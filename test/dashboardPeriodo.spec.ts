// Dashboard period filter (Resultado consolidado / Financiamentos) and the detail endpoints:
// a whole year by range equals the year view, and every detail list adds up to the value on screen.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const db = (env as unknown as { DB: D1Database }).DB;
const BASE = 'https://worker.test';

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
}

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'BB', '001')`).run();
	await db
		.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS'), (25, 'contaCorrente', 1, 'BB JPT')`)
		.run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (30, 'Agricultura', 'CUSTEIO', 'RECEITA'),
			 (40, 'Insumos', 'CUSTEIO', 'DESPESA'), (41, 'Insumos', 'CUSTEIO', NULL),
			 (50, 'Máquinas', 'INVESTIMENTO', 'DESPESA')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, tipoMovimento, modalidadeMovimento, idCentroCustos) VALUES
			 (1, '2026-02-10T00:00:00.000Z', 'Venda soja', 24, 1000, 0, 'a', 'C', 'padrao', 30),
			 (2, '2026-05-10T00:00:00.000Z', 'Venda milho', 24, 2000, 0, 'b', 'C', 'padrao', 30),
			 (3, '2026-02-15T00:00:00.000Z', 'Compra rateada', 24, -500, 0, 'c', 'D', 'padrao', NULL),
			 (4, '2026-03-01T00:00:00.000Z', 'Adubo', 24, -100, 0, 'd', 'D', 'padrao', 41),
			 (5, '2025-12-20T00:00:00.000Z', 'Venda dezembro', 24, 700, 0, 'e', 'C', 'padrao', 30),
			 (6, '2026-02-20T00:00:00.000Z', 'Semente', 25, -50, 0, 'f', 'D', 'padrao', 40)`,
		)
		.run();
	await db
		.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (3, 40, 300), (3, 50, 200)`)
		.run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, responsavel, dataContrato, valor, numeroContrato) VALUES
			 (1, 1, 'GJN', '2025-06-06', 1000, 'A-1'), (2, 1, 'JPT', '2026-02-15', 5000, 'B-2')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
			 (1, 300, 'Liquidado', 1, '2026-03-15', '2026-03-10'),
			 (1, 450, 'Aberto', 2, '2027-06-15', NULL),
			 (2, 3000, 'Aberto', 1, '2027-02-15', NULL),
			 (2, 3000, 'Aberto', 2, '2028-02-15', NULL)`,
		)
		.run();
}

async function getJson<T>(path: string): Promise<T> {
	const res = await SELF.fetch(`${BASE}${path}`);
	expect(res.status, path).toBe(200);
	return (await res.json()) as T;
}

type Linha = { descricao: string; valor: number; tipoMovimento: string; subtipoDespesa?: string; idsCentros?: number[] };
type Periodo = { receitasAgrupadoPorCentros: Linha[]; agrupadoPor: Linha[]; semCentroCustos: { receitas: number; despesas: number } };

const ordenar = (rows: Linha[]) =>
	rows.map((r) => [r.descricao, r.subtipoDespesa ?? '', Math.round(r.valor * 100) / 100, r.idsCentros]).sort((a, b) => String(a).localeCompare(String(b)));

describe('dashboard: filtro de período e detalhamentos', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	it('ano inteiro por intervalo == ano do /api/dashboard (mesmo motor)', async () => {
		const ano = await getJson<{ receitasDespesas: Periodo }>(`/api/dashboard?ano=2026&contas=24,25`);
		const periodo = await getJson<Periodo>(`/api/dashboard/periodo?inicio=2026-01-01&fim=2027-01-01&contas=24,25`);
		expect(ordenar(periodo.receitasAgrupadoPorCentros)).toEqual(ordenar(ano.receitasDespesas.receitasAgrupadoPorCentros));
		expect(ordenar(periodo.agrupadoPor)).toEqual(ordenar(ano.receitasDespesas.agrupadoPor));
		// Same label in two centres: one row with both ids (the detail lists both)
		expect(periodo.agrupadoPor.find((r) => r.descricao === 'Insumos')).toMatchObject({ valor: 450, idsCentros: [40, 41] });
	});

	it('trimestre e últimos 12 meses (cruzando o ano)', async () => {
		const t1 = await getJson<Periodo>(`/api/dashboard/periodo?inicio=2026-01-01&fim=2026-04-01`);
		expect(t1.receitasAgrupadoPorCentros.map((r) => r.valor)).toEqual([1000]);
		const doze = await getJson<Periodo>(`/api/dashboard/periodo?inicio=2025-11-01&fim=2026-11-01`);
		expect(doze.receitasAgrupadoPorCentros.map((r) => r.valor)).toEqual([3700]);
		// Account filter
		const so25 = await getJson<Periodo>(`/api/dashboard/periodo?inicio=2026-01-01&fim=2027-01-01&contas=25`);
		expect(so25.agrupadoPor.map((r) => [r.descricao, r.valor])).toEqual([['Insumos', 50]]);
	});

	it('detalhar: lançamentos somam o valor da linha (rateio e centro único)', async () => {
		const periodo = await getJson<Periodo>(`/api/dashboard/periodo?inicio=2026-01-01&fim=2027-01-01`);
		for (const linha of [...periodo.receitasAgrupadoPorCentros, ...periodo.agrupadoPor]) {
			const tipo = linha.tipoMovimento;
			const movs = await getJson<Array<{ id: number; data: string; historico: string; conta: string; valor: number }>>(
				`/api/dashboard/detalhar?tipo=${tipo}&centros=${linha.idsCentros!.join(',')}&inicio=2026-01-01&fim=2027-01-01`,
			);
			expect(Math.round(movs.reduce((s, m) => s + m.valor, 0) * 100) / 100, linha.descricao).toBe(linha.valor);
		}
		const insumos = await getJson<Array<{ id: number; data: string; historico: string; conta: string; valor: number }>>(
			`/api/dashboard/detalhar?tipo=D&centros=40,41&inicio=2026-01-01&fim=2027-01-01`,
		);
		expect(insumos).toEqual([
			{ id: 3, data: '2026-02-15', historico: 'Compra rateada', conta: 'BB GFS', valor: 300 },
			{ id: 6, data: '2026-02-20', historico: 'Semente', conta: 'BB JPT', valor: 50 },
			{ id: 4, data: '2026-03-01', historico: 'Adubo', conta: 'BB GFS', valor: 100 },
		]);
	});

	it('rejeita período inválido', async () => {
		for (const q of ['inicio=2026-01-01', 'inicio=2026-04-01&fim=2026-01-01', 'inicio=2020-01-01&fim=2030-01-01', 'inicio=x&fim=y']) {
			const res = await SELF.fetch(`${BASE}/api/dashboard/periodo?${q}`);
			expect(res.status, q).toBe(400);
		}
		const semCentro = await SELF.fetch(`${BASE}/api/dashboard/detalhar?tipo=C&inicio=2026-01-01&fim=2027-01-01`);
		expect(semCentro.status).toBe(400);
	});

	it('financiamentos: saldo devedor por intervalo e contratos que somam os quadros', async () => {
		type Mes = { ano: number; mes: number; saldoInicial: number; quitados: number; creditosNovos: number; saldoFinal: number };
		const t1 = await getJson<Mes[]>(`/api/dashboard/financiamentos?tipo=saldo-devedor&inicio=2026-01-01&fim=2026-04-01`);
		expect(t1.map((m) => [m.ano, m.mes])).toEqual([[2026, 1], [2026, 2], [2026, 3]]);
		expect(t1[0].saldoInicial).toBe(750);
		expect(t1[2].saldoFinal).toBe(750 + 6000 - 300);

		// Future years load too (parcelas already registered)
		const futuro = await getJson<Mes[]>(`/api/dashboard/financiamentos?tipo=saldo-devedor&inicio=2031-01-01&fim=2032-01-01`);
		expect(futuro).toHaveLength(12);

		type Contrato = { numeroContrato: string; credor: string; valorNoPeriodo: number; parcelas: unknown[] };
		const c = await getJson<{ novos: Contrato[]; quitados: Contrato[] }>(
			`/api/dashboard/financiamentos?tipo=contratos-periodo&inicio=2026-01-01&fim=2026-04-01`,
		);
		const soma = (k: 'quitados' | 'creditosNovos') => t1.reduce((s, m) => s + m[k], 0);
		expect(c.novos.map((x) => [x.numeroContrato, x.credor, x.valorNoPeriodo])).toEqual([['B-2', 'BB', 6000]]);
		expect(c.novos.reduce((s, x) => s + x.valorNoPeriodo, 0)).toBe(soma('creditosNovos'));
		expect(c.quitados.map((x) => [x.numeroContrato, x.valorNoPeriodo, x.parcelas.length])).toEqual([['A-1', 300, 1]]);
		expect(c.quitados.reduce((s, x) => s + x.valorNoPeriodo, 0)).toBe(soma('quitados'));
	});
});
