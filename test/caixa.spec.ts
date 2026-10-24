// Integration tests: Dashboard aba "Caixa" (/api/caixa) against an isolated local D1
// seeded with the production schema snapshot + migration_caixa.sql.
// The route is called through its handler directly (backend/src/routes/handleCaixa.ts).
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import migrationCaixaSql from '../migration_caixa.sql?raw';
import { handleRequest } from '../backend/src/routes/handleCaixa';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

async function applySql(sqlText: string) {
	const statements = sqlText
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) {
		await db.prepare(sql).run();
	}
}

async function seedFinanciamentos() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001'), (2, 'Sicredi', '748')`).run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, responsavel, dataContrato, valor, numeroContrato) VALUES
			 (10, 1, 'GFS', '2025-01-10', 500000, 'CT-001'),
			 (11, 2, 'JPT', '2025-03-01', 200000, 'CT-002')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (id, idFinanciamento, valor, status, numParcela, dt_vencimento) VALUES
			 (100, 10, 10000, 'Aberto', 3, '2026-10-01'),
			 (101, 11, 2500.5, 'Liquidado', 7, '2026-10-15'),
			 (102, 10, 1000, 'Vencido', 2, '2026-09-30'),
			 (103, 11, 3000, 'Aberto', 8, '2026-11-01'),
			 (104, 10, 499.5, 'Vencido', 4, '2026-10-15T03:00:00.000Z')`,
		)
		.run();
}

async function call(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method };
	if (body !== undefined) {
		init.headers = { 'Content-Type': 'application/json' };
		init.body = typeof body === 'string' ? body : JSON.stringify(body);
	}
	const res = await handleRequest(new Request(`${BASE}${path}`, init), db);
	const text = await res.text();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { status: res.status, headers: res.headers, body: (text ? JSON.parse(text) : null) as any };
}

const getOutubro = () => call('GET', '/api/caixa?ano=2026&mes=10');

describe('GET /api/caixa', () => {
	beforeAll(async () => {
		await applySql(schemaSql);
		await applySql(migrationCaixaSql);
		await seedFinanciamentos();
	});

	it('monta os 31 dias de outubro com as parcelas do mês (todos os status)', async () => {
		const { status, body } = await getOutubro();
		expect(status).toBe(200);
		expect(body.ano).toBe(2026);
		expect(body.mes).toBe(10);
		expect(body.saldoInicial).toBeNull();
		expect(body.dias).toHaveLength(31);
		expect(body.dias[0].data).toBe('2026-10-01');
		expect(body.dias[30].data).toBe('2026-10-31');

		expect(body.dias[0].financiamento).toBe(10000);
		expect(body.dias[0].saldo).toBe(-10000);
		// 2.500,50 (Liquidado) + 499,50 gravada com hora
		expect(body.dias[14].financiamento).toBe(3000);
		expect(body.dias[14].saldo).toBe(-13000);
		expect(body.totais.financiamento).toBe(13000);
		expect(body.totais.boletos).toBe(0);
		expect(body.lancamentos).toEqual([]);

		expect(body.parcelas.map((p: { id: number }) => p.id)).toEqual([100, 101, 104]);
		expect(body.parcelas[0]).toEqual({
			id: 100,
			data: '2026-10-01',
			valor: 10000,
			status: 'Aberto',
			numParcela: 3,
			idFinanciamento: 10,
			contrato: 'CT-001',
			tomador: 'GFS',
			banco: 'Banco do Brasil',
		});
		expect(body.parcelas[2].data).toBe('2026-10-15');
		expect(body.parcelas[1]).toMatchObject({ status: 'Liquidado', tomador: 'JPT', banco: 'Sicredi', contrato: 'CT-002' });
	});

	it('exemplo do cliente: saldo inicial 100.000, boleto 1.000 e financiamento 10.000 no dia 01 → 89.000', async () => {
		expect((await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: 100000 })).status).toBe(200);
		const boleto = await call('POST', '/api/caixa/lancamentos', {
			tipo: 'BOLETO',
			data: '2026-10-01',
			descricao: 'Energia elétrica',
			valor: 1000,
		});
		expect(boleto.status).toBe(201);

		const { body } = await getOutubro();
		expect(body.saldoInicial).toBe(100000);
		expect(body.saldoInicialAtualizadoEm).toBeTruthy();
		expect(body.dias[0]).toMatchObject({ boletos: 1000, financiamento: 10000, saldo: 89000, saldoFinal: 89000 });
		expect(body.totais.saldo).toBe(86000);
		expect(body.minimo.saldo).toMatchObject({ valor: 86000, data: '2026-10-15', aporteNecessario: 0, caixaNecessario: 14000 });
	});

	it('previsões C/D entram só no saldo final (acumulado)', async () => {
		await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: 20000 });
		await call('POST', '/api/caixa/lancamentos', { tipo: 'PREVISAO', natureza: 'C', data: '2026-10-10', descricao: 'Venda de gado', valor: 5000 });
		await call('POST', '/api/caixa/lancamentos', { tipo: 'PREVISAO', natureza: 'D', data: '2026-10-20', descricao: 'Compra de ração', valor: 30000 });

		const { body } = await getOutubro();
		const dia = (d: number) => body.dias[d - 1];
		expect(dia(10)).toMatchObject({ saldo: 10000, previsaoC: 5000, previsaoD: 0, previsao: 5000, saldoFinal: 15000 });
		expect(dia(15)).toMatchObject({ saldo: 7000, saldoFinal: 12000 });
		expect(dia(20)).toMatchObject({ saldo: 7000, previsaoD: 30000, previsao: -30000, saldoFinal: -18000 });
		expect(body.totais).toMatchObject({ previsaoC: 5000, previsaoD: 30000, previsao: -25000, saldo: 7000, saldoFinal: -18000 });
		expect(body.minimo.saldo).toMatchObject({ valor: 7000, data: '2026-10-15' });
		expect(body.minimo.saldoFinal).toMatchObject({ valor: -18000, data: '2026-10-20', aporteNecessario: 18000, caixaNecessario: 38000 });
		expect(body.lancamentos).toHaveLength(2);
		expect(body.lancamentos[0]).toMatchObject({ tipo: 'PREVISAO', natureza: 'C', data: '2026-10-10', descricao: 'Venda de gado', valor: 5000 });
	});

	it('lançamentos e saldo de outro mês não entram no mês consultado', async () => {
		await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 11, valor: 999 });
		await call('POST', '/api/caixa/lancamentos', { tipo: 'BOLETO', data: '2026-11-05', descricao: 'Boleto de novembro', valor: 700 });
		await call('POST', '/api/caixa/lancamentos', { tipo: 'BOLETO', data: '2026-09-30', descricao: 'Boleto de setembro', valor: 700 });

		const out = await getOutubro();
		expect(out.body.saldoInicial).toBeNull();
		expect(out.body.lancamentos).toEqual([]);
		expect(out.body.totais.boletos).toBe(0);

		const nov = await call('GET', '/api/caixa?ano=2026&mes=11');
		expect(nov.body.dias).toHaveLength(30);
		expect(nov.body.saldoInicial).toBe(999);
		expect(nov.body.dias[0]).toMatchObject({ financiamento: 3000, saldo: -2001 });
		expect(nov.body.dias[4]).toMatchObject({ boletos: 700, saldo: -2701 });
	});

	it('valida ano/mes', async () => {
		for (const qs of ['', '?ano=2026', '?mes=10', '?ano=2026&mes=13', '?ano=2026&mes=0', '?ano=abc&mes=10', '?ano=1999&mes=1']) {
			const r = await call('GET', `/api/caixa${qs}`);
			expect(r.status, qs).toBe(400);
			expect(typeof r.body.error).toBe('string');
		}
	});
});

describe('PUT /api/caixa/saldo-inicial', () => {
	beforeAll(async () => {
		await applySql(schemaSql);
		await applySql(migrationCaixaSql);
	});

	it('faz upsert (uma linha por mês, vale o último valor)', async () => {
		await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: 100000 });
		const r = await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: 75000.25 });
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ ano: 2026, mes: 10, valor: 75000.25 });

		const { results } = await db.prepare(`SELECT * FROM caixaSaldoInicial`).all();
		expect(results).toHaveLength(1);
		expect((await getOutubro()).body.saldoInicial).toBe(75000.25);
	});

	it('aceita saldo negativo e remove com valor null', async () => {
		await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: -5000 });
		expect((await getOutubro()).body.saldoInicial).toBe(-5000);

		const r = await call('PUT', '/api/caixa/saldo-inicial', { ano: 2026, mes: 10, valor: null });
		expect(r.status).toBe(200);
		expect((await getOutubro()).body.saldoInicial).toBeNull();
	});

	it('rejeita dados inválidos com 400', async () => {
		const casos: unknown[] = [
			{ ano: 2026, mes: 13, valor: 1 },
			{ ano: 2026, valor: 1 },
			{ mes: 10, valor: 1 },
			{ ano: 2026, mes: 10 },
			{ ano: 2026, mes: 10, valor: 'abc' },
			{ ano: 2026, mes: 10, valor: true },
			'nao-e-json',
			[1, 2],
		];
		for (const c of casos) {
			const r = await call('PUT', '/api/caixa/saldo-inicial', c);
			expect(r.status, JSON.stringify(c)).toBe(400);
			expect(typeof r.body.error).toBe('string');
		}
		const { results } = await db.prepare(`SELECT * FROM caixaSaldoInicial`).all();
		expect(results).toHaveLength(0);
	});
});

describe('/api/caixa/lancamentos', () => {
	beforeAll(async () => {
		await applySql(schemaSql);
		await applySql(migrationCaixaSql);
	});

	it('cria boleto sempre com natureza D', async () => {
		const r = await call('POST', '/api/caixa/lancamentos', { tipo: 'BOLETO', data: '2026-10-05', descricao: '  Unimed  ', valor: '1.234,56' });
		expect(r.status).toBe(201);
		expect(r.body).toMatchObject({ tipo: 'BOLETO', natureza: 'D', data: '2026-10-05', descricao: 'Unimed', valor: 1234.56 });
		expect(r.body.id).toBeGreaterThan(0);

		const c = await call('POST', '/api/caixa/lancamentos', { tipo: 'BOLETO', natureza: 'C', data: '2026-10-05', descricao: 'x', valor: 1 });
		expect(c.status).toBe(400);
		expect(c.body.error).toMatch(/Boleto/);
	});

	it('edita (parcial) e exclui uma previsão', async () => {
		const criado = await call('POST', '/api/caixa/lancamentos', {
			tipo: 'PREVISAO',
			natureza: 'C',
			data: '2026-10-10',
			descricao: 'Venda de soja',
			valor: 1000,
		});
		const id = criado.body.id;

		const ed = await call('PUT', `/api/caixa/lancamentos/${id}`, { valor: 1500.556, descricao: 'Venda de soja (lote 2)' });
		expect(ed.status).toBe(200);
		expect(ed.body).toMatchObject({ id, tipo: 'PREVISAO', natureza: 'C', data: '2026-10-10', descricao: 'Venda de soja (lote 2)', valor: 1500.56 });

		const ed2 = await call('PUT', `/api/caixa/lancamentos/${id}`, { natureza: 'D', data: '2026-10-11' });
		expect(ed2.body).toMatchObject({ natureza: 'D', data: '2026-10-11', valor: 1500.56 });

		const dia11 = (await getOutubro()).body.dias[10];
		expect(dia11).toMatchObject({ previsaoD: 1500.56, saldoFinal: -1500.56 });

		// virar boleto força natureza D
		const ed3 = await call('PUT', `/api/caixa/lancamentos/${id}`, { tipo: 'BOLETO' });
		expect(ed3.body).toMatchObject({ tipo: 'BOLETO', natureza: 'D' });

		const del = await call('DELETE', `/api/caixa/lancamentos/${id}`);
		expect(del.status).toBe(200);
		expect((await call('DELETE', `/api/caixa/lancamentos/${id}`)).status).toBe(404);
		expect((await call('PUT', `/api/caixa/lancamentos/${id}`, { valor: 10 })).status).toBe(404);
		expect((await getOutubro()).body.lancamentos).toEqual([]);
	});

	it('rejeita dados inválidos com 400 e mensagem clara', async () => {
		const base = { tipo: 'PREVISAO', natureza: 'C', data: '2026-10-10', descricao: 'Teste', valor: 100 };
		const casos: Array<[Record<string, unknown> | string, RegExp]> = [
			[{ ...base, valor: undefined }, /valor/],
			[{ ...base, valor: 0 }, /maior que zero/],
			[{ ...base, valor: -5 }, /maior que zero/],
			[{ ...base, valor: 'abc' }, /valor/],
			[{ ...base, data: '2026-02-30' }, /data/],
			[{ ...base, data: '10/10/2026' }, /data/],
			[{ ...base, data: undefined }, /data/],
			[{ ...base, tipo: 'PIX' }, /tipo/],
			[{ ...base, tipo: undefined }, /tipo/],
			[{ ...base, natureza: undefined }, /natureza/],
			[{ ...base, natureza: 'X' }, /natureza/],
			[{ ...base, descricao: '   ' }, /descricao/],
			[{ ...base, descricao: 'x'.repeat(201) }, /descricao/],
			['{invalido', /JSON/],
		];
		for (const [corpo, msg] of casos) {
			const r = await call('POST', '/api/caixa/lancamentos', corpo);
			expect(r.status, JSON.stringify(corpo)).toBe(400);
			expect(r.body.error).toMatch(msg);
		}
		const { results } = await db.prepare(`SELECT * FROM caixaLancamento`).all();
		expect(results).toHaveLength(0);

		const criado = await call('POST', '/api/caixa/lancamentos', base);
		const r = await call('PUT', `/api/caixa/lancamentos/${criado.body.id}`, { valor: -1 });
		expect(r.status).toBe(400);
		expect((await call('PUT', '/api/caixa/lancamentos/abc', { valor: 1 })).status).toBe(400);
		expect((await call('DELETE', '/api/caixa/lancamentos/0')).status).toBe(400);
	});

	it('responde CORS, 404 e 405', async () => {
		const opt = await handleRequest(new Request(`${BASE}/api/caixa/lancamentos`, { method: 'OPTIONS' }), db);
		expect(opt.status).toBe(204);
		expect(opt.headers.get('Access-Control-Allow-Origin')).toBe('*');

		const get = await getOutubro();
		expect(get.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect((await call('GET', '/api/caixa/nao-existe')).status).toBe(404);
		expect((await call('POST', '/api/caixa', {})).status).toBe(405);
		expect((await call('GET', '/api/caixa/lancamentos')).status).toBe(405);
	});
});

describe('tabelas do caixa criadas sob demanda', () => {
	beforeAll(async () => {
		await applySql(schemaSql); // sem migration_caixa.sql
	});

	it('o repositório cria caixaSaldoInicial e caixaLancamento se não existirem', async () => {
		const antes = await db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('caixaSaldoInicial', 'caixaLancamento')`)
			.all();
		expect(antes.results).toHaveLength(0);

		const r = await getOutubro();
		expect(r.status).toBe(200);
		expect(r.body.dias).toHaveLength(31);

		const depois = await db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('caixaSaldoInicial', 'caixaLancamento')`)
			.all();
		expect(depois.results).toHaveLength(2);

		const post = await call('POST', '/api/caixa/lancamentos', { tipo: 'BOLETO', data: '2026-10-05', descricao: 'Primeiro', valor: 10 });
		expect(post.status).toBe(201);
	});
});
