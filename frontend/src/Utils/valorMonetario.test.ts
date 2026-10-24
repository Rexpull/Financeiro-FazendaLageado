import { describe, it, expect } from 'vitest';
import { parseValorMonetario, valorMonetarioPositivo } from './valorMonetario';

describe('parseValorMonetario', () => {
	it.each([
		['1.234,56', 1234.56],
		['1234,56', 1234.56],
		['1234.56', 1234.56],
		['R$ 1.234,56', 1234.56],
		['R$ 1.234,56', 1234.56],
		['1,234.56', 1234.56], // en-US formatting
		['1.234.567,89', 1234567.89],
		['1,234,567', 1234567],
		['1.234.567', 1234567],
		['1.061.52', 1061.52], // Caixa-style cents
		['1500.50', 1500.5],
		['1.500', 1500], // pt-BR thousands
		['0.500', 0.5],
		['0,5', 0.5],
		['12,', 12], // CurrencyInput while typing
		['-50,00', -50],
		['500', 500],
	])('%s → %s', (entrada, esperado) => {
		expect(parseValorMonetario(entrada)).toBe(esperado);
	});

	it('numbers pass through (rounded to cents)', () => {
		expect(parseValorMonetario(1234.5)).toBe(1234.5);
		expect(parseValorMonetario(10.005)).toBe(10.01);
		expect(parseValorMonetario(Number.NaN)).toBeNaN();
	});

	it.each(['', ',', '.', 'abc', '12a', 'R$', undefined, null, {}])('%s → NaN', (entrada) => {
		expect(parseValorMonetario(entrada)).toBeNaN();
	});

	it('the en-US bug case: "1,234.56" is never R$ 123.456,00', () => {
		expect(parseValorMonetario('1,234.56')).toBe(1234.56);
		expect(parseValorMonetario('1234.56')).not.toBe(123456);
	});
});

describe('valorMonetarioPositivo', () => {
	it('accepts only values > 0', () => {
		expect(valorMonetarioPositivo('1.500,50')).toBe(1500.5);
		expect(valorMonetarioPositivo('0,00')).toBeNull();
		expect(valorMonetarioPositivo('-10')).toBeNull();
		expect(valorMonetarioPositivo(',')).toBeNull();
		expect(valorMonetarioPositivo(undefined)).toBeNull();
	});
});
