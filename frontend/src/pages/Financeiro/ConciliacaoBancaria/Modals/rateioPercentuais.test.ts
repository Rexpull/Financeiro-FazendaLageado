import { describe, expect, it } from 'vitest';
import {
	aplicarPercentuaisEmValoresMonetarios,
	dividirIgualmenteEntrePreenchidos,
	isPercentualPreenchido,
	parsePercentualCampo,
	rateiosCentrosFromDraft,
	somarPercentuaisPreenchidos,
	splitPercentEquallyWithRemainderOnLast,
} from './rateioPercentuais';

describe('isPercentualPreenchido / parsePercentualCampo', () => {
	it('treats blank, whitespace and 0 as not filled', () => {
		expect(isPercentualPreenchido('')).toBe(false);
		expect(isPercentualPreenchido('   ')).toBe(false);
		expect(isPercentualPreenchido('0')).toBe(false);
		expect(isPercentualPreenchido('0,0')).toBe(false);
		expect(parsePercentualCampo('')).toBeNull();
		expect(parsePercentualCampo('0')).toBeNull();
	});

	it('parses positive percents with comma or percent sign', () => {
		expect(parsePercentualCampo('50')).toBe(50);
		expect(parsePercentualCampo('33,33')).toBe(33.33);
		expect(parsePercentualCampo('25%')).toBe(25);
	});
});

describe('dividirIgualmenteEntrePreenchidos', () => {
	it('only redistributes among already filled rows; blanks stay blank', () => {
		const draft = {
			'1': '10',
			'2': '',
			'3': '20',
			'4': '0',
		};
		const next = dividirIgualmenteEntrePreenchidos(draft);
		expect(next['2']).toBe('');
		expect(next['4']).toBe('0');
		const filled = [next['1'], next['3']].map(Number);
		expect(filled.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
		expect(filled).toEqual(splitPercentEquallyWithRemainderOnLast(2));
	});

	it('no-ops when nothing is filled', () => {
		const draft = { '1': '', '2': '0' };
		expect(dividirIgualmenteEntrePreenchidos(draft)).toEqual(draft);
	});

	it('splits three filled rows to ~33.33 / 33.33 / 33.34', () => {
		const draft = { a: '1', b: '1', c: '1', d: '' };
		const next = dividirIgualmenteEntrePreenchidos(draft);
		expect(next.d).toBe('');
		expect([next.a, next.b, next.c].map(Number)).toEqual(splitPercentEquallyWithRemainderOnLast(3));
		expect(somarPercentuaisPreenchidos(next)).toBeCloseTo(100, 5);
	});
});

describe('rateiosCentrosFromDraft', () => {
	const centros = new Map([
		[1, { id: 1, descricao: 'A' }],
		[2, { id: 2, descricao: 'B' }],
		[3, { id: 3, descricao: 'C' }],
	]);

	it('excludes blank and zero from confirm payload (multi = % in valor)', () => {
		const draft = { '1': '60', '2': '', '3': '0', '99': '40' };
		const rows = rateiosCentrosFromDraft(draft, centros, { multi: true, totalAbsoluto: 1000 });
		expect(rows).toEqual([
			{ idCentro: 1, descricao: 'A', valor: 60 },
			{ idCentro: 99, descricao: 'Centro 99', valor: 40 },
		]);
	});

	it('converts filled % to money in single mode with last-row remainder', () => {
		const draft = { '1': '33.33', '2': '33.33', '3': '33.34' };
		const rows = rateiosCentrosFromDraft(draft, centros, { multi: false, totalAbsoluto: 100 });
		expect(rows.map((r) => r.idCentro)).toEqual([1, 2, 3]);
		expect(rows.reduce((a, r) => a + r.valor, 0)).toBeCloseTo(100, 2);
	});

	it('blocks confirm-ready sum when filled % ≠ 100', () => {
		const draft = { '1': '40', '2': '40' };
		expect(Math.abs(somarPercentuaisPreenchidos(draft) - 100) < 0.02).toBe(false);
		const draftOk = { '1': '50', '2': '50', '3': '' };
		expect(Math.abs(somarPercentuaisPreenchidos(draftOk) - 100) < 0.02).toBe(true);
	});
});

describe('aplicarPercentuaisEmValoresMonetarios', () => {
	it('keeps monetary total exact', () => {
		const rateios = [{ valor: 0 }, { valor: 0 }, { valor: 0 }];
		const out = aplicarPercentuaisEmValoresMonetarios(rateios, [33.33, 33.33, 33.34], 1000);
		expect(out.reduce((a, r) => a + r.valor, 0)).toBeCloseTo(1000, 2);
	});
});
