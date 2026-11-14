import { describe, it, expect } from 'vitest';
import { classificacaoAposPut, classificacaoDe, erroTipoPlanoCentro, mesmaClassificacao, normalizarTipoClassificacao, tipoUnico } from './regraTipoPlanoCentro';

const inv = (valor: number) => ({ tipo: 'investimento', valor });
const cus = (valor: number) => ({ tipo: 'custeio', valor });
const INV = (valor: number) => ({ tipo: 'INVESTIMENTO', valor });
const CUS = (valor: number) => ({ tipo: 'CUSTEIO', valor });

describe('normalizarTipoClassificacao / tipoUnico', () => {
	it('reads planoContas.tipo (lowercase) and CentroCustos.tipo (uppercase) the same way', () => {
		expect(normalizarTipoClassificacao('INVESTIMENTO')).toBe('investimento');
		expect(normalizarTipoClassificacao(' Custeio ')).toBe('custeio');
		expect(normalizarTipoClassificacao(null)).toBeNull();
		expect(normalizarTipoClassificacao('outro')).toBeNull();
	});

	it('tipoUnico: one type or null', () => {
		expect(tipoUnico([inv(1), INV(2)])).toBe('investimento');
		expect(tipoUnico([inv(1), cus(2)])).toBeNull();
		expect(tipoUnico([])).toBeNull();
	});
});

describe('erroTipoPlanoCentro: one plano type', () => {
	it('investimento plano → investimento centre', () => {
		expect(erroTipoPlanoCentro([inv(100)], [INV(100)])).toBeNull();
		expect(erroTipoPlanoCentro([inv(100)], [CUS(100)])).toBe(
			'O plano de contas é de investimento: o centro de custos também precisa ser de investimento.',
		);
	});

	it('custeio plano → custeio centre', () => {
		expect(erroTipoPlanoCentro([cus(100)], [CUS(100)])).toBeNull();
		expect(erroTipoPlanoCentro([cus(100)], [INV(100)])).toContain('custeio');
	});

	it('a rateio between centres must stay inside the plano type (production case: Obras → Leite custeio)', () => {
		expect(erroTipoPlanoCentro([inv(23541)], [INV(10000), INV(13541)])).toBeNull();
		expect(erroTipoPlanoCentro([inv(23541)], [INV(10000), CUS(13541)])).not.toBeNull();
	});

	it('several planos of the same type say "planos"', () => {
		expect(erroTipoPlanoCentro([inv(60), inv(40)], [CUS(100)])).toBe(
			'Os planos de contas são de investimento: os centros de custos também precisam ser de investimento.',
		);
		expect(erroTipoPlanoCentro([cus(60), cus(40)], [CUS(30), CUS(70)])).toBeNull();
	});
});

describe('erroTipoPlanoCentro: both plano types in one line (card bill)', () => {
	it('accepts when each type has the same total on both sides', () => {
		// DEB.CTA.FATURA: 4.000 máquinas (investimento) + 7.678,10 manutenção (custeio)
		expect(erroTipoPlanoCentro([inv(4000), cus(7678.1)], [INV(4000), CUS(5000), CUS(2678.1)])).toBeNull();
	});

	it('refuses when the totals per type differ, pointing to "Detalhar por itens"', () => {
		const erro = erroTipoPlanoCentro([inv(4000), cus(7678.1)], [CUS(11678.1)]);
		expect(erro).toContain('Detalhar por itens');
		expect(erro).toMatch(/R\$\s4\.000,00 de investimento e R\$\s7\.678,10 de custeio/); // pt-BR puts a no-break space after R$
		expect(erroTipoPlanoCentro([inv(4000), cus(7678.1)], [INV(5000), CUS(6678.1)])).not.toBeNull();
	});

	it('tolerates the cents of a percentage split, not more', () => {
		// 1.000,01 split 50/50 on each side: 500,00 + 500,01 vs 500,01 + 500,00
		expect(erroTipoPlanoCentro([inv(500), cus(500.01)], [INV(500.01), CUS(500)])).toBeNull();
		expect(erroTipoPlanoCentro([inv(500), cus(500.01)], [INV(500.1), CUS(499.91)])).not.toBeNull();
	});
});

describe('erroTipoPlanoCentro: nothing to check', () => {
	it('one side empty', () => {
		expect(erroTipoPlanoCentro([], [CUS(10)])).toBeNull();
		expect(erroTipoPlanoCentro([inv(10)], [])).toBeNull();
	});

	it('an entry without a known type', () => {
		expect(erroTipoPlanoCentro([{ tipo: null, valor: 10 }], [CUS(10)])).toBeNull();
		expect(erroTipoPlanoCentro([inv(10)], [{ tipo: undefined, valor: 10 }])).toBeNull();
	});
});

describe('classificacaoDe', () => {
	it('lists win over the single ids; a single id takes the whole value', () => {
		expect(classificacaoDe({ valor: -100, idPlanoContas: 5, idCentroCustos: 9 })).toEqual({
			planos: [{ id: 5, valor: 100 }],
			centros: [{ id: 9, valor: 100 }],
		});
		expect(
			classificacaoDe({
				valor: -100,
				idPlanoContas: 5,
				resultadoList: [{ idPlanoContas: 5, valor: 60 }, { idPlanoContas: 6, valor: 40 }],
				centroCustosList: [{ idCentroCustos: 9, valor: 100 }],
			}),
		).toEqual({ planos: [{ id: 5, valor: 60 }, { id: 6, valor: 40 }], centros: [{ id: 9, valor: 100 }] });
		expect(classificacaoDe({ valor: -100 })).toEqual({ planos: [], centros: [] });
	});
});

describe('classificacaoAposPut', () => {
	const antes = { valor: -100, tipoMovimento: 'D', modalidadeMovimento: 'padrao', idPlanoContas: 5, idCentroCustos: 9 };

	it('null when the PUT does not touch plano/centro (e.g. only the histórico)', () => {
		expect(classificacaoAposPut(antes, { historico: 'x' } as never)).toBeNull();
	});

	it('null for credits and for lines that are not padrão', () => {
		expect(classificacaoAposPut({ ...antes, valor: 100, tipoMovimento: 'C' }, { idCentroCustos: 3 })).toBeNull();
		expect(classificacaoAposPut(antes, { modalidadeMovimento: 'financiamento', idPlanoContas: null, idCentroCustos: null })).toBeNull();
		expect(classificacaoAposPut({ ...antes, modalidadeMovimento: 'transferencia' }, { idPlanoContas: 7 })).toBeNull();
	});

	it('a single id sent replaces that side and keeps the other', () => {
		expect(classificacaoAposPut(antes, { idCentroCustos: 3 })).toEqual({ planos: [{ id: 5, valor: 100 }], centros: [{ id: 3, valor: 100 }] });
		expect(classificacaoAposPut(antes, { idPlanoContas: 7 })).toEqual({ planos: [{ id: 7, valor: 100 }], centros: [{ id: 9, valor: 100 }] });
	});

	it('a list sent wins over the id; null clears the side', () => {
		expect(
			classificacaoAposPut(antes, { idCentroCustos: null, centroCustosList: [{ idCentroCustos: 3, valor: 70 }, { idCentroCustos: 4, valor: 30 }] }),
		).toEqual({ planos: [{ id: 5, valor: 100 }], centros: [{ id: 3, valor: 70 }, { id: 4, valor: 30 }] });
		expect(classificacaoAposPut(antes, { idCentroCustos: null })?.centros).toEqual([]);
	});

	it('uses the stored lists when the PUT leaves a side alone', () => {
		const comRateio = { ...antes, idCentroCustos: null, centroCustosList: [{ idCentroCustos: 3, valor: 70 }, { idCentroCustos: 4, valor: 30 }] };
		expect(classificacaoAposPut(comRateio, { idPlanoContas: 7 })?.centros).toEqual([{ id: 3, valor: 70 }, { id: 4, valor: 30 }]);
	});

	it('legacy tipoMovimento NULL follows the sign of valor', () => {
		expect(classificacaoAposPut({ valor: -50, idPlanoContas: 5, idCentroCustos: 9 }, { idCentroCustos: 3 })).not.toBeNull();
		expect(classificacaoAposPut({ valor: 50, idCentroCustos: 9 }, { idCentroCustos: 3 })).toBeNull();
	});
});

describe('mesmaClassificacao', () => {
	it('ignores the order and compares in cents', () => {
		const a = { planos: [{ id: 1, valor: 60 }, { id: 2, valor: 40 }], centros: [{ id: 9, valor: 100 }] };
		expect(mesmaClassificacao(a, { planos: [{ id: 2, valor: 40.001 }, { id: 1, valor: 60 }], centros: [{ id: 9, valor: 100 }] })).toBe(true);
		expect(mesmaClassificacao(a, { ...a, centros: [{ id: 8, valor: 100 }] })).toBe(false);
		expect(mesmaClassificacao(a, { ...a, planos: [{ id: 1, valor: 50 }, { id: 2, valor: 50 }] })).toBe(false);
	});
});

describe('classificacaoAposPut follows what the update really does (regression guard)', () => {
	const rateio = [{ idCentroCustos: 3, valor: 70 }, { idCentroCustos: 4, valor: 30 }];
	const comRateio = { valor: -100, tipoMovimento: 'D', modalidadeMovimento: 'padrao', idPlanoContas: 5, idCentroCustos: null, centroCustosList: rateio };

	it('null sent to a column that is already null keeps the stored rateio (the update does not clear it)', () => {
		expect(classificacaoAposPut(comRateio, { idPlanoContas: 7, idCentroCustos: null })).toEqual({
			planos: [{ id: 7, valor: 100 }],
			centros: [{ id: 3, valor: 70 }, { id: 4, valor: 30 }],
		});
	});

	it('the same id sent again changes nothing; an empty list is the same as no list', () => {
		const antes = { valor: -100, tipoMovimento: 'D', modalidadeMovimento: 'padrao', idPlanoContas: 5, idCentroCustos: 9 };
		const igual = classificacaoAposPut(antes, { idPlanoContas: 5, idCentroCustos: 9, resultadoList: [], centroCustosList: [] });
		expect(igual && mesmaClassificacao(igual, classificacaoDe(antes))).toBe(true);
	});

	it('"Limpar conciliação" is never checked', () => {
		expect(classificacaoAposPut(comRateio, { idPlanoContas: null, idCentroCustos: null, resultadoList: [], limparConciliacao: true } as never)).toBeNull();
	});
});
