// Integration: the result screens must agree. For one period, Relatório Centro de Custos totals
// (receitas, custeio, investimento) == Dashboard == Fluxo de Caixa (centros); Itens Classificados (Plano de
// Contas report) has the same despesas, but only the receitas WITH plan (credits without plan are receitas by
// centre and stay out of that plan-based report — client request),
// using the single "pendente" rule (isMovimentoPendenteConcilacao) for every status filter, the
// notification bell and the Conciliação list/exports.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { SignJWT } from 'jose';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

// When a JWT_SECRET reaches the pool (e.g. a local .dev.vars), call the API as a real signed-in user.
let authHeader: Record<string, string> = {};
async function prepararAuth() {
	const secret = (env as unknown as { JWT_SECRET?: string }).JWT_SECRET;
	if (!secret) return;
	await db.prepare(`INSERT INTO usuario (id, nome, usuario, email, senha) VALUES (1, 'Teste', 'teste', 'teste@fazenda.test', 'x')`).run();
	const token = await new SignJWT({ id: 1, email: 'teste@fazenda.test' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(secret));
	authHeader = { Authorization: `Bearer ${token}` };
}

function api(path: string, init: RequestInit = {}) {
	return SELF.fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), ...authHeader } });
}

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
}

type Mov = {
	id: number;
	valor: number;
	tipo: 'C' | 'D';
	historico: string;
	dt?: string;
	plano?: number | null;
	centro?: number | null;
	modalidade?: string;
	idFinanciamento?: number | null;
	resultado?: Array<[number, number]>;
	mcc?: Array<[number, number]>;
};

const DT = '2026-10-13T00:00:00.000Z';

// Centres: 10/11 receita (tipo CUSTEIO, the default for receitas), 20/21 custeio, 30 investimento
const MOVS: Mov[] = [
	{ id: 1, valor: 10000, tipo: 'C', historico: 'Venda leite (só centro)', centro: 10 },
	{ id: 2, valor: 3000, tipo: 'C', historico: 'Venda grãos (plano + centro)', plano: 110, centro: 11, resultado: [[110, 3000]] },
	{ id: 3, valor: -2000, tipo: 'D', historico: 'Insumos', plano: 300, centro: 20, resultado: [[300, 2000]] },
	{ id: 4, valor: -5000, tipo: 'D', historico: 'Trator', plano: 301, centro: 30, resultado: [[301, 5000]] },
	// rateio across a custeio and an investimento centre (idPlanoContas/idCentroCustos NULL)
	{ id: 5, valor: -1200, tipo: 'D', historico: 'Rateio 2 centros', resultado: [[300, 1200]], mcc: [[20, 700], [30, 500]] },
	// transfers (one "classified as revenue" with a centre): outside the results
	{ id: 6, valor: -4000, tipo: 'D', historico: 'Transferência saída', plano: 173, modalidade: 'transferencia', resultado: [[173, 4000]] },
	{ id: 7, valor: 4000, tipo: 'C', historico: 'Transferência entrada', plano: 173, centro: 10, modalidade: 'transferencia', resultado: [[173, 4000]] },
	// financing: contract payment, and a padrão debit on the Parametros financing plan
	{ id: 8, valor: -1500, tipo: 'D', historico: 'Parcela financiamento', centro: 20, modalidade: 'financiamento', idFinanciamento: 1 },
	{ id: 9, valor: -800, tipo: 'D', historico: 'Pagamento financiamento (plano)', plano: 400, centro: 20, resultado: [[400, 800]] },
	// estorno: child of plano 170 ("Movimentação Bancária")
	{ id: 10, valor: 600, tipo: 'C', historico: 'Estorno movimentação interna', plano: 172, centro: 10, resultado: [[172, 600]] },
	// debit in a RECEITA centre → despesa (custeio); credit in a DESPESA centre → receita
	{ id: 11, valor: -1000, tipo: 'D', historico: 'Débito em centro de receita', plano: 300, centro: 10, resultado: [[300, 1000]] },
	{ id: 12, valor: 250, tipo: 'C', historico: 'Crédito em centro de despesa', centro: 20 },
	// pending (new rule): debit with centre without plan / credit without centre / debit with plan without centre
	{ id: 13, valor: -350, tipo: 'D', historico: 'Débito sem plano', centro: 21 },
	{ id: 14, valor: 150, tipo: 'C', historico: 'Crédito sem centro' },
	{ id: 15, valor: -90, tipo: 'D', historico: 'Débito sem centro', plano: 300, resultado: [[300, 90]] },
	// last day of the month (ISO timestamp) and a movement of the next month
	{ id: 16, valor: 500, tipo: 'C', historico: 'Venda último dia', centro: 11, dt: '2026-10-31T00:00:00.000Z' },
	{ id: 17, valor: 777, tipo: 'C', historico: 'Venda novembro', centro: 10, dt: '2026-11-05T00:00:00.000Z' },
	// financing without contract: pending, outside the results
	{ id: 18, valor: -300, tipo: 'D', historico: 'Financiamento sem contrato', modalidade: 'financiamento' },
];

const PENDENTES = [13, 14, 15, 18];

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '001')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel, numConta) VALUES (24, 'contaCorrente', 1, 'BB GFS', '123')`).run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo, idReferente) VALUES
			 (100, 1, '001', 'Receitas', 'custeio', NULL),
			 (101, 2, '001.001', 'Receitas operacionais', 'custeio', 100),
			 (110, 3, '001.001.001', 'Venda de grãos', 'custeio', 101),
			 (200, 1, '002', 'Despesas', 'custeio', NULL),
			 (201, 2, '002.001', 'Despesas operacionais', 'custeio', 200),
			 (300, 3, '002.001.001', 'Insumos', 'custeio', 201),
			 (301, 3, '002.001.002', 'Máquinas', 'custeio', 201),
			 (400, 3, '002.001.009', 'Pagamento financiamentos', 'custeio', 201),
			 (170, 1, '003', 'Movimentação Bancária', 'custeio', NULL),
			 (172, 2, '003.002', 'Estornos movimentação interna', 'custeio', 170),
			 (173, 2, '003.003', 'Transferência entre contas', 'custeio', 170)`,
		)
		.run();
	await db
		.prepare(`INSERT INTO parametros (id, idPlanoTransferenciaEntreContas, idPlanoPagamentoFinanciamentos) VALUES (1, 173, 400)`)
		.run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (10, 'Venda Leite', 'CUSTEIO', 'RECEITA'),
			 (11, 'Venda Grãos', 'CUSTEIO', 'RECEITA'),
			 (20, 'Insumos', 'CUSTEIO', 'DESPESA'),
			 (21, 'Pastagem', 'CUSTEIO', 'DESPESA'),
			 (30, 'Máquinas', 'INVESTIMENTO', 'DESPESA')`,
		)
		.run();
	await db
		.prepare(`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato, idBanco) VALUES (1, 'GFS', '2025-01-10', 10000, 'C1', 1)`)
		.run();
	for (const m of MOVS) {
		const dt = m.dt ?? DT;
		await db
			.prepare(
				`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, identificador_ofx,
				 tipoMovimento, modalidadeMovimento, idFinanciamento, idCentroCustos, parcelado)
				 VALUES (?, ?, ?, ?, 24, ?, 0, ?, ?, ?, ?, ?, 0)`,
			)
			.bind(m.id, dt, m.historico, m.plano ?? null, m.valor, `FIT${m.id}`, m.tipo, m.modalidade ?? 'padrao', m.idFinanciamento ?? null, m.centro ?? null)
			.run();
		for (const [idPlano, valor] of m.resultado ?? []) {
			await db
				.prepare(`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo) VALUES (?, ?, ?, 24, ?, ?)`)
				.bind(dt, m.id, idPlano, valor, m.tipo)
				.run();
		}
		for (const [idCentro, valor] of m.mcc ?? []) {
			await db
				.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, ?, ?)`)
				.bind(m.id, idCentro, valor)
				.run();
		}
	}
}

const PERIODO = 'dataInicio=2026-10-01&dataFim=2026-10-31';
const ESPERADO = { receitas: 13750, custeio: 4050, investimento: 5500 };
/** Plano de Contas report: only credits WITH plan (mov 2, "Venda de grãos"); receitas by centre are left out. */
const RECEITAS_COM_PLANO = 3000;

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));

type GrupoCentro = {
	centro: {
		id: number;
		descricao: string;
		tipo?: string;
		tipoReceitaDespesa?: string;
		semCentro?: boolean;
		subtipoDespesa?: 'custeio' | 'investimento';
	};
	total: number;
	movimentos: Array<{ id: number; valor: number; tipoMovimento: string; pendente?: boolean; planoDescricao?: string }>;
};

type ItemClassificado = {
	id: number;
	valor: number;
	tipoMovimento: string;
	idPlanoContas?: number;
	planoDescricao?: string;
	centroCustosDescricao?: string;
	centroCustosTipo?: string | null;
	semCentro?: boolean;
	semPlano?: boolean;
	pendente?: boolean;
	subtipoDespesa?: 'custeio' | 'investimento';
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await api(path, init);
	expect(res.status).toBe(200);
	return (await res.json()) as T;
}

async function getSheetRows(path: string, sheetIndex = 0): Promise<unknown[][]> {
	const res = await api(path);
	expect(res.status).toBe(200);
	const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
	const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
	return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
}

/** Same aggregation the screen does (RelatorioCentroCustos.tsx). */
function totaisCentroCustos(grupos: GrupoCentro[]) {
	const comCentro = grupos.filter((g) => !g.centro.semCentro);
	const despesas = comCentro.filter((g) => g.centro.tipoReceitaDespesa === 'DESPESA');
	return {
		receitas: soma(comCentro.filter((g) => g.centro.tipoReceitaDespesa === 'RECEITA').map((g) => g.total)),
		custeio: soma(despesas.filter((g) => g.centro.subtipoDespesa === 'custeio').map((g) => g.total)),
		investimento: soma(despesas.filter((g) => g.centro.subtipoDespesa === 'investimento').map((g) => g.total)),
	};
}

/** Same aggregation the screen does (RelatorioItensClassificados.tsx). */
function totaisItens(itens: ItemClassificado[]) {
	const comCentro = itens.filter((i) => !i.semCentro);
	return {
		receitas: soma(comCentro.filter((i) => i.tipoMovimento === 'C').map((i) => i.valor)),
		custeio: soma(comCentro.filter((i) => i.tipoMovimento === 'D' && i.subtipoDespesa === 'custeio').map((i) => i.valor)),
		investimento: soma(comCentro.filter((i) => i.tipoMovimento === 'D' && i.subtipoDespesa === 'investimento').map((i) => i.valor)),
	};
}

async function totaisDashboard() {
	const data = await getJson<{
		receitasDespesas: {
			receitasAgrupadoPorCentros: Array<{ valor: number }>;
			agrupadoPor: Array<{ valor: number; tipoMovimento: string; subtipoDespesa?: string }>;
		};
	}>(`/api/dashboard?ano=2026&mes=10&contas=24`);
	const rd = data.receitasDespesas;
	const d = rd.agrupadoPor.filter((r) => r.tipoMovimento === 'D');
	return {
		receitas: soma(rd.receitasAgrupadoPorCentros.map((r) => r.valor)),
		custeio: soma(d.filter((r) => r.subtipoDespesa === 'custeio').map((r) => r.valor)),
		investimento: soma(d.filter((r) => r.subtipoDespesa === 'investimento').map((r) => r.valor)),
	};
}

async function totaisFluxo() {
	const { dadosMensais } = await getJson<{
		dadosMensais: Array<{ receitas: Record<string, number>; despesas: Record<string, { filhos: Record<string, number> }> }>;
	}>(`/api/fluxoCaixa`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano: '2026', contas: ['24'], tipoAgrupamento: 'centros' }),
	});
	const out = dadosMensais[9];
	return {
		receitas: soma(Object.values(out.receitas)),
		custeio: soma(Object.values(out.despesas['1000']?.filhos ?? {})),
		investimento: soma(Object.values(out.despesas['2000']?.filhos ?? {})),
	};
}

const idsDe = (grupos: GrupoCentro[]) => [...new Set(grupos.flatMap((g) => g.movimentos.map((m) => m.id)))].sort((a, b) => a - b);

describe('Relatórios × Dashboard × Fluxo: mesmos totais', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
		await prepararAuth();
	});

	it('Centro de Custos == Dashboard == Fluxo (centros); Itens Classificados: same despesas, receitas only with plan', async () => {
		const cc = totaisCentroCustos(await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`));
		const dash = await totaisDashboard();
		const fluxo = await totaisFluxo();
		const itens = totaisItens(await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}`));
		expect(dash).toEqual(ESPERADO);
		expect(fluxo).toEqual(ESPERADO);
		expect(cc).toEqual(ESPERADO);
		// New rule: the plan-based report leaves out receitas classified only by centre (they are in the
		// Centro de Custos report), so its receitas are NOT the Dashboard receitas; despesas still match.
		expect(itens).toEqual({ ...ESPERADO, receitas: RECEITAS_COM_PLANO });
	});

	describe('Relatório Centro de Custos', () => {
		it('groups by movement direction: debit in a RECEITA centre is a despesa, credit in a DESPESA centre is a receita', async () => {
			const grupos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`);
			const despesaNaReceita = grupos.find((g) => g.centro.id === 10 && g.centro.tipoReceitaDespesa === 'DESPESA')!;
			expect(despesaNaReceita.movimentos.map((m) => m.id)).toEqual([11]);
			expect(despesaNaReceita.centro.subtipoDespesa).toBe('custeio');
			const receitaVendaLeite = grupos.find((g) => g.centro.id === 10 && g.centro.tipoReceitaDespesa === 'RECEITA')!;
			expect(receitaVendaLeite.total).toBe(10000);
			const receitaNaDespesa = grupos.find((g) => g.centro.id === 20 && g.centro.tipoReceitaDespesa === 'RECEITA')!;
			expect(receitaNaDespesa.movimentos.map((m) => m.id)).toEqual([12]);
		});

		it('excludes transfers and children of 170; financing stays in its own block (outside the totals)', async () => {
			const grupos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`);
			const ids = idsDe(grupos);
			for (const fora of [6, 7, 10, 17]) expect(ids).not.toContain(fora);
			const fin = grupos.filter((g) => g.centro.tipoReceitaDespesa === 'FINANCIAMENTO');
			expect(idsDe(fin)).toEqual([8, 9, 18]);
			const operacionais = grupos.filter((g) => g.centro.tipoReceitaDespesa !== 'FINANCIAMENTO');
			expect(idsDe(operacionais).some((id) => [8, 9, 18].includes(id))).toBe(false);
		});

		it('status filter uses the single pendente rule (Todos = Conciliados + Pendentes)', async () => {
			const todos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`);
			const conc = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}&status=conciliados`);
			const pend = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}&status=pendentes`);
			expect(idsDe(pend)).toEqual(PENDENTES);
			expect(idsDe(conc).some((id) => PENDENTES.includes(id))).toBe(false);
			expect([...idsDe(conc), ...idsDe(pend)].sort((a, b) => a - b)).toEqual(idsDe(todos));
			// debit with centre and no plan: pending, shown under its centre
			const pastagem = pend.find((g) => g.centro.id === 21)!;
			expect(pastagem.movimentos.map((m) => m.id)).toEqual([13]);
			expect(pastagem.movimentos[0].pendente).toBe(true);
			// without centre: "Sem centro de custos", flagged and outside the totals
			const semCentro = pend.filter((g) => g.centro.semCentro);
			expect(idsDe(semCentro)).toEqual([14, 15, 18]);
			expect(totaisCentroCustos(conc)).toEqual({ ...ESPERADO, custeio: ESPERADO.custeio - 350 });
		});

		it('Excel shows Saldo operacional (A = R − custeio) and Saldo após investimentos (C = R − todas as despesas)', async () => {
			const rows = await getSheetRows(`/api/relatorio/centro-custos/excel?${PERIODO}`);
			const linha = (prefixo: string) => rows.find((r) => String(r[0]).startsWith(prefixo))!;
			expect(linha('Total Receitas')[1]).toBe(ESPERADO.receitas);
			expect(linha('Total Despesas')[2]).toBe(ESPERADO.custeio);
			expect(linha('Total Despesas')[3]).toBe(ESPERADO.investimento);
			expect(linha('Saldo operacional')[1]).toBe(ESPERADO.receitas - ESPERADO.custeio);
			expect(linha('Saldo após investimentos')[1]).toBe(ESPERADO.receitas - ESPERADO.custeio - ESPERADO.investimento);
		});

		it('PDF is generated', async () => {
			const res = await api(`/api/relatorio/centro-custos/pdf?${PERIODO}`);
			expect(res.status).toBe(200);
			expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
		});
	});

	describe('Relatório Itens Classificados', () => {
		it('leaves out credits without plan (receitas by centre: Centro de Custos report); credits with plan stay', async () => {
			const todos = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}`);
			const ids = new Set(todos.map((i) => i.id));
			// 1, 12, 16: receitas classified only by centre; 14: credit without centre and plan (pending in Centro de Custos)
			for (const fora of [1, 12, 14, 16]) expect(ids.has(fora)).toBe(false);
			expect(todos.some((i) => i.tipoMovimento === 'C' && (i.semPlano || !i.planoDescricao))).toBe(false);
			const vendaGraos = todos.find((i) => i.id === 2)!;
			expect(vendaGraos.planoDescricao).toBe('Venda de grãos');
			expect(vendaGraos.valor).toBe(RECEITAS_COM_PLANO);
			// "Sem plano" now only lists debits pending classification
			expect([...new Set(todos.filter((i) => i.semPlano).map((i) => i.id))]).toEqual([13]);
			expect(todos.find((i) => i.id === 13)!.tipoMovimento).toBe('D');
			const conc = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&status=conciliados`);
			expect(totaisItens(conc)).toEqual({ receitas: RECEITAS_COM_PLANO, custeio: ESPERADO.custeio - 350, investimento: ESPERADO.investimento });
		});

		it('applies the base exclusions (transfers, financing, children of 170)', async () => {
			const itens = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}`);
			const ids = new Set(itens.map((i) => i.id));
			for (const fora of [6, 7, 8, 9, 10, 17, 18]) expect(ids.has(fora)).toBe(false);
		});

		it('status filter works; a debit without centre is "Sem centro", never investimento', async () => {
			const pend = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&status=pendentes`);
			// 14 (credit without centre and plan) is not here anymore: no plan → Centro de Custos report
			expect([...new Set(pend.map((i) => i.id))].sort((a, b) => a - b)).toEqual([13, 15]);
			const semCentro = pend.find((i) => i.id === 15)!;
			expect(semCentro.semCentro).toBe(true);
			expect(semCentro.subtipoDespesa).toBeUndefined();
			expect(semCentro.centroCustosDescricao).toBe('Sem centro');
			const conc = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&status=conciliados`);
			expect(conc.some((i) => PENDENTES.includes(i.id))).toBe(false);
		});

		it('Excel: TOTAL matches the screen and sem-centro values stay out of the custeio/investimento columns', async () => {
			const rows = await getSheetRows(`/api/relatorio/itens-classificados/excel?${PERIODO}`);
			const header = rows.find((r) => r[0] === 'Data')!;
			const total = rows.find((r) => r[0] === 'TOTAL')!;
			expect(header[2]).toBe('Receitas (com plano de contas)');
			expect(total[2]).toBe(RECEITAS_COM_PLANO);
			// No "Receitas − Despesas" line (it would not be the real result) and a note pointing to the other report
			expect(rows.some((r) => String(r[0]).startsWith('SALDO'))).toBe(false);
			expect(rows.some((r) => String(r[0]).includes('Relatório de Centro de Custos'))).toBe(true);
			expect(rows.some((r) => r[1] === 'Venda leite (só centro)')).toBe(false);
			expect(rows.find((r) => String(r[0]).startsWith('Plano de Contas:'))![0]).toBe('Plano de Contas: Todos');
			expect(total[3]).toBe(ESPERADO.custeio);
			expect(total[4]).toBe(ESPERADO.investimento);
			const linha15 = rows.find((r) => r[1] === 'Débito sem centro')!;
			expect(linha15[3]).toBe('');
			expect(linha15[4]).toBe('');
			expect(linha15[header.indexOf('Despesa sem centro (pendente)')]).toBe(90);
			const res = await api(`/api/relatorio/itens-classificados/pdf?${PERIODO}`);
			expect(res.status).toBe(200);
		});

		it('planoContasId filter: only that plan (split movements included), totals and exports follow it', async () => {
			const insumos = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&planoContasId=300`);
			expect(insumos.every((i) => i.idPlanoContas === 300)).toBe(true);
			// 5 = split (idPlanoContas NULL, plan only in Resultado); 15 = debit without centre (pending, outside the totals)
			expect([...new Set(insumos.map((i) => i.id))].sort((a, b) => a - b)).toEqual([3, 5, 11, 15]);
			const esperado300 = { receitas: 0, custeio: 2000 + 700 + 1000, investimento: 500 };
			expect(totaisItens(insumos)).toEqual(esperado300);

			const rows = await getSheetRows(`/api/relatorio/itens-classificados/excel?${PERIODO}&planoContasId=300`);
			expect(rows.find((r) => String(r[0]).startsWith('Plano de Contas:'))![0]).toBe('Plano de Contas: 002.001.001 - Insumos');
			const total = rows.find((r) => r[0] === 'TOTAL')!;
			expect(total[1]).toBe('4 movimento(s)');
			expect(total[3]).toBe(esperado300.custeio);
			expect(total[4]).toBe(esperado300.investimento);
			expect(rows.some((r) => r[1] === 'Trator')).toBe(false);

			const pdf = await api(`/api/relatorio/itens-classificados/pdf?${PERIODO}&planoContasId=300`);
			expect(pdf.status).toBe(200);
			expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(0);

			// A receita plan: only its credits; combined with the status filter
			const graos = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&planoContasId=110`);
			expect(graos.map((i) => i.id)).toEqual([2]);
			expect(totaisItens(graos)).toEqual({ receitas: RECEITAS_COM_PLANO, custeio: 0, investimento: 0 });
			const pend300 = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&planoContasId=300&status=pendentes`);
			expect([...new Set(pend300.map((i) => i.id))]).toEqual([15]);
		});
	});

	describe('Pendente: notificações e Conciliação', () => {
		it('bell count/list use the single rule (split and financing with contract are not pending)', async () => {
			const total = await getJson<{ total: number }>(`/api/notificacoes/total`);
			expect(total.total).toBe(PENDENTES.length);
			const lista = await getJson<Array<{ idContaCorrente: number; quantidadePendentes: number; dataInicial: string; dataFinal: string }>>(
				`/api/notificacoes/conciliacao`,
			);
			expect(lista).toHaveLength(1);
			expect(lista[0].quantidadePendentes).toBe(PENDENTES.length);
		});

		it('Conciliação list: pendentes/conciliados partition all movements, count matches', async () => {
			type Pagina = { movimentos: Array<{ id: number }>; total: number };
			const pend = await getJson<Pagina>(`/api/movBancario/paginado?page=1&limit=100&status=pendentes`);
			expect(pend.movimentos.map((m) => m.id).sort((a, b) => a - b)).toEqual(PENDENTES);
			expect(pend.total).toBe(PENDENTES.length);
			const conc = await getJson<Pagina>(`/api/movBancario/paginado?page=1&limit=100&status=conciliados`);
			expect(conc.total).toBe(MOVS.length - PENDENTES.length);
			expect(conc.movimentos.some((m) => PENDENTES.includes(m.id))).toBe(false);
		});

		it('Conciliação exports: Status column follows the rule', async () => {
			const rows = await getSheetRows(`/api/movBancario/export`);
			const header = rows.find((r) => r[0] === 'Data do Movimento')!;
			const col = header.indexOf('Status');
			expect(col).toBeGreaterThan(0);
			const status = (hist: string) => rows.find((r) => r[1] === hist)![col];
			expect(status('Rateio 2 centros')).toBe('Conciliado');
			expect(status('Venda leite (só centro)')).toBe('Conciliado');
			expect(status('Parcela financiamento')).toBe('Conciliado');
			expect(status('Débito sem plano')).toBe('Pendente');
			expect(status('Débito sem centro')).toBe('Pendente');
			const soPend = await getSheetRows(`/api/movBancario/export?status=pendentes`);
			const hist = soPend.map((r) => r[1]);
			expect(hist).toContain('Débito sem plano');
			expect(hist).not.toContain('Rateio 2 centros');
			const pdf = await api(`/api/movBancario/export-pdf?status=pendentes`);
			expect(pdf.status).toBe(200);
		});
	});

	describe('Cadastro › Centro de Custos: movimentos por centro', () => {
		type Grupo = { idCentroCustos: number; totalReceitas: number; totalDespesas: number; saldoLiquido: number; movimentos: Array<{ id: number; valor: number }> };

		it('keeps the last day of the period, splits rateio by centre and matches the report', async () => {
			const grupos = await getJson<Grupo[]>(`/api/movBancario/por-centro-custos?${PERIODO}`);
			const vendaGraos = grupos.find((g) => g.idCentroCustos === 11)!;
			expect(vendaGraos.movimentos.map((m) => m.id).sort((a, b) => a - b)).toEqual([2, 16]);
			expect(vendaGraos.totalReceitas).toBe(3500);
			const maquinas = grupos.find((g) => g.idCentroCustos === 30)!;
			expect(maquinas.totalDespesas).toBe(5500);
			expect(maquinas.saldoLiquido).toBe(-5500);
			const ids = new Set(grupos.flatMap((g) => g.movimentos.map((m) => m.id)));
			expect(ids.has(17)).toBe(false); // next month
			for (const fora of [6, 7, 8, 9, 10]) expect(ids.has(fora)).toBe(false);
			expect(soma(grupos.map((g) => g.totalReceitas))).toBe(ESPERADO.receitas);
			expect(soma(grupos.map((g) => g.totalDespesas))).toBe(ESPERADO.custeio + ESPERADO.investimento);
		});
	});
});
