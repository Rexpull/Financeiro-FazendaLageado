import { describe, it, expect } from 'vitest';
import {
	isMovimentoPendenteConcilacao,
	resumirPendentesConcilacao,
} from './isMovimentoPendenteConcilacao';

describe('isMovimentoPendenteConcilacao', () => {
	it('despesa (D) with plan but no cost center is NOT pending (Abr/2026 Fluxo inconsistency case)', () => {
		expect(
			isMovimentoPendenteConcilacao({
				tipoMovimento: 'D',
				modalidadeMovimento: 'padrao',
				idPlanoContas: 50,
				idCentroCustos: null,
				centroCustosList: [],
				valor: 220528.38,
			}),
		).toBe(false);
	});

	it('despesa (D) without plan and without resultadoList IS pending', () => {
		expect(
			isMovimentoPendenteConcilacao({
				tipoMovimento: 'D',
				modalidadeMovimento: 'padrao',
				idPlanoContas: null,
				resultadoList: [],
				valor: 100,
			}),
		).toBe(true);
	});

	it('despesa (D) with resultadoList is not pending even without idPlanoContas on MB', () => {
		expect(
			isMovimentoPendenteConcilacao({
				tipoMovimento: 'D',
				modalidadeMovimento: 'padrao',
				idPlanoContas: null,
				resultadoList: [{ idPlanoContas: 10 }],
			}),
		).toBe(false);
	});

	it('crédito (C) without cost center IS pending', () => {
		expect(
			isMovimentoPendenteConcilacao({
				tipoMovimento: 'C',
				modalidadeMovimento: 'padrao',
				idCentroCustos: null,
				centroCustosList: [],
				valor: 500,
			}),
		).toBe(true);
	});

	it('crédito (C) with cost center is not pending', () => {
		expect(
			isMovimentoPendenteConcilacao({
				tipoMovimento: 'C',
				modalidadeMovimento: 'padrao',
				idCentroCustos: 42,
			}),
		).toBe(false);
	});

	it('financiamento without linked contract is pending', () => {
		expect(
			isMovimentoPendenteConcilacao({
				modalidadeMovimento: 'financiamento',
				idFinanciamento: null,
			}),
		).toBe(true);
		expect(
			isMovimentoPendenteConcilacao({
				modalidadeMovimento: 'financiamento',
				idFinanciamento: 7,
			}),
		).toBe(false);
	});

	it('transferência without plan is pending; with plan is not', () => {
		expect(
			isMovimentoPendenteConcilacao({
				modalidadeMovimento: 'transferencia',
				idPlanoContas: null,
				resultadoList: [],
			}),
		).toBe(true);
		expect(
			isMovimentoPendenteConcilacao({
				modalidadeMovimento: 'transferencia',
				idPlanoContas: 3,
			}),
		).toBe(false);
	});
});

describe('resumirPendentesConcilacao', () => {
	it('returns quantity and absolute value for todos and pendentes', () => {
		const resumo = resumirPendentesConcilacao([
			{ tipoMovimento: 'D', idPlanoContas: 1, valor: -100 }, // classified
			{ tipoMovimento: 'D', idPlanoContas: null, resultadoList: [], valor: -50.5 }, // pending
			{ tipoMovimento: 'C', idCentroCustos: null, valor: 20 }, // pending
		]);
		expect(resumo.todos).toEqual({ quantidade: 3, valorTotal: 170.5 });
		expect(resumo.pendentes).toEqual({ quantidade: 2, valorTotal: 70.5 });
	});

	it('classified despesa without centro does not inflate pendentes (regression vs Fluxo)', () => {
		const resumo = resumirPendentesConcilacao([
			{
				tipoMovimento: 'D',
				idPlanoContas: 99,
				idCentroCustos: null,
				valor: 220528.38,
			},
		]);
		expect(resumo.pendentes.quantidade).toBe(0);
		expect(resumo.pendentes.valorTotal).toBe(0);
		expect(resumo.todos.valorTotal).toBe(220528.38);
	});
});
