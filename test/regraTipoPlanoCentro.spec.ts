// Integration tests: the worker refuses a despesa whose plano and centro have different types
// (investimento → investimento, custeio → custeio; rule of 13/11/2026), on every path that classifies a line:
// PUT and POST /api/movBancario, the memória de conciliação applied by the import, and "Lembrar".
import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const CONTA = 24;
// planos
const P_CUSTEIO = 300; // Manutenção de máquinas
const P_CUSTEIO_2 = 301; // Energia elétrica
const P_INVEST = 310; // Obras e instalações
const P_INVEST_2 = 311; // Compra de máquinas
// centros
const C_CUSTEIO = 42; // Leite - Produção (custeio)
const C_CUSTEIO_2 = 43;
const C_INVEST = 50; // Leite - Produção (investimento)
const C_INVEST_2 = 51;
const C_RECEITA = 60;

async function applySchema() {
	for (const sql of schemaSql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
		await db.prepare(sql).run();
	}
}

type Mov = {
	id: number;
	valor: number;
	idPlanoContas: number | null;
	idCentroCustos: number | null;
	idMemoriaConciliacao: number | null;
	resultadoList: Array<{ idPlanoContas: number; valor: number }>;
	centroCustosList: Array<{ idCentroCustos: number; valor: number }>;
	memoriaResultado?: { acao: string; motivo?: string };
};

let seq = 0;
function linha(valor: number, historico: string, dia = '2026-11-10') {
	const dt = `${dia}T00:00:00.000Z`;
	seq += 1;
	return {
		dtMovimento: dt,
		historico,
		valor,
		saldo: 0,
		idContaCorrente: CONTA,
		identificadorOfx: `REGRA${seq}|${dt}|${valor.toFixed(2)}`,
		tipoMovimento: valor < 0 ? 'D' : 'C',
		modalidadeMovimento: 'padrao',
		ideagro: false,
		parcelado: false,
	};
}

async function importar(movimentos: unknown[]) {
	const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ movimentos }),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as { novos: number; classificadosPorMemoria: number; movimentos: Mov[] };
}

const nova = async (valor: number, historico = 'Pagamento de Boleto - Fornecedor') => (await importar([linha(valor, historico)])).movimentos[0];

async function put(id: number, body: unknown) {
	const res = await SELF.fetch(`${BASE}/api/movBancario/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as Mov & { error?: string } };
}

const guardado = async (id: number) =>
	(await db.prepare(`SELECT idPlanoContas, idCentroCustos, historico FROM MovimentoBancario WHERE id = ?`).bind(id).first<{
		idPlanoContas: number | null;
		idCentroCustos: number | null;
		historico: string;
	}>())!;

/** A despesa classified before the rule existed: investimento plano in a custeio centre, written straight to the DB. */
async function legado(valor = -1000, historico = 'DÉB.TIT.COMPE EFETIVADO') {
	const mov = await nova(valor, historico);
	const abs = Math.abs(valor);
	await db.batch([
		db.prepare(`UPDATE MovimentoBancario SET idPlanoContas = ?, idCentroCustos = ? WHERE id = ?`).bind(P_INVEST, C_CUSTEIO, mov.id),
		db
			.prepare(`INSERT INTO Resultado (dtMovimento, idMovimentoBancario, idPlanoContas, idContaCorrente, valor, tipo) VALUES ('2026-11-10T00:00:00.000Z', ?, ?, ?, ?, 'D')`)
			.bind(mov.id, P_INVEST, CONTA, abs),
		db.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, ?, ?)`).bind(mov.id, C_CUSTEIO, abs),
	]);
	return mov.id;
}

beforeAll(async () => {
	await applySchema();
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (${CONTA}, 'contaCorrente', 1, 'BB GFS')`).run();
	await db
		.prepare(
			`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES
			 (${P_CUSTEIO}, 3, '002.001.001', 'Manutenção de Máquinas e Equipamentos', 'custeio'),
			 (${P_CUSTEIO_2}, 3, '002.001.002', 'Energia elétrica', 'custeio'),
			 (${P_INVEST}, 3, '002.005.001', 'Obras e instalações', 'investimento'),
			 (${P_INVEST_2}, 3, '002.005.002', 'Compra de máquinas, veículos, ferramentas e equipamentos', 'investimento')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (${C_CUSTEIO}, 'Leite - Produção', 'CUSTEIO', 'DESPESA'),
			 (${C_CUSTEIO_2}, 'Leite - Recria', 'CUSTEIO', 'DESPESA'),
			 (${C_INVEST}, 'Leite - Produção', 'INVESTIMENTO', 'DESPESA'),
			 (${C_INVEST_2}, 'Agricultura', 'INVESTIMENTO', 'DESPESA'),
			 (${C_RECEITA}, 'Venda de leite', 'CUSTEIO', 'RECEITA')`,
		)
		.run();
});

describe('PUT /api/movBancario/:id — one plano type', () => {
	it('investimento plano with a custeio centre is refused with a clear message, and nothing is saved', async () => {
		const mov = await nova(-23541);
		const r = await put(mov.id, { idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO });
		expect(r.status).toBe(400);
		expect(r.body.error).toBe('O plano de contas é de investimento: o centro de custos também precisa ser de investimento.');
		expect(await guardado(mov.id)).toMatchObject({ idPlanoContas: null, idCentroCustos: null });
	});

	it('investimento plano with an investimento centre is saved', async () => {
		const mov = await nova(-23541);
		const r = await put(mov.id, { idPlanoContas: P_INVEST, idCentroCustos: C_INVEST });
		expect(r.status).toBe(200);
		expect(await guardado(mov.id)).toMatchObject({ idPlanoContas: P_INVEST, idCentroCustos: C_INVEST });
	});

	it('custeio plano: custeio centre saved, investimento centre refused', async () => {
		const mov = await nova(-500);
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: C_INVEST })).status).toBe(400);
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: C_CUSTEIO })).status).toBe(200);
	});

	it('a rateio between centres must stay inside the plano type', async () => {
		const mov = await nova(-1000);
		const misto = await put(mov.id, {
			idPlanoContas: P_INVEST,
			idCentroCustos: null,
			centroCustosList: [{ idCentroCustos: C_INVEST, valor: 600 }, { idCentroCustos: C_CUSTEIO, valor: 400 }],
		});
		expect(misto.status).toBe(400);
		const certo = await put(mov.id, {
			idPlanoContas: P_INVEST,
			idCentroCustos: null,
			centroCustosList: [{ idCentroCustos: C_INVEST, valor: 600 }, { idCentroCustos: C_INVEST_2, valor: 400 }],
		});
		expect(certo.status).toBe(200);
		expect(certo.body.centroCustosList).toHaveLength(2);
	});

	it('changing only the centre is checked against the plano already saved', async () => {
		const mov = await nova(-800);
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: C_CUSTEIO })).status).toBe(200);
		expect((await put(mov.id, { idCentroCustos: C_INVEST })).status).toBe(400);
		expect((await put(mov.id, { idCentroCustos: C_CUSTEIO_2 })).status).toBe(200);
		// and changing only the plano against the centre already saved
		expect((await put(mov.id, { idPlanoContas: P_INVEST })).status).toBe(400);
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO_2 })).status).toBe(200);
	});
});

describe('PUT /api/movBancario/:id — both plano types in one line (card bill)', () => {
	// the screen sends each plano of a rateio as a full Resultado line
	const resultado = (idPlanoContas: number, valor: number) => ({
		dtMovimento: '2026-11-10T00:00:00.000Z',
		idPlanoContas,
		idContaCorrente: CONTA,
		valor,
		tipo: 'D',
	});
	const planos = [resultado(P_INVEST_2, 4000), resultado(P_CUSTEIO, 7678.1)];

	it('saved when each type has the same total in planos and centros (what "Detalhar por itens" sends)', async () => {
		const mov = await nova(-11678.1, 'DEB.CTA.FATURA-033227742');
		const r = await put(mov.id, {
			idPlanoContas: null,
			resultadoList: planos,
			idCentroCustos: null,
			centroCustosList: [
				{ idCentroCustos: C_INVEST, valor: 4000 },
				{ idCentroCustos: C_CUSTEIO, valor: 5000 },
				{ idCentroCustos: C_CUSTEIO_2, valor: 2678.1 },
			],
		});
		expect(r.status).toBe(200);
		expect(r.body.resultadoList).toHaveLength(2);
		expect(r.body.centroCustosList).toHaveLength(3);
	});

	it('refused when the totals per type differ, pointing to "Detalhar por itens"', async () => {
		const mov = await nova(-11678.1, 'DEB.CTA.FATURA-033220877');
		const r = await put(mov.id, {
			idPlanoContas: null,
			resultadoList: planos,
			idCentroCustos: null,
			centroCustosList: [{ idCentroCustos: C_CUSTEIO, valor: 9000 }, { idCentroCustos: C_CUSTEIO_2, valor: 2678.1 }],
		});
		expect(r.status).toBe(400);
		expect(r.body.error).toContain('Detalhar por itens');
		expect(await db.prepare(`SELECT COUNT(*) n FROM Resultado WHERE idMovimentoBancario = ?`).bind(mov.id).first<{ n: number }>()).toEqual({ n: 0 });
	});
});

describe('lines classified before the rule', () => {
	it('stay as they are: a PUT that does not change plano/centro goes through', async () => {
		const id = await legado();
		expect((await put(id, { historico: 'DÉB.TIT.COMPE EFETIVADO - obra do galpão' })).status).toBe(200);
		// the screen sending the same classification again (e.g. only the description changed)
		expect((await put(id, { idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO, descricao: 'conferido' })).status).toBe(200);
		expect(await guardado(id)).toMatchObject({ idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO });
	});

	it('reclassifying one of them has to follow the rule', async () => {
		const id = await legado();
		expect((await put(id, { idCentroCustos: C_CUSTEIO_2 })).status).toBe(400);
		expect((await put(id, { idCentroCustos: C_INVEST })).status).toBe(200);
		expect(await guardado(id)).toMatchObject({ idPlanoContas: P_INVEST, idCentroCustos: C_INVEST });
	});

	it('"Lembrar" is refused for a line that breaks the rule (the classification itself is kept)', async () => {
		const id = await legado(-1500, 'Pagamento de Boleto - JUCA INDUSTRIA E COMERCIO');
		const r = await put(id, { idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO, lembrarClassificacao: true });
		expect(r.status).toBe(200);
		expect(r.body.memoriaResultado).toMatchObject({ acao: 'recusada' });
		expect(r.body.memoriaResultado?.motivo).toContain('investimento');
	});
});

describe('what the rule leaves alone', () => {
	it('credits (no plano, receita centre)', async () => {
		const mov = await nova(15000, 'Venda de leite - Laticínio');
		expect((await put(mov.id, { idCentroCustos: C_RECEITA })).status).toBe(200);
	});

	it('clearing the classification of a despesa', async () => {
		const mov = await nova(-300);
		await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: C_CUSTEIO });
		const r = await put(mov.id, { idPlanoContas: null, idCentroCustos: null, limparConciliacao: true });
		expect(r.status).toBe(200);
	});

	it('financiamento and movimentação sem efeito (no centre involved)', async () => {
		const mov = await nova(-900, 'Pagamento de parcela');
		expect((await put(mov.id, { modalidadeMovimento: 'transferencia', idPlanoContas: P_INVEST, idCentroCustos: null })).status).toBe(200);
	});
});

describe('POST /api/movBancario (lançamento manual)', () => {
	const corpo = (extra: object) => ({ ...linha(-750, 'Lançamento manual - obra'), ...extra });
	const post = (body: unknown) =>
		SELF.fetch(`${BASE}/api/movBancario`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

	it('refuses a despesa with plano and centro of different types', async () => {
		const res = await post(corpo({ idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO }));
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toContain('investimento');
	});

	it('creates it when the types match', async () => {
		const res = await post(corpo({ idPlanoContas: P_INVEST, idCentroCustos: C_INVEST }));
		expect(res.status).toBe(201);
	});
});

describe('memória de conciliação', () => {
	const UNIMED = 'Pagamento de Boleto - UNIMED PATOS DE MINAS';

	it('a memory that follows the rule classifies the next import', async () => {
		const mov = await nova(-400, UNIMED);
		const r = await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: C_CUSTEIO, lembrarClassificacao: true });
		expect(r.body.memoriaResultado).toMatchObject({ acao: 'salva' });
		const proxima = await importar([linha(-410, UNIMED, '2026-12-10')]);
		expect(proxima.classificadosPorMemoria).toBe(1);
		expect(proxima.movimentos[0]).toMatchObject({ idPlanoContas: P_CUSTEIO, idCentroCustos: C_CUSTEIO });
	});

	it('a memory saved before the rule that breaks it is not applied: the line comes in unclassified', async () => {
		const OBRA = 'Pagamento de Boleto - G5 CONSTRUCOES LTDA';
		await importar([linha(-10, 'aquece o schema da memória')]);
		await db
			.prepare(
				`INSERT INTO memoriaConciliacao (idContaCorrente, tipoMovimento, chave, historicoExemplo, modalidadeMovimento, planosJson, centrosJson)
				 VALUES (?, 'D', 'PAGAMENTO DE BOLETO - G5 CONSTRUCOES LTDA', ?, 'padrao', ?, ?)`,
			)
			.bind(CONTA, OBRA, JSON.stringify([{ id: P_INVEST, pct: 100 }]), JSON.stringify([{ id: C_CUSTEIO, pct: 100 }]))
			.run();

		const r = await importar([linha(-2540, OBRA)]);
		expect(r.novos).toBe(1);
		expect(r.classificadosPorMemoria).toBe(0);
		expect(r.movimentos[0]).toMatchObject({ idPlanoContas: null, idCentroCustos: null, idMemoriaConciliacao: null });
	});
});

/* ------------------------------------------------------------------ */
/* Regression guard: what has to keep working with the rule in place.  */

const json = { 'Content-Type': 'application/json' };

const linhasDe = async (id: number) => ({
	planos: (await db.prepare(`SELECT idPlanoContas, valor FROM Resultado WHERE idMovimentoBancario = ? ORDER BY id`).bind(id).all<{ idPlanoContas: number; valor: number }>())
		.results,
	centros: (
		await db
			.prepare(`SELECT idCentroCustos, valor FROM MovimentoCentroCustos WHERE idMovimentoBancario = ? ORDER BY id`)
			.bind(id)
			.all<{ idCentroCustos: number; valor: number }>()
	).results,
});

/** Like legado(), but with the centres in a 60/40 rateio (the column of the line is NULL, as the screen stores it). */
async function legadoComRateio(valor = -1000, historico = 'DÉB.TIT.COMPE EFETIVADO - rateio') {
	const id = await legado(valor, historico);
	const abs = Math.abs(valor);
	await db.batch([
		db.prepare(`UPDATE MovimentoBancario SET idCentroCustos = NULL WHERE id = ?`).bind(id),
		db.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`).bind(id),
		db
			.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, ?, ?), (?, ?, ?)`)
			.bind(id, C_CUSTEIO, abs * 0.6, id, C_CUSTEIO_2, abs * 0.4),
	]);
	return id;
}

describe('regression guard — lines classified before the rule', () => {
	const comoEstava = { planos: [{ idPlanoContas: P_INVEST, valor: 1000 }], centros: [{ idCentroCustos: C_CUSTEIO, valor: 1000 }] };

	it('edits that are not a reclassification go through and leave the classification as it was', async () => {
		const id = await legado();
		expect((await put(id, { historico: 'DÉB.TIT.COMPE EFETIVADO - galpão' })).status).toBe(200);
		expect((await put(id, { descricao: 'nota 123', numeroDocumento: '987' })).status).toBe(200);
		expect((await put(id, { ideagro: true })).status).toBe(200);
		const patch = await SELF.fetch(`${BASE}/api/movBancario/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ ideagro: false }) });
		expect(patch.status).toBe(200);
		expect(await linhasDe(id)).toEqual(comoEstava);
	});

	it('the body the screen sends when the classification did not change (same ids, resultadoList []) is accepted', async () => {
		const id = await legado();
		const r = await put(id, { idPlanoContas: P_INVEST, idCentroCustos: C_CUSTEIO, resultadoList: [], idPessoa: null, modalidadeMovimento: 'padrao' });
		expect(r.status).toBe(200);
		expect(await linhasDe(id)).toEqual(comoEstava);
	});

	it('a rateio saved before the rule is left alone when it is sent back unchanged', async () => {
		const id = await legadoComRateio();
		const mesmoRateio = [{ idCentroCustos: C_CUSTEIO_2, valor: 400 }, { idCentroCustos: C_CUSTEIO, valor: 600 }];
		expect((await put(id, { idCentroCustos: null, centroCustosList: mesmoRateio, descricao: 'conferido' })).status).toBe(200);
		expect((await put(id, { idPlanoContas: P_INVEST, idCentroCustos: null, resultadoList: [] })).status).toBe(200);
		expect((await linhasDe(id)).centros).toHaveLength(2);
	});

	it('can become a movimentação sem efeito, be cleared ("Limpar conciliação") and be deleted', async () => {
		const a = await legado(-1000, 'DÉB.TIT.COMPE - vira movimentação');
		expect((await put(a, { modalidadeMovimento: 'transferencia', idCentroCustos: null })).status).toBe(200);

		const b = await legadoComRateio(-2000);
		const limpar = { idPlanoContas: null, idCentroCustos: null, resultadoList: [], modalidadeMovimento: 'padrao', limparConciliacao: true };
		expect((await put(b, limpar)).status).toBe(200);
		expect(await linhasDe(b)).toEqual({ planos: [], centros: [] });

		const c = await legado(-3000, 'DÉB.TIT.COMPE - será excluído');
		expect((await SELF.fetch(`${BASE}/api/movBancario/${c}`, { method: 'DELETE' })).status).toBe(200);
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario WHERE id = ?`).bind(c).first()).toEqual({ n: 0 });
	});
});

describe('regression guard — a rateio is still checked when only the other side changes', () => {
	it('centres in a rateio: the plano cannot change type, even with idCentroCustos sent as null again', async () => {
		const mov = await nova(-1000);
		const rateio = [{ idCentroCustos: C_CUSTEIO, valor: 600 }, { idCentroCustos: C_CUSTEIO_2, valor: 400 }];
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO, idCentroCustos: null, centroCustosList: rateio })).status).toBe(200);
		// null again does not clear a rateio (the column is already NULL): the custeio centres stay
		expect((await put(mov.id, { idPlanoContas: P_INVEST, idCentroCustos: null })).status).toBe(400);
		expect((await put(mov.id, { idPlanoContas: P_CUSTEIO_2, idCentroCustos: null })).status).toBe(200);
		expect(await linhasDe(mov.id)).toEqual({
			planos: [{ idPlanoContas: P_CUSTEIO_2, valor: 1000 }],
			centros: [{ idCentroCustos: C_CUSTEIO, valor: 600 }, { idCentroCustos: C_CUSTEIO_2, valor: 400 }],
		});
	});
});

describe('regression guard — import and memória with the rule in place', () => {
	it('memories of a receita and of a movimentação sem efeito keep classifying the next import', async () => {
		const LEITE = 'Recebimento Pix - LATICINIO SERRA AZUL';
		const receita = await nova(15000, LEITE);
		expect((await put(receita.id, { idCentroCustos: C_RECEITA, lembrarClassificacao: true })).body.memoriaResultado).toMatchObject({ acao: 'salva' });

		const APLIC = 'Transferência enviada - CONTA INVESTIMENTO GFS';
		const semEfeito = await nova(-9000, APLIC);
		const r = await put(semEfeito.id, { modalidadeMovimento: 'transferencia', idPlanoContas: P_CUSTEIO, idCentroCustos: null, lembrarClassificacao: true });
		expect(r.body.memoriaResultado).toMatchObject({ acao: 'salva' });

		const proximo = await importar([linha(16000, LEITE, '2026-12-10'), linha(-7000, APLIC, '2026-12-10')]);
		expect(proximo).toMatchObject({ novos: 2, classificadosPorMemoria: 2 });
	});

	it('a memory with both types (card bill) classifies a line of another value, cents included', async () => {
		const FATURA = 'Pagamento de Boleto - CARTAO OUROCARD EMPRESARIAL';
		const res = (idPlanoContas: number, valor: number) => ({ dtMovimento: '2026-11-10T00:00:00.000Z', idPlanoContas, idContaCorrente: CONTA, valor, tipo: 'D' });
		const mov = await nova(-11678.1, FATURA);
		const salvo = await put(mov.id, {
			idPlanoContas: null,
			resultadoList: [res(P_INVEST_2, 4000), res(P_CUSTEIO, 7678.1)],
			idCentroCustos: null,
			centroCustosList: [{ idCentroCustos: C_INVEST, valor: 4000 }, { idCentroCustos: C_CUSTEIO, valor: 5000 }, { idCentroCustos: C_CUSTEIO_2, valor: 2678.1 }],
			lembrarClassificacao: true,
		});
		expect(salvo.body.memoriaResultado).toMatchObject({ acao: 'salva' });

		const proxima = await importar([linha(-3333.33, FATURA, '2026-12-10')]);
		expect(proxima.classificadosPorMemoria).toBe(1);
		const { planos, centros } = await linhasDe(proxima.movimentos[0].id);
		expect(planos).toHaveLength(2);
		expect(centros).toHaveLength(3);
		expect(Math.round(planos.reduce((a, p) => a + p.valor, 0) * 100)).toBe(333333);
		expect(Math.round(centros.reduce((a, c) => a + c.valor, 0) * 100)).toBe(333333);
	});

	it('importing the same file again creates nothing, also for the line whose memory the rule refused', async () => {
		const OBRA = 'Pagamento de Boleto - G5 CONSTRUCOES LTDA';
		await importar([linha(-10, 'aquece o schema da memória')]);
		await db
			.prepare(
				`INSERT INTO memoriaConciliacao (idContaCorrente, tipoMovimento, chave, historicoExemplo, modalidadeMovimento, planosJson, centrosJson)
				 VALUES (?, 'D', 'PAGAMENTO DE BOLETO - G5 CONSTRUCOES LTDA', ?, 'padrao', ?, ?)`,
			)
			.bind(CONTA, OBRA, JSON.stringify([{ id: P_INVEST, pct: 100 }]), JSON.stringify([{ id: C_CUSTEIO, pct: 100 }]))
			.run();
		const arquivo = [linha(-2540, OBRA), linha(-80, 'Tarifa de pacote de serviços'), linha(500, 'Pix recebido - FULANO')];
		expect(await importar(arquivo)).toMatchObject({ novos: 3, classificadosPorMemoria: 0 });
		expect((await importar(arquivo)).novos).toBe(0);
		expect(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario`).first()).toEqual({ n: 4 });
	});
});

describe('regression guard — outside the rule', () => {
	it('a despesa with only the plano, or only the centre, is saved (nothing to compare yet)', async () => {
		const a = await nova(-120, 'Pagamento de Boleto - A');
		expect((await put(a.id, { idPlanoContas: P_INVEST })).status).toBe(200);
		const b = await nova(-130, 'Pagamento de Boleto - B');
		expect((await put(b.id, { idCentroCustos: C_CUSTEIO })).status).toBe(200);
	});

	it('a plano or a centre without a known type is not checked', async () => {
		await db.prepare(`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (320, 3, '002.009.001', 'Plano sem tipo', '')`).run();
		const mov = await nova(-140, 'Pagamento de Boleto - C');
		expect((await put(mov.id, { idPlanoContas: 320, idCentroCustos: C_INVEST })).status).toBe(200);
		expect((await put(mov.id, { idPlanoContas: 320, idCentroCustos: C_CUSTEIO })).status).toBe(200);
	});

	it('a receita and a despesa without classification are created by hand (POST)', async () => {
		const post = (body: unknown) => SELF.fetch(`${BASE}/api/movBancario`, { method: 'POST', headers: json, body: JSON.stringify(body) });
		expect((await post({ ...linha(900, 'Lançamento manual - venda'), idCentroCustos: C_RECEITA })).status).toBe(201);
		expect((await post(linha(-75, 'Lançamento manual - sem classificação'))).status).toBe(201);
	});
});
