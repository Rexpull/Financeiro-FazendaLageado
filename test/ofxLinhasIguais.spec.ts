// Integration tests: OFX with many equal lines (same day, valor and historico, distinct FITIDs), sent by the
// screen in batches of 10 — the BB GFS file of 10/11/2026 with 22 "BB Consórcio - Prestação" lines, of which
// 5 were lost because a later batch took them as rows an earlier batch had just created.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import schemaSql from './fixtures/schema.sql?raw';
import { parseOFXContent } from '../frontend/src/Utils/parseOfxFile';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
let authHeader: Record<string, string> = {};

async function prepararAuth() {
	const secret = (env as unknown as { JWT_SECRET?: string }).JWT_SECRET;
	if (!secret) return;
	await db.prepare(`INSERT INTO usuario (id, nome, usuario, email, senha) VALUES (1, 'Teste', 'teste', 'teste@fazenda.test', 'x')`).run();
	const token = await new SignJWT({ id: 1, email: 'teste@fazenda.test' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(secret));
	authHeader = { Authorization: `Bearer ${token}` };
}

async function applySchema() {
	for (const sql of schemaSql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
		await db.prepare(sql).run();
	}
}

// bank order (Ronaldo's screen) + the FITID sequence numbers seen in production
const CONS: Array<[number, string]> = [
	[2862.81, '0'],
	[862.93, '0'], [862.93, '2'], [862.93, '3'], [862.93, '4'], [862.93, '5'],
	[609.13, '0'],
	[862.93, '6'],
	...['0', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((s) => [792.58, s] as [number, string]),
	[3637.88, '0'], [3637.88, '2'],
	[4850.5, '0'],
];
const OUTROS = [1378, 3900.27, 13680.75, 30825.02, 321.13, 565.25, 41.51, 275.7, 84.76, 516.26];

function fitid(valor: number, seq: string) {
	const cents = Math.round(valor * 100);
	return `202611101${cents}0${seq === '0' ? '' : seq}`;
}

function ofx() {
	const linhas = [
		...CONS.map(([v, s]) => ({ v, f: fitid(v, s), memo: 'BB Consórcio - Prestação', chk: '' })),
		...OUTROS.map((v, i) => ({ v, f: fitid(v, 'x' + i), memo: `Outro ${i}`, chk: String(111000 + i) })),
	];
	const trn = linhas
		.map((l) => `<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261110120000[-3:BRT]\n<TRNAMT>-${l.v.toFixed(2)}\n<FITID>${l.f}\n<CHECKNUM>${l.chk}\n<MEMO>${l.memo}\n</STMTTRN>`)
		.join('\n');
	return `OFXHEADER:100\nDATA:OFXSGML\nCHARSET:1252\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>1<ACCTID>123<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20261110<DTEND>20261110\n${trn}\n</BANKTRANLIST><LEDGERBAL><BALAMT>0<DTASOF>20261110</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
}

/** Same as the screen (salvarMovimentosOFX): batches of 10, each one with the identificadores of the whole file. */
async function importar(linhas = parseOFXContent(ofx()).movimentos, comArquivo = true) {
	const identificadoresArquivo = linhas.map((m) => m.identificadorOfx);
	let novos = 0;
	let existentes = 0;
	for (let i = 0; i < linhas.length; i += 10) {
		const lote = linhas.slice(i, i + 10).map((m) => ({ ...m, idContaCorrente: 24 }));
		const res = await SELF.fetch(`${BASE}/api/movBancario/batch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeader },
			body: JSON.stringify(comArquivo ? { movimentos: lote, identificadoresArquivo } : { movimentos: lote }),
		});
		expect(res.status).toBe(200);
		const r = (await res.json()) as { novos: number; existentes: number; erros: number };
		expect(r.erros).toBe(0);
		novos += r.novos;
		existentes += r.existentes;
	}
	return { novos, existentes };
}

const consorcioNoBanco = async () =>
	(await db.prepare(`SELECT id, identificador_ofx FROM MovimentoBancario WHERE historico LIKE 'BB Cons%' ORDER BY id`).all<{ id: number; identificador_ofx: string }>())
		.results;

describe('OFX with equal lines sent in batches of 10', () => {
	beforeAll(async () => {
		await applySchema();
		await prepararAuth();
		await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'BB', '001')`).run();
		await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
	});

	it('saves all 22 consórcio lines across batches; re-import adds only the lines that are missing', async () => {
		const linhas = parseOFXContent(ofx()).movimentos;
		expect(linhas).toHaveLength(32);
		expect(await importar(linhas)).toEqual({ novos: 32, existentes: 0 });
		expect(await consorcioNoBanco()).toHaveLength(22);

		// importing the same file again creates nothing
		expect(await importar()).toEqual({ novos: 0, existentes: 32 });
		expect(await consorcioNoBanco()).toHaveLength(22);

		// production case: re-importing the file brings back the lines an earlier import lost
		const perdidos = (await consorcioNoBanco()).filter((r) => /^202611101(86293)02\||^202611101(79258)0[5-8]\|/.test(r.identificador_ofx));
		expect(perdidos).toHaveLength(5);
		for (const p of perdidos) await db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(p.id).run();
		expect(await consorcioNoBanco()).toHaveLength(17);

		expect(await importar()).toEqual({ novos: 5, existentes: 27 });
		expect(await consorcioNoBanco()).toHaveLength(22);
	});

	it('without the file list (older screen still open), a line equal to an imported one is still taken as imported', async () => {
		// keeps the re-import protection for banks that change the FITID between exports
		await db.prepare(`DELETE FROM MovimentoBancario`).run();
		const linhas = parseOFXContent(ofx()).movimentos;
		const { novos } = await importar(linhas, false);
		expect(novos).toBeLessThan(32);
	});
});
