// Integration: the Conciliação exports (Excel/PDF) must list exactly the movements of the screen —
// the same plan / centre (including split movements), "histórico contém" and valor filters as
// /api/movBancario/paginado, not only conta/período/status. Isolated local D1 with the schema snapshot.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const DT = '2026-10-13T00:00:00.000Z';

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
	historico: string;
	conta?: number;
	dt?: string;
	plano?: number | null;
	centro?: number | null;
	resultado?: Array<[number, number]>;
	mcc?: Array<[number, number]>;
};

const MOVS: Mov[] = [
	{ id: 1, valor: -2000, historico: 'Insumos adubo', plano: 300, centro: 20, resultado: [[300, 2000]] },
	// split in plans and centres: idPlanoContas / idCentroCustos NULL, found only through Resultado / MovimentoCentroCustos
	{ id: 2, valor: -1200, historico: 'Rateio dois centros', resultado: [[300, 600], [301, 600]], mcc: [[20, 700], [30, 500]] },
	{ id: 3, valor: -1234.56, historico: 'Peça do trator', plano: 301, centro: 30, resultado: [[301, 1234.56]] },
	{ id: 4, valor: 10000, historico: 'Venda leite', centro: 10 },
	{ id: 5, valor: -350, historico: 'Pastagem sem plano', centro: 21 },
	// other account and next month: never in the account 24 / October exports
	{ id: 6, valor: -500, historico: 'Insumos outra conta', conta: 25, plano: 300, centro: 20, resultado: [[300, 500]] },
	{ id: 7, valor: -800, historico: 'Insumos novembro', dt: '2026-11-05T00:00:00.000Z', plano: 300, centro: 20, resultado: [[300, 800]] },
];

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '001')`).run();
	await db
		.prepare(
			`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel, numConta) VALUES
			 (24, 'contaCorrente', 1, 'BB GFS', '123'), (25, 'contaCorrente', 1, 'SICOOB GFS', '456')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo, idReferente) VALUES
			 (200, 1, '002', 'Despesas', 'custeio', NULL),
			 (201, 2, '002.001', 'Despesas operacionais', 'custeio', 200),
			 (300, 3, '002.001.001', 'Insumos', 'custeio', 201),
			 (301, 3, '002.001.002', 'Máquinas', 'investimento', 201)`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (10, 'Venda Leite', 'CUSTEIO', 'RECEITA'),
			 (20, 'Lavoura', 'CUSTEIO', 'DESPESA'),
			 (21, 'Pastagem', 'CUSTEIO', 'DESPESA'),
			 (30, 'Máquinas', 'INVESTIMENTO', 'DESPESA')`,
		)
		.run();
	for (const m of MOVS) {
		const dt = m.dt ?? DT;
		const conta = m.conta ?? 24;
		const tipo = m.valor >= 0 ? 'C' : 'D';
		await db
			.prepare(
				`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, identificador_ofx,
				 tipoMovimento, modalidadeMovimento, idCentroCustos, parcelado)
				 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'padrao', ?, 0)`,
			)
			.bind(m.id, dt, m.historico, m.plano ?? null, conta, m.valor, `FIT${m.id}`, tipo, m.centro ?? null)
			.run();
		for (const [idPlano, valor] of m.resultado ?? []) {
			await db
				.prepare(`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo) VALUES (?, ?, ?, ?, ?, ?)`)
				.bind(dt, m.id, idPlano, conta, valor, tipo)
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

const BASE_FILTRO = 'contaId=24&dataInicio=2026-10-01&dataFim=2026-10-31';

async function sheetRows(query: string): Promise<unknown[][]> {
	const res = await SELF.fetch(`${BASE}/api/movBancario/export?${query}`);
	expect(res.status).toBe(200);
	const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: 'array' });
	const ws = wb.Sheets[wb.SheetNames[0]];
	return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
}

/** Histórico of every data row of the Excel (rows after the "Data do Movimento" header). */
async function historicosExcel(query: string): Promise<string[]> {
	const rows = await sheetRows(query);
	const inicio = rows.findIndex((r) => r[0] === 'Data do Movimento');
	expect(inicio).toBeGreaterThanOrEqual(0);
	return rows
		.slice(inicio + 1)
		.map((r) => String(r[1]))
		.filter(Boolean)
		.sort();
}

async function historicosTela(query: string): Promise<string[]> {
	const res = await SELF.fetch(`${BASE}/api/movBancario/paginado?page=1&limit=100&${query}`);
	expect(res.status).toBe(200);
	const pagina = (await res.json()) as { movimentos: Array<{ historico: string }> };
	return pagina.movimentos.map((m) => m.historico).sort();
}

describe('Conciliação: exportações seguem todos os filtros da tela', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	const CASOS: Array<[string, string, string[]]> = [
		['sem filtros extras', '', ['Insumos adubo', 'Pastagem sem plano', 'Peça do trator', 'Rateio dois centros', 'Venda leite']],
		['plano (inclui rateio)', 'planosIds=300', ['Insumos adubo', 'Rateio dois centros']],
		['centro (inclui rateio)', 'centrosIds=30', ['Peça do trator', 'Rateio dois centros']],
		['plano + centro', 'planosIds=301&centrosIds=20', ['Rateio dois centros']],
		['histórico contém (sem diferenciar maiúsculas)', 'historicoContem=INSUMOS', ['Insumos adubo']],
		['valor', 'valorBusca=1234', ['Peça do trator']],
		['valor com vírgula', 'valorBusca=1234%2C5', ['Peça do trator']],
		['status + histórico', 'status=pendentes&historicoContem=pastagem', ['Pastagem sem plano']],
	];

	for (const [nome, extra, esperado] of CASOS) {
		it(`Excel = lista da tela: ${nome}`, async () => {
			const query = extra ? `${BASE_FILTRO}&${extra}` : BASE_FILTRO;
			const tela = await historicosTela(query);
			expect(tela).toEqual([...esperado].sort());
			expect(await historicosExcel(query)).toEqual(tela);
		});
	}

	it('Excel header names the plan/centre/histórico filters and keeps the table right below it', async () => {
		const rows = await sheetRows(`${BASE_FILTRO}&planosIds=300&centrosIds=20,30&historicoContem=adubo`);
		const rotulo = (r: string) => rows.find((row) => row[0] === r)?.[1];
		expect(rotulo('Período:')).toBe('01/10/2026 até 31/10/2026');
		expect(rotulo('Planos de contas:')).toBe('Insumos');
		expect(rotulo('Centros de custos:')).toBe('Lavoura, Máquinas');
		expect(rotulo('Histórico contém:')).toBe('"adubo"');
		expect(rotulo('Total de registros:')).toBe(1);
		const inicio = rows.findIndex((r) => r[0] === 'Data do Movimento');
		expect(rows[inicio - 1].every((c) => c === '')).toBe(true);
		expect(rows[inicio + 1][1]).toBe('Insumos adubo');
	});

	it('PDF is generated with the extra filters (and invalid ids are ignored)', async () => {
		const res = await SELF.fetch(
			`${BASE}/api/movBancario/export-pdf?${BASE_FILTRO}&planosIds=300,abc&centrosIds=20&historicoContem=insumos&valorBusca=2000`,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
	});
});
