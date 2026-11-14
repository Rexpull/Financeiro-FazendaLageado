import { describe, it, expect } from 'vitest';
import { debitoFicaSemCentro, erroTipoPlanoCentroConciliacao, tipoCentroExigido } from './conciliacaoValidacao';

// planos: 1 = Manutenção (custeio), 2 = Energia (custeio), 10 = Obras (investimento), 11 = Máquinas (investimento)
// centros: 42 = Leite custeio, 43 = Recria custeio, 50 = Leite investimento, 51 = Agricultura investimento
const tipoPlano = (id: number) => ({ 1: 'custeio', 2: 'custeio', 10: 'investimento', 11: 'investimento' })[id];
const tipoCentro = (id: number) => ({ 42: 'CUSTEIO', 43: 'CUSTEIO', 50: 'INVESTIMENTO', 51: 'INVESTIMENTO' })[id];
const regra = (
	escolhaPlanos: Array<{ id: number; peso: number }> | null,
	escolhaCentros: Array<{ id: number; peso: number }> | null,
	movimentos: Parameters<typeof erroTipoPlanoCentroConciliacao>[0]['movimentos'] = [{ valor: -1000, tipoMovimento: 'D' }],
) => erroTipoPlanoCentroConciliacao({ escolhaPlanos, escolhaCentros, movimentos, tipoPlano, tipoCentro });
const um = (id: number) => [{ id, peso: 100 }];

describe('erroTipoPlanoCentroConciliacao: one line', () => {
	it('blocks an investimento plano in a custeio centre (e.g. "Obras e instalações" in "Leite - Produção" custeio)', () => {
		expect(regra(um(10), um(42))).toBe('O plano de contas é de investimento: o centro de custos também precisa ser de investimento.');
		expect(regra(um(1), um(50))).toContain('custeio');
	});

	it('accepts matching types, in a single centre or in a rateio of centres', () => {
		expect(regra(um(10), um(50))).toBeNull();
		expect(regra(um(1), [{ id: 42, peso: 60 }, { id: 43, peso: 40 }])).toBeNull();
		expect(regra(um(10), [{ id: 50, peso: 60 }, { id: 42, peso: 40 }])).not.toBeNull();
	});

	it('nothing to check while one side is still empty, or for a credit', () => {
		expect(regra(um(10), null)).toBeNull();
		expect(regra(null, um(42))).toBeNull();
		expect(regra(um(10), um(42), [{ valor: 1000, tipoMovimento: 'C' }])).toBeNull();
	});

	it('what was not chosen in the modal comes from the line (saved plano × new centre)', () => {
		const salvo = [{ valor: -1000, tipoMovimento: 'D', idPlanoContas: 10, idCentroCustos: 50 }];
		expect(regra(null, um(42), salvo)).not.toBeNull();
		expect(regra(null, um(51), salvo)).toBeNull();
		expect(regra(um(1), null, salvo)).not.toBeNull();
	});

	it('planos of both types: the totals per type must match (percentages or R$)', () => {
		const planos = [{ id: 11, peso: 4000 }, { id: 1, peso: 7678.1 }];
		const fatura = [{ valor: -11678.1, tipoMovimento: 'D' }];
		expect(regra(planos, [{ id: 50, peso: 4000 }, { id: 42, peso: 5000 }, { id: 43, peso: 2678.1 }], fatura)).toBeNull();
		expect(regra(planos, um(42), fatura)).toContain('Detalhar por itens');
		// 40% investimento / 60% custeio on both sides
		expect(regra([{ id: 11, peso: 40 }, { id: 1, peso: 60 }], [{ id: 51, peso: 40 }, { id: 42, peso: 60 }])).toBeNull();
		expect(regra([{ id: 11, peso: 40 }, { id: 1, peso: 60 }], [{ id: 51, peso: 50 }, { id: 42, peso: 50 }])).not.toBeNull();
	});
});

describe('erroTipoPlanoCentroConciliacao: batch', () => {
	const lote = [
		{ valor: -100, tipoMovimento: 'D', historico: 'Boleto JUCA', idPlanoContas: 10, idCentroCustos: 50 },
		{ valor: -200, tipoMovimento: 'D', historico: 'Energia CEMIG', idPlanoContas: 1, idCentroCustos: 42 },
		{ valor: 300, tipoMovimento: 'C', historico: 'Venda de leite', idCentroCustos: 60 },
	];

	it('choosing only the centre checks each despesa against its own plano, and names the one that breaks', () => {
		expect(regra(null, um(42), lote)).toBe(
			'"Boleto JUCA": O plano de contas é de investimento: o centro de custos também precisa ser de investimento.',
		);
		expect(regra(null, um(50), lote)).toContain('"Energia CEMIG"');
	});

	it('choosing plano and centre of the same type is fine for every line', () => {
		expect(regra(um(2), um(43), lote)).toBeNull();
		expect(regra(null, null, lote)).toBeNull();
	});
});

describe('tipoCentroExigido', () => {
	const exigido = (escolhaPlanos: Array<{ id: number; peso: number }> | null, movimentos: Array<Record<string, unknown>> = [{ valor: -1000, tipoMovimento: 'D' }]) =>
		tipoCentroExigido({ escolhaPlanos, movimentos: movimentos as never, tipoPlano });

	it('the type of the chosen planos, uppercase like CentroCustos.tipo', () => {
		expect(exigido(um(10))).toBe('INVESTIMENTO');
		expect(exigido([{ id: 1, peso: 50 }, { id: 2, peso: 50 }])).toBe('CUSTEIO');
	});

	it('null without a plano or with both types', () => {
		expect(exigido(null)).toBeNull();
		expect(exigido([{ id: 1, peso: 50 }, { id: 10, peso: 50 }])).toBeNull();
	});

	it('uses the saved plano of the line when none is chosen; a batch needs every despesa of the same type', () => {
		expect(exigido(null, [{ valor: -100, tipoMovimento: 'D', idPlanoContas: 10 }])).toBe('INVESTIMENTO');
		expect(exigido(null, [{ valor: -100, tipoMovimento: 'D', idPlanoContas: 10 }, { valor: -50, tipoMovimento: 'D', idPlanoContas: 1 }])).toBeNull();
		expect(exigido(null, [{ valor: -100, tipoMovimento: 'D', idPlanoContas: 10 }, { valor: -50, tipoMovimento: 'D' }])).toBeNull();
		expect(exigido(null, [{ valor: -100, tipoMovimento: 'D', idPlanoContas: 10 }, { valor: 50, tipoMovimento: 'C' }])).toBe('INVESTIMENTO');
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
