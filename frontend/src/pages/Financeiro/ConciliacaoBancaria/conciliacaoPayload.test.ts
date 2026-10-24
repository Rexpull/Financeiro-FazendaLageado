import { describe, expect, it } from 'vitest';
import { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';
import {
	montarMovimentoConciliacaoIndividual,
	montarMovimentoConciliacaoLote,
	montarMovimentosLote,
	ratearPercentuaisNoValor,
} from './conciliacaoPayload';
import { montarCorpoPutParcial } from '../../../services/movimentoBancarioService';
import { movimentoTemAlgumCentro, movimentoTemAlgumPlano } from './conciliacaoLabels';

const somaCentavos = (vals: number[]) => Math.round(vals.reduce((a, v) => a + v, 0) * 100) / 100;

function mov(over: Partial<MovimentoBancario> = {}): MovimentoBancario {
	return {
		id: 1,
		dtMovimento: '2026-04-13T00:00:00.000Z',
		historico: 'PIX',
		idContaCorrente: 7,
		valor: -1234.57,
		saldo: 0,
		ideagro: false,
		parcelado: false,
		identificadorOfx: 'x',
		criadoEm: '',
		atualizadoEm: '',
		tipoMovimento: 'D',
		modalidadeMovimento: 'padrao',
		...over,
	};
}

describe('ratearPercentuaisNoValor', () => {
	it('33.33/33.33/33.34 over R$ 1.234,57 → centavos exatos somando o valor', () => {
		const valores = ratearPercentuaisNoValor([33.33, 33.33, 33.34], -1234.57);
		expect(valores).toEqual([411.48, 411.48, 411.61]);
		expect(somaCentavos(valores)).toBe(1234.57);
		valores.forEach((v) => expect(Math.round(v * 100) / 100).toBe(v));
	});

	it('divisão igual em 3 (33.33 cada + resíduo) também fecha o total', () => {
		const valores = ratearPercentuaisNoValor([33.33, 33.33, 33.34], 100);
		expect(somaCentavos(valores)).toBe(100);
	});

	it('lista vazia → []', () => {
		expect(ratearPercentuaisNoValor([], 10)).toEqual([]);
	});
});

describe('montarMovimentosLote (rateio % por movimento)', () => {
	it('arredonda cada movimento a centavos e fecha exatamente no seu valor', () => {
		const movimentos = [mov({ id: 1, valor: -1234.57 }), mov({ id: 2, valor: -10 }), mov({ id: 3, valor: -0.05 })];
		const out = montarMovimentosLote(
			movimentos,
			{ modalidadeMovimento: 'padrao', idPlanoContas: null, idCentroCustos: null },
			[
				{ idPlano: 10, porcentagem: 33.33 },
				{ idPlano: 11, porcentagem: 33.33 },
				{ idPlano: 12, porcentagem: 33.34 },
			],
			[
				{ idCentro: 20, porcentagem: 50 },
				{ idCentro: 21, porcentagem: 50 },
			]
		);

		out.forEach((m, i) => {
			const abs = Math.abs(movimentos[i].valor);
			expect(m.idPlanoContas).toBeNull();
			expect(m.idCentroCustos).toBeNull();
			expect(somaCentavos(m.resultadoList!.map((r) => r.valor))).toBe(abs);
			expect(somaCentavos(m.centroCustosList!.map((c) => c.valor))).toBe(abs);
			m.resultadoList!.forEach((r) => expect(Math.round(r.valor * 100) / 100).toBe(r.valor));
		});
		expect(out[0].resultadoList!.map((r) => r.valor)).toEqual([411.48, 411.48, 411.61]);
	});

	it('ignora listas de dados (pertencem ao 1º movimento) e mantém plano/centro não escolhidos', () => {
		const movimentos = [
			mov({ id: 1, idPlanoContas: 5, idCentroCustos: 8 }),
			mov({
				id: 2,
				idPlanoContas: undefined,
				idCentroCustos: undefined,
				resultadoList: [
					{ idPlanoContas: 5, valor: 600, tipo: 'D', idContaCorrente: 7, dtMovimento: '' },
					{ idPlanoContas: 6, valor: 634.57, tipo: 'D', idContaCorrente: 7, dtMovimento: '' },
				],
			}),
		];
		const out = montarMovimentosLote(movimentos, {
			modalidadeMovimento: 'padrao',
			idPlanoContas: null,
			idCentroCustos: null,
			centroCustosList: [{ idCentroCustos: 99, valor: 1 }],
			resultadoList: [{ idPlanoContas: 98, valor: 1, tipo: 'D', idContaCorrente: 7, dtMovimento: '' }],
		});
		const corpo1 = montarCorpoPutParcial(out[0]);
		const corpo2 = montarCorpoPutParcial(out[1]);
		expect(corpo1.idPlanoContas).toBe(5);
		expect(corpo1.idCentroCustos).toBe(8);
		expect('centroCustosList' in corpo1).toBe(false);
		expect('resultadoList' in corpo1).toBe(false);
		// movimento rateado: nada que apague o rateio
		expect('idCentroCustos' in corpo2).toBe(false);
		expect('resultadoList' in corpo2).toBe(false);
		expect('centroCustosList' in corpo2).toBe(false);
	});
});

describe('montarMovimentoConciliacaoIndividual — null limpa, undefined mantém', () => {
	it('padrão: limpa idFinanciamento/idBanco com null (não undefined)', () => {
		const base = mov({ modalidadeMovimento: 'financiamento', idFinanciamento: 3, idBanco: 2, parcelado: true });
		const out = montarMovimentoConciliacaoIndividual(base, {
			modalidadeMovimento: 'padrao',
			idPlanoContas: 10,
			idCentroCustos: 20,
			resultadoList: [],
		});
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idFinanciamento).toBeNull();
		expect(corpo.idBanco).toBeNull();
		expect(corpo.parcelado).toBe(false);
		expect(corpo.idPlanoContas).toBe(10);
		expect(corpo.idCentroCustos).toBe(20);
	});

	it('transferência: limpa centro (null) e não reenvia o rateio de centros antigo', () => {
		const base = mov({
			idCentroCustos: undefined,
			centroCustosList: [
				{ idMovimentoBancario: 1, idCentroCustos: 20, valor: 600 },
				{ idMovimentoBancario: 1, idCentroCustos: 21, valor: 634.57 },
			],
			idFinanciamento: 4,
		});
		const out = montarMovimentoConciliacaoIndividual(base, { modalidadeMovimento: 'transferencia', idPlanoContas: 77 });
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idCentroCustos).toBeNull();
		expect('centroCustosList' in corpo).toBe(false);
		expect(corpo.resultadoList).toEqual([]);
		expect(corpo.idFinanciamento).toBeNull();
		expect(corpo.idBanco).toBeNull();
		expect(corpo.idPlanoContas).toBe(77);
	});

	it('financiamento: centro vira null (não undefined) e rateio antigo não é reenviado', () => {
		const base = mov({
			idCentroCustos: 20,
			centroCustosList: [{ idMovimentoBancario: 1, idCentroCustos: 20, valor: 1234.57 }],
		});
		const out = montarMovimentoConciliacaoIndividual(base, {
			modalidadeMovimento: 'financiamento',
			idPlanoContas: null,
			idCentroCustos: null,
			idFinanciamento: 9,
			resultadoList: [],
		});
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idCentroCustos).toBeNull();
		expect(corpo.idPlanoContas).toBeNull();
		expect('centroCustosList' in corpo).toBe(false);
		expect(corpo.idFinanciamento).toBe(9);
		expect(corpo.ideagro).toBe(true);
	});

	it('padrão com rateio de centros: idCentroCustos null + lista', () => {
		const lista = [
			{ idCentroCustos: 20, valor: 600 },
			{ idCentroCustos: 21, valor: 634.57 },
		];
		const out = montarMovimentoConciliacaoIndividual(mov(), {
			modalidadeMovimento: 'padrao',
			idPlanoContas: 10,
			idCentroCustos: null,
			centroCustosList: lista,
		});
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idCentroCustos).toBeNull();
		expect(corpo.centroCustosList).toEqual(lista);
	});

	it('não limpa numeroDocumento (identificador OFX) ao conciliar', () => {
		const out = montarMovimentoConciliacaoIndividual(mov({ numeroDocumento: 'FITID|2026' }), {
			modalidadeMovimento: 'transferencia',
			idPlanoContas: 77,
		});
		expect(out.numeroDocumento).toBe('FITID|2026');
	});
});

describe('montarMovimentoConciliacaoLote', () => {
	it('financiamento em lote limpa plano e centro com null', () => {
		const out = montarMovimentoConciliacaoLote(mov({ idPlanoContas: 5, idCentroCustos: 8 }), {
			modalidadeMovimento: 'financiamento',
			idPlanoContas: null,
			idCentroCustos: null,
			idFinanciamento: 3,
		});
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idPlanoContas).toBeNull();
		expect(corpo.idCentroCustos).toBeNull();
		expect(corpo.resultadoList).toEqual([]);
		expect(corpo.idFinanciamento).toBe(3);
	});

	it('padrão em lote com plano/centro escolhidos substitui rateios anteriores', () => {
		const out = montarMovimentoConciliacaoLote(
			mov({
				centroCustosList: [
					{ idMovimentoBancario: 1, idCentroCustos: 20, valor: 600 },
					{ idMovimentoBancario: 1, idCentroCustos: 21, valor: 634.57 },
				],
				idFinanciamento: 2,
			}),
			{ modalidadeMovimento: 'padrao', idPlanoContas: 10, idCentroCustos: 30 }
		);
		const corpo = montarCorpoPutParcial(out);
		expect(corpo.idPlanoContas).toBe(10);
		expect(corpo.resultadoList).toEqual([]);
		expect(corpo.idCentroCustos).toBe(30);
		expect('centroCustosList' in corpo).toBe(false);
		expect(corpo.idFinanciamento).toBeNull();
	});
});

describe('montarCorpoPutParcial', () => {
	it('descarta undefined e preserva null', () => {
		expect(montarCorpoPutParcial({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
	});
});

describe('filtros por plano/centro consideram rateios', () => {
	const rateado = mov({
		idPlanoContas: undefined,
		idCentroCustos: undefined,
		resultadoList: [
			{ idPlanoContas: 5, valor: 600, tipo: 'D', idContaCorrente: 7, dtMovimento: '' },
			{ idPlanoContas: 6, valor: 634.57, tipo: 'D', idContaCorrente: 7, dtMovimento: '' },
		],
		centroCustosList: [
			{ idMovimentoBancario: 1, idCentroCustos: 20, valor: 600 },
			{ idMovimentoBancario: 1, idCentroCustos: 21, valor: 634.57 },
		],
	});

	it('casa plano/centro presente apenas no rateio', () => {
		expect(movimentoTemAlgumPlano(rateado, [6])).toBe(true);
		expect(movimentoTemAlgumPlano(rateado, [7])).toBe(false);
		expect(movimentoTemAlgumCentro(rateado, [21])).toBe(true);
		expect(movimentoTemAlgumCentro(rateado, [22])).toBe(false);
	});

	it('casa idPlanoContas/idCentroCustos simples e filtro vazio', () => {
		const simples = mov({ idPlanoContas: 9, idCentroCustos: 30 });
		expect(movimentoTemAlgumPlano(simples, [9])).toBe(true);
		expect(movimentoTemAlgumCentro(simples, [30])).toBe(true);
		expect(movimentoTemAlgumPlano(simples, [])).toBe(true);
	});
});
