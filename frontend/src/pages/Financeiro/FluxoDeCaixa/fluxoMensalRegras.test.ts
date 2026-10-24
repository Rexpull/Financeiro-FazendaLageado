import { describe, it, expect } from 'vitest';
import { montarFluxoMensal } from './fluxoMensalRegras';

const vazio = () => ({ receitas: {}, despesas: {}, financiamentos: { pagos: {}, contratados: {} } });

describe('montarFluxoMensal', () => {
	const meses = Array.from({ length: 12 }, vazio);
	meses[9] = {
		receitas: { '32': 1000, '31': 500 },
		despesas: {
			'1000': { descricao: 'Custeio', filhos: { '42': 600, '60': 100 } },
			'2000': { descricao: 'Investimentos', filhos: { '51': 200 } },
		},
		financiamentos: { pagos: { b_1: { valor: 300 } }, contratados: { b_2: { valor: 6000 }, p_3: { valor: 1000 } } },
	};
	meses[2] = {
		receitas: { '32': 250 },
		despesas: { '1000': { descricao: 'Custeio', filhos: { '42': 50 } } },
		financiamentos: { pagos: {}, contratados: {} },
	};
	const { linhas, total, colunas } = montarFluxoMensal(meses);

	it('separates operational (custeio) and investment expenses', () => {
		expect(linhas[9].totalReceitas).toBe(1500);
		expect(linhas[9].totalOperacionais).toBe(700);
		expect(linhas[9].totalInvestimentos).toBe(200);
	});

	it('computes A, B and C (financiamentos left out)', () => {
		expect(linhas[9].saldoOperacional).toBe(800); // A = R − op
		expect(linhas[9].investimentosRealizados).toBe(200); // B
		expect(linhas[9].saldoAposInvestimentos).toBe(600); // C = A − B = R − D
		expect(linhas[9].lucratividade).toBe(40);
	});

	it('totals financing per month', () => {
		expect(linhas[9].quitados).toBe(300);
		expect(linhas[9].creditosNovos).toBe(7000);
	});

	it('builds the annual total row and the per-group columns', () => {
		expect(total.totalReceitas).toBe(1750);
		expect(total.totalOperacionais).toBe(750);
		expect(total.saldoAposInvestimentos).toBe(800);
		expect(total.receitas['32']).toBe(1250);
		expect(colunas.receitas).toEqual(['32', '31']);
		expect(colunas.operacionais).toEqual(['42', '60']);
		expect(colunas.investimentos).toEqual(['51']);
	});

	it('months without revenue have no lucratividade', () => {
		expect(linhas[0].lucratividade).toBeNull();
	});

	it('does not round per month before summing (annual total matches the Dashboard)', () => {
		const m = Array.from({ length: 12 }, vazio);
		m[0] = { ...vazio(), despesas: { '1000': { filhos: { '42': 0.004 } } } };
		m[1] = { ...vazio(), despesas: { '1000': { filhos: { '42': 0.004 } } } };
		expect(montarFluxoMensal(m).total.totalOperacionais).toBeCloseTo(0.008, 6);
	});
});
