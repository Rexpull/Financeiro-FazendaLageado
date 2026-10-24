import { describe, it, expect } from 'vitest';
import {
	chaveFitidDia,
	contaSuffixRange,
	escolherIdentificadorParaConta,
	isFitidGenerico,
	normalizeHistoricoOfx,
	selecionarCandidatoFallbackOfx,
	shouldReuseOfxMovimento,
	stripContaSuffix,
} from './ofxIdentificadorMatch';

describe('shouldReuseOfxMovimento', () => {
	it('reuses only when FITID match is on the same account', () => {
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: 26,
				incomingIdContaCorrente: 26,
			}),
		).toBe(true);
	});

	it('does not reuse BB movement when importing into SICOOB', () => {
		// Regression: R$ 793.319,71 showed as BB RLF in Fluxo detail for SICOOB GJN
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: 26, // BB RLF
				incomingIdContaCorrente: 27, // SICOOB GJN
			}),
		).toBe(false);
	});

	it('rejects missing account ids', () => {
		expect(
			shouldReuseOfxMovimento({
				existingIdContaCorrente: null,
				incomingIdContaCorrente: 27,
			}),
		).toBe(false);
	});
});

const DT = '2026-10-05T00:00:00.000Z';
const ident = (fitid: string, valor: number, extra = '') => `${fitid}|${DT}|${valor.toFixed(2)}${extra}`;

describe('conta suffix helpers', () => {
	it('stripContaSuffix removes only the trailing |@c<id>[-n]', () => {
		expect(stripContaSuffix(`${ident('F', -1)}|@c25`)).toBe(ident('F', -1));
		expect(stripContaSuffix(`${ident('F', -1)}|9|#2|@c25-3`)).toBe(`${ident('F', -1)}|9|#2`);
		expect(stripContaSuffix(ident('F', -1, '|851'))).toBe(ident('F', -1, '|851'));
	});

	it('contaSuffixRange brackets every suffixed variant and nothing else', () => {
		const base = ident('F', -1);
		const { from, to } = contaSuffixRange(base);
		const dentro = (s: string) => s >= from && s < to;
		expect(dentro(`${base}|@c25`)).toBe(true);
		expect(dentro(`${base}|@c25-2`)).toBe(true);
		expect(dentro(base)).toBe(false);
		expect(dentro(`${base}|851`)).toBe(false);
		expect(dentro(`${base}|#2|@c25`)).toBe(false);
	});

	it('escolherIdentificadorParaConta', () => {
		const base = ident('F', -1);
		expect(escolherIdentificadorParaConta(base, 25, [])).toBe(base);
		// held by the same conta → bare form (insert fails on UNIQUE: never a same-conta duplicate)
		expect(escolherIdentificadorParaConta(base, 24, [{ identificadorOfx: base, idContaCorrente: 24 }])).toBe(base);
		expect(escolherIdentificadorParaConta(base, 25, [{ identificadorOfx: base, idContaCorrente: 24 }])).toBe(`${base}|@c25`);
		expect(
			escolherIdentificadorParaConta(base, 25, [
				{ identificadorOfx: base, idContaCorrente: 24 },
				{ identificadorOfx: `${base}|@c25`, idContaCorrente: 26 }, // moved to another conta later
			]),
		).toBe(`${base}|@c25-2`);
	});
});

describe('OFX fallback helpers', () => {
	it('isFitidGenerico', () => {
		expect(isFitidGenerico('000000')).toBe(true);
		expect(isFitidGenerico('0')).toBe(true);
		expect(isFitidGenerico(' ')).toBe(true);
		expect(isFitidGenerico('000123')).toBe(false);
	});

	it('normalizeHistoricoOfx ignores case, accents and spacing', () => {
		expect(normalizeHistoricoOfx('  Pagamento  de Boleto ')).toBe(normalizeHistoricoOfx('PAGAMENTO DE BOLETO'));
		expect(normalizeHistoricoOfx('Transferência')).toBe('TRANSFERENCIA');
	});

	it('chaveFitidDia groups by conta + FITID + day (valor/checkNum/#N ignored)', () => {
		expect(chaveFitidDia(ident('F', -1, '|9|#2'), 24)).toBe(chaveFitidDia(ident('F', -5), 24));
		expect(chaveFitidDia(ident('F', -1), 24)).not.toBe(chaveFitidDia(ident('F', -1), 25));
	});
});

describe('selecionarCandidatoFallbackOfx', () => {
	const cand = (id: number, identificadorOfx: string, historico = 'PAGTO', valor = -100) => ({ id, identificadorOfx, historico, valor });
	const incoming = (identificadorOfx: string, historico = 'PAGTO', valor = -200) => ({ identificadorOfx, historico, valor });

	it('re-matches the same bank line whose valor changed', () => {
		const c = cand(1, ident('FIT', -100, '|7'));
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200, '|7')), candidatos: [c] })).toBe(c);
	});

	it('matches a candidate stored with a conta suffix', () => {
		const c = cand(1, `${ident('FIT', -100, '|7')}|@c25`);
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200, '|7')), candidatos: [c] })).toBe(c);
	});

	it('never for a generic FITID (Santander 000000)', () => {
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('000000', -14105)), candidatos: [cand(1, ident('000000', -2300))] }),
		).toBeNull();
	});

	it('requires the same historico', () => {
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200), 'PIX'), candidatos: [cand(1, ident('FIT', -100), 'TARIFA')] }),
		).toBeNull();
	});

	it('requires checkNum equality when either side has one', () => {
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200, '|8')), candidatos: [cand(1, ident('FIT', -100, '|7'))] }),
		).toBeNull();
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200, '|8')), candidatos: [cand(1, ident('FIT', -100))] })).toBeNull();
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200)), candidatos: [cand(1, ident('FIT', -100, '|7'))] })).toBeNull();
	});

	it('never across the |#N occurrence suffix (either side)', () => {
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200, '|#2')), candidatos: [cand(1, ident('FIT', -100))] }),
		).toBeNull();
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200)), candidatos: [cand(1, ident('FIT', -100, '|#2'))] }),
		).toBeNull();
	});

	it('never reuses a row already matched in the batch, nor one whose identificador is another line of the batch', () => {
		const c = cand(1, ident('FIT', -100));
		const base = { incoming: incoming(ident('FIT', -200)), candidatos: [c] };
		expect(selecionarCandidatoFallbackOfx({ ...base, idsJaUsados: new Set([1]) })).toBeNull();
		expect(selecionarCandidatoFallbackOfx({ ...base, identificadoresDoLote: new Set([ident('FIT', -100)]) })).toBeNull();
	});

	it('never when FITID+day repeats in the batch, when the sign differs, or when ambiguous', () => {
		const c = cand(1, ident('FIT', -100));
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200)), candidatos: [c], fitidDiaRepetidoNoLote: true })).toBeNull();
		expect(selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', 200), 'PAGTO', 200), candidatos: [c] })).toBeNull();
		expect(
			selecionarCandidatoFallbackOfx({ incoming: incoming(ident('FIT', -200)), candidatos: [c, cand(2, ident('FIT', -150))] }),
		).toBeNull();
	});

	it('ignores candidates from another day or FITID', () => {
		expect(
			selecionarCandidatoFallbackOfx({
				incoming: incoming(ident('FIT', -200)),
				candidatos: [cand(1, `FIT|2026-10-06T00:00:00.000Z|-100.00`), cand(2, ident('OTHER', -100))],
			}),
		).toBeNull();
	});
});
