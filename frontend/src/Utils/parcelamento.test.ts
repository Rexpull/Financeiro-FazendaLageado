import { describe, it, expect } from 'vitest';
import { gerarDatasVencimento, dividirValorEmParcelas } from './parcelamento';
import { adicionarMeses, formatarDataISO, hojeISO } from './dataSemFuso';

describe('gerarDatasVencimento', () => {
	it('keeps day 31 and clamps short months (no skipped month)', () => {
		expect(gerarDatasVencimento('2025-01-31', 5)).toEqual([
			'2025-01-31',
			'2025-02-28',
			'2025-03-31',
			'2025-04-30',
			'2025-05-31',
		]);
	});

	it('29/01 goes to 28/02 then back to 29/03 (and 29/02 in a leap year)', () => {
		expect(gerarDatasVencimento('2025-01-29', 3)).toEqual(['2025-01-29', '2025-02-28', '2025-03-29']);
		expect(gerarDatasVencimento('2024-01-29', 2)).toEqual(['2024-01-29', '2024-02-29']);
	});

	it('crosses the year boundary', () => {
		expect(gerarDatasVencimento('2025-11-30', 4)).toEqual(['2025-11-30', '2025-12-30', '2026-01-30', '2026-02-28']);
	});

	it('annual series clamps 29/02 on non-leap years and keeps it on leap years', () => {
		expect(gerarDatasVencimento('2024-02-29', 5, 12)).toEqual([
			'2024-02-29',
			'2025-02-28',
			'2026-02-28',
			'2027-02-28',
			'2028-02-29',
		]);
	});

	it('returns [] for zero installments', () => {
		expect(gerarDatasVencimento('2025-01-10', 0)).toEqual([]);
	});
});

describe('dividirValorEmParcelas', () => {
	it('puts the residual on the last installment', () => {
		expect(dividirValorEmParcelas(100, 3)).toEqual([33.33, 33.33, 33.34]);
		expect(dividirValorEmParcelas(10, 6)).toEqual([1.66, 1.66, 1.66, 1.66, 1.66, 1.7]);
	});

	it('sum always equals the total', () => {
		for (const [total, n] of [
			[1234.57, 7],
			[0.1, 3],
			[999999.99, 12],
		] as const) {
			const parcelas = dividirValorEmParcelas(total, n);
			expect(parcelas).toHaveLength(n);
			expect(Math.round(parcelas.reduce((s, v) => s + v, 0) * 100)).toBe(Math.round(total * 100));
		}
	});

	it('handles invalid input', () => {
		expect(dividirValorEmParcelas(NaN, 3)).toEqual([]);
		expect(dividirValorEmParcelas(100, 0)).toEqual([]);
		expect(dividirValorEmParcelas(50, 1)).toEqual([50]);
	});
});

describe('dataSemFuso', () => {
	it('formatarDataISO reads the date text (no timezone shift)', () => {
		expect(formatarDataISO('2025-01-01')).toBe('01/01/2025');
		expect(formatarDataISO('2025-03-31T00:00:00.000Z')).toBe('31/03/2025');
		expect(formatarDataISO('2025-03-31 10:20:30')).toBe('31/03/2025');
		expect(formatarDataISO(null)).toBe('-');
		expect(formatarDataISO('', '')).toBe('');
		expect(formatarDataISO('lixo')).toBe('-');
	});

	it('adicionarMeses supports negative offsets', () => {
		expect(adicionarMeses('2025-03-31', -1)).toBe('2025-02-28');
		expect(adicionarMeses('2025-01-15', -1)).toBe('2024-12-15');
	});

	it('hojeISO uses the local calendar date', () => {
		expect(hojeISO(new Date(2025, 0, 31, 23, 30))).toBe('2025-01-31');
	});
});
