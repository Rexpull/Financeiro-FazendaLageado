import { describe, it, expect } from 'vitest';
import { avisoTipoPlanoCentro, debitoFicaSemCentro } from './conciliacaoValidacao';

describe('avisoTipoPlanoCentro', () => {
	it('warns when an investment plan goes to a custeio centre (e.g. "Obras e instalações" in "Leite - Produção")', () => {
		expect(avisoTipoPlanoCentro(['investimento'], ['CUSTEIO'])).toBe(
			'O plano é de investimento, mas o centro de custos é de custeio. No Dashboard o valor entra como custeio.',
		);
		expect(avisoTipoPlanoCentro(['Custeio'], ['INVESTIMENTO'])).toContain('No Dashboard o valor entra como investimento.');
	});

	it('no warning when types match or one side is unknown', () => {
		expect(avisoTipoPlanoCentro(['custeio'], ['CUSTEIO'])).toBeNull();
		expect(avisoTipoPlanoCentro(['transferencia'], ['CUSTEIO'])).toBeNull();
		expect(avisoTipoPlanoCentro([], ['CUSTEIO'])).toBeNull();
		expect(avisoTipoPlanoCentro(['investimento'], [undefined])).toBeNull();
		expect(avisoTipoPlanoCentro(['custeio', 'custeio'], ['CUSTEIO', 'CUSTEIO'])).toBeNull();
	});

	it('mixed rateios get a generic warning', () => {
		expect(avisoTipoPlanoCentro(['investimento', 'custeio'], ['CUSTEIO'])).toContain('têm tipos diferentes');
	});
});

describe('debitoFicaSemCentro', () => {
	it('a chosen centre or rateio is enough', () => {
		expect(debitoFicaSemCentro({ centroEscolhido: true, rateioCentrosEscolhido: false, movimento: {} })).toBe(false);
		expect(debitoFicaSemCentro({ centroEscolhido: false, rateioCentrosEscolhido: true, movimento: {} })).toBe(false);
	});

	it('single movement: clearing the only centre is refused, an untouched multi-centre rateio is kept', () => {
		expect(debitoFicaSemCentro({ centroEscolhido: false, rateioCentrosEscolhido: false, movimento: { idCentroCustos: 37 } })).toBe(true);
		expect(
			debitoFicaSemCentro({
				centroEscolhido: false,
				rateioCentrosEscolhido: false,
				movimento: { idCentroCustos: null, centroCustosList: [{}, {}] },
			}),
		).toBe(false);
	});

	it('batch: every selected movement must already have a centre when none is chosen', () => {
		const base = { centroEscolhido: false, rateioCentrosEscolhido: false, movimento: {} };
		expect(debitoFicaSemCentro({ ...base, movimentosLote: [{ idCentroCustos: 1 }, { centroCustosList: [{}, {}] }] })).toBe(false);
		expect(debitoFicaSemCentro({ ...base, movimentosLote: [{ idCentroCustos: 1 }, { idCentroCustos: null }] })).toBe(true);
	});
});
