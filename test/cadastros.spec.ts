// Integration tests for cadastros / financiamento endpoints: reference checks before delete (409),
// atomic financiamento delete, getAll without N+1, input validation (400/404).
import { env, SELF } from 'cloudflare:test';
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
	await db.batch([
		db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Com Conta', '001'), (2, 'Banco Livre', '002')`),
		db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS'), (25, 'contaCorrente', 1, 'Conta Vazia')`),
		db.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo, idReferente) VALUES
			 (1, 1, '002', 'Despesas', 'custeio', NULL),
			 (300, 3, '002.001.001', 'Pessoal - Planos de saúde', 'custeio', 1),
			 (301, 3, '002.001.002', 'Manutenção de casas', 'custeio', 1),
			 (302, 3, '002.001.003', 'Plano sem uso', 'custeio', 1),
			 (303, 3, '002.001.004', 'Pagamento de financiamentos', 'custeio', 1)`,
		),
		db.prepare(
			`INSERT INTO parametros (id, idPlanoTransferenciaEntreContas, idPlanoEntradaFinanciamentos, idPlanoPagamentoFinanciamentos)
			 VALUES (1, NULL, NULL, 303)`,
		),
		db.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (37, 'Administrativo', 'CUSTEIO', 'DESPESA'),
			 (42, 'Leite - Produção', 'CUSTEIO', 'DESPESA')`,
		),
		db.prepare(`INSERT INTO pessoa (id, nome, tipo) VALUES (7, 'Fulano', 'fisica')`),
	]);
}

let seq = 0;
async function inserirMovimento(campos: Partial<Record<string, unknown>> = {}): Promise<number> {
	seq += 1;
	const row: Record<string, unknown> = {
		dtMovimento: '2026-10-05',
		historico: 'Teste',
		idContaCorrente: 24,
		valor: -100,
		saldo: 0,
		identificador_ofx: `TESTE-${seq}-${Math.random()}`,
		...campos,
	};
	const cols = Object.keys(row);
	const { meta } = await db
		.prepare(`INSERT INTO MovimentoBancario (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
		.bind(...cols.map((c) => row[c]))
		.run();
	return meta.last_row_id as number;
}

async function inserirFinanciamento(numParcelas: number): Promise<{ id: number; parcelas: number[] }> {
	const { meta } = await db
		.prepare(
			`INSERT INTO Financiamento (idBanco, responsavel, dataContrato, valor, numeroContrato, modalidade)
			 VALUES (1, 'GFS', '2025-01-10', 3000, ?, 'CUSTEIO')`,
		)
		.bind(`CT-${Math.random()}`)
		.run();
	const id = meta.last_row_id as number;
	const parcelas: number[] = [];
	// inserted in reverse order to check that the API orders by numParcela
	for (let n = numParcelas; n >= 1; n--) {
		const r = await db
			.prepare(
				`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento)
				 VALUES (?, 1000, 'Aberto', ?, ?)`,
			)
			.bind(id, n, `2025-0${n}-10`)
			.run();
		parcelas.unshift(r.meta.last_row_id as number);
	}
	return { id, parcelas };
}

async function count(sql: string, ...binds: unknown[]): Promise<number> {
	const row = await db.prepare(sql).bind(...binds).first<{ n: number }>();
	return Number(row?.n ?? 0);
}

function api(path: string, init?: RequestInit) {
	return SELF.fetch(`${BASE}${path}`, init);
}

function json(method: string, body: unknown): RequestInit {
	return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

describe('cadastros e financiamentos', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	describe('Financiamento', () => {
		it('GET /api/financiamento returns every contract with its ordered parcelasList (no N+1)', async () => {
			const a = await inserirFinanciamento(3);
			const b = await inserirFinanciamento(0);
			const res = await api('/api/financiamento');
			expect(res.status).toBe(200);
			const lista = (await res.json()) as Array<{
				id: number;
				totalParcelas: number;
				parcelasList: Array<{ id: number; numParcela: number; idFinanciamento: number; dt_liquidacao: string | null }>;
			}>;
			const fa = lista.find((f) => f.id === a.id)!;
			const fb = lista.find((f) => f.id === b.id)!;
			expect(fa.totalParcelas).toBe(3);
			expect(fa.parcelasList.map((p) => p.numParcela)).toEqual([1, 2, 3]);
			expect(fa.parcelasList.every((p) => p.idFinanciamento === a.id)).toBe(true);
			expect(fa.parcelasList[0]).toHaveProperty('dt_liquidacao', null);
			expect(fb.totalParcelas).toBe(0);
			expect(fb.parcelasList).toEqual([]);
		});

		it('GET /api/financiamento/:id validates the id (400) and answers 404 when missing', async () => {
			expect((await api('/api/financiamento/abc')).status).toBe(400);
			expect((await api('/api/financiamento/999999')).status).toBe(404);
			const { id } = await inserirFinanciamento(2);
			const res = await api(`/api/financiamento/${id}`);
			expect(res.status).toBe(200);
			const fin = (await res.json()) as { id: number; parcelasList: unknown[] };
			expect(fin.id).toBe(id);
			expect(fin.parcelasList).toHaveLength(2);
		});

		it('DELETE removes the contract and its parcelas when nothing is linked', async () => {
			const { id } = await inserirFinanciamento(3);
			const res = await api(`/api/financiamento/${id}`, { method: 'DELETE' });
			expect(res.status).toBe(200);
			expect(await count(`SELECT COUNT(*) n FROM Financiamento WHERE id = ?`, id)).toBe(0);
			expect(await count(`SELECT COUNT(*) n FROM parcelaFinanciamento WHERE idFinanciamento = ?`, id)).toBe(0);
		});

		it('DELETE answers 409 (and deletes nothing) when a bank movement points to the contract', async () => {
			const { id } = await inserirFinanciamento(2);
			await inserirMovimento({ idFinanciamento: id, modalidadeMovimento: 'financiamento', valor: 3000 });
			const res = await api(`/api/financiamento/${id}`, { method: 'DELETE' });
			expect(res.status).toBe(409);
			const body = (await res.json()) as { error: string };
			expect(body.error).toBe('Este financiamento tem 1 lançamento bancário vinculado. Desvincule-os antes de excluir.');
			expect(await count(`SELECT COUNT(*) n FROM Financiamento WHERE id = ?`, id)).toBe(1);
			expect(await count(`SELECT COUNT(*) n FROM parcelaFinanciamento WHERE idFinanciamento = ?`, id)).toBe(2);
		});

		it('DELETE answers 409 when installments are paid by bank movements (parcela / Resultado links)', async () => {
			const { id, parcelas } = await inserirFinanciamento(3);
			const mov1 = await inserirMovimento();
			const mov2 = await inserirMovimento();
			await db.prepare(`UPDATE parcelaFinanciamento SET idMovimentoBancario = ? WHERE id = ?`).bind(mov1, parcelas[0]).run();
			await db
				.prepare(
					`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, idParcelaFinanciamento, valor, tipo)
					 VALUES ('2026-10-05', ?, 303, 24, ?, -1000, 'D')`,
				)
				.bind(mov2, parcelas[1])
				.run();
			const res = await api(`/api/financiamento/${id}`, { method: 'DELETE' });
			expect(res.status).toBe(409);
			expect(((await res.json()) as { error: string }).error).toContain('2 lançamentos bancários vinculados');
			expect(await count(`SELECT COUNT(*) n FROM parcelaFinanciamento WHERE idFinanciamento = ?`, id)).toBe(3);
		});

		it('rejects a non-numeric id on DELETE', async () => {
			expect((await api('/api/financiamento/abc', { method: 'DELETE' })).status).toBe(400);
		});
	});

	describe('ParcelaFinanciamento', () => {
		it('lists only the installments of one contract or of one movement', async () => {
			const a = await inserirFinanciamento(2);
			await inserirFinanciamento(3);
			const res = await api(`/api/parcelaFinanciamento/financiamento/${a.id}`);
			expect(res.status).toBe(200);
			const lista = (await res.json()) as Array<{ id: number; idFinanciamento: number; numParcela: number }>;
			expect(lista.map((p) => p.id)).toEqual(a.parcelas);
			expect(lista.map((p) => p.numParcela)).toEqual([1, 2]);

			const mov = await inserirMovimento();
			await db.prepare(`UPDATE parcelaFinanciamento SET idMovimentoBancario = ? WHERE id = ?`).bind(mov, a.parcelas[1]).run();
			const porMov = (await (await api(`/api/parcelaFinanciamento/${mov}`)).json()) as Array<{ id: number }>;
			expect(porMov.map((p) => p.id)).toEqual([a.parcelas[1]]);

			expect((await api('/api/parcelaFinanciamento/financiamento/abc')).status).toBe(400);
		});
	});

	describe('Banco', () => {
		it('GET /api/bancos/:id answers 404 / 400 instead of 200 null', async () => {
			expect((await api('/api/bancos/999')).status).toBe(404);
			expect((await api('/api/bancos/abc')).status).toBe(400);
			const res = await api('/api/bancos/1');
			expect(res.status).toBe(200);
			expect(((await res.json()) as { nome: string }).nome).toBe('Banco Com Conta');
		});

		it('DELETE refuses a bank that still has accounts (409) and deletes an unused one', async () => {
			const res = await api('/api/bancos/1', { method: 'DELETE' });
			expect(res.status).toBe(409);
			const { error } = (await res.json()) as { error: string };
			expect(error).toContain('2 contas correntes/cartões');
			expect(await count(`SELECT COUNT(*) n FROM banco WHERE id = 1`)).toBe(1);

			expect((await api('/api/bancos/2', { method: 'DELETE' })).status).toBe(200);
			expect(await count(`SELECT COUNT(*) n FROM banco WHERE id = 2`)).toBe(0);
		});
	});

	describe('Conta corrente', () => {
		it('DELETE refuses an account with movements (409) and deletes an unused one', async () => {
			await inserirMovimento({ idContaCorrente: 24 });
			const res = await api('/api/contas/24', { method: 'DELETE' });
			expect(res.status).toBe(409);
			expect(((await res.json()) as { error: string }).error).toContain('1 lançamento bancário');
			expect(await count(`SELECT COUNT(*) n FROM contaCorrente WHERE id = 24`)).toBe(1);

			expect((await api('/api/contas/25', { method: 'DELETE' })).status).toBe(200);
		});
	});

	describe('Centro de custos', () => {
		it('DELETE refuses a centro used in a rateio (409)', async () => {
			const mov = await inserirMovimento();
			await db.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, 42, 100)`).bind(mov).run();
			const res = await api('/api/centro-custos/42', { method: 'DELETE' });
			expect(res.status).toBe(409);
			expect(((await res.json()) as { error: string }).error).toContain('1 lançamento bancário');
			expect(await count(`SELECT COUNT(*) n FROM CentroCustos WHERE id = 42`)).toBe(1);
		});

		it('DELETE refuses a centro set directly on a movement (409) and deletes an unused one', async () => {
			await inserirMovimento({ idCentroCustos: 37 });
			expect((await api('/api/centro-custos/37', { method: 'DELETE' })).status).toBe(409);
			await db.prepare(`DELETE FROM MovimentoBancario WHERE idCentroCustos = 37`).run();
			expect((await api('/api/centro-custos/37', { method: 'DELETE' })).status).toBe(200);
		});

		it('POST without descricao answers 400 JSON with the validation message', async () => {
			const res = await api('/api/centro-custos', json('POST', { tipo: 'CUSTEIO', tipoReceitaDespesa: 'DESPESA' }));
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'Descrição é obrigatória' });
		});
	});

	describe('Plano de contas', () => {
		it('DELETE refuses a plano used by movements, parametros or child plans (409)', async () => {
			await inserirMovimento({ idPlanoContas: 300 });
			const r1 = await api('/api/planoContas/300', { method: 'DELETE' });
			expect(r1.status).toBe(409);
			expect(((await r1.json()) as { error: string }).error).toContain('1 lançamento bancário');

			const r2 = await api('/api/planoContas/303', { method: 'DELETE' });
			expect(r2.status).toBe(409);
			expect(((await r2.json()) as { error: string }).error).toContain('Parâmetros do sistema');

			const r3 = await api('/api/planoContas/1', { method: 'DELETE' });
			expect(r3.status).toBe(409);
			expect(((await r3.json()) as { error: string }).error).toContain('planos de contas filhos');

			expect((await api('/api/planoContas/302', { method: 'DELETE' })).status).toBe(200);
		});

		it('PUT updates the record of the URL id, even when the body carries another id', async () => {
			const res = await api(
				'/api/planoContas/301',
				json('PUT', { id: 300, nivel: 3, hierarquia: '002.001.002', descricao: 'Manutenção (editado)', tipo: 'custeio', idReferente: 1, inativo: false }),
			);
			expect(res.status).toBe(200);
			const rows = await db.prepare(`SELECT id, descricao FROM planoContas WHERE id IN (300, 301) ORDER BY id`).all<{ id: number; descricao: string }>();
			expect(rows.results).toEqual([
				{ id: 300, descricao: 'Pessoal - Planos de saúde' },
				{ id: 301, descricao: 'Manutenção (editado)' },
			]);
		});

		it('PUT without hierarquia/nivel answers 400 and an unknown id answers 404', async () => {
			const r1 = await api('/api/planoContas/301', json('PUT', { descricao: 'X', tipo: 'custeio' }));
			expect(r1.status).toBe(400);
			const r2 = await api(
				'/api/planoContas/99999',
				json('PUT', { nivel: 1, hierarquia: '009', descricao: 'Novo nome', tipo: 'custeio' }),
			);
			expect(r2.status).toBe(404);
		});
	});

	describe('Parâmetros', () => {
		it('PUT with missing fields answers 400; a full body updates', async () => {
			const r1 = await api('/api/parametro', json('PUT', { idPlanoPagamentoFinanciamentos: 303 }));
			expect(r1.status).toBe(400);
			expect(((await r1.json()) as { error: string }).error).toContain('idPlanoTransferenciaEntreContas');

			const r2 = await api(
				'/api/parametro',
				json('PUT', {
					idPlanoTransferenciaEntreContas: 301,
					idPlanoEntradaFinanciamentos: null,
					idPlanoPagamentoFinanciamentos: 303,
					idPlanoEstornos: null,
					idPlanoAplicacaoResgateInvestimentos: null,
				}),
			);
			expect(r2.status).toBe(200);
			expect(await count(`SELECT idPlanoTransferenciaEntreContas AS n FROM parametros WHERE id = 1`)).toBe(301);
		});
	});

	describe('Pessoa', () => {
		it('GET /api/pessoa/:id returns the person (was always 404)', async () => {
			const res = await api('/api/pessoa/7');
			expect(res.status).toBe(200);
			expect(((await res.json()) as { nome: string }).nome).toBe('Fulano');
			expect((await api('/api/pessoa/999')).status).toBe(404);
			expect((await api('/api/pessoa/abc')).status).toBe(400);
		});

		it('DELETE refuses a person linked to movements (409)', async () => {
			await inserirMovimento({ idPessoa: 7 });
			const res = await api('/api/pessoa/7', { method: 'DELETE' });
			expect(res.status).toBe(409);
			expect(await count(`SELECT COUNT(*) n FROM pessoa WHERE id = 7`)).toBe(1);
		});
	});
});
