// Integration tests: renegociação de contratos (POST /api/financiamento/:id/renegociar, GET .../renegociacoes)
// against an isolated local D1 seeded with the production schema snapshot (without the renegotiation table:
// the backend creates it at runtime, like migration_renegociacao.sql).
// Storage is rolled back after each test, so every test renegotiates from the same seed.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import migrationRenegociacaoSql from '../migration_renegociacao.sql?raw';
import migrationCaixaSql from '../migration_caixa.sql?raw';
import migrationCaixaV2Sql from '../migration_caixa_v2.sql?raw';
import { garantirSchemaRenegociacao, RenegociacaoRepository } from '../backend/src/repositories/RenegociacaoRepository';
import { validarRenegociacao } from '../backend/src/utils/renegociacao';
import { RegistroEmUsoError } from '../backend/src/utils/verificarUsoRegistro';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

async function applySql(sqlText: string) {
	const statements = sqlText
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
}

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001'), (2, 'Sicredi', '748')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
	await db.prepare(`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (1, 1, '001', 'Financiamentos', 'despesa')`).run();
	await db
		.prepare(
			`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, tipoMovimento) VALUES
			 (900, '2026-06-10T00:00:00.000Z', 'Pagamento parcela', 24, -100000, 0, 'ofx-900', 'D')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, totalJuros, numeroContrato, numeroGarantia, observacao, modalidade) VALUES
			 (1, 1, NULL, 'GFS', '2024-01-10', 1000000, 8, 0, 'BB-100', 'G-1', 'Custeio safra', 'CUSTEIO'),
			 (2, 2, NULL, 'JPT', '2025-03-01', 150000, 10, 0, 'SIC-200', NULL, NULL, 'INVESTIMENTO'),
			 (3, 1, NULL, 'GFS', '2025-05-01', 200000, 9, 0, 'BB-300', NULL, NULL, 'CUSTEIO'),
			 (4, 1, NULL, 'GFS', '2025-05-01', 90000, 9, 0, 'BB-400', NULL, NULL, 'CUSTEIO'),
			 (5, 2, NULL, 'MLF', '2025-07-01', 80000, 11, 0, 'SIC-500', NULL, NULL, 'CUSTEIO')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (id, idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao, idMovimentoBancario) VALUES
			 (11, 1, 200000, 'Liquidado', 1, '2025-01-10', '2025-01-09', NULL),
			 (12, 1, 200000, 'Liquidado', 2, '2026-01-10', '2026-01-10', NULL),
			 (13, 1, 300000, 'Aberto',    3, '2027-01-10', NULL, NULL),
			 (14, 1, 300000, 'Aberto',    4, '2028-01-10', NULL, NULL),
			 (21, 2, 50000,  'Liquidado', 1, '2026-03-01', '2026-03-01', NULL),
			 (22, 2, 50000,  'Aberto',    2, '2027-03-01', NULL, NULL),
			 (23, 2, 50000,  'Aberto',    3, '2028-03-01', NULL, NULL),
			 (31, 3, 100000, 'Vencido',   1, '2026-06-10', NULL, 900),
			 (32, 3, 100000, 'Aberto',    2, '2027-06-10', NULL, NULL),
			 (41, 4, 45000,  'Aberto',    1, '2027-05-01', NULL, NULL),
			 (42, 4, 45000,  'Aberto',    2, '2028-05-01', NULL, NULL),
			 (51, 5, 40000,  'Aberto',    1, '2027-07-01', NULL, NULL),
			 (52, 5, 40000,  'Aberto',    2, '2028-07-01', NULL, NULL)`,
		)
		.run();
	// parcela 41 has a Resultado row (no movement): it cannot be replaced either
	await db
		.prepare(
			`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, idParcelaFinanciamento, valor, tipo)
			 VALUES ('2026-05-01', NULL, 1, 24, 41, 45000, 'D')`,
		)
		.run();
	// Caixa tab choices for open parcelas of contract 2
	await db.prepare(`INSERT INTO caixaParcelaConsiderada (idParcela, considerar) VALUES (22, 0), (21, 1)`).run();
}

async function call(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method };
	if (body !== undefined) {
		init.headers = { 'Content-Type': 'application/json' };
		init.body = JSON.stringify(body);
	}
	const res = await SELF.fetch(`${BASE}${path}`, init);
	const text = await res.text();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
}

type Parcela = { id: number; numParcela: number; valor: number; status: string; dt_vencimento: string; dt_liquidacao: string | null };

async function parcelasDo(idFinanciamento: number): Promise<Parcela[]> {
	const { results } = await db
		.prepare(`SELECT id, numParcela, valor, status, dt_vencimento, dt_liquidacao FROM parcelaFinanciamento WHERE idFinanciamento = ? ORDER BY numParcela`)
		.bind(idFinanciamento)
		.all<Parcela>();
	return results ?? [];
}

type Mes = {
	ano: number;
	mes: number;
	saldoInicial: number;
	quitados: number;
	creditosNovos: number;
	contratosNovos: number;
	renegociacoes: number;
	saldoFinal: number;
};

async function saldoDevedor(inicio: string, fim: string): Promise<Mes[]> {
	const { status, body } = await call('GET', `/api/dashboard/financiamentos?tipo=saldo-devedor&inicio=${inicio}&fim=${fim}`);
	expect(status).toBe(200);
	return body as Mes[];
}

const PARCELAS_ADITIVO = [
	{ dt_vencimento: '2027-01-10', valor: 210000 },
	{ dt_vencimento: '2028-01-10', valor: 210000 },
	{ dt_vencimento: '2029-01-10', valor: 210000.5 },
];

const NOVO_CONTRATO = {
	tipo: 'NOVO_CONTRATO',
	novoContrato: { numeroContrato: 'SIC-200-R', dataContrato: '2026-10-15', valor: 100000, taxaJurosAnual: 12 },
	observacao: 'Prorrogação pedida ao banco',
	parcelas: [
		{ dt_vencimento: '2027-10-15', valor: 40000 },
		{ dt_vencimento: '2028-10-15', valor: 40000 },
		{ dt_vencimento: '2029-10-15', valor: 40000 },
	],
};

describe('renegociação de contratos', () => {
	beforeAll(async () => {
		await applySql(schemaSql);
		await applySql(migrationCaixaSql);
		await applySql(migrationCaixaV2Sql);
		await seed();
	});

	it('cria a tabela e a coluna de forma idempotente (runtime e migration)', async () => {
		const existe = async () => {
			const t = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financiamentoRenegociacao'`).all();
			const c = await db.prepare(`PRAGMA table_info(Financiamento)`).all<{ name: string }>();
			return { tabela: t.results.length, coluna: c.results.filter((r) => r.name === 'idFinanciamentoOrigem').length };
		};
		expect(await existe()).toEqual({ tabela: 0, coluna: 0 });
		await garantirSchemaRenegociacao(db);
		await garantirSchemaRenegociacao(db);
		expect(await existe()).toEqual({ tabela: 1, coluna: 1 });
		// the API keeps working on an already-created schema
		expect((await call('GET', '/api/financiamento')).status).toBe(200);
	});

	it('migration_renegociacao.sql cria o mesmo schema e o runtime não falha depois dela', async () => {
		await applySql(migrationRenegociacaoSql);
		await garantirSchemaRenegociacao(db);
		const c = await db.prepare(`PRAGMA table_info(financiamentoRenegociacao)`).all<{ name: string }>();
		expect(c.results.map((r) => r.name)).toEqual([
			'id',
			'idFinanciamento',
			'tipo',
			'dataRenegociacao',
			'idFinanciamentoNovo',
			'parcelasAnteriores',
			'parcelasNovas',
			'condicoesAnteriores',
			'observacao',
			'criadoEm',
		]);
		expect((await call('GET', '/api/financiamento/1/renegociacoes')).body).toEqual([]);
	});

	it('aditivo: substitui só as parcelas em aberto, mantém as pagas e muda as condições', async () => {
		const { status, body } = await call('POST', '/api/financiamento/1/renegociar', {
			tipo: 'ADITIVO',
			dataRenegociacao: '2026-10-29',
			condicoes: { valor: 1200000, taxaJurosAnual: 9.5 },
			parcelas: PARCELAS_ADITIVO,
		});
		expect(status).toBe(200);
		expect(body).toEqual({
			idFinanciamento: 1,
			idFinanciamentoNovo: null,
			parcelasRemovidas: 2,
			valorRemovido: 600000,
			parcelasCriadas: 3,
			valorCriado: 630000.5,
		});

		const parcelas = await parcelasDo(1);
		// paid ones untouched (same ids, values, dates); the open ones were replaced, numbering continues after 2
		expect(parcelas.slice(0, 2)).toEqual([
			{ id: 11, numParcela: 1, valor: 200000, status: 'Liquidado', dt_vencimento: '2025-01-10', dt_liquidacao: '2025-01-09' },
			{ id: 12, numParcela: 2, valor: 200000, status: 'Liquidado', dt_vencimento: '2026-01-10', dt_liquidacao: '2026-01-10' },
		]);
		expect(parcelas.slice(2).map((p) => [p.numParcela, p.dt_vencimento, p.valor, p.status])).toEqual([
			[3, '2027-01-10', 210000, 'Aberto'],
			[4, '2028-01-10', 210000, 'Aberto'],
			[5, '2029-01-10', 210000.5, 'Aberto'],
		]);
		expect(parcelas.some((p) => p.id === 13 || p.id === 14)).toBe(false);

		const contrato = await db.prepare(`SELECT * FROM Financiamento WHERE id = 1`).first<Record<string, unknown>>();
		expect(contrato).toMatchObject({
			numeroContrato: 'BB-100',
			valor: 1200000,
			taxaJurosAnual: 9.5,
			modalidade: 'CUSTEIO',
			numeroGarantia: 'G-1',
			observacao: 'Custeio safra\nAditivo em 29/10/2026',
			dataVencimentoPrimeiraParcela: '2025-01-10',
			dataVencimentoUltimaParcela: '2029-01-10',
			idFinanciamentoOrigem: null,
		});

		const historico = await call('GET', '/api/financiamento/1/renegociacoes');
		expect(historico.status).toBe(200);
		expect(historico.body).toHaveLength(1);
		expect(historico.body[0]).toMatchObject({
			idFinanciamento: 1,
			numeroContrato: 'BB-100',
			tipo: 'ADITIVO',
			dataRenegociacao: '2026-10-29',
			idFinanciamentoNovo: null,
			parcelasAnteriores: [
				{ numParcela: 3, dt_vencimento: '2027-01-10', valor: 300000, status: 'Aberto' },
				{ numParcela: 4, dt_vencimento: '2028-01-10', valor: 300000, status: 'Aberto' },
			],
			condicoesAnteriores: { valor: 1000000, taxaJurosAnual: 8, modalidade: 'CUSTEIO', numeroContrato: 'BB-100', numeroGarantia: 'G-1' },
		});

		// the list keeps it as an active contract with one aditivo (not "Renegociado")
		const lista = (await call('GET', '/api/financiamento')).body as Array<Record<string, unknown>>;
		expect(lista.find((f) => f.id === 1)).toMatchObject({ renegociadoEm: null, qtdRenegociacoes: 1, ultimoAditivoEm: '2026-10-29' });
	});

	it('novo contrato: encerra o antigo, cria o novo com origem e o saldo devedor muda só pela diferença', async () => {
		const periodo = ['2025-01-01', '2027-01-01'] as const;
		const antes = await saldoDevedor(...periodo);

		const { status, body } = await call('POST', '/api/financiamento/2/renegociar', NOVO_CONTRATO);
		expect(status).toBe(200);
		expect(body).toMatchObject({ idFinanciamento: 2, parcelasRemovidas: 2, valorRemovido: 100000, parcelasCriadas: 3, valorCriado: 120000 });
		const idNovo = body.idFinanciamentoNovo as number;
		expect(idNovo).toBeGreaterThan(5);

		// old contract: only the paid parcela is left, observation says where the debt went
		expect((await parcelasDo(2)).map((p) => p.id)).toEqual([21]);
		const antigo = await db.prepare(`SELECT * FROM Financiamento WHERE id = 2`).first<Record<string, unknown>>();
		expect(antigo).toMatchObject({
			valor: 150000,
			observacao: 'Renegociado em 15/10/2026 → contrato SIC-200-R — Prorrogação pedida ao banco',
			dataVencimentoUltimaParcela: '2026-03-01',
		});

		// new contract: defaults from the old one (credor, tomador), modalidade Renegociação, juros = parcelas − valor
		const novo = await db.prepare(`SELECT * FROM Financiamento WHERE id = ?`).bind(idNovo).first<Record<string, unknown>>();
		expect(novo).toMatchObject({
			idBanco: 2,
			idPessoa: null,
			responsavel: 'JPT',
			numeroContrato: 'SIC-200-R',
			dataContrato: '2026-10-15',
			valor: 100000,
			taxaJurosAnual: 12,
			totalJuros: 20000,
			modalidade: 'RENEGOCIACAO',
			idFinanciamentoOrigem: 2,
			dataVencimentoPrimeiraParcela: '2027-10-15',
			dataVencimentoUltimaParcela: '2029-10-15',
		});
		expect((await parcelasDo(idNovo)).map((p) => [p.numParcela, p.valor, p.status])).toEqual([
			[1, 40000, 'Aberto'],
			[2, 40000, 'Aberto'],
			[3, 40000, 'Aberto'],
		]);

		// Caixa choice of the removed parcela is gone; the paid one keeps its choice
		const caixa = await db.prepare(`SELECT idParcela FROM caixaParcelaConsiderada ORDER BY idParcela`).all<{ idParcela: number }>();
		expect(caixa.results.map((r) => r.idParcela)).toEqual([21]);

		// saldo devedor today (end of the period) = before − removed + new; quitados never change
		const depois = await saldoDevedor(...periodo);
		const ultimo = (m: Mes[]) => m[m.length - 1];
		expect(ultimo(depois).saldoFinal).toBe(ultimo(antes).saldoFinal - 100000 + 120000);
		expect(depois.map((m) => m.quitados)).toEqual(antes.map((m) => m.quitados));
		// months before the renegotiation keep the debt they had (the replaced parcelas come from the history)
		const ateSetembro = (m: Mes[]) => m.filter((x) => x.ano < 2026 || x.mes < 10);
		expect(ateSetembro(depois)).toEqual(ateSetembro(antes));
		// October: not new credit — the difference shows as "renegociações" and the card's formula still adds up
		const outubro = (m: Mes[]) => m.find((x) => x.ano === 2026 && x.mes === 10)!;
		expect(outubro(depois).saldoInicial).toBe(outubro(antes).saldoInicial);
		expect(outubro(depois).creditosNovos).toBe(outubro(antes).creditosNovos);
		expect(outubro(depois).contratosNovos).toBe(outubro(antes).contratosNovos);
		expect(outubro(depois).renegociacoes - outubro(antes).renegociacoes).toBe(20000);
		for (const m of depois) {
			expect(m.saldoFinal).toBeCloseTo(m.saldoInicial - m.quitados + m.creditosNovos + m.renegociacoes, 2);
		}

		// history row with the snapshot of what was removed
		const historico = (await call('GET', '/api/financiamento/2/renegociacoes')).body;
		expect(historico).toHaveLength(1);
		expect(historico[0]).toMatchObject({
			tipo: 'NOVO_CONTRATO',
			dataRenegociacao: '2026-10-15',
			idFinanciamentoNovo: idNovo,
			numeroContratoNovo: 'SIC-200-R',
			observacao: 'Prorrogação pedida ao banco',
			parcelasAnteriores: [
				{ numParcela: 2, dt_vencimento: '2027-03-01', valor: 50000, status: 'Aberto' },
				{ numParcela: 3, dt_vencimento: '2028-03-01', valor: 50000, status: 'Aberto' },
			],
		});
		// the new contract's details show the same renegotiation (where it came from)
		expect((await call('GET', `/api/financiamento/${idNovo}/renegociacoes`)).body).toHaveLength(1);

		const lista = (await call('GET', '/api/financiamento')).body as Array<Record<string, unknown>>;
		expect(lista.find((f) => f.id === 2)).toMatchObject({
			renegociadoEm: '2026-10-15',
			idFinanciamentoNovo: idNovo,
			numeroContratoNovo: 'SIC-200-R',
			qtdRenegociacoes: 1,
		});
		expect(lista.find((f) => f.id === idNovo)).toMatchObject({ idFinanciamentoOrigem: 2, numeroContratoOrigem: 'SIC-200', renegociadoEm: null });
	});

	it('relatório: o contrato renegociado aparece como "Renegociado", nunca como quitado', async () => {
		expect((await call('POST', '/api/financiamento/2/renegociar', NOVO_CONTRATO)).status).toBe(200);
		// contract 5 has no paid parcela: after renegotiating it has no parcelas at all
		const r5 = await call('POST', '/api/financiamento/5/renegociar', {
			...NOVO_CONTRATO,
			novoContrato: { ...NOVO_CONTRATO.novoContrato, numeroContrato: 'SIC-500-R' },
		});
		expect(r5.status).toBe(200);

		const { status, body: r } = await call('GET', '/api/relatorio/financiamentos?ano=2026');
		expect(status).toBe(200);
		const porId = new Map((r.contratos as Array<Record<string, unknown>>).map((c) => [c.idFinanciamento, c]));
		expect(porId.get(2)).toMatchObject({ ativo: false, valorVincendo: 0, renegociadoEm: '2026-10-15', numeroContratoNovo: 'SIC-200-R' });
		expect(porId.get(2)?.dataQuitacao).toBeUndefined();
		expect(porId.get(5)).toMatchObject({ ativo: false, renegociadoEm: '2026-10-15' });

		// contract 2 paid a parcela in 2026: listed in "Liquidados", as renegotiated (not quitado)
		const liq2 = (r.liquidados.contratos as Array<Record<string, unknown>>).find((c) => c.idFinanciamento === 2);
		expect(liq2).toEqual({ idFinanciamento: 2, valor: 50000, quitado: false, renegociado: true });
		expect(r.liquidados.renegociados).toBe(1);
		expect(r.liquidados.quitados + r.liquidados.amortizados + r.liquidados.renegociados).toBe(r.liquidados.quantidade);

		// active contracts: the new ones, never the closed ones
		const ativos = (r.ativos.contratos as Array<{ idFinanciamento: number }>).map((c) => c.idFinanciamento);
		expect(ativos).not.toContain(2);
		expect(ativos).not.toContain(5);
		expect(ativos).toContain(r5.body.idFinanciamentoNovo);
		// a contract born from a renegotiation is not "contratado no período" (not new credit, like the Dashboard)
		const contratados = (r.contratados.contratos as Array<{ idFinanciamento: number }>).map((c) => c.idFinanciamento);
		expect(contratados).not.toContain(r5.body.idFinanciamentoNovo);
		const outubro = (r.graficos.novosXLiquidados as Array<{ ano: number; mes: number; novos: { valor: number } }>).find(
			(m) => m.ano === 2026 && m.mes === 10,
		);
		expect(outubro?.novos.valor).toBe(0);
	});

	it('recusa (409) quando uma parcela em aberto está vinculada a lançamento ou a resultado; nada muda', async () => {
		const mov = await call('POST', '/api/financiamento/3/renegociar', {
			tipo: 'ADITIVO',
			dataRenegociacao: '2026-10-29',
			parcelas: [{ dt_vencimento: '2027-06-10', valor: 210000 }],
		});
		expect(mov.status).toBe(409);
		expect(mov.body.error).toContain('a parcela em aberto 1 (vinculada a lançamento bancário)');
		expect((await parcelasDo(3)).map((p) => p.id)).toEqual([31, 32]);

		const res = await call('POST', '/api/financiamento/4/renegociar', { ...NOVO_CONTRATO, novoContrato: { ...NOVO_CONTRATO.novoContrato, numeroContrato: 'X' } });
		expect(res.status).toBe(409);
		expect(res.body.error).toContain('1 (com lançamento de resultado)');
		expect((await parcelasDo(4)).map((p) => p.id)).toEqual([41, 42]);
		const novos = await db.prepare(`SELECT COUNT(*) AS n FROM Financiamento`).first<{ n: number }>();
		expect(novos?.n).toBe(5);
		expect((await call('GET', '/api/financiamento/4/renegociacoes')).body).toEqual([]);
	});

	it('valida os dados (400) e o contrato (404)', async () => {
		const base = { tipo: 'ADITIVO', dataRenegociacao: '2026-10-29', parcelas: [{ dt_vencimento: '2027-01-10', valor: 1000 }] };
		const erro = async (id: number, body: unknown) => {
			const r = await call('POST', `/api/financiamento/${id}/renegociar`, body);
			return [r.status, r.body.error];
		};
		expect(await erro(1, { ...base, parcelas: [] })).toEqual([400, 'Informe ao menos uma parcela nova.']);
		expect(await erro(1, { ...base, parcelas: [{ dt_vencimento: '2027-02-30', valor: 10 }] })).toEqual([
			400,
			'Parcela 1: informe uma data de vencimento válida.',
		]);
		expect(await erro(1, { ...base, parcelas: [{ dt_vencimento: '2027-02-10', valor: 0 }] })).toEqual([
			400,
			'Parcela 1: o valor deve ser maior que zero.',
		]);
		expect(await erro(1, { ...base, parcelas: [{ numParcela: 2, dt_vencimento: '2027-02-10', valor: 10 }] })).toEqual([
			400,
			'O número de parcela 2 já é de uma parcela paga deste contrato.',
		]);
		expect(await erro(2, { ...NOVO_CONTRATO, novoContrato: { ...NOVO_CONTRATO.novoContrato, numeroContrato: 'sic-200' } })).toEqual([
			400,
			'O novo contrato tem o mesmo número deste. Para manter o número, escolha "Aditivo (mesmo contrato)".',
		]);
		expect(await erro(99, base)).toEqual([404, 'Financiamento não encontrado']);
		// dates: not after today, not before the contract (contract 1 is from 10/01/2024)
		expect(await erro(1, { ...base, dataRenegociacao: '2099-01-01' })).toEqual([400, 'A data do aditivo (01/01/2099) não pode ser depois de hoje.']);
		expect(await erro(1, { ...base, dataRenegociacao: '2023-12-31' })).toEqual([
			400,
			'A data do aditivo (31/12/2023) não pode ser antes da data do contrato (10/01/2024).',
		]);
		expect(await erro(2, { ...NOVO_CONTRATO, novoContrato: { ...NOVO_CONTRATO.novoContrato, dataContrato: '2099-01-01' } })).toEqual([
			400,
			'A data da renegociação (01/01/2099) não pode ser depois de hoje.',
		]);
		// a renegotiated contract has nothing open to renegotiate again
		expect((await call('POST', '/api/financiamento/2/renegociar', NOVO_CONTRATO)).status).toBe(200);
		expect(await erro(2, base)).toEqual([400, 'Este contrato não tem parcelas em aberto para renegociar.']);
		expect((await call('GET', '/api/financiamento/x/renegociacoes')).status).toBe(400);
	});

	it('Fluxo de Caixa: "Créditos novos" não muda no mês do contrato antigo e o contrato novo não é crédito novo', async () => {
		const fluxo = async (ano: string) =>
			(await call('POST', '/api/fluxoCaixa', { ano, contas: [], tipoAgrupamento: 'centros' })).body.dadosMensais as Array<{
				financiamentos: { contratados: Record<string, { valor: number }> };
			}>;
		const soma = (o: Record<string, { valor: number }>) => Object.values(o).reduce((s, v) => s + v.valor, 0);
		const detalhe = async (ano: string, mes: number) =>
			(await call('GET', `/api/fluxoCaixa/detalhar?planoId=todos&mes=${mes}&tipo=financiamentos&subtipo=contratados&ano=${ano}&tipoAgrupamento=centros`))
				.body as Array<{ numeroContrato: string; parcelas: Array<{ valor: number; status: string }> }>;
		const marco2025 = soma((await fluxo('2025'))[2].financiamentos.contratados);
		expect(marco2025).toBe(150000 + 0); // contract 2 (SIC-200), signed 01/03/2025

		expect((await call('POST', '/api/financiamento/2/renegociar', NOVO_CONTRATO)).status).toBe(200);

		// the old contract's month keeps its parcelas (the replaced ones come from the history)
		expect(soma((await fluxo('2025'))[2].financiamentos.contratados)).toBe(marco2025);
		const d = await detalhe('2025', 2);
		expect(d.map((c) => c.numeroContrato)).toEqual(['SIC-200']);
		expect(d[0].parcelas.map((p) => [p.valor, p.status])).toEqual([
			[50000, 'Liquidado'],
			[50000, 'Renegociada'],
			[50000, 'Renegociada'],
		]);
		// the new contract (15/10/2026) is not new credit, in the cell nor in the detail
		expect(soma((await fluxo('2026'))[9].financiamentos.contratados)).toBe(0);
		expect(await detalhe('2026', 9)).toEqual([]);
	});

		it('aditivo com data anterior ao último aditivo é recusado', async () => {
		const primeiro = await call('POST', '/api/financiamento/1/renegociar', { tipo: 'ADITIVO', dataRenegociacao: '2026-09-10', parcelas: PARCELAS_ADITIVO });
		expect(primeiro.status).toBe(200);
		const r = await call('POST', '/api/financiamento/1/renegociar', { tipo: 'ADITIVO', dataRenegociacao: '2026-09-01', parcelas: PARCELAS_ADITIVO });
		expect([r.status, r.body.error]).toEqual([400, 'A data do aditivo (01/09/2026) não pode ser antes da última renegociação deste contrato (10/09/2026).']);
	});

	it('se uma parcela muda entre a leitura e a gravação, nada é gravado (409)', async () => {
		// another request pays parcela 14 right before the renegotiation batch runs
		const dbComConcorrencia = new Proxy(db, {
			get(alvo, prop) {
				if (prop === 'batch') {
					return async (stmts: D1PreparedStatement[]) => {
						if (stmts.length >= 6) {
							await alvo.prepare(`UPDATE parcelaFinanciamento SET status = 'Liquidado', dt_liquidacao = '2026-10-29' WHERE id = 14`).run();
						}
						return alvo.batch(stmts);
					};
				}
				const v = Reflect.get(alvo, prop);
				return typeof v === 'function' ? v.bind(alvo) : v;
			},
		});
		const validado = validarRenegociacao({ tipo: 'ADITIVO', dataRenegociacao: '2026-10-29', parcelas: PARCELAS_ADITIVO });
		if (!validado.ok) throw new Error(validado.erro);
		await expect(new RenegociacaoRepository(dbComConcorrencia).renegociar(1, validado.dados)).rejects.toBeInstanceOf(RegistroEmUsoError);
		// nothing deleted, nothing inserted, no history
		expect((await parcelasDo(1)).map((p) => [p.id, p.status])).toEqual([
			[11, 'Liquidado'],
			[12, 'Liquidado'],
			[13, 'Aberto'],
			[14, 'Liquidado'],
		]);
		expect((await call('GET', '/api/financiamento/1/renegociacoes')).body).toEqual([]);
	});

	it('excluir o contrato novo ou o antigo continua funcionando e limpa os vínculos', async () => {
		const { body } = await call('POST', '/api/financiamento/2/renegociar', NOVO_CONTRATO);
		const idNovo = body.idFinanciamentoNovo as number;

		expect((await call('DELETE', `/api/financiamento/${idNovo}`)).status).toBe(200);
		const historico = (await call('GET', '/api/financiamento/2/renegociacoes')).body;
		expect(historico[0]).toMatchObject({ tipo: 'NOVO_CONTRATO', idFinanciamentoNovo: null });

		expect((await call('DELETE', '/api/financiamento/2')).status).toBe(200);
		const resto = await db.prepare(`SELECT COUNT(*) AS n FROM financiamentoRenegociacao`).first<{ n: number }>();
		expect(resto?.n).toBe(0);
	});
});
