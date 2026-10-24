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

type Item = {
	idFinanciamento: number;
	responsavel: string;
	statusContrato: 'NOVO' | 'ATIVO' | 'QUITADO';
	valor: number;
	modalidade?: string;
	dataContrato: string;
	dataQuitacao?: string;
};

type Relatorio = {
	periodo: { ano: number; mes: number | null; inicio: string; fim: string };
	tomadores: string[];
	itens: Item[];
	totalizadores: { totalContratos: number; totalValor: number };
	resumoStatus: Record<'NOVO' | 'ATIVO' | 'QUITADO', { quantidade: number; valor: number }>;
	graficos: {
		mensal: Array<{ mes: number; novos: number; liquidados: number; compromissos: number }>;
		compromissosPorAno: Array<{ ano: number; valor: number }>;
		liquidadosPorAno: Array<{ ano: number; valor: number }>;
	};
};

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

	it('status e valor por contrato no ano filtrado', async () => {
		const r = await relatorio('ano=2026');
		expect(r.periodo).toEqual({ ano: 2026, mes: null, inicio: '2026-01-01', fim: '2026-12-31' });
		const m = new Map(r.itens.map((i) => [i.idFinanciamento, i]));
		// NOVO pela data do contrato (não por criadoEm): contrato 3 foi cadastrado em 2026 mas é de 2023
		expect(m.get(2)).toMatchObject({ statusContrato: 'NOVO', valor: 50000, responsavel: 'CGF' });
		expect(m.get(5)).toMatchObject({ statusContrato: 'NOVO', valor: 8000, modalidade: 'RENEGOCIACAO' });
		expect(m.get(1)).toMatchObject({ statusContrato: 'ATIVO', valor: 4000 });
		expect(m.get(3)).toMatchObject({ statusContrato: 'QUITADO', valor: 22000, dataQuitacao: '2026-02-01' });
		expect(m.has(4)).toBe(false); // quitado em 2025
		expect(r.resumoStatus).toEqual({
			NOVO: { quantidade: 2, valor: 58000 },
			// novos ainda em aberto também são ativos: 1 (4.000) + 2 (60.000) + 5 (9.000)
			ATIVO: { quantidade: 3, valor: 73000 },
			QUITADO: { quantidade: 1, valor: 22000 },
		});
		expect(r.tomadores).toEqual(['CGF', 'GFS', 'MLF', 'RLF']);
	});

	it('filtro de status retorna só os contratos daquele status', async () => {
		const quitados = await relatorio('ano=2026&statusContrato=QUITADO');
		expect(quitados.itens.map((i) => i.idFinanciamento)).toEqual([3]);
		expect(quitados.totalizadores).toMatchObject({ totalContratos: 1, totalValor: 22000 });

		const novos = await relatorio('ano=2026&statusContrato=NOVO');
		expect(novos.itens.map((i) => i.idFinanciamento).sort()).toEqual([2, 5]);

		const ativos = await relatorio('ano=2026&statusContrato=ATIVO');
		expect(ativos.itens.map((i) => [i.idFinanciamento, i.statusContrato, i.valor]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
			[1, 'ATIVO', 4000],
			[2, 'ATIVO', 60000],
			[5, 'ATIVO', 9000],
		]);
	});

	it('tomador filtra por responsavel; modalidade aceita RENEGOCIACAO', async () => {
		const gfs = await relatorio('ano=2026&tomador=GFS');
		expect(gfs.itens.map((i) => i.idFinanciamento).sort()).toEqual([1, 3]);
		expect(gfs.graficos.mensal.every((x) => x.novos === 0)).toBe(true);

		const reneg = await relatorio('ano=2026&modalidade=RENEGOCIACAO');
		expect(reneg.itens.map((i) => i.idFinanciamento)).toEqual([5]);
	});

	it('período mensal e histórico', async () => {
		const maio = await relatorio('ano=2026&mes=5');
		const m = new Map(maio.itens.map((i) => [i.idFinanciamento, i]));
		expect(m.get(2)?.statusContrato).toBe('NOVO');
		expect(m.has(3)).toBe(false); // quitado em fevereiro
		expect(m.has(5)).toBe(false); // assinado em agosto

		const r2025 = await relatorio('ano=2025');
		const h = new Map(r2025.itens.map((i) => [i.idFinanciamento, i]));
		expect(h.get(4)).toMatchObject({ statusContrato: 'QUITADO', valor: 5500 });
		expect(h.get(1)).toMatchObject({ statusContrato: 'ATIVO', valor: 8000 });
	});

	it('gráficos: novos x quitados, compromissos e liquidados', async () => {
		const { graficos: g } = await relatorio('ano=2026&statusContrato=QUITADO');
		expect(g.mensal).toHaveLength(12);
		expect(g.mensal[4].novos).toBe(50000);
		expect(g.mensal[7].novos).toBe(8000);
		expect(g.mensal[1].liquidados).toBe(11000);
		expect(g.mensal[2].liquidados).toBe(4000);
		expect(g.mensal[8].compromissos).toBe(4500);
		expect(g.compromissosPorAno[g.compromissosPorAno.length - 1].ano).toBe(2036);
		expect(g.compromissosPorAno.find((x) => x.ano === 2030)?.valor).toBe(38500);
		expect(g.compromissosPorAno.find((x) => x.ano === 2031)?.valor).toBe(30000);
		expect(g.liquidadosPorAno).toEqual([
			{ ano: 2025, valor: 20500 },
			{ ano: 2026, valor: 15000 },
		]);
	});

	it('sem ano usa o ano atual e ignora parâmetros inválidos', async () => {
		const r = await relatorio('mes=13&modalidade=XYZ&statusContrato=foo');
		expect(r.periodo.mes).toBeNull();
		expect(r.periodo.ano).toBeGreaterThanOrEqual(2026);
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
