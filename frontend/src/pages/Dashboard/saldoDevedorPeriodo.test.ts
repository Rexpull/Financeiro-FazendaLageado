import { describe, it, expect } from 'vitest';
import { pontosEvolucaoSaldoDevedor, saldoDevedorPeriodo } from './saldoDevedorPeriodo';
import { intervaloPeriodo, rotuloFimDeMes } from './periodoDashboard';
import type { ResumoSaldoDevedorMes } from '../../services/dashboardService';

// Same shape the API returns for the 3º trimestre de 2026 (saldoInicial of a month = end of the month before)
const t3: ResumoSaldoDevedorMes[] = [
	{ ano: 2026, mes: 7, saldoInicial: 18_736_165.07, quitados: 112_480.4, creditosNovos: 600_000, valorContratadoNovos: 500_000, contratosNovos: 1, saldoFinal: 19_223_684.67 },
	{ ano: 2026, mes: 8, saldoInicial: 19_223_684.67, quitados: 250_000, creditosNovos: 0, valorContratadoNovos: 0, contratosNovos: 0, saldoFinal: 18_973_684.67 },
	{ ano: 2026, mes: 9, saldoInicial: 18_973_684.67, quitados: 73_684.67, creditosNovos: 100_000, valorContratadoNovos: 90_000, contratosNovos: 1, saldoFinal: 19_000_000 },
];

describe('saldo devedor do período (cards) x evolução (gráfico)', () => {
	const cards = saldoDevedorPeriodo(t3, -1)!;
	const pontos = pontosEvolucaoSaldoDevedor(t3, intervaloPeriodo(2026, 't3').meses);

	it('início − quitados + créditos novos = fim do período', () => {
		expect(cards.quitados).toBe(436_165.07);
		expect(cards.creditosNovos).toBe(700_000);
		expect(cards.saldoFinal).toBeCloseTo(cards.saldoInicial - cards.quitados + cards.creditosNovos, 2);
	});

	it('o ponto antes do primeiro mês é o saldo do início (fim de junho) e o último é o saldo do fim', () => {
		expect(pontos).toHaveLength(4);
		expect(pontos[0]).toEqual({ ano: 2026, mes: 6, saldo: cards.saldoInicial });
		expect(rotuloFimDeMes(pontos[0])).toBe('fim de jun/2026');
		expect(pontos[1]).toEqual({ ano: 2026, mes: 7, saldo: 19_223_684.67 }); // fim de julho
		expect(pontos[pontos.length - 1].saldo).toBe(cards.saldoFinal);
	});

	it('cada ponto é o saldo do anterior − quitados + créditos novos do mês', () => {
		for (let i = 1; i < pontos.length; i++) {
			const m = t3[i - 1];
			expect(pontos[i].saldo).toBeCloseTo(pontos[i - 1].saldo - m.quitados + m.creditosNovos, 2);
		}
	});

	it('janeiro começa no fim de dezembro do ano anterior; sem dados, sem pontos', () => {
		const jan: ResumoSaldoDevedorMes[] = [{ ano: 2026, mes: 1, saldoInicial: 10, quitados: 0, creditosNovos: 0, valorContratadoNovos: 0, contratosNovos: 0, saldoFinal: 10 }];
		expect(pontosEvolucaoSaldoDevedor(jan, [])[0]).toEqual({ ano: 2025, mes: 12, saldo: 10 });
		expect(pontosEvolucaoSaldoDevedor([], [])).toEqual([]);
	});
});
