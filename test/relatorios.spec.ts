// Integration tests: Relatórios (Centro de Custos / Itens Classificados), conciliation list
// "Pendentes" filters/exports and Fluxo detail (planos), against an isolated local D1 seeded
// with the production schema snapshot. Focus: split movements (rateio) with idPlanoContas NULL.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import schemaSql from './fixtures/schema.sql?raw';
import { formatarDataISO } from '../frontend/src/Utils/formatarData';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) {
		await db.prepare(sql).run();
	}
}

const DT = '2026-10-13T00:00:00.000Z';

type Mov = {
	id: number;
	valor: number;
	tipo: 'C' | 'D' | null;
	historico: string;
	plano?: number | null;
	centro?: number | null;
	modalidade?: string | null;
	idFinanciamento?: number | null;
	resultado?: Array<[number, number]>;
	mcc?: Array<[number, number]>;
};

// M1 is the review case: R$10.000 expense split into 2 plans and 2 centres (idPlanoContas/idCentroCustos NULL)
const MOVS: Mov[] = [
	{ id: 1, valor: -10000, tipo: 'D', historico: 'M1 rateio', resultado: [[300, 6000], [301, 4000]], mcc: [[37, 7000], [50, 3000]] },
	{ id: 2, valor: -500, tipo: 'D', historico: 'M2 simples', plano: 300, centro: 42, resultado: [[300, 500]] },
	{ id: 3, valor: 2000, tipo: 'C', historico: 'M3 receita', plano: 110, centro: 60, resultado: [[110, 2000]] },
	{ id: 4, valor: -300, tipo: 'D', historico: 'M4 pendente debito' },
	{ id: 5, valor: 150, tipo: 'C', historico: 'M5 pendente credito' },
	// Fluxo excludes these from the plano 300 cell
	{ id: 7, valor: -150, tipo: 'D', historico: 'M7 plano filho 170', resultado: [[300, 100], [171, 50]] },
	{ id: 8, valor: -90, tipo: 'D', historico: 'M8 plano financiamento', resultado: [[300, 60], [400, 30]] },
	{ id: 9, valor: -70, tipo: 'D', historico: 'M9 sem modalidade', plano: 300, modalidade: null, resultado: [[300, 70]] },
	// Classified expense without any centre (centre tipo unknown)
	{ id: 10, valor: -250, tipo: 'D', historico: 'M10 sem centro', plano: 301, resultado: [[301, 250]] },
	// Financing credit with centre
	{ id: 11, valor: 5000, tipo: 'C', historico: 'M11 financiamento', centro: 61, modalidade: 'financiamento', idFinanciamento: 1 },
];

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '001')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo, idReferente) VALUES
			 (100, 1, '001', 'Receitas', 'custeio', NULL),
			 (101, 2, '001.001', 'Receitas operacionais', 'custeio', 100),
			 (110, 3, '001.001.001', 'Venda de leite', 'custeio', 101),
			 (200, 1, '002', 'Despesas', 'custeio', NULL),
			 (201, 2, '002.001', 'Despesas operacionais', 'custeio', 200),
			 (300, 3, '002.001.001', 'Planos de saúde', 'custeio', 201),
			 (301, 3, '002.001.002', 'Manutenção', 'custeio', 201),
			 (170, 2, '002.009', 'Bloqueados', 'custeio', 200),
			 (171, 3, '002.009.001', 'Filho de 170', 'custeio', 170),
			 (400, 3, '002.001.009', 'Pagamento financiamentos', 'custeio', 201)`,
		)
		.run();
	await db.prepare(`INSERT INTO parametros (id, idPlanoPagamentoFinanciamentos) VALUES (1, 400)`).run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (37, 'Administrativo', 'CUSTEIO', 'DESPESA'),
			 (42, 'Leite', 'CUSTEIO', 'DESPESA'),
			 (50, 'Leite', 'INVESTIMENTO', 'DESPESA'),
			 (60, 'Venda Leite', 'CUSTEIO', 'RECEITA'),
			 (61, 'Crédito rural', 'CUSTEIO', 'RECEITA')`,
		)
		.run();
	for (const m of MOVS) {
		await db
			.prepare(
				`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, identificador_ofx,
				 tipoMovimento, modalidadeMovimento, idFinanciamento, idCentroCustos, parcelado)
				 VALUES (?, ?, ?, ?, 24, ?, 0, ?, ?, ?, ?, ?, 0)`,
			)
			.bind(
				m.id,
				DT,
				m.historico,
				m.plano ?? null,
				m.valor,
				`FIT${m.id}`,
				m.tipo,
				m.modalidade === undefined ? 'padrao' : m.modalidade,
				m.idFinanciamento ?? null,
				m.centro ?? null,
			)
			.run();
		for (const [idPlano, valor] of m.resultado ?? []) {
			await db
				.prepare(
					`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo) VALUES (?, ?, ?, 24, ?, ?)`,
				)
				.bind(DT, m.id, idPlano, valor, m.tipo ?? 'D')
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

type ItemClassificado = {
	id: number;
	valor: number;
	tipoMovimento: string;
	idPlanoContas?: number;
	planoDescricao?: string;
	centroCustosDescricao?: string;
	centroCustosTipo?: string | null;
	semCentro?: boolean;
	subtipoDespesa?: 'custeio' | 'investimento';
};

type GrupoCentro = {
	centro: { id: number; descricao: string; tipo?: string; tipoReceitaDespesa?: string };
	total: number;
	movimentos: Array<{ id: number; valor: number; planoDescricao?: string }>;
};

async function getJson<T>(path: string): Promise<T> {
	const res = await SELF.fetch(`${BASE}${path}`);
	expect(res.status).toBe(200);
	return (await res.json()) as T;
}

async function getSheetRows(path: string, sheetIndex = 0): Promise<unknown[][]> {
	const res = await SELF.fetch(`${BASE}${path}`);
	expect(res.status).toBe(200);
	const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
	const ws = wb.Sheets[wb.SheetNames[sheetIndex]];
	return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
}

const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe('Relatórios com movimentos rateados (idPlanoContas NULL)', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	describe('Itens Classificados', () => {
		it('includes the split expense, broken down by plan (Resultado) and centre', async () => {
			const itens = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}`);
			const m1 = itens.filter((i) => i.id === 1);
			expect(m1.length).toBeGreaterThan(0);
			expect(soma(m1.map((i) => i.valor))).toBe(10000);
			expect(soma(m1.filter((i) => i.idPlanoContas === 300).map((i) => i.valor))).toBe(6000);
			expect(soma(m1.filter((i) => i.idPlanoContas === 301).map((i) => i.valor))).toBe(4000);
			expect(m1.find((i) => i.idPlanoContas === 300)?.planoDescricao).toBe('Planos de saúde');
			expect(soma(m1.filter((i) => i.centroCustosTipo === 'CUSTEIO').map((i) => i.valor))).toBe(7000);
			expect(soma(m1.filter((i) => i.centroCustosTipo === 'INVESTIMENTO').map((i) => i.valor))).toBe(3000);
			// pending movements (single rule) are not classified
			const conciliados = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}&status=conciliados`);
			expect(conciliados.some((i) => i.id === 4 || i.id === 5)).toBe(false);
		});

		it('Excel: split expense counted; an expense without centre is pending ("sem centro"), never Investimento', async () => {
			const itens = await getJson<ItemClassificado[]>(`/api/relatorio/itens-classificados?${PERIODO}`);
			const rows = await getSheetRows(`/api/relatorio/itens-classificados/excel?${PERIODO}`);
			const header = rows.find((r) => r[0] === 'Data')!;
			const total = rows.find((r) => r[0] === 'TOTAL')!;
			const despesas = itens.filter((i) => i.tipoMovimento === 'D' && !i.semCentro);
			const custeio = soma(despesas.filter((i) => i.subtipoDespesa === 'custeio').map((i) => i.valor));
			const invest = soma(despesas.filter((i) => i.subtipoDespesa === 'investimento').map((i) => i.valor));
			expect(total[3]).toBe(custeio);
			expect(total[4]).toBe(invest);
			expect(custeio + invest).toBe(soma(despesas.map((i) => i.valor)));
			expect(despesas.some((i) => i.id === 1)).toBe(true);
			const linhaM10 = rows.find((r) => r[1] === 'M10 sem centro')!;
			expect(linhaM10[3]).toBe('');
			expect(linhaM10[4]).toBe('');
			expect(linhaM10[header.indexOf('Despesa sem centro (pendente)')]).toBe(250);
		});
	});

	describe('Centro de Custos', () => {
		it('includes the split expense in each centre with its share and lists its plans', async () => {
			const grupos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`);
			const adm = grupos.find((g) => g.centro.id === 37)!;
			const leiteInv = grupos.find((g) => g.centro.id === 50)!;
			expect(adm.movimentos.find((m) => m.id === 1)?.valor).toBe(7000);
			expect(leiteInv.movimentos.find((m) => m.id === 1)?.valor).toBe(3000);
			const plano = adm.movimentos.find((m) => m.id === 1)?.planoDescricao ?? '';
			expect(plano).toContain('Planos de saúde');
			expect(plano).toContain('Manutenção');
			const totalDespesas = soma(grupos.filter((g) => g.centro.tipoReceitaDespesa === 'DESPESA').map((g) => g.total));
			expect(totalDespesas).toBeGreaterThanOrEqual(10500);
		});

		it('status=pendentes returns the pending movements by the single rule (credits without centre included)', async () => {
			const grupos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}&status=pendentes`);
			const ids = grupos.flatMap((g) => g.movimentos.map((m) => m.id)).sort((a, b) => a - b);
			// debits without centre (M8 on the financing plan → financing block, M9, M10) are pending too; M7 (170) is out
			expect(ids).toEqual([4, 5, 8, 9, 10]);
			const receita = grupos.find((g) => g.centro.tipoReceitaDespesa === 'RECEITA')!;
			const despesa = grupos.find((g) => g.centro.tipoReceitaDespesa === 'DESPESA')!;
			expect(receita.total).toBe(150);
			expect(despesa.total).toBe(620);
		});

		it('filtering by centroCustosId returns only that centre share', async () => {
			const grupos = await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}&centroCustosId=37`);
			expect(grupos.every((g) => g.centro.id === 37)).toBe(true);
			expect(soma(grupos.map((g) => g.total))).toBe(7000);
		});

		it('Excel: financing has its own column and Saldo operacional = Receitas − Despesas de custeio', async () => {
			const grupos = (await getJson<GrupoCentro[]>(`/api/relatorio/centro-custos?${PERIODO}`)).filter(
				(g) => !(g.centro as { semCentro?: boolean }).semCentro,
			);
			const receitas = soma(grupos.filter((g) => g.centro.tipoReceitaDespesa === 'RECEITA').map((g) => g.total));
			const custeio = soma(
				grupos
					.filter((g) => g.centro.tipoReceitaDespesa === 'DESPESA' && (g.centro as { subtipoDespesa?: string }).subtipoDespesa === 'custeio')
					.map((g) => g.total),
			);
			expect(grupos.some((g) => g.centro.tipoReceitaDespesa === 'FINANCIAMENTO')).toBe(true);

			const rows = await getSheetRows(`/api/relatorio/centro-custos/excel?${PERIODO}`);
			const header = rows.find((r) => r[0] === 'Centro de Custos')!;
			expect(header).toContain('Financiamentos');
			const colFin = header.indexOf('Financiamentos');
			const totalFin = rows.find((r) => r[0] === 'Total Financiamentos')!;
			expect(totalFin[1]).toBe('');
			expect(totalFin[colFin]).toBe(5000);
			const finRow = rows.find((r) => r[0] === 'Crédito rural')!;
			expect(finRow[1]).toBe('');
			expect(finRow[colFin]).toBe(5000);
			const saldo = rows.find((r) => String(r[0]).startsWith('Saldo operacional'))!;
			expect(saldo[1]).toBe(soma([receitas, -custeio]));
		});
	});

	describe('Conciliação: lista paginada e exportações', () => {
		type Pagina = { movimentos: Array<{ id: number }>; total: number };

		it('Pendentes do not include split (already classified) movements', async () => {
			const pag = await getJson<Pagina>(`/api/movBancario/paginado?page=1&limit=50&status=pendentes`);
			const ids = pag.movimentos.map((m) => m.id).sort((a, b) => a - b);
			// single rule: debits without cost centre (M7–M10) are pending; M1 (split) and M11 (financing with contract) are not
			expect(ids).toEqual([4, 5, 7, 8, 9, 10]);
			expect(pag.total).toBe(6);
		});

		it('planosIds and centrosIds filters match split movements', async () => {
			const porPlano = await getJson<Pagina>(`/api/movBancario/paginado?page=1&limit=50&planosIds=301`);
			expect(porPlano.movimentos.map((m) => m.id).sort((a, b) => a - b)).toEqual([1, 10]);
			const porCentro = await getJson<Pagina>(`/api/movBancario/paginado?page=1&limit=50&centrosIds=50`);
			expect(porCentro.movimentos.map((m) => m.id)).toEqual([1]);
			expect(porCentro.total).toBe(1);
		});

		it('Excel "Apenas Pendentes" lists only unclassified movements', async () => {
			const rows = await getSheetRows(`/api/movBancario/export?status=pendentes`);
			const historicos = rows.map((r) => r[1]);
			expect(historicos).toContain('M4 pendente debito');
			expect(historicos).toContain('M5 pendente credito');
			expect(historicos).not.toContain('M1 rateio');
		});

		it('Excel (todos) shows the split plans instead of "Não definido"', async () => {
			const rows = await getSheetRows(`/api/movBancario/export`);
			const header = rows.find((r) => r[0] === 'Data do Movimento')!;
			const m1 = rows.find((r) => r[1] === 'M1 rateio')!;
			const plano = String(m1[header.indexOf('Plano de Contas')]);
			expect(plano).toContain('Planos de saúde');
			expect(plano).toContain('Manutenção');
		});

		it('PDF "Apenas Pendentes" is generated', async () => {
			const res = await SELF.fetch(`${BASE}/api/movBancario/export-pdf?status=pendentes`);
			expect(res.status).toBe(200);
			expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
		});
	});

	describe('Fluxo de Caixa: detalhamento por plano', () => {
		it('modal total equals the Fluxo cell (170 children, financing plans, non-padrão excluded)', async () => {
			const res = await SELF.fetch(`${BASE}/api/fluxoCaixa`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ano: '2026', contas: ['24'], tipoAgrupamento: 'planos' }),
			});
			expect(res.status).toBe(200);
			const { dadosMensais } = (await res.json()) as {
				dadosMensais: Array<{ despesas: Record<string, { filhos: Record<string, number> }> }>;
			};
			const celula = dadosMensais[9].despesas['201'].filhos['300'];
			expect(celula).toBe(6500);

			const params = new URLSearchParams({ planoId: '300', mes: '9', tipo: 'despesas', ano: '2026', tipoAgrupamento: 'planos', contas: '24' });
			const detalhe = await getJson<Array<{ id: number; valor: number }>>(`/api/fluxoCaixa/detalhar?${params}`);
			expect(soma(detalhe.map((d) => d.valor))).toBe(celula);
			expect(detalhe.map((d) => d.id).sort((a, b) => a - b)).toEqual([1, 2]);
		});
	});
});

describe('formatarDataISO (datas sem deslocamento de fuso)', () => {
	it('formats the calendar date of the ISO text, ignoring the time/zone', () => {
		expect(formatarDataISO('2026-10-13T00:00:00.000Z')).toBe('13/10/2026');
		expect(formatarDataISO('2026-10-13')).toBe('13/10/2026');
		expect(formatarDataISO('2026-10-13 23:59:59')).toBe('13/10/2026');
		expect(formatarDataISO('')).toBe('');
		expect(formatarDataISO(undefined)).toBe('');
	});
});
