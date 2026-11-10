// Integration tests of the WHOLE OFX import path, the way the screen runs it: the real parser
// (parseOFXContent) → the real sender (salvarMovimentosOFX, batches of 10) → the real worker and D1.
// The invariant every test checks: each line of the bank file is saved exactly once, re-importing never
// duplicates, and nothing is lost when equal lines (same day, valor and histórico) fall in different batches.
// Background: on 10/11/2026, 5 of 22 "BB Consórcio - Prestação" lines of the BB GFS file were lost.
import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';
import { parseOFXContent } from '../frontend/src/Utils/parseOfxFile';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn() } }));

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const CONTA = 24;
const OUTRA_CONTA = 25;
const PLANO = 278;
const CENTRO = 90;

// The screen calls `${VITE_API_URL}/api/...`: send every request to this worker instead.
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input instanceof Request ? input.url : input);
	return SELF.fetch(`${BASE}${url.slice(url.indexOf('/api/'))}`, init);
});
const { salvarMovimentosOFX } = await import('../frontend/src/services/movimentoBancarioService');

async function applySchema() {
	for (const sql of schemaSql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
		await db.prepare(sql).run();
	}
}

/* ------------------------------------------------------------------ */
/* OFX builder                                                          */

type Linha = { dia: string; valor: number; memo: string; fitid: string; checkNum?: string; refNum?: string };

const CONSORCIO = 'BB Consórcio - Prestação';

/** BB FITID: YYYYMMDD + '1' + centavos + '0' + occurrence (none on the first, then 2, 3…). */
const fitidBB = (dia: string, valor: number, n: number) => `${dia.replace(/-/g, '')}1${Math.round(Math.abs(valor) * 100)}0${n > 1 ? n : ''}`;

/** Lines with BB-style FITIDs: equal day+valor get the next occurrence number, like the bank does. */
function linhasBB(itens: Array<{ dia: string; valor: number; memo: string; checkNum?: string; refNum?: string }>): Linha[] {
	const vistos = new Map<string, number>();
	return itens.map((i) => {
		const k = `${i.dia}|${i.valor}`;
		const n = (vistos.get(k) ?? 0) + 1;
		vistos.set(k, n);
		return { ...i, fitid: fitidBB(i.dia, i.valor, n) };
	});
}

function ofx(linhas: Linha[], bankId = '1') {
	const trn = linhas
		.map(
			(l) =>
				`<STMTTRN>\n<TRNTYPE>${l.valor < 0 ? 'DEBIT' : 'CREDIT'}\n<DTPOSTED>${l.dia.replace(/-/g, '')}120000[-3:BRT]\n<TRNAMT>${l.valor.toFixed(2)}\n<FITID>${l.fitid}\n` +
				(l.checkNum ? `<CHECKNUM>${l.checkNum}\n` : '') +
				(l.refNum ? `<REFNUM>${l.refNum}\n` : '') +
				`<MEMO>${l.memo}\n</STMTTRN>`,
		)
		.join('\n');
	return `OFXHEADER:100\nDATA:OFXSGML\nCHARSET:1252\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>${bankId}<ACCTID>123<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST>\n${trn}\n</BANKTRANLIST><LEDGERBAL><BALAMT>0<DTASOF>20261130</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
}

/** The 22 consórcio installments of 10/11/2026 (bank order) + 10 other lines of the same day. */
function extratoBB1011(): Linha[] {
	const valores = [2862.81, ...Array(5).fill(862.93), 609.13, 862.93, ...Array(11).fill(792.58), 3637.88, 3637.88, 4850.5];
	const outros = [-1378, -3900.27, -13680.75, -30825.02, -321.13, -565.25, -41.51, -275.7, -84.76, -516.26];
	return linhasBB([
		...valores.map((v) => ({ dia: '2026-11-10', valor: -v, memo: CONSORCIO, checkNum: '14033' })),
		...outros.map((v, i) => ({ dia: '2026-11-10', valor: v, memo: `Pagamento de boleto ${i + 1}`, checkNum: String(111001 + i) })),
	]);
}

/** Deterministic shuffle (mulberry32), so a failure can be reproduced. */
function embaralhar<T>(lista: T[], semente: number): T[] {
	let s = semente >>> 0;
	const rnd = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const out = [...lista];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/* ------------------------------------------------------------------ */
/* Screen-like import + checks                                          */

async function importarArquivo(linhas: Linha[], conta = CONTA, bankId = '1') {
	const { movimentos } = parseOFXContent(ofx(linhas, bankId));
	const r = await salvarMovimentosOFX(movimentos, conta);
	return { ...r, parseados: movimentos };
}

type Row = { id: number; valor: number; historico: string; identificador_ofx: string; idPlanoContas: number | null; idCentroCustos: number | null };
const noBanco = async (conta = CONTA) =>
	(await db.prepare(`SELECT id, valor, historico, identificador_ofx, idPlanoContas, idCentroCustos FROM MovimentoBancario WHERE idContaCorrente = ? ORDER BY id`).bind(conta).all<Row>())
		.results;
const centavos = (l: Array<{ valor: number }>) => l.reduce((s, x) => s + Math.round(Number(x.valor) * 100), 0);
const fitidsDe = (rows: Row[]) => rows.map((r) => r.identificador_ofx.split('|')[0]).sort();

/** Every line of the file is in the conta exactly once, with the file total. */
async function esperarArquivoCompleto(linhas: Linha[], conta = CONTA) {
	const rows = await noBanco(conta);
	expect(fitidsDe(rows)).toEqual(linhas.map((l) => l.fitid).sort());
	expect(centavos(rows)).toBe(centavos(linhas));
	return rows;
}

beforeAll(async () => {
	await applySchema();
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco do Brasil', '001')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (${CONTA}, 'contaCorrente', 1, 'BB GFS'), (${OUTRA_CONTA}, 'contaCorrente', 1, 'BB JPT')`).run();
	await db.prepare(`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (${PLANO}, 3, '003.001.001', 'Aplicações financeiras', 'investimento')`).run();
	await db.prepare(`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES (${CENTRO}, 'Aplicações e investimentos financeiros', 'INVESTIMENTO', 'DESPESA')`).run();
});

beforeEach(async () => {
	await db.prepare(`DELETE FROM MovimentoBancario`).run();
});

/* ------------------------------------------------------------------ */

describe('OFX import through the screen: every line once', () => {
	it('BB GFS 10/11/2026: the 22 consórcio installments and the 10 other lines are all saved', async () => {
		const linhas = extratoBB1011();
		const r = await importarArquivo(linhas);
		expect(r.parseados).toHaveLength(32);
		expect(r).toMatchObject({ novos: 32, existentes: 0 });
		const rows = await esperarArquivoCompleto(linhas);
		expect(rows.filter((x) => x.historico === CONSORCIO)).toHaveLength(22);
		// the screen lists each saved row once (no row repeated in place of a lost line)
		expect(new Set(r.movimentos.map((m) => m.id)).size).toBe(32);
		expect(r.movimentos).toHaveLength(32);
	});

	it('importing the same file again creates nothing and returns each row once', async () => {
		const linhas = extratoBB1011();
		await importarArquivo(linhas);
		const r = await importarArquivo(linhas);
		expect(r).toMatchObject({ novos: 0, existentes: 32 });
		expect(new Set(r.movimentos.map((m) => m.id)).size).toBe(32);
		await esperarArquivoCompleto(linhas);
	});

	it('re-importing brings back lines lost by an earlier import, without duplicating the others', async () => {
		const linhas = extratoBB1011();
		await importarArquivo(linhas);
		// what production had after the faulty import: 862,93 nº 2 and 792,58 nº 5 to 8 missing
		const perdidos = new Set([fitidBB('2026-11-10', 862.93, 2), ...[5, 6, 7, 8].map((n) => fitidBB('2026-11-10', 792.58, n))]);
		for (const row of await noBanco()) {
			if (perdidos.has(row.identificador_ofx.split('|')[0])) await db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(row.id).run();
		}
		expect(await noBanco()).toHaveLength(27);

		const r = await importarArquivo(linhas);
		expect(r).toMatchObject({ novos: 5, existentes: 27 });
		await esperarArquivoCompleto(linhas);
	});

	it.each([1, 2, 9, 10, 11, 19, 20, 21, 25, 31])('%i equal lines (same day, valor and histórico) are all saved, then re-import adds none', async (n) => {
		const linhas = linhasBB(Array.from({ length: n }, () => ({ dia: '2026-11-10', valor: -792.58, memo: CONSORCIO, checkNum: '14033' })));
		expect(await importarArquivo(linhas)).toMatchObject({ novos: n, existentes: 0 });
		await esperarArquivoCompleto(linhas);
		expect(await importarArquivo(linhas)).toMatchObject({ novos: 0, existentes: n });
		await esperarArquivoCompleto(linhas);
	});

	it.each([1, 2, 3, 4, 5])('shuffled file (seed %i): equal lines spread across the batches are all saved', async (semente) => {
		const linhas = embaralhar(extratoBB1011(), semente);
		expect(await importarArquivo(linhas)).toMatchObject({ novos: 32 });
		await esperarArquivoCompleto(linhas);
		// the same lines in another order are the same file
		expect(await importarArquivo(embaralhar(linhas, semente + 100))).toMatchObject({ novos: 0, existentes: 32 });
		await esperarArquivoCompleto(linhas);
	});

	it('several days, each with its own equal lines, across many batches', async () => {
		const dias = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
		const linhas = linhasBB(
			dias.flatMap((dia) => [
				...Array.from({ length: 7 }, () => ({ dia, valor: -862.93, memo: CONSORCIO, checkNum: '14033' })),
				{ dia, valor: -1.5, memo: 'Tarifa pacote de serviços' },
				...Array.from({ length: 4 }, () => ({ dia, valor: -4.9, memo: 'Tarifa Pix enviado' })),
			]),
		);
		expect(linhas).toHaveLength(48);
		expect(await importarArquivo(linhas)).toMatchObject({ novos: 48 });
		await esperarArquivoCompleto(linhas);
	});
});

describe('OFX import through the screen: files that overlap', () => {
	it('importing during the day and again at the end of the day brings only the new lines', async () => {
		const completo = extratoBB1011();
		const parcial = completo.filter((_, i) => i % 3 !== 2); // the intraday file had only part of the lines
		expect(await importarArquivo(parcial)).toMatchObject({ novos: parcial.length });

		const r = await importarArquivo(completo);
		expect(r).toMatchObject({ novos: completo.length - parcial.length, existentes: parcial.length });
		await esperarArquivoCompleto(completo);
	});

	it('a file covering days already imported (overlapping periods) only adds the days that are new', async () => {
		const mes = linhasBB(
			['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09'].flatMap((dia) => [
				...Array.from({ length: 3 }, () => ({ dia, valor: -792.58, memo: CONSORCIO })),
				{ dia, valor: 15000, memo: 'Venda de leite - Laticínio' },
			]),
		);
		const primeiraSemana = mes.filter((l) => l.dia <= '2026-11-05');
		const segundoArquivo = mes.filter((l) => l.dia >= '2026-11-04');
		await importarArquivo(primeiraSemana);
		const r = await importarArquivo(segundoArquivo);
		expect(r).toMatchObject({ novos: mes.length - primeiraSemana.length, existentes: segundoArquivo.length - (mes.length - primeiraSemana.length) });
		await esperarArquivoCompleto(mes);
	});

	it('a bank that changes every FITID between exports does not duplicate lines already imported', async () => {
		const linhas = linhasBB([
			{ dia: '2026-11-10', valor: -320.4, memo: 'Pagamento de boleto - Agropecuária' },
			{ dia: '2026-11-10', valor: -50, memo: 'Pix enviado - Fulano' },
			{ dia: '2026-11-11', valor: 1200, memo: 'Pix recebido - Cooperativa' },
		]);
		await importarArquivo(linhas);
		const reexportado = linhas.map((l, i) => ({ ...l, fitid: `NOVO${i}${l.fitid}` }));
		expect(await importarArquivo(reexportado)).toMatchObject({ novos: 0, existentes: 3 });
		expect(await noBanco()).toHaveLength(3);
	});

	it('a debit and a credit with the same day, valor and histórico are two lines (estorno)', async () => {
		const linhas = linhasBB([
			{ dia: '2026-11-10', valor: -450, memo: 'Pagamento de boleto - Fornecedor' },
			{ dia: '2026-11-10', valor: 450, memo: 'Pagamento de boleto - Fornecedor' },
		]);
		expect(await importarArquivo(linhas)).toMatchObject({ novos: 2 });
		await esperarArquivoCompleto(linhas);
		expect(centavos(await noBanco())).toBe(0);
	});
});

describe('OFX import through the screen: accounts and classification', () => {
	it('the same file in two accounts is saved in each one, and re-import keeps both complete', async () => {
		const linhas = extratoBB1011();
		await importarArquivo(linhas, CONTA);
		expect(await importarArquivo(linhas, OUTRA_CONTA)).toMatchObject({ novos: 32 });
		await esperarArquivoCompleto(linhas, CONTA);
		await esperarArquivoCompleto(linhas, OUTRA_CONTA);
		expect(await importarArquivo(linhas, OUTRA_CONTA)).toMatchObject({ novos: 0 });
		await esperarArquivoCompleto(linhas, OUTRA_CONTA);
	});

	it('the memória de conciliação classifies every equal line, in every batch', async () => {
		const primeira = linhasBB([{ dia: '2026-11-03', valor: -792.58, memo: CONSORCIO, checkNum: '14033' }]);
		await importarArquivo(primeira);
		const [row] = await noBanco();
		const res = await SELF.fetch(`${BASE}/api/movBancario/${row.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idPlanoContas: PLANO, idCentroCustos: CENTRO, lembrarClassificacao: true }),
		});
		expect(res.status).toBe(200);

		const linhas = extratoBB1011();
		const r = await importarArquivo(linhas);
		expect(r.classificadosPorMemoria).toBe(22);
		const consorcio = (await noBanco()).filter((x) => x.historico === CONSORCIO && x.id !== row.id);
		expect(consorcio).toHaveLength(22);
		expect(consorcio.every((x) => x.idPlanoContas === PLANO && x.idCentroCustos === CENTRO)).toBe(true);
	});

	it('a line already conciliated keeps its classification when the file is imported again', async () => {
		const linhas = extratoBB1011();
		await importarArquivo(linhas);
		const alvo = (await noBanco())[5];
		await SELF.fetch(`${BASE}/api/movBancario/${alvo.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idPlanoContas: PLANO, idCentroCustos: CENTRO }),
		});
		await importarArquivo(linhas);
		const depois = (await noBanco()).find((x) => x.id === alvo.id)!;
		expect(depois).toMatchObject({ idPlanoContas: PLANO, idCentroCustos: CENTRO, valor: alvo.valor });
		await esperarArquivoCompleto(linhas);
	});
});

describe('OFX import through the screen: other banks', () => {
	it('Santander (FITID 000000 on every line): equal lines across batches are all saved', async () => {
		const linhas: Linha[] = Array.from({ length: 23 }, (_, i) => ({
			dia: '2026-11-10',
			valor: i % 2 ? -5.5 : 1200,
			memo: i % 2 ? 'TARIFA AVULSA PIX' : 'PIX RECEBIDO COOPERATIVA',
			fitid: '000000',
		}));
		const r = await importarArquivo(linhas, CONTA, '0033');
		expect(r.novos).toBe(23);
		const rows = await noBanco();
		expect(rows).toHaveLength(23);
		expect(centavos(rows)).toBe(centavos(linhas));
		expect(await importarArquivo(linhas, CONTA, '0033')).toMatchObject({ novos: 0, existentes: 23 });
		expect(await noBanco()).toHaveLength(23);
	});

	it('a bank with its own unique FITIDs (Sicoob-style): 30 equal tarifas are all saved', async () => {
		const linhas: Linha[] = Array.from({ length: 30 }, (_, i) => ({ dia: '2026-11-10', valor: -2.35, memo: 'TARIFA PIX', fitid: `SIC${String(i).padStart(8, '0')}` }));
		expect(await importarArquivo(linhas, CONTA, '756')).toMatchObject({ novos: 30 });
		await esperarArquivoCompleto(linhas);
		expect(await importarArquivo(linhas, CONTA, '756')).toMatchObject({ novos: 0, existentes: 30 });
	});
});
