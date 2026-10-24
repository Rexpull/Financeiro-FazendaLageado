import { describe, expect, it } from 'vitest';
import { brl, brlCompacto, pct } from './formatos';

// Intl may use a non-breaking space after "R$"
const norm = (s: string) => s.replace(/ /g, ' ');

describe('formatos', () => {
	it('brl formats pt-BR currency and tolerates bad input', () => {
		expect(norm(brl(1234.56))).toBe('R$ 1.234,56');
		expect(norm(brl(-1234.5))).toBe('-R$ 1.234,50');
		expect(norm(brl(undefined))).toBe('R$ 0,00');
		expect(norm(brl('abc'))).toBe('R$ 0,00');
	});

	it('pct uses a comma and a dash for missing values', () => {
		expect(pct(37.5)).toBe('37,5%');
		expect(pct(6.234, 2)).toBe('6,23%');
		expect(pct(-280.48)).toBe('-280,5%');
		expect(pct(null)).toBe('—');
		expect(pct(Number.NaN)).toBe('—');
	});

	it('brlCompacto shortens chart axis values', () => {
		expect(brlCompacto(950)).toBe('R$ 950');
		expect(brlCompacto(12_400)).toBe('R$ 12 mil');
		expect(brlCompacto(1_500_000)).toBe('R$ 1,5 mi');
		expect(brlCompacto(-2_000_000)).toBe('-R$ 2 mi');
		expect(brlCompacto(3_200_000_000)).toBe('R$ 3,2 bi');
	});
});
