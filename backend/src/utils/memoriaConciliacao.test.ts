import { describe, expect, it } from 'vitest';
import { chaveMemoria, percentuaisDe, valoresDe } from './memoriaConciliacao';

describe('chaveMemoria', () => {
	it('drops dates, times and numbers of a Pix', () => {
		expect(chaveMemoria('Pix - Enviado - 05/11 18:02 Larissa Ferreira')).toBe('PIX - ENVIADO - LARISSA FERREIRA');
		expect(chaveMemoria('Pix - Enviado - 28/10 09:15 Larissa Ferreira')).toBe('PIX - ENVIADO - LARISSA FERREIRA');
	});

	it('the same boleto on different days gives the same key', () => {
		const a = chaveMemoria('Pagamento de Boleto - UNIMED PATOS DE MINAS COOPERAT');
		expect(a).toBe('PAGAMENTO DE BOLETO - UNIMED PATOS DE MINAS COOPERAT');
		expect(chaveMemoria('Pagamento  de Boleto - Unimed Patos de Minas Cooperat ')).toBe(a);
	});

	it('removes accents and document numbers', () => {
		expect(chaveMemoria('DÉB.TIT.COMPE EFETIVADO 001234')).toBe('DEB TIT COMPE EFETIVADO');
		expect(chaveMemoria('Tarifa Pacote Serviços 10/2026')).toBe('TARIFA PACOTE SERVICOS');
	});

	it('nothing but numbers or punctuation is not remembered', () => {
		expect(chaveMemoria('')).toBe('');
		expect(chaveMemoria(null)).toBe('');
		expect(chaveMemoria('000123 - 05/11/2026')).toBe('');
	});
});

describe('percentuaisDe / valoresDe', () => {
	it('R$ → % closes 100 on the last one', () => {
		expect(percentuaisDe([{ id: 1, valor: 1 }, { id: 2, valor: 1 }, { id: 3, valor: 1 }])).toEqual([
			{ id: 1, pct: 33.33 },
			{ id: 2, pct: 33.33 },
			{ id: 3, pct: 33.34 },
		]);
		expect(percentuaisDe([{ id: 7, valor: -50 }])).toEqual([{ id: 7, pct: 100 }]);
		expect(percentuaisDe([])).toEqual([]);
	});

	it('% → R$ sums exactly to the value, remainder on the last', () => {
		const v = valoresDe([{ id: 1, pct: 33.33 }, { id: 2, pct: 33.33 }, { id: 3, pct: 33.34 }], -5344.09);
		expect(v).toEqual([
			{ id: 1, valor: 1781.19 },
			{ id: 2, valor: 1781.19 },
			{ id: 3, valor: 1781.71 },
		]);
		expect(Math.round(v.reduce((s, x) => s + x.valor, 0) * 100)).toBe(534409);
	});

	it('a split remembered from one value applies to another (Unimed 4.705,57 → 5.344,09)', () => {
		const fatias = percentuaisDe([
			{ id: 10, valor: 1000 },
			{ id: 11, valor: 1705.57 },
			{ id: 12, valor: 2000 },
		]);
		const v = valoresDe(fatias, 5344.09);
		expect(v.map((x) => x.id)).toEqual([10, 11, 12]);
		expect(Math.round(v.reduce((s, x) => s + x.valor, 0) * 100)).toBe(534409);
	});
});
