// Re-importing a period whose bank changed the identificador between exports (Bradesco numbers the
// FITID per file, Santander puts the export time in it, BB changes REFNUM/MEMO by channel) must keep
// the earlier rows — and their conciliation — instead of creating them again as pending.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;
const DT = '2026-10-13T00:00:00.000Z';
const CONTA = 36;

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'Banco Teste', '237')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (${CONTA}, 'contaCorrente', 1, 'BRADESCO GJN')`).run();
	await db.prepare(`INSERT INTO planoContas (id, nivel, hierarquia, descricao, tipo) VALUES (278, 3, '002.001.001', 'Consórcios', 'custeio')`).run();
}

function linha(fitid: string, valor: number, historico: string, extra = '') {
	const identificadorOfx = `${fitid}|${DT}|${valor.toFixed(2)}${extra}`;
	return {
		dtMovimento: DT,
		historico,
		valor,
		saldo: 0,
		idContaCorrente: CONTA,
		identificadorOfx,
		numeroDocumento: identificadorOfx,
		tipoMovimento: valor >= 0 ? 'C' : 'D',
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
	return (await res.json()) as { novos: number; existentes: number; movimentos: Array<{ id: number }> };
}

const total = async () =>
	(await db.prepare(`SELECT COUNT(*) n FROM MovimentoBancario WHERE idContaCorrente = ?`).bind(CONTA).first<{ n: number }>())!.n;

describe('OFX re-import with a different identificador', () => {
	beforeAll(applySchema);

	it('keeps the earlier rows and their plano, and only creates the lines that are really new', async () => {
		const primeiro = await postBatch([
			linha('N20290', -1562.11, 'Pagto Cobranca 070600202401110000bradesco Admin', '|0000078'),
			linha('N20272', -1562.11, 'Pagto Cobranca 070600213601110000bradesco Admin', '|0000077'),
			linha('N202AE', -151943.86, 'Parc Cred Rural', '|0440286'),
		]);
		expect(primeiro.novos).toBe(3);
		const idCobranca = primeiro.movimentos[0].id;
		const put = await SELF.fetch(`${BASE}/api/movBancario/${idCobranca}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idPlanoContas: 278 }),
		});
		expect(put.status).toBe(200);

		// Next export: same lines with new FITIDs, plus a third boleto of the same valor that day
		const segundo = await postBatch([
			linha('N20368', -1562.11, 'Pagto Cobranca 070600202401110000bradesco Admin', '|0000078'),
			linha('N2034A', -1562.11, 'Pagto Cobranca 070600213601110000bradesco Admin', '|0000077'),
			linha('N2032C', -1562.11, 'Pagto Cobranca 070600215301110000bradesco Admin', '|0000076'),
			linha('N20386', -151943.86, 'Parc Cred Rural', '|0440286'),
		]);
		expect({ novos: segundo.novos, existentes: segundo.existentes }).toEqual({ novos: 1, existentes: 3 });
		expect(segundo.movimentos[0].id).toBe(idCobranca);
		expect(await total()).toBe(4);
		const plano = await db.prepare(`SELECT idPlanoContas p FROM MovimentoBancario WHERE id = ?`).bind(idCobranca).first<{ p: number }>();
		expect(plano?.p).toBe(278);
	});

	it('recognises a BB consórcio grouped now but imported line by line before', async () => {
		const individuais = await postBatch([
			linha('2026101311595070', -1595.07, 'BB ADMIN CONSÓRCIO SA', '|14033'),
			linha('20261013115950702', -1595.07, 'BB ADMIN CONSÓRCIO SA', '|14033'),
			linha('202610131848500', -848.5, 'BB ADMIN CONSÓRCIO SA', '|14033'),
		]);
		expect(individuais.novos).toBe(3);
		const antes = await total();

		const agrupado = await postBatch([linha('2026101311595070', -4038.64, 'BB Cons - Agrupado (3 movimentos) - REF: 14.033', '|14.033')]);
		expect({ novos: agrupado.novos, existentes: agrupado.existentes }).toEqual({ novos: 0, existentes: 1 });
		expect(await total()).toBe(antes);
	});

	it('imports next month’s card installment (same purchase date and valor) as a new line', async () => {
		await postBatch([linha('2025102265500000000030100000000019', -11428.57, 'GEA EQUIPAMEN PARC 12/21 JAGUARIUNA  BR')]);
		const antes = await total();
		const proxima = await postBatch([linha('2025102265500000000030100000000007', -11428.57, 'GEA EQUIPAMEN PARC 13/21 JAGUARIUNA  BR')]);
		expect(proxima.novos).toBe(1);
		expect(await total()).toBe(antes + 1);
	});
});
