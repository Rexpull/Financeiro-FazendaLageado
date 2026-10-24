import { describe, it, expect } from 'vitest';
import { anoDaDataISO, diaDoValor, dtMovimentoDoDia, mesesEntreDatasISO } from './dataMovimento';
import { hojeISO } from './dataSemFuso';

describe('dtMovimentoDoDia', () => {
	it('stores the chosen local day as UTC midnight, like OFX rows', () => {
		expect(dtMovimentoDoDia('2025-01-31')).toBe('2025-01-31T00:00:00.000Z');
		// old datetime-local values keep their calendar day (31/01 22:30 is still January)
		expect(dtMovimentoDoDia('2025-01-31T22:30')).toBe('2025-01-31T00:00:00.000Z');
	});

	it('the local "today" default never jumps to tomorrow after 21h in UTC-3', () => {
		// 31/01/2025 22:30 in São Paulo = 2025-02-01T01:30Z; toISOString().slice(0, 10) would say 02-01
		const agora = new Date(2025, 0, 31, 22, 30);
		expect(dtMovimentoDoDia(hojeISO(agora))).toBe('2025-01-31T00:00:00.000Z');
	});

	it('rejects invalid dates', () => {
		expect(() => dtMovimentoDoDia('')).toThrow();
		expect(() => dtMovimentoDoDia('2025-02-30')).toThrow();
		expect(() => dtMovimentoDoDia(undefined)).toThrow();
	});
});

describe('diaDoValor / anoDaDataISO', () => {
	it('reads the text, never the timezone', () => {
		expect(diaDoValor('2025-01-01T00:00:00.000Z')).toBe('2025-01-01');
		expect(anoDaDataISO('2025-01-01')).toBe(2025); // new Date('2025-01-01').getFullYear() is 2024 in UTC-3
		expect(anoDaDataISO('x')).toBeNull();
	});
});

describe('mesesEntreDatasISO', () => {
	it('counts calendar months even when a date is the 1st', () => {
		expect(mesesEntreDatasISO('2025-02-01', '2025-03-01')).toBe(1);
		expect(mesesEntreDatasISO('2025-01-01', '2026-01-01')).toBe(12);
		expect(mesesEntreDatasISO('2025-01-31', '2025-02-28')).toBe(1);
		expect(mesesEntreDatasISO('2025-03-01', '2025-03-31')).toBe(0);
		expect(mesesEntreDatasISO('', '2025-03-31')).toBeNull();
	});
});
