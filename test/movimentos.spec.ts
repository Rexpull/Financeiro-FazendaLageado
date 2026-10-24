// Integration tests: MovimentoBancario write paths (OFX batch, PUT, transfer, deletes)
// against an isolated local D1 seeded with the production schema snapshot.
// Storage is isolated per test: each test starts from the state left by beforeAll.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const DT = '2026-10-05T00:00:00.000Z';

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) {
		await db.prepare(sql).run();
	}
}

async function seed({ planoTransferencia = true } = {}) {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '001')`).run();
	await db
		.prepare(
			`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES
			 (24, 'contaCorrente', 1, 'BB GFS'), (25, 'contaCorrente', 1, 'SANTANDER GFS')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES
			 (300, 3, '002.001.001', 'Pessoal - Planos de saúde', 'custeio'),
			 (301, 3, '002.001.002', 'Manutenção de casas e dependências', 'custeio'),
			 (900, 3, '009.001.001', 'Transferência entre contas', 'transferencia')`,
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
	await db
		.prepare(`INSERT INTO parametros (id, idPlanoTransferenciaEntreContas) VALUES (1, ?)`)
		.bind(planoTransferencia ? 900 : null)
		.run();
}

type Mov = {
	id: number;
	valor: number;
	historico: string;
	idContaCorrente: number;
	identificadorOfx: string;
	idPlanoContas: number | null;
	idCentroCustos: number | null;
	centroCustosList?: Array<{ idCentroCustos: number; valor: number }>;
	resultadoList?: Array<{ idPlanoContas: number; valor: number; tipo: string }>;
};

function linhaOfx(opts: {
	fitid: string;
	valor: number;
	historico: string;
	conta?: number;
	checkNum?: string;
	ocorrencia?: number;
	dt?: string;
}) {
	const dt = opts.dt ?? DT;
	let identificadorOfx = `${opts.fitid}|${dt}|${opts.valor.toFixed(2)}`;
	if (opts.checkNum) identificadorOfx += `|${opts.checkNum}`;
	if (opts.ocorrencia) identificadorOfx += `|#${opts.ocorrencia}`;
	return {
		dtMovimento: dt,
		historico: opts.historico,
		valor: opts.valor,
		saldo: 0,
		idContaCorrente: opts.conta ?? 24,
		identificadorOfx,
		numeroDocumento: identificadorOfx,
		tipoMovimento: opts.valor >= 0 ? 'C' : 'D',
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
	return (await res.json()) as { novos: number; existentes: number; erros: number; detalhesErros: string[]; movimentos: Mov[] };
}

async function request(method: string, path: string, body?: unknown) {
	const res = await SELF.fetch(`${BASE}${path}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let json: any = null;
	try {
		json = JSON.parse(text);
	} catch {
		json = text;
	}
	return { status: res.status, json };
}

async function rowsDaConta(conta: number) {
	const { results } = await db
		.prepare(`SELECT id, valor, identificador_ofx, historico FROM MovimentoBancario WHERE idContaCorrente = ? ORDER BY id`)
		.bind(conta)
		.all<{ id: number; valor: number; identificador_ofx: string; historico: string }>();
	return results;
}

async function mcc(idMov: number) {
	const { results } = await db
		.prepare(`SELECT idCentroCustos, valor FROM MovimentoCentroCustos WHERE idMovimentoBancario = ? ORDER BY idCentroCustos`)
		.bind(idMov)
		.all<{ idCentroCustos: number; valor: number }>();
	return results.map((r) => [r.idCentroCustos, r.valor]);
}

async function resultados(idMov: number) {
	const { results } = await db
		.prepare(`SELECT idPlanoContas, valor, tipo FROM Resultado WHERE idMovimentoBancario = ? ORDER BY id`)
		.bind(idMov)
		.all<{ idPlanoContas: number; valor: number; tipo: string }>();
	return results;
}

async function mbCentro(idMov: number) {
	const row = await db.prepare(`SELECT idCentroCustos FROM MovimentoBancario WHERE id = ?`).bind(idMov).first<{ idCentroCustos: number | null }>();
	return row?.idCentroCustos ?? null;
}

/* ------------------------------------------------------------------ */

describe('Bug 1 — OFX fallback never merges distinct movements', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	const santander = [
		linhaOfx({ fitid: '000000', valor: -2300, historico: 'PIX ENVIADO' }),
		linhaOfx({ fitid: '000000', valor: -14105, historico: 'PIX ENVIADO' }),
		linhaOfx({ fitid: '000000', valor: -11300, historico: 'PIX ENVIADO' }),
	];

	it('Santander generic FITID: 3 lines on the same day become 3 movements', async () => {
		const out = await postBatch(santander);
		expect(out).toMatchObject({ novos: 3, existentes: 0, erros: 0 });
		const rows = await rowsDaConta(24);
		expect(rows.map((r) => r.valor)).toEqual([-2300, -14105, -11300]);
	});

	it('re-importing the same Santander file keeps the 3 movements', async () => {
		await postBatch(santander);
		const out = await postBatch(santander);
		expect(out).toMatchObject({ novos: 0, existentes: 3, erros: 0 });
		expect(await rowsDaConta(24)).toHaveLength(3);
	});

	it('generic FITID never falls back across HTTP batches (frontend sends 10 per request)', async () => {
		await postBatch([santander[0]]);
		const out = await postBatch([santander[1]]);
		expect(out).toMatchObject({ novos: 1, existentes: 0 });
		expect((await rowsDaConta(24)).map((r) => r.valor)).toEqual([-2300, -14105]);
	});

	it('non-generic FITID with a different historico is a new movement', async () => {
		await postBatch([linhaOfx({ fitid: 'DOC77', valor: -100, historico: 'TARIFA PACOTE' })]);
		const out = await postBatch([linhaOfx({ fitid: 'DOC77', valor: -250, historico: 'PIX ENVIADO FULANO' })]);
		expect(out).toMatchObject({ novos: 1, existentes: 0 });
		expect((await rowsDaConta(24)).map((r) => r.valor)).toEqual([-100, -250]);
	});

	it('different checkNum is a new movement', async () => {
		await postBatch([linhaOfx({ fitid: 'DOC88', valor: -100, historico: 'CHEQUE', checkNum: '851' })]);
		const out = await postBatch([linhaOfx({ fitid: 'DOC88', valor: -300, historico: 'CHEQUE', checkNum: '852' })]);
		expect(out).toMatchObject({ novos: 1, existentes: 0 });
		expect(await rowsDaConta(24)).toHaveLength(2);
	});

	it('checkNum on only one side is a new movement', async () => {
		await postBatch([linhaOfx({ fitid: 'DOC89', valor: -100, historico: 'CHEQUE' })]);
		const out = await postBatch([linhaOfx({ fitid: 'DOC89', valor: -300, historico: 'CHEQUE', checkNum: '852' })]);
		expect(out).toMatchObject({ novos: 1, existentes: 0 });
	});

	it('repeated identical lines with |#N suffix are distinct and re-import is idempotent', async () => {
		const linhas = [
			linhaOfx({ fitid: 'TAR1', valor: -9.9, historico: 'TARIFA' }),
			linhaOfx({ fitid: 'TAR1', valor: -9.9, historico: 'TARIFA', ocorrencia: 2 }),
			linhaOfx({ fitid: 'TAR1', valor: -9.9, historico: 'TARIFA', ocorrencia: 3 }),
		];
		expect(await postBatch(linhas)).toMatchObject({ novos: 3, existentes: 0, erros: 0 });
		expect(await postBatch(linhas)).toMatchObject({ novos: 0, existentes: 3, erros: 0 });
		expect(await rowsDaConta(24)).toHaveLength(3);
	});

	it('never falls back across the |#N occurrence suffix', async () => {
		await postBatch([linhaOfx({ fitid: 'TAR2', valor: -9.9, historico: 'TARIFA' })]);
		const out = await postBatch([linhaOfx({ fitid: 'TAR2', valor: -12.5, historico: 'TARIFA', ocorrencia: 2 })]);
		expect(out).toMatchObject({ novos: 1, existentes: 0 });
		expect((await rowsDaConta(24)).map((r) => r.valor)).toEqual([-9.9, -12.5]);
	});

	it('a row already matched by another line of the same batch is never reused', async () => {
		await postBatch([linhaOfx({ fitid: 'DOC90', valor: -100, historico: 'PAGTO' })]);
		// two lines with the same FITID/day in one batch: the fallback is ambiguous → both are new
		const out = await postBatch([
			linhaOfx({ fitid: 'DOC90', valor: -150, historico: 'PAGTO' }),
			linhaOfx({ fitid: 'DOC90', valor: -175, historico: 'PAGTO' }),
		]);
		expect(out).toMatchObject({ novos: 2, existentes: 0 });
		expect((await rowsDaConta(24)).map((r) => r.valor)).toEqual([-100, -150, -175]);
	});

	it('exact re-import + corrected line in the same batch do not steal each other', async () => {
		await postBatch([linhaOfx({ fitid: 'DOC91', valor: -100, historico: 'PAGTO', checkNum: '1' })]);
		const out = await postBatch([
			linhaOfx({ fitid: 'DOC91', valor: -100, historico: 'PAGTO', checkNum: '1' }),
			linhaOfx({ fitid: 'DOC91', valor: -999, historico: 'PAGTO', checkNum: '1' }),
		]);
		expect(out).toMatchObject({ novos: 1, existentes: 1 });
		expect((await rowsDaConta(24)).map((r) => r.valor)).toEqual([-100, -999]);
	});

	it('still corrects the SAME bank line after a parser fix (historico normalized)', async () => {
		const first = await postBatch([linhaOfx({ fitid: 'FIT55', valor: -1.06152, historico: 'Pagamento  de Boleto', checkNum: '7' })]);
		const id = first.movimentos[0].id;
		const out = await postBatch([linhaOfx({ fitid: 'FIT55', valor: -1061.52, historico: 'PAGAMENTO DE BOLETO ', checkNum: '7' })]);
		expect(out).toMatchObject({ novos: 0, existentes: 1 });
		expect(out.movimentos[0].id).toBe(id);
		const rows = await rowsDaConta(24);
		expect(rows).toHaveLength(1);
		expect(rows[0].valor).toBe(-1061.52);
		expect(rows[0].identificador_ofx).toBe(`FIT55|${DT}|-1061.52|7`);
	});
});

describe('Bug 2 — transferência entre contas', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	const payload = {
		contaOrigemId: 24,
		contaOrigemDescricao: 'BB GFS',
		contaDestinoId: 25,
		contaDestinoDescricao: 'SANTANDER GFS',
		valor: 1500,
		descricao: 'Cobertura de saldo',
		data: '2026-10-05',
		idUsuario: 1,
	};

	it('creates both legs with distinct identificadores and ABS Resultado', async () => {
		const res = await request('POST', '/api/movBancario/transfer', payload);
		expect(res.status).toBe(201);
		const { results } = await db
			.prepare(
				`SELECT id, idContaCorrente, valor, identificador_ofx, transf_origem, transf_destino, tipoMovimento, idPlanoContas
				 FROM MovimentoBancario ORDER BY id`,
			)
			.all<any>();
		expect(results).toHaveLength(2);
		const [saida, entrada] = results;
		expect(saida).toMatchObject({ idContaCorrente: 24, valor: -1500, tipoMovimento: 'D', transf_destino: 25, idPlanoContas: 900 });
		expect(entrada).toMatchObject({ idContaCorrente: 25, valor: 1500, tipoMovimento: 'C', transf_origem: saida.id, idPlanoContas: 900 });
		expect(saida.identificador_ofx).not.toBe(entrada.identificador_ofx);
		expect(saida.identificador_ofx).toMatch(/\|saida$/);
		expect(entrada.identificador_ofx).toMatch(/\|entrada$/);
		expect(await resultados(saida.id)).toEqual([{ idPlanoContas: 900, valor: 1500, tipo: 'D' }]);
		expect(await resultados(entrada.id)).toEqual([{ idPlanoContas: 900, valor: 1500, tipo: 'C' }]);
	});

	it('two transfers in a row both succeed', async () => {
		expect((await request('POST', '/api/movBancario/transfer', payload)).status).toBe(201);
		expect((await request('POST', '/api/movBancario/transfer', payload)).status).toBe(201);
		const row = await db.prepare(`SELECT COUNT(*) n, SUM(valor) s FROM MovimentoBancario`).first<{ n: number; s: number }>();
		expect(row).toEqual({ n: 4, s: 0 });
	});

	it('rejects negative or zero valor with 400', async () => {
		for (const valor of [-10, 0]) {
			const res = await request('POST', '/api/movBancario/transfer', { ...payload, valor });
			expect(res.status).toBe(400);
			expect(res.json.message).toMatch(/valor/i);
		}
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario`).first('n')).toBe(0);
	});

	it('rejects origem == destino with 400', async () => {
		const res = await request('POST', '/api/movBancario/transfer', { ...payload, contaDestinoId: 24 });
		expect(res.status).toBe(400);
		expect(res.json.message).toMatch(/mesma conta|origem e destino/i);
	});

	it('is atomic: a failing entry leg leaves no orphan exit leg', async () => {
		const res = await request('POST', '/api/movBancario/transfer', { ...payload, contaDestinoId: 9999 });
		expect(res.status).toBe(500);
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario`).first('n')).toBe(0);
		expect(await db.prepare(`SELECT COUNT(*) n FROM Resultado`).first('n')).toBe(0);
	});
});

describe('Bug 2 — transferência sem plano configurado', () => {
	beforeAll(async () => {
		await applySchema();
		await seed({ planoTransferencia: false });
	});

	it('returns 400 with a clear message and writes nothing', async () => {
		const res = await request('POST', '/api/movBancario/transfer', {
			contaOrigemId: 24,
			contaOrigemDescricao: 'BB GFS',
			contaDestinoId: 25,
			contaDestinoDescricao: 'SANTANDER GFS',
			valor: 10,
			descricao: 'x',
			data: '2026-10-05',
			idUsuario: 1,
		});
		expect(res.status).toBe(400);
		expect(res.json.message).toMatch(/plano/i);
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario`).first('n')).toBe(0);
	});
});

describe('Bugs 3/4 — PUT centro de custos e valor novo', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	async function criarComCentroUnico(valor = -100) {
		const out = await postBatch([{ ...linhaOfx({ fitid: 'C1', valor, historico: 'COMPRA' }), idPlanoContas: 300, idCentroCustos: 37 }]);
		expect(out.novos).toBe(1);
		const id = out.movimentos[0].id;
		expect(await mcc(id)).toEqual([[37, Math.abs(valor)]]);
		expect(await mbCentro(id)).toBe(37);
		return id;
	}

	it('switching a single centre to a split (ConciliarPlano payload) keeps the sent list', async () => {
		const id = await criarComCentroUnico();
		const res = await request('PUT', `/api/movBancario/${id}`, {
			idCentroCustos: null,
			centroCustosList: [
				{ idCentroCustos: 37, valor: 60 },
				{ idCentroCustos: 42, valor: 40 },
			],
		});
		expect(res.status).toBe(200);
		expect(await mcc(id)).toEqual([
			[37, 60],
			[42, 40],
		]);
		expect(await mbCentro(id)).toBeNull();
	});

	it('changing idCentroCustos together with a list: the list wins and MB is NULL for >1', async () => {
		const id = await criarComCentroUnico();
		const res = await request('PUT', `/api/movBancario/${id}`, {
			idCentroCustos: 42,
			centroCustosList: [
				{ idCentroCustos: 42, valor: 50 },
				{ idCentroCustos: 43, valor: 50 },
			],
		});
		expect(res.status).toBe(200);
		expect(await mcc(id)).toEqual([
			[42, 50],
			[43, 50],
		]);
		expect(await mbCentro(id)).toBeNull();
	});

	it('"Limpar conciliação" (idCentroCustos null, no list) on a single-centre movement', async () => {
		const id = await criarComCentroUnico();
		const res = await request('PUT', `/api/movBancario/${id}`, {
			idPlanoContas: null,
			idCentroCustos: null,
			resultadoList: [],
			modalidadeMovimento: 'padrao',
		});
		expect(res.status).toBe(200);
		expect(await mcc(id)).toEqual([]);
		expect(await mbCentro(id)).toBeNull();
		expect(await resultados(id)).toEqual([]);
	});

	it('a split replaced by a one-item list sets MB.idCentroCustos to that centre', async () => {
		const id = await criarComCentroUnico();
		await request('PUT', `/api/movBancario/${id}`, {
			idCentroCustos: null,
			centroCustosList: [
				{ idCentroCustos: 37, valor: 60 },
				{ idCentroCustos: 42, valor: 40 },
			],
		});
		const res = await request('PUT', `/api/movBancario/${id}`, { centroCustosList: [{ idCentroCustos: 43, valor: 100 }] });
		expect(res.status).toBe(200);
		expect(await mcc(id)).toEqual([[43, 100]]);
		expect(await mbCentro(id)).toBe(43);
	});

	it('changing only the single centre still works', async () => {
		const id = await criarComCentroUnico();
		const res = await request('PUT', `/api/movBancario/${id}`, { idCentroCustos: 42 });
		expect(res.status).toBe(200);
		expect(await mcc(id)).toEqual([[42, 100]]);
		expect(await mbCentro(id)).toBe(42);
	});

	it('Bug 4: default Resultado/MCC use the NEW valor', async () => {
		const id = await criarComCentroUnico(-100);
		const res = await request('PUT', `/api/movBancario/${id}`, { valor: -150, idPlanoContas: 301, idCentroCustos: 42 });
		expect(res.status).toBe(200);
		expect(await resultados(id)).toEqual([{ idPlanoContas: 301, valor: 150, tipo: 'D' }]);
		expect(await mcc(id)).toEqual([[42, 150]]);
	});
});

describe('Bug 5 — same OFX line in two accounts (global UNIQUE identificador)', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	const linha = (conta: number, valor = -500) => linhaOfx({ fitid: 'FITX', valor, historico: 'TED', checkNum: '9', conta });

	it('imports into the second account with a conta suffix and re-import is idempotent in both', async () => {
		expect(await postBatch([linha(24)])).toMatchObject({ novos: 1, erros: 0 });
		const out = await postBatch([linha(25)]);
		expect(out).toMatchObject({ novos: 1, existentes: 0, erros: 0 });
		const base = `FITX|${DT}|-500.00|9`;
		expect((await rowsDaConta(24)).map((r) => r.identificador_ofx)).toEqual([base]);
		expect((await rowsDaConta(25)).map((r) => r.identificador_ofx)).toEqual([`${base}|@c25`]);

		expect(await postBatch([linha(25)])).toMatchObject({ novos: 0, existentes: 1, erros: 0 });
		expect(await postBatch([linha(24)])).toMatchObject({ novos: 0, existentes: 1, erros: 0 });
		expect(await rowsDaConta(24)).toHaveLength(1);
		expect(await rowsDaConta(25)).toHaveLength(1);
	});

	it('parser-fix correction of the suffixed row keeps it in its account', async () => {
		await postBatch([linha(24)]);
		await postBatch([linha(25)]);
		expect(await postBatch([linha(24, -5000)])).toMatchObject({ novos: 0, existentes: 1, erros: 0 });
		expect(await postBatch([linha(25, -5000)])).toMatchObject({ novos: 0, existentes: 1, erros: 0 });
		const base = `FITX|${DT}|-5000.00|9`;
		expect(await rowsDaConta(24)).toMatchObject([{ valor: -5000, identificador_ofx: base }]);
		expect(await rowsDaConta(25)).toMatchObject([{ valor: -5000, identificador_ofx: `${base}|@c25` }]);
	});

	it('POST /api/movBancario scopes the duplicate check by conta', async () => {
		const body = (conta: number) => ({ ...linha(conta), idPlanoContas: 300 });
		const r1 = await request('POST', '/api/movBancario', body(24));
		expect(r1.status).toBe(201);
		const r2 = await request('POST', '/api/movBancario', body(25));
		expect(r2.status).toBe(201);
		expect(r2.json.idContaCorrente).toBe(25);
		expect(r2.json.id).not.toBe(r1.json.id);
		const r3 = await request('POST', '/api/movBancario', body(25));
		expect(r3.status).toBe(200);
		expect(r3.json.id).toBe(r2.json.id);
		expect(await rowsDaConta(25)).toHaveLength(1);
	});
});

describe('Bugs 6/7 — bulk deletes', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	async function inserirMovimentos(conta: number, n: number) {
		const stmts = [];
		for (let i = 0; i < n; i++) {
			stmts.push(
				db
					.prepare(
						`INSERT INTO MovimentoBancario (dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, idPlanoContas)
						 VALUES ('2026-10-05', 'mov', ?, -1, 0, ?, 300)`,
					)
					.bind(conta, `bulk-${conta}-${i}`),
			);
		}
		await db.batch(stmts);
		await db
			.prepare(
				`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo)
				 SELECT dtMovimento, id, 300, idContaCorrente, 1, 'D' FROM MovimentoBancario WHERE idContaCorrente = ?`,
			)
			.bind(conta)
			.run();
	}

	it('Bug 6: reset-teste deletes accounts with more than 100 movements', async () => {
		await inserirMovimentos(24, 205);
		const res = await request('DELETE', '/api/movBancario/reset-teste?contas=24');
		expect(res.status).toBe(200);
		expect(res.json.excluidos).toBe(205);
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario`).first('n')).toBe(0);
		expect(await db.prepare(`SELECT COUNT(*) n FROM Resultado`).first('n')).toBe(0);
	});

	it('Bug 7: deleteAll reports failures instead of a silent partial 200', async () => {
		await inserirMovimentos(24, 3);
		const idBloqueado = await db.prepare(`SELECT MIN(id) id FROM MovimentoBancario`).first<number>('id');
		await db
			.prepare(
				`CREATE TRIGGER bloqueia_delete BEFORE DELETE ON MovimentoBancario WHEN OLD.id = ${idBloqueado}
				 BEGIN SELECT RAISE(ABORT, 'bloqueado'); END`,
			)
			.run();
		const res = await request('DELETE', '/api/movBancario/deleteAll/24');
		expect(res.status).not.toBe(200);
		expect(res.json).toMatchObject({ excluidos: 2, falhas: 1 });
		expect(typeof res.json.error).toBe('string');
	});

	it('Bug 7: deleteAll success keeps the old shape plus falhas: 0', async () => {
		await inserirMovimentos(24, 3);
		const res = await request('DELETE', '/api/movBancario/deleteAll/24');
		expect(res.status).toBe(200);
		expect(res.json).toMatchObject({ excluidos: 3, falhas: 0 });
		expect(typeof res.json.message).toBe('string');
	});
});

describe('Bug 8 — GET /api/movBancario maps every column', () => {
	beforeAll(async () => {
		await applySchema();
		await seed();
	});

	it('returns numeroDocumento, identificadorOfx, criadoEm, tipoMovimento, modalidadeMovimento, idUsuario', async () => {
		await postBatch([{ ...linhaOfx({ fitid: 'G1', valor: -10, historico: 'X' }), idPlanoContas: 300, idUsuario: 7 }]);
		const res = await request('GET', '/api/movBancario');
		expect(res.status).toBe(200);
		const [mov] = res.json as any[];
		expect(mov).toMatchObject({
			numeroDocumento: `G1|${DT}|-10.00`,
			identificadorOfx: `G1|${DT}|-10.00`,
			tipoMovimento: 'D',
			modalidadeMovimento: 'padrao',
			idUsuario: 7,
		});
		expect(mov.criadoEm).toBeTruthy();
		expect(mov.resultadoList).toHaveLength(1);
	});
});
