// Integration tests: real worker (backend/src/index.ts) against an isolated local D1
// seeded with the production schema snapshot (test/fixtures/schema.sql).
import { env, SELF, createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

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

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '001')`).run();
	await db
		.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`)
		.run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES
			 (300, 3, '002.001.001', 'Pessoal - Planos de saúde', 'custeio'),
			 (301, 3, '002.001.002', 'Manutenção de casas e dependências', 'custeio')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (37, 'Administrativo', 'CUSTEIO', 'DESPESA'),
			 (42, 'Leite - Produção', 'CUSTEIO', 'DESPESA'),
			 (43, 'Leite - Recria', 'CUSTEIO', 'DESPESA')`,
		)
		.run();
}

function movimentoOfx(valor: number) {
	const dt = '2026-10-05T00:00:00.000Z';
	return {
		dtMovimento: dt,
		historico: 'Pagamento de Boleto - UNIMED',
		valor,
		saldo: 0,
		idContaCorrente: 24,
		identificadorOfx: `FIT123|${dt}|${valor}|100.512`,
		tipoMovimento: 'D',
		modalidadeMovimento: 'padrao',
		ideagro: false,
		parcelado: false,
	};
}

async function postBatch(movimentos: unknown[]) {
	const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ movimentos }),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as {
		novos: number;
		existentes: number;
		erros: number;
		movimentos: Array<{
			id: number;
			valor: number;
			idCentroCustos: number | null;
			centroCustosList?: Array<{ idCentroCustos: number; valor: number }>;
			resultadoList?: Array<{ idPlanoContas: number; valor: number }>;
		}>;
	};
}

describe('worker routing', () => {
	it('answers CORS preflight', async () => {
		const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, { method: 'OPTIONS' });
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('returns 404 for unknown routes', async () => {
		const res = await SELF.fetch(`${BASE}/api/nao-existe`);
		expect(res.status).toBe(404);
	});

	it('exposes a scheduled handler for the cron trigger', async () => {
		const worker = (await import('../backend/src/index')).default as { scheduled?: unknown };
		expect(typeof worker.scheduled).toBe('function');
	});
});

describe('OFX batch import keeps rateio (multi centro de custos)', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	// Storage is isolated per test, so each scenario imports its own movement first.
	async function importarComRateio() {
		const out = await postBatch([
			{
				...movimentoOfx(-4779.85),
				idPlanoContas: 300,
				centroCustosList: [
					{ idCentroCustos: 37, valor: 2000 },
					{ idCentroCustos: 42, valor: 1779.85 },
					{ idCentroCustos: 43, valor: 1000 },
				],
			},
		]);
		expect(out.novos).toBe(1);
		return out.movimentos[0];
	}

	it('creates a new movement with plano + 3 centros', async () => {
		const mov = await importarComRateio();
		expect(mov.idCentroCustos).toBeNull();
		expect(mov.centroCustosList).toHaveLength(3);
		expect(mov.resultadoList).toHaveLength(1);
	});

	it('re-import of the same OFX line returns the existing movement with its rateio', async () => {
		const { id: idMov } = await importarComRateio();
		const out = await postBatch([movimentoOfx(-4779.85)]);
		expect(out.novos).toBe(0);
		expect(out.existentes).toBe(1);
		const mov = out.movimentos[0];
		expect(mov.id).toBe(idMov);
		expect(mov.centroCustosList?.map((c) => c.idCentroCustos).sort()).toEqual([37, 42, 43]);
		expect(mov.resultadoList).toHaveLength(1);

		const { results } = await db
			.prepare(`SELECT COUNT(*) n FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`)
			.bind(idMov)
			.all<{ n: number }>();
		expect(results[0].n).toBe(3);
	});

	it('partial PUT (only historico) keeps Resultado and centro rateio', async () => {
		const { id: idMov } = await importarComRateio();
		const res = await SELF.fetch(`${BASE}/api/movBancario/${idMov}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ historico: 'UNIMED - editado' }),
		});
		expect(res.status).toBe(200);
		const mov = (await res.json()) as {
			historico: string;
			resultadoList: unknown[];
			centroCustosList: unknown[];
		};
		expect(mov.historico).toBe('UNIMED - editado');
		expect(mov.resultadoList).toHaveLength(1);
		expect(mov.centroCustosList).toHaveLength(3);
	});

	async function put(id: number, body: unknown) {
		const res = await SELF.fetch(`${BASE}/api/movBancario/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		expect(res.status).toBe(200);
		return (await res.json()) as { idPlanoContas: number | null; resultadoList: Array<{ idPlanoContas: number }> };
	}

	it('reclassifying to another single plano (modal payload) moves Resultado too', async () => {
		const { id } = await importarComRateio();
		// ConciliarPlano sends resultadoList [] for a single plano
		const mov = await put(id, { idPlanoContas: 301, resultadoList: [] });
		expect(mov.idPlanoContas).toBe(301);
		expect(mov.resultadoList.map((r) => r.idPlanoContas)).toEqual([301]);
	});

	it('stale resultadoList never leaves MovimentoBancario and Resultado divergent', async () => {
		const { id } = await importarComRateio();
		// Old client behaviour: new idPlanoContas + previous resultadoList [300]
		const mov = await put(id, {
			idPlanoContas: 301,
			resultadoList: [{ idPlanoContas: 300, valor: 4779.85, tipo: 'D', idContaCorrente: 24, dtMovimento: '2026-10-05T00:00:00.000Z' }],
		});
		expect(mov.resultadoList.map((r) => r.idPlanoContas)).toEqual([mov.idPlanoContas]);
	});

	it('Fluxo detail labels each account only by its name', async () => {
		await importarComRateio();
		const params = new URLSearchParams({ planoId: '42', mes: '9', tipo: 'despesas', ano: '2026', tipoAgrupamento: 'centros', contas: '24' });
		const res = await SELF.fetch(`${BASE}/api/fluxoCaixa/detalhar?${params}`);
		expect(res.status).toBe(200);
		const rows = (await res.json()) as Array<{ conta: string; valor: number }>;
		expect(rows.length).toBeGreaterThan(0);
		expect(new Set(rows.map((r) => r.conta))).toEqual(new Set(['BB GFS']));
	});

	it('"Limpar conciliação" removes plan and centre rateios', async () => {
		const { id } = await importarComRateio();
		// make it a plan rateio too (idPlanoContas becomes NULL)
		await SELF.fetch(`${BASE}/api/movBancario/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				resultadoList: [
					{ idPlanoContas: 300, valor: 2779.85, tipo: 'D', idContaCorrente: 24, dtMovimento: '2026-10-05T00:00:00.000Z' },
					{ idPlanoContas: 301, valor: 2000, tipo: 'D', idContaCorrente: 24, dtMovimento: '2026-10-05T00:00:00.000Z' },
				],
			}),
		});
		const res = await SELF.fetch(`${BASE}/api/movBancario/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idPlanoContas: null, idCentroCustos: null, resultadoList: [], limparConciliacao: true }),
		});
		expect(res.status).toBe(200);
		const mov = (await res.json()) as { idPlanoContas: number | null; idCentroCustos: number | null; resultadoList: unknown[]; centroCustosList: unknown[] };
		expect(mov).toMatchObject({ idPlanoContas: null, idCentroCustos: null });
		expect(mov.resultadoList).toHaveLength(0);
		expect(mov.centroCustosList).toHaveLength(0);
	});

	it('valor correction on re-import rescales rateio instead of deleting it', async () => {
		const { id: idMov } = await importarComRateio();
		// Same FITID + day, corrected valor (parser fix scenario)
		const out = await postBatch([movimentoOfx(-9559.7)]);
		expect(out.existentes).toBe(1);
		expect(out.movimentos[0].id).toBe(idMov);

		const mcc = await db
			.prepare(`SELECT idCentroCustos, valor FROM MovimentoCentroCustos WHERE idMovimentoBancario = ? ORDER BY idCentroCustos`)
			.bind(idMov)
			.all<{ idCentroCustos: number; valor: number }>();
		expect(mcc.results.map((r) => [r.idCentroCustos, r.valor])).toEqual([
			[37, 4000],
			[42, 3559.7],
			[43, 2000],
		]);

		const res = await db
			.prepare(`SELECT idPlanoContas, valor FROM Resultado WHERE idMovimentoBancario = ?`)
			.bind(idMov)
			.all<{ idPlanoContas: number; valor: number }>();
		expect(res.results).toEqual([{ idPlanoContas: 300, valor: 9559.7 }]);
	});
});

describe('cron validarParcelasVencidas', () => {
	beforeAll(async () => {
		await applySchema();
	});

	it('marks only past-due open parcelas as Vencido and keeps liquidadas untouched', async () => {
		await db
			.prepare(
				`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato) VALUES (1, 'Teste', '2026-01-10', 1000, 'C-1')`,
			)
			.run();
		await db
			.prepare(
				`INSERT INTO parcelaFinanciamento (id, idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
				 (1, 1, 100, 'Aberto',    1, '2020-01-15', NULL),
				 (2, 1, 100, 'Aberto',    2, '2999-01-15', NULL),
				 (3, 1, 100, 'Liquidado', 3, '2020-02-15', '2020-02-10'),
				 (4, 1, 100, 'Vencido',   4, '2020-03-15', NULL)`,
			)
			.run();

		const worker = (await import('../backend/src/index')).default as unknown as {
			scheduled: (c: ScheduledController, e: unknown, ctx: ExecutionContext) => Promise<void>;
		};
		const ctx = createExecutionContext();
		await worker.scheduled(createScheduledController({ cron: '0 6 * * *' }), env, ctx);
		await waitOnExecutionContext(ctx);

		const { results } = await db
			.prepare(`SELECT id, status, dt_liquidacao FROM parcelaFinanciamento ORDER BY id`)
			.all<{ id: number; status: string; dt_liquidacao: string | null }>();
		expect(results).toEqual([
			{ id: 1, status: 'Vencido', dt_liquidacao: null },
			{ id: 2, status: 'Aberto', dt_liquidacao: null },
			{ id: 3, status: 'Liquidado', dt_liquidacao: '2020-02-10' },
			{ id: 4, status: 'Vencido', dt_liquidacao: null },
		]);
	});
});

describe('dashboard saldo devedor', () => {
	beforeAll(async () => {
		await applySchema();
	});

	it('returns 12 months where saldo final = inicial − quitados + novos', async () => {
		await db
			.prepare(
				`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato) VALUES
				 (1, 'GJN', '2025-06-06', 1000, 'A'), (2, 'JPT', '2026-10-15', 5000, 'B')`,
			)
			.run();
		await db
			.prepare(
				`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
				 (1, 300, 'Liquidado', 1, '2026-10-15', '2026-10-14'),
				 (1, 450, 'Aberto', 2, '2027-06-15', NULL),
				 (2, 3000, 'Aberto', 1, '2027-10-15', NULL)`,
			)
			.run();
		const res = await SELF.fetch(`${BASE}/api/dashboard/financiamentos?tipo=saldo-devedor&ano=2026`);
		expect(res.status).toBe(200);
		const meses = (await res.json()) as Array<{ mes: number; saldoInicial: number; quitados: number; creditosNovos: number; saldoFinal: number }>;
		expect(meses).toHaveLength(12);
		const out = meses[9];
		expect(out).toMatchObject({ saldoInicial: 750, quitados: 300, creditosNovos: 3000, saldoFinal: 3450 });
	});

	it('Fluxo (centros): créditos novos sum ALL parcelas of the new contract, even future years', async () => {
		await db
			.prepare(
				`INSERT INTO Financiamento (id, idBanco, idPessoa, responsavel, dataContrato, valor, numeroContrato) VALUES
				 (2, NULL, NULL, 'JPT', '2026-10-15', 5000, 'B')`,
			)
			.run();
		await db
			.prepare(
				`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
				 (2, 3000, 'Aberto', 1, '2027-10-15', NULL), (2, 3000, 'Aberto', 2, '2028-10-15', NULL)`,
			)
			.run();
		const res = await SELF.fetch(`${BASE}/api/fluxoCaixa`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ano: '2026', contas: ['24'], tipoAgrupamento: 'centros' }),
		});
		expect(res.status).toBe(200);
		const { dadosMensais } = (await res.json()) as { dadosMensais: Array<{ financiamentos: { contratados: Record<string, { valor: number }> } }> };
		const outubro = Object.values(dadosMensais[9].financiamentos.contratados).reduce((a, c) => a + c.valor, 0);
		expect(outubro).toBe(6000); // no lender registered and parcelas only in 2027/2028
	});

	it('Fluxo detail "todos": quitados of the month and créditos novos with all their parcelas', async () => {
		await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'SICREDI', '748')`).run();
		await db
			.prepare(
				`INSERT INTO Financiamento (id, idBanco, responsavel, dataContrato, valor, numeroContrato) VALUES
				 (1, 1, 'GJN', '2025-06-06', 1000, 'A'), (2, 1, 'JPT', '2026-10-15', 5000, 'B')`,
			)
			.run();
		await db
			.prepare(
				`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
				 (1, 300, 'Liquidado', 1, '2026-10-15', '2026-10-14'),
				 (1, 450, 'Vencido', 2, '2026-10-20', NULL),
				 (2, 3000, 'Aberto', 1, '2027-10-15', NULL),
				 (2, 3000, 'Aberto', 2, '2028-10-15', NULL)`,
			)
			.run();
		const url = (subtipo: string) =>
			`${BASE}/api/fluxoCaixa/detalhar?planoId=todos&tipo=financiamentos&subtipo=${subtipo}&mes=9&ano=2026&tipoAgrupamento=centros`;

		const pagos = (await (await SELF.fetch(url('pagos'))).json()) as Array<{ numeroContrato: string; credor: string; tomador: string; parcelas: Array<{ valor: number }> }>;
		expect(pagos).toHaveLength(1);
		expect(pagos[0]).toMatchObject({ numeroContrato: 'A', credor: 'SICREDI', tomador: 'GJN' });
		expect(pagos[0].parcelas.map((p) => p.valor)).toEqual([300]); // unpaid parcela of the month is not "quitado"

		const novos = (await (await SELF.fetch(url('contratados'))).json()) as Array<{ numeroContrato: string; parcelas: unknown[] }>;
		expect(novos.map((n) => n.numeroContrato)).toEqual(['B']);
		expect(novos[0].parcelas).toHaveLength(2);
	});
});
