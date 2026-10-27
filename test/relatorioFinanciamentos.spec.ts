// Integration tests: Relatório de Financiamentos (GET /api/relatorio/financiamentos) and the
// RENEGOCIACAO migration, against an isolated local D1 seeded with the production schema snapshot.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import migrationSql from '../migration_financiamento_modalidade_renegociacao.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

function splitSql(sql: string) {
	return sql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
}

async function applySchema(sql = schemaSql) {
	for (const stmt of splitSql(sql)) {
		await db.prepare(stmt).run();
	}
}

type ValorContrato = { idFinanciamento: number; valor: number; quitado?: boolean };
type Bloco = { quantidade: number; valor: number; valorContratos: number; contratos: ValorContrato[] };
type Ponto = { valor: number; contratos: ValorContrato[] };

type Relatorio = {
	periodo: { ano: number; inicio: string; fim: string; ultimoDia: string };
	tomadores: string[];
	contratos: Array<{ idFinanciamento: number; tomador: string; credor: string; modalidade?: string; ativo: boolean; valorVincendo: number; dataQuitacao?: string }>;
	ativos: Bloco;
	contratados: Bloco;
	liquidados: Bloco & { quitados: number; amortizados: number };
	porTomador: { grupos: Array<{ tomador: string; quantidade: number; valor: number }>; quantidade: number; valor: number };
	graficos: {
		novosXLiquidados: Array<{ ano: number; mes: number; novos: Ponto; liquidados: Ponto }>;
		compromissosDoAno: { ano: number; meses: Array<{ mes: number } & Ponto> };
		compromissosPorAno: Array<{ ano: number } & Ponto>;
	};
};

const ids = (b: { contratos: ValorContrato[] }) => b.contratos.map((c) => c.idFinanciamento).sort((a, b) => a - b);

async function relatorio(query: string): Promise<Relatorio> {
	const res = await SELF.fetch(`${BASE}/api/relatorio/financiamentos?${query}`);
	expect(res.status).toBe(200);
	return (await res.json()) as Relatorio;
}

async function seedFinanciamentos(comRenegociacao = true) {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001'), (2, 'Sicredi', '748')`).run();
	await db.prepare(`INSERT INTO pessoa (id, nome, tipo) VALUES (1, 'Credor Particular', 'fisica')`).run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, numeroContrato, modalidade, criadoEm) VALUES
			 (1, 1, NULL, 'GFS', '2024-03-10', 10000, 7, 'BB-001', 'CUSTEIO', '2024-03-10'),
			 (2, 2, NULL, 'CGF', '2026-05-20', 50000, 11, 'SIC-002', 'INVESTIMENTO', '2025-01-01'),
			 (3, 1, NULL, 'GFS', '2023-01-15', 20000, 7, 'BB-003', 'CUSTEIO', '2026-06-01'),
			 (4, NULL, 1, 'RLF', '2022-06-01', 5000, NULL, 'PART-004', 'PARTICULAR', '2022-06-01')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
			 (1, 4000, 'Liquidado', 1, '2025-03-10', '2025-03-08'),
			 (1, 4000, 'Liquidado', 2, '2026-03-10', '2026-03-09'),
			 (1, 4000, 'Aberto',    3, '2030-03-10', NULL),
			 (2, 30000, 'Aberto',   1, '2030-05-20', NULL),
			 (2, 30000, 'Aberto',   2, '2031-05-20', NULL),
			 (3, 11000, 'Liquidado', 1, '2025-01-15', '2025-01-14'),
			 (3, 11000, 'Liquidado', 2, '2026-01-15', '2026-02-01'),
			 (4, 5500, 'Liquidado', 1, '2025-06-01', '2025-06-01')`,
		)
		.run();
	if (!comRenegociacao) return;
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, numeroContrato, modalidade, criadoEm)
			 VALUES (5, 1, NULL, 'MLF', '2026-08-01', 8000, 9, 'BB-005', 'RENEGOCIACAO', '2026-08-01')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
			 (5, 4500, 'Vencido', 1, '2026-09-01', NULL),
			 (5, 4500, 'Aberto',  2, '2030-09-01', NULL)`,
		)
		.run();
}

describe('GET /api/relatorio/financiamentos', () => {
	beforeAll(async () => {
		await applySchema();
		await seedFinanciamentos();
	});

	it('contratos ativos: posição de hoje, sem distinguir novos; valor = soma das parcelas a vencer', async () => {
		const r = await relatorio('ano=2026');
		expect(r.periodo).toEqual({ ano: 2026, inicio: '2026-01-01', fim: '2027-01-01', ultimoDia: '2026-12-31' });
		expect(r.ativos.contratos).toEqual([
			{ idFinanciamento: 2, valor: 60000 },
			{ idFinanciamento: 5, valor: 9000 },
			{ idFinanciamento: 1, valor: 4000 },
		]);
		expect(r.ativos).toMatchObject({ quantidade: 3, valor: 73000, valorContratos: 68000 });
		const m = new Map(r.contratos.map((c) => [c.idFinanciamento, c]));
		expect(m.get(3)).toMatchObject({ ativo: false, valorVincendo: 0, dataQuitacao: '2026-02-01' });
		expect(m.get(4)?.credor).toBe('Credor Particular');
		expect(m.get(5)?.modalidade).toBe('RENEGOCIACAO');
		expect(r.tomadores).toEqual(['CGF', 'GFS', 'MLF', 'RLF']);
		// o período não muda os ativos
		expect((await relatorio('ano=2024')).ativos).toEqual(r.ativos);
	});

	it('contratados no período (só ativos, pela data do contrato; inclui o último dia)', async () => {
		const ano = await relatorio('ano=2026');
		expect(ids(ano.contratados)).toEqual([2, 5]);
		expect(ano.contratados.valor).toBe(69000);
		expect(ids(await relatorio('ano=2026&inicio=2026-05-01&fim=2026-05-20').then((r) => r.contratados))).toEqual([]);
		expect(ids(await relatorio('ano=2026&inicio=2026-05-01&fim=2026-05-21').then((r) => r.contratados))).toEqual([2]);
		expect(ids(await relatorio('ano=2026&mes=8').then((r) => r.contratados))).toEqual([5]);
	});

	it('liquidados no período: amortizados e quitados, valor = parcelas pagas no período', async () => {
		const r = await relatorio('ano=2026');
		expect(r.liquidados.contratos).toEqual([
			{ idFinanciamento: 3, valor: 11000, quitado: true },
			{ idFinanciamento: 1, valor: 4000, quitado: false },
		]);
		expect(r.liquidados).toMatchObject({ quantidade: 2, valor: 15000, quitados: 1, amortizados: 1 });
		const t1 = await relatorio('ano=2026&inicio=2026-01-01&fim=2026-04-01');
		expect(ids(t1.liquidados)).toEqual([1, 3]);
		expect(ids(t1.contratados)).toEqual([]);
		const r2025 = await relatorio('ano=2025');
		expect(r2025.liquidados.contratos.find((c) => c.idFinanciamento === 4)).toEqual({ idFinanciamento: 4, valor: 5500, quitado: true });
	});

	it('contratos por tomador (ativos) e filtro de tomador / modalidade', async () => {
		const r = await relatorio('ano=2026');
		expect(r.porTomador.grupos.map((g) => [g.tomador, g.quantidade, g.valor])).toEqual([
			['CGF', 1, 60000],
			['MLF', 1, 9000],
			['GFS', 1, 4000],
		]);
		expect(r.porTomador.valor).toBe(r.ativos.valor);

		const gfs = await relatorio('ano=2026&tomador=gfs');
		expect(ids(gfs.ativos)).toEqual([1]);
		expect(ids(gfs.liquidados)).toEqual([1, 3]);
		expect(gfs.graficos.novosXLiquidados.every((x) => x.novos.valor === 0)).toBe(true);

		const reneg = await relatorio('ano=2026&modalidade=RENEGOCIACAO');
		expect(ids(reneg.ativos)).toEqual([5]);
	});

	it('gráficos: novos x liquidados, compromissos do ano e por ano', async () => {
		const { graficos: g, ativos } = await relatorio('ano=2026');
		expect(g.novosXLiquidados).toHaveLength(12);
		expect(g.novosXLiquidados[4].novos).toEqual({ valor: 60000, contratos: [{ idFinanciamento: 2, valor: 60000 }] });
		expect(g.novosXLiquidados[7].novos.valor).toBe(9000);
		expect(g.novosXLiquidados[1].liquidados.valor).toBe(11000);
		expect(g.novosXLiquidados[2].liquidados.valor).toBe(4000);
		expect(g.compromissosDoAno.meses[8].valor).toBe(4500);
		expect(g.compromissosPorAno.find((x) => x.ano === 2030)?.valor).toBe(38500);
		expect(g.compromissosPorAno.find((x) => x.ano === 2031)?.valor).toBe(30000);
		expect(g.compromissosPorAno[g.compromissosPorAno.length - 1].ano).toBe(2031);
		expect(g.compromissosPorAno.reduce((s, x) => s + x.valor, 0)).toBe(ativos.valor);

		const tri = await relatorio('ano=2026&inicio=2026-04-01&fim=2026-07-01');
		expect(tri.graficos.novosXLiquidados.map((x) => x.mes)).toEqual([4, 5, 6]);
	});

	it('sem ano usa o ano atual e ignora parâmetros inválidos', async () => {
		const r = await relatorio('mes=13&modalidade=XYZ&inicio=foo&fim=2026-01-01&statusContrato=foo');
		const ano = r.periodo.ano;
		expect(ano).toBeGreaterThanOrEqual(2026);
		expect(r.periodo).toMatchObject({ inicio: `${ano}-01-01`, fim: `${ano + 1}-01-01` });
		expect(ids(r.ativos)).toEqual([1, 2, 5]);
	});
});

describe('migration_financiamento_modalidade_renegociacao.sql', () => {
	it('reconstrói Financiamento com o CHECK novo preservando linhas, ids, FKs e sqlite_sequence', async () => {
		const checkAntigo = "CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR'))";
		const schemaAntigo = schemaSql.replace(
			"CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'))",
			checkAntigo,
		);
		expect(schemaAntigo).toContain(checkAntigo);
		await applySchema(schemaAntigo);
		await seedFinanciamentos(false);
		await expect(
			db.prepare(`INSERT INTO Financiamento (responsavel, dataContrato, valor, numeroContrato, modalidade) VALUES ('X', '2026-01-01', 1, 'X', 'RENEGOCIACAO')`).run(),
		).rejects.toThrow();

		// estado antes: contratos 1..4 + um id 9 excluído (sqlite_sequence = 9)
		await db
			.prepare(`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato, modalidade) VALUES (9, 'Y', '2026-01-01', 1, 'Y', 'CUSTEIO')`)
			.run();
		await db.prepare(`DELETE FROM Financiamento WHERE id = 9`).run();
		const antes = await db.prepare(`SELECT * FROM Financiamento ORDER BY id`).all();
		expect(antes.results.map((r) => r.id)).toEqual([1, 2, 3, 4]);

		await db.batch(splitSql(migrationSql).map((s) => db.prepare(s)));

		const ddl = await db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Financiamento'`).first<{ sql: string }>();
		expect(ddl?.sql).toContain("'RENEGOCIACAO'");
		expect(ddl?.sql).toContain('REFERENCES Banco(id)');
		const novos = await db.prepare(`SELECT name FROM sqlite_master WHERE name = 'Financiamento_new'`).all();
		expect(novos.results).toHaveLength(0);

		const depois = await db.prepare(`SELECT * FROM Financiamento ORDER BY id`).all();
		expect(depois.results).toEqual(antes.results);

		const fk = await db.prepare(`PRAGMA foreign_key_check(parcelaFinanciamento)`).all();
		expect(fk.results).toHaveLength(0);
		const join = await db
			.prepare(`SELECT COUNT(*) AS n FROM parcelaFinanciamento p JOIN Financiamento f ON f.id = p.idFinanciamento`)
			.first<{ n: number }>();
		expect(join?.n).toBe(8);

		const seq = await db.prepare(`SELECT name, seq FROM sqlite_sequence WHERE name LIKE 'Financiamento%'`).all();
		expect(seq.results).toEqual([{ name: 'Financiamento', seq: 9 }]);

		const novo = await db
			.prepare(`INSERT INTO Financiamento (responsavel, dataContrato, valor, numeroContrato, modalidade) VALUES ('MLF', '2026-08-01', 8000, 'R-1', 'RENEGOCIACAO') RETURNING id`)
			.first<{ id: number }>();
		expect(novo?.id).toBe(10);
		await expect(
			db.prepare(`INSERT INTO Financiamento (responsavel, dataContrato, valor, numeroContrato, modalidade) VALUES ('X', '2026-01-01', 1, 'X', 'OUTRA')`).run(),
		).rejects.toThrow();
	});
});
