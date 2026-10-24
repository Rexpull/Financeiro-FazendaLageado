// The SQL and JS versions of the "pendente" rule must agree on every case.
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import { isMovimentoPendenteConcilacao, sqlMovimentoPendente } from '../backend/src/utils/isMovimentoPendenteConcilacao';

const db = (env as unknown as { DB: D1Database }).DB;

const casos = [
	{ id: 1, valor: 100, tipo: 'C', mod: 'padrao', plano: null, centro: 30, fin: null, res: false, mcc: false },
	{ id: 2, valor: 100, tipo: 'C', mod: 'padrao', plano: null, centro: null, fin: null, res: false, mcc: false },
	{ id: 3, valor: 100, tipo: 'C', mod: 'padrao', plano: null, centro: null, fin: null, res: false, mcc: true },
	{ id: 4, valor: -50, tipo: 'D', mod: 'padrao', plano: 300, centro: null, fin: null, res: true, mcc: false },
	{ id: 5, valor: -50, tipo: 'D', mod: 'padrao', plano: 300, centro: 42, fin: null, res: true, mcc: false },
	{ id: 6, valor: -50, tipo: 'D', mod: 'padrao', plano: null, centro: null, fin: null, res: true, mcc: true },
	{ id: 7, valor: -50, tipo: 'D', mod: 'padrao', plano: null, centro: 42, fin: null, res: false, mcc: false },
	{ id: 8, valor: -50, tipo: 'D', mod: 'transferencia', plano: null, centro: null, fin: null, res: false, mcc: false },
	{ id: 9, valor: -50, tipo: 'D', mod: 'transferencia', plano: 171, centro: null, fin: null, res: true, mcc: false },
	{ id: 10, valor: -50, tipo: 'D', mod: 'financiamento', plano: null, centro: null, fin: 7, res: false, mcc: false },
	{ id: 11, valor: -50, tipo: 'D', mod: 'financiamento', plano: null, centro: null, fin: null, res: false, mcc: false },
	{ id: 12, valor: 80, tipo: null, mod: null, plano: null, centro: 30, fin: null, res: false, mcc: false },
	{ id: 13, valor: -80, tipo: null, mod: null, plano: 300, centro: 42, fin: null, res: true, mcc: false },
];

describe('regra única de pendente', () => {
	beforeAll(async () => {
		const statements = schemaSql
			.split(/;\s*\n/)
			.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
			.filter(Boolean);
		for (const sql of statements) await db.prepare(sql).run();
	});

	it('SQL and JS agree for every case', async () => {
		await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'BB', '001')`).run();
		await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
		await db
			.prepare(
				`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (300, 3, '002.001.001', 'Despesa X', 'custeio'), (171, 3, '003.001.001', 'Transferência entre contas', 'custeio')`,
			)
			.run();
		await db
			.prepare(`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES (30, 'Venda', 'CUSTEIO', 'RECEITA'), (42, 'Leite', 'CUSTEIO', 'DESPESA')`)
			.run();
		await db
			.prepare(`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato) VALUES (7, 'GJN', '2026-01-01', 1000, 'C7')`)
			.run();
		for (const c of casos) {
			await db
				.prepare(
					`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, tipoMovimento, modalidadeMovimento, idPlanoContas, idCentroCustos, idFinanciamento)
					 VALUES (?, '2026-10-01', 'x', 24, ?, 0, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(c.id, c.valor, `id${c.id}`, c.tipo, c.mod, c.plano, c.centro, c.fin)
				.run();
			if (c.res) {
				await db
					.prepare(`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo) VALUES ('2026-10-01', ?, 300, 24, 50, 'D')`)
					.bind(c.id)
					.run();
			}
			if (c.mcc) {
				await db.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, 42, 50)`).bind(c.id).run();
			}
		}
		const { results } = await db
			.prepare(`SELECT mb.id FROM MovimentoBancario mb WHERE ${sqlMovimentoPendente('mb')} ORDER BY mb.id`)
			.all<{ id: number }>();
		const sqlPend = results.map((r) => r.id);
		const jsPend = casos
			.filter((c) =>
				isMovimentoPendenteConcilacao({
					tipoMovimento: c.tipo,
					modalidadeMovimento: c.mod,
					idPlanoContas: c.plano,
					idCentroCustos: c.centro,
					idFinanciamento: c.fin,
					valor: c.valor,
					resultadoList: c.res ? [{ idPlanoContas: 300 }] : [],
					centroCustosList: c.mcc ? [{ idCentroCustos: 42 }] : [],
				}),
			)
			.map((c) => c.id);
		expect(sqlPend).toEqual(jsPend);
		expect(jsPend).toEqual([2, 4, 7, 8, 11]);
	});
});
