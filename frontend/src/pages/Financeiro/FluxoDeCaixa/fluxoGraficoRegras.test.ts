import { describe, it, expect } from 'vitest';
import { compararAnos, resumoAnoFluxo, topCentros } from './fluxoGraficoRegras';
import { montarFluxoMensal } from './fluxoMensalRegras';

const vazio = () => ({ receitas: {}, despesas: {}, financiamentos: { pagos: {}, contratados: {} } });

const atual = Array.from({ length: 12 }, vazio);
atual[2] = { ...vazio(), receitas: { '60': 250 }, despesas: { '1000': { filhos: { '42': 50 } } } };
atual[9] = {
	receitas: { '60': 1000, '61': 500 },
	despesas: { '1000': { filhos: { '42': 600, '43': 100 } }, '2000': { filhos: { '50': 200 } } },
	// Financing never enters C, lucratividade or best/worst month
	financiamentos: { pagos: { b_1: { valor: 300 } }, contratados: { b_2: { valor: 7000 } } },
};

const anterior = Array.from({ length: 12 }, vazio);
anterior[5] = { ...vazio(), receitas: { '60': 1000 }, despesas: { '1000': { filhos: { '42': 900 } } } };

describe('resumoAnoFluxo (aba Gráfico)', () => {
	const r = resumoAnoFluxo(atual);

	it('total acumulado = (C) of the year, same as the table total', () => {
		expect(r.acumulado).toBe(800); // 1750 − 750 − 200
		expect(r.acumulado).toBe(montarFluxoMensal(atual).total.saldoAposInvestimentos);
	});

	it('lucratividade = C ÷ R (not the saldo inicial variation)', () => {
		expect(r.lucratividade).toBeCloseTo((800 / 1750) * 100, 6);
	});

	it('best / worst month by C, ignoring months without movement', () => {
		expect(r.melhorMes).toEqual({ idx: 9, valor: 600 });
		expect(r.piorMes).toEqual({ idx: 2, valor: 200 });
	});

	it('series: R, operacionais, investimentos (B), A and C', () => {
		expect(r.series.receitas[9]).toBe(1500);
		expect(r.series.operacionais[9]).toBe(700);
		expect(r.series.investimentos[9]).toBe(200);
		expect(r.series.saldoOperacional[9]).toBe(800);
		expect(r.series.saldoAposInvestimentos[9]).toBe(600);
	});

	it('compares with the previous year (R$ and percentage points)', () => {
		const cmp = compararAnos(r, resumoAnoFluxo(anterior));
		expect(cmp.diferencaAcumulado).toBe(700);
		expect(cmp.diferencaLucratividade).toBeCloseTo((800 / 1750) * 100 - 10, 6);
	});

	it('no comparison when the previous year has no data', () => {
		const cmp = compararAnos(r, resumoAnoFluxo(Array.from({ length: 12 }, vazio)));
		expect(cmp).toEqual({ diferencaAcumulado: null, diferencaLucratividade: null });
		expect(resumoAnoFluxo(Array.from({ length: 12 }, vazio))).toMatchObject({ temDados: false, melhorMes: null, piorMes: null, lucratividade: null });
	});
});

describe('topCentros', () => {
	const centros = [
		{ id: 42, descricao: 'Leite', tipo: 'CUSTEIO' },
		{ id: 43, descricao: 'Administrativo', tipo: 'CUSTEIO' },
		{ id: 50, descricao: 'Leite', tipo: 'INVESTIMENTO' },
		{ id: 60, descricao: 'Venda Leite', tipo: 'CUSTEIO' },
	];
	const { total } = montarFluxoMensal(atual);

	it('groups despesas by centro id and tells apart same-name centros', () => {
		expect(topCentros(total, 'despesas', centros)).toEqual([
			{ key: 'CUSTEIO:42', descricao: 'Leite · Custeio', valor: 650 },
			{ key: 'INVESTIMENTO:50', descricao: 'Leite · Investimento', valor: 200 },
			{ key: 'CUSTEIO:43', descricao: 'Administrativo', valor: 100 },
		]);
	});

	it('receitas keep plain names when there is no collision; unknown centro falls back to its id', () => {
		expect(topCentros(total, 'receitas', centros)).toEqual([
			{ key: 'receitas:60', descricao: 'Venda Leite', valor: 1250 },
			{ key: 'receitas:61', descricao: 'Centro 61', valor: 500 },
		]);
	});

	it('same name and same type: adds the id', () => {
		const dup = centros.map((c) => (c.id === 43 ? { ...c, descricao: 'Leite' } : c));
		const nomes = topCentros(total, 'despesas', dup).map((i) => i.descricao);
		expect(nomes).toEqual(['Leite · Custeio (#42)', 'Leite · Investimento', 'Leite · Custeio (#43)']);
	});

	it('limits to N items', () => {
		expect(topCentros(total, 'despesas', centros, 2)).toHaveLength(2);
	});
});
