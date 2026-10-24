import { describe, it, expect } from 'vitest';
import { identificadoresTransferencia, parsePlanoTransferencia, validarTransferencia } from './transferencia';

describe('validarTransferencia', () => {
	const ok = { contaOrigemId: 24, contaDestinoId: 25, valor: 100 };

	it('accepts a valid transfer', () => {
		expect(validarTransferencia(ok)).toBeNull();
		expect(validarTransferencia({ ...ok, valor: '100.50' })).toBeNull();
	});

	it('rejects valor <= 0 or not numeric', () => {
		for (const valor of [0, -1, 'abc', null]) {
			expect(validarTransferencia({ ...ok, valor })).toMatch(/valor/i);
		}
	});

	it('rejects origem == destino', () => {
		expect(validarTransferencia({ ...ok, contaDestinoId: 24 })).toMatch(/diferentes/i);
		expect(validarTransferencia({ ...ok, contaDestinoId: '24' })).toMatch(/diferentes/i);
	});

	it('rejects missing accounts', () => {
		expect(validarTransferencia({ ...ok, contaOrigemId: undefined })).toMatch(/obrigat/i);
	});
});

describe('identificadoresTransferencia', () => {
	it('gives each leg a distinct identificador from the same uuid', () => {
		const ids = identificadoresTransferencia('abc');
		expect(ids).toEqual({ saida: 'abc|saida', entrada: 'abc|entrada' });
	});
});

describe('parsePlanoTransferencia', () => {
	it('never returns NaN', () => {
		expect(parsePlanoTransferencia(undefined)).toBeNull();
		expect(parsePlanoTransferencia(null)).toBeNull();
		expect(parsePlanoTransferencia('')).toBeNull();
		expect(parsePlanoTransferencia('x')).toBeNull();
		expect(parsePlanoTransferencia(0)).toBeNull();
		expect(parsePlanoTransferencia(900)).toBe(900);
		expect(parsePlanoTransferencia('900')).toBe(900);
	});
});
