// "Memória de conciliação": a line classified with "Lembrar" is classified the same way on the next OFX
// imports of that conta (same direction, same histórico without dates/numbers), with the "memória" tag.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import { garantirSchemaMemoria } from '../backend/src/repositories/MemoriaConciliacaoRepository';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const CONTA = 11;
const OUTRA_CONTA = 12;
const UNIMED = 'Pagamento de Boleto - UNIMED PATOS DE MINAS COOPERAT';
const CENTROS = [21, 22, 23, 24, 25, 26];

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (${CONTA}, 'contaCorrente', 1, 'BB GFS'), (${OUTRA_CONTA}, 'contaCorrente', 1, 'BB RLF')`).run();
	await db.prepare(`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (300, 3, '002.005.001', 'Planos de saúde', 'custeio'), (301, 3, '002.005.002', 'Salários', 'custeio')`).run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES ${CENTROS.map((c) => `(${c}, 'Centro ${c}', 'CUSTEIO', 'DESPESA')`).join(', ')}`,
		)
		.run();
	await db
		.prepare(`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato, modalidade) VALUES (1, 'BB', '2026-01-01', 1000, 'C-1', 'CUSTEIO')`)
		.run();
	// Each test starts from this state (storage is reset between tests), so the memory schema is created here
	await garantirSchemaMemoria(db);
}

let seq = 0;
function linha(dia: string, valor: number, historico: string, conta = CONTA) {
	seq++;
	const dt = `2026-${dia}T00:00:00.000Z`;
	const identificadorOfx = `F${seq}|${dt}|${valor.toFixed(2)}`;
	return {
		dtMovimento: dt,
		historico,
		valor,
		saldo: 0,
		idContaCorrente: conta,
		identificadorOfx,
		numeroDocumento: identificadorOfx,
		tipoMovimento: valor >= 0 ? 'C' : 'D',
		modalidadeMovimento: 'padrao',
		ideagro: false,
		parcelado: false,
	};
}

type Mov = {
	id: number;
	idPlanoContas: number | null;
	idCentroCustos: number | null;
	idMemoriaConciliacao: number | null;
	resultadoList: Array<{ idPlanoContas: number; valor: number }>;
	centroCustosList: Array<{ idCentroCustos: number; valor: number }>;
};

async function importar(movimentos: unknown[]) {
	const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ movimentos }),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as { novos: number; existentes: number; classificadosPorMemoria: number; movimentos: Mov[] };
}

async function put(id: number, body: unknown) {
	const res = await SELF.fetch(`${BASE}/api/movBancario/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as Mov;
}

const get = async (path: string) => {
	const res = await SELF.fetch(`${BASE}${path}`);
	return { status: res.status, body: (await res.json()) as any };
};

const soma = (l: Array<{ valor: number }>) => Math.round(l.reduce((s, x) => s + Number(x.valor), 0) * 100);
const pendentes = async (ids: number[]) =>
	(
		await db
			.prepare(
				`SELECT COUNT(*) n FROM MovimentoBancario mb WHERE mb.id IN (${ids.join(',')})
				 AND NOT EXISTS (SELECT 1 FROM MovimentoCentroCustos c WHERE c.idMovimentoBancario = mb.id) AND mb.idCentroCustos IS NULL`,
			)
			.first<{ n: number }>()
	)!.n;

/** Unimed remembered with 6 centros, and a second Unimed imported after it (classified by the memory). */
async function unimedLembrada() {
	const primeiro = await importar([linha('10-06', -4705.57, UNIMED)]);
	const centroCustosList = CENTROS.map((c, i) => ({ idCentroCustos: c, valor: i < 5 ? 784.26 : 784.27 }));
	await put(primeiro.movimentos[0].id, { idPlanoContas: 300, idCentroCustos: null, centroCustosList, lembrarClassificacao: true });
	const lista = await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`);
	const segundo = await importar([linha('11-05', -5344.09, UNIMED)]);
	return { idMemoria: lista.body[0].id as number, idPrimeiro: primeiro.movimentos[0].id, tagged: segundo.movimentos[0] };
}

describe('memória de conciliação', () => {
	beforeAll(applySchema);

	let idMemoria = 0;
	let idTagged = 0;

	it('remembers the classification of a line and classifies the same text on the next import', async () => {
		const primeiro = await importar([linha('10-06', -4705.57, UNIMED)]);
		const id = primeiro.movimentos[0].id;
		expect(primeiro.classificadosPorMemoria).toBe(0);

		// 6 centros: 4 x 700 + 2 x 952.785 → R$ split of 4.705,57
		const centroCustosList = CENTROS.map((c, i) => ({ idCentroCustos: c, valor: i < 5 ? 784.26 : 784.27 }));
		const salvo = (await put(id, { idPlanoContas: 300, idCentroCustos: null, centroCustosList, lembrarClassificacao: true })) as Mov & {
			memoriaResultado: { acao: string };
		};
		expect(salvo.idMemoriaConciliacao).toBeNull();
		expect(salvo.memoriaResultado.acao).toBe('salva');

		const lista = await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`);
		expect(lista.body).toHaveLength(1);
		expect(lista.body[0]).toMatchObject({ tipoMovimento: 'D', chave: 'PAGAMENTO DE BOLETO - UNIMED PATOS DE MINAS COOPERAT', planos: [{ id: 300, pct: 100 }] });
		expect(lista.body[0].centros).toHaveLength(6);
		idMemoria = lista.body[0].id;

		// November: same boleto with another value, plus a Pix that has no memory
		const segundo = await importar([linha('11-05', -5344.09, 'Pagamento  de Boleto - Unimed Patos de Minas Cooperat'), linha('11-06', -201.94, 'Pix - Enviado - 06/11 10:40 PATRICIO')]);
		expect(segundo.novos).toBe(2);
		expect(segundo.classificadosPorMemoria).toBe(1);
		const [unimed, pix] = segundo.movimentos;
		idTagged = unimed.id;
		expect(unimed.idMemoriaConciliacao).toBe(idMemoria);
		expect(unimed.idPlanoContas).toBe(300);
		expect(unimed.centroCustosList.map((c) => c.idCentroCustos)).toEqual(CENTROS);
		expect(soma(unimed.centroCustosList)).toBe(534409);
		expect(soma(unimed.resultadoList)).toBe(534409);
		expect(pix.idMemoriaConciliacao).toBeNull();
		expect(pix.idPlanoContas).toBeNull();
		expect(await pendentes([unimed.id])).toBe(0);

		const usada = await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`);
		expect(usada.body[0].usos).toBe(1);

		// The modal of the new line opens with "Lembrar" ticked and shows the recognized text
		const doMov = await get(`/api/memoriaConciliacao/movimento/${unimed.id}`);
		expect(doMov.body).toMatchObject({ chave: 'PAGAMENTO DE BOLETO - UNIMED PATOS DE MINAS COOPERAT', tipoMovimento: 'D', memoria: { id: idMemoria } });

		// "Pela memória" filter of the Conciliação list
		const filtro = await get(`/api/movBancario/paginado?page=1&limit=50&contaId=${CONTA}&status=memoria`);
		expect(filtro.body.movimentos.map((m: Mov) => m.id)).toEqual([unimed.id]);
	});

	it('does not apply to another conta, to the other direction, nor to a re-imported line', async () => {
		({ idMemoria, tagged: { id: idTagged } } = await unimedLembrada());
		const outra = await importar([linha('11-07', -100, UNIMED, OUTRA_CONTA), linha('11-07', 100, UNIMED)]);
		expect(outra.classificadosPorMemoria).toBe(0);
		expect(outra.movimentos.every((m) => m.idMemoriaConciliacao == null)).toBe(true);

		const antes = await db.prepare(`SELECT * FROM MovimentoBancario WHERE id = ?`).bind(idTagged).first();
		const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ movimentos: [await db.prepare(`SELECT identificador_ofx FROM MovimentoBancario WHERE id = ?`).bind(idTagged).first<{ identificador_ofx: string }>().then((r) => ({ ...linha('11-05', -5344.09, UNIMED), identificadorOfx: r!.identificador_ofx }))] }),
		});
		const reimport = (await res.json()) as { novos: number; existentes: number; classificadosPorMemoria: number };
		expect(reimport).toMatchObject({ novos: 0, existentes: 1, classificadosPorMemoria: 0 });
		expect(await db.prepare(`SELECT * FROM MovimentoBancario WHERE id = ?`).bind(idTagged).first()).toEqual(antes);
	});

	it('saving the same classification keeps the tag; reclassifying by hand removes it', async () => {
		({ idMemoria, tagged: { id: idTagged } } = await unimedLembrada());
		const mesmo = await put(idTagged, { historico: UNIMED });
		expect(mesmo.idMemoriaConciliacao).toBe(idMemoria);
		const outro = await put(idTagged, { idPlanoContas: 301 });
		expect(outro.idMemoriaConciliacao).toBeNull();
	});

	it('lembrarClassificacao false forgets the memory; financing lines are never remembered', async () => {
		({ idMemoria } = await unimedLembrada());
		const imp = await importar([linha('11-08', -50, 'Parc Cred Rural 0440286'), linha('11-09', -80, UNIMED)]);
		const [parcela, unimed] = imp.movimentos;
		expect(unimed.idMemoriaConciliacao).toBe(idMemoria);

		await put(parcela.id, { modalidadeMovimento: 'financiamento', idFinanciamento: 1, lembrarClassificacao: true });
		expect((await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`)).body).toHaveLength(1);

		const esquecido = await put(unimed.id, { lembrarClassificacao: false });
		expect(esquecido.idMemoriaConciliacao).toBeNull();
		expect(esquecido.idPlanoContas).toBe(300); // the line keeps its classification
		expect((await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`)).body).toHaveLength(0);
		expect((await get(`/api/memoriaConciliacao/movimento/${unimed.id}`)).body.memoria).toBeNull();

		const depois = await importar([linha('12-05', -90, UNIMED)]);
		expect(depois.classificadosPorMemoria).toBe(0);
	});

	it('refuses an incomplete classification or a text with nothing to recognize, and counts variations', async () => {
		const imp = await importar([
			linha('11-10', -30, 'DEB.TIT.COMPE EFETIVADO'),
			linha('11-11', -40, 'DEB.TIT.COMPE EFETIVADO'),
			linha('11-12', -50, 'DEB.TIT.COMPE EFETIVADO'),
			linha('11-13', -60, '000123 - 05/11/2026'),
		]);
		const [a, b, c, numeros] = imp.movimentos;
		const pendente = (await put(a.id, { idPlanoContas: 300, lembrarClassificacao: true })) as unknown as { memoriaResultado: { acao: string; motivo: string } };
		expect(pendente.memoriaResultado).toMatchObject({ acao: 'recusada', motivo: expect.stringContaining('Complete') });
		const semTexto = (await put(numeros.id, { idPlanoContas: 300, idCentroCustos: 21, lembrarClassificacao: true })) as unknown as {
			memoriaResultado: { acao: string };
		};
		expect(semTexto.memoriaResultado.acao).toBe('recusada');
		expect((await get(`/api/memoriaConciliacao/movimento/${numeros.id}`)).body).toMatchObject({ chave: '', memoria: null });

		// the same generic text paid to two suppliers: the third line sees 2 variations
		await put(a.id, { idPlanoContas: 300, idCentroCustos: 21 });
		await put(b.id, { idPlanoContas: 301, idCentroCustos: 22 });
		expect((await get(`/api/memoriaConciliacao/movimento/${c.id}`)).body).toMatchObject({ chave: 'DEB TIT COMPE EFETIVADO', variacoes: 2 });
		expect((await get(`/api/memoriaConciliacao?idContaCorrente=${CONTA}`)).body).toHaveLength(0);
	});

	it('DELETE removes a memory and the tag of the lines it classified', async () => {
		const imp = await importar([linha('12-06', -10, 'Tarifa Pacote Servicos 10/2026')]);
		await put(imp.movimentos[0].id, { idPlanoContas: 301, idCentroCustos: 21, lembrarClassificacao: true });
		const nova = await importar([linha('12-07', -12, 'Tarifa Pacote Servicos 11/2026')]);
		expect(nova.movimentos[0].idMemoriaConciliacao).toBeGreaterThan(0);
		const idMem = nova.movimentos[0].idMemoriaConciliacao!;

		const del = await SELF.fetch(`${BASE}/api/memoriaConciliacao/${idMem}`, { method: 'DELETE' });
		expect(del.status).toBe(200);
		const tag = await db.prepare(`SELECT idMemoriaConciliacao, idPlanoContas FROM MovimentoBancario WHERE id = ?`).bind(nova.movimentos[0].id).first();
		expect(tag).toEqual({ idMemoriaConciliacao: null, idPlanoContas: 301 });
		expect((await SELF.fetch(`${BASE}/api/memoriaConciliacao/${idMem}`, { method: 'DELETE' })).status).toBe(404);
		expect((await get(`/api/memoriaConciliacao`)).status).toBe(400);
	});
});
