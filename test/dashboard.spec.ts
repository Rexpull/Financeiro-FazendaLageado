// Dashboard (Receitas e Despesas): centros with the same label and movements without a cost centre.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const db = (env as unknown as { DB: D1Database }).DB;

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
}

describe('dashboard receitas por centro', () => {
	beforeAll(async () => {
		await applySchema();
	});

	it('keeps same-label centres apart and reports what has no cost centre', async () => {
		await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'BB', '001')`).run();
		await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
		await db
			.prepare(
				`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
				 (30, 'Agricultura', 'CUSTEIO', 'RECEITA'), (31, 'Agricultura', 'INVESTIMENTO', 'RECEITA')`,
			)
			.run();
		await db
			.prepare(
				`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, tipoMovimento, modalidadeMovimento, idCentroCustos) VALUES
				 (1, '2026-10-05T00:00:00.000Z', 'Venda A', 24, 1000, 0, 'a', 'C', 'padrao', 30),
				 (2, '2026-10-06T00:00:00.000Z', 'Venda B', 24, 400, 0, 'b', 'C', 'padrao', 31),
				 (3, '2026-10-07T00:00:00.000Z', 'Crédito sem centro', 24, 250, 0, 'c', 'C', 'padrao', NULL),
				 (4, '2026-10-08T00:00:00.000Z', 'Débito sem centro', 24, -90, 0, 'd', 'D', 'padrao', NULL)`,
			)
			.run();

		const res = await SELF.fetch('https://worker.test/api/dashboard?ano=2026&mes=10&contas=24');
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			receitasDespesas: {
				receitasAgrupadoPorCentros: Array<{ descricao: string; valor: number }>;
				semCentroCustos: { receitas: number; despesas: number };
			};
		};
		const rd = data.receitasDespesas;
		expect(rd.receitasAgrupadoPorCentros.map((r) => [r.descricao, r.valor]).sort()).toEqual([
			['Agricultura (Custeio)', 1000],
			['Agricultura (Investimento)', 400],
		]);
		expect(rd.semCentroCustos).toEqual({ receitas: 250, despesas: 90 });
	});
});
