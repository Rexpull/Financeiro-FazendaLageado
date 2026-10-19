import { describe, it, expect } from 'vitest';
import { reescalarRateio } from './rateioOfxCorrecao';

describe('reescalarRateio', () => {
	it('returns empty list when there is no rateio', () => {
		expect(reescalarRateio(undefined, 100)).toEqual([]);
		expect(reescalarRateio([], 100)).toEqual([]);
	});

	it('single line takes the whole new valor', () => {
		expect(reescalarRateio([{ idCentroCustos: 42, valor: 1000 }], 1250.5)).toEqual([
			{ idCentroCustos: 42, valor: 1250.5 },
		]);
	});

	it('keeps each line share of a multi-centro rateio', () => {
		const out = reescalarRateio(
			[
				{ idCentroCustos: 37, valor: 500 },
				{ idCentroCustos: 42, valor: 300 },
				{ idCentroCustos: 43, valor: 200 },
			],
			2000,
		);
		expect(out.map((c) => c.valor)).toEqual([1000, 600, 400]);
		expect(out.map((c) => c.idCentroCustos)).toEqual([37, 42, 43]);
	});

	it('rounds to cents and puts the residual on the last line', () => {
		const out = reescalarRateio(
			[
				{ valor: 1 },
				{ valor: 1 },
				{ valor: 1 },
			],
			100,
		);
		expect(out.map((c) => c.valor)).toEqual([33.33, 33.33, 33.34]);
		const soma = Math.round(out.reduce((a, c) => a + c.valor, 0) * 100);
		expect(soma).toBe(10000);
	});
});
