import { describe, it, expect } from 'vitest';
import { anosDashboard, emMilhares, intervaloMes, intervaloPeriodo, rotuloMesGrafico, ultimoDiaDoIntervalo } from './periodoDashboard';

const hoje = new Date(2026, 9, 27); // 27/10/2026

describe('intervaloPeriodo (filtro Período do Dashboard)', () => {
	it('ano inteiro, trimestres e semestres do ano escolhido', () => {
		expect(intervaloPeriodo(2026, 'ano', hoje)).toMatchObject({ inicio: '2026-01-01', fim: '2027-01-01', rotulo: '2026' });
		expect(intervaloPeriodo(2026, 't1', hoje)).toMatchObject({ inicio: '2026-01-01', fim: '2026-04-01', rotulo: '1º trimestre de 2026' });
		expect(intervaloPeriodo(2026, 't4', hoje)).toMatchObject({ inicio: '2026-10-01', fim: '2027-01-01' });
		expect(intervaloPeriodo(2026, 's2', hoje)).toMatchObject({ inicio: '2026-07-01', fim: '2027-01-01', rotulo: '2º semestre de 2026' });
		expect(intervaloPeriodo(2031, 's1', hoje).meses).toHaveLength(6);
	});

	it('últimos 12 meses terminam no mês atual, qualquer que seja o ano escolhido', () => {
		const p = intervaloPeriodo(2024, '12m', hoje);
		expect(p).toMatchObject({ inicio: '2025-11-01', fim: '2026-11-01', rotulo: 'Últimos 12 meses (Nov/2025 a Out/2026)' });
		expect(p.meses[0]).toEqual({ ano: 2025, mes: 11 });
		expect(p.meses[11]).toEqual({ ano: 2026, mes: 10 });
		// January: crosses back to February of the previous year
		expect(intervaloPeriodo(2026, '12m', new Date(2026, 0, 5))).toMatchObject({ inicio: '2025-02-01', fim: '2026-02-01' });
	});

	it('mês da tela Receitas e despesas (ou o ano todo)', () => {
		expect(intervaloMes(2026, 11)).toMatchObject({ inicio: '2026-12-01', fim: '2027-01-01', rotulo: 'Dez/2026' });
		expect(intervaloMes(2026, -1)).toMatchObject({ inicio: '2026-01-01', fim: '2027-01-01' });
	});

	it('último dia do intervalo e rótulos dos meses no gráfico', () => {
		expect(ultimoDiaDoIntervalo('2026-04-01')).toBe('2026-03-31');
		expect(ultimoDiaDoIntervalo('2027-01-01')).toBe('2026-12-31');
		expect(ultimoDiaDoIntervalo('2028-03-01')).toBe('2028-02-29');
		expect(rotuloMesGrafico({ ano: 2025, mes: 11 }, true)).toBe('Nov/25');
		expect(rotuloMesGrafico({ ano: 2025, mes: 11 }, false)).toBe('Nov');
	});
});

describe('anosDashboard', () => {
	it('de 2024 até 5 anos à frente (2031 em 2026)', () => {
		const anos = anosDashboard(hoje);
		expect(anos[0]).toBe(2024);
		expect(anos[anos.length - 1]).toBe(2031);
		expect(anos).toHaveLength(8);
	});

	it('mantém um ano selecionado fora da faixa', () => {
		expect(anosDashboard(hoje, 2035).at(-1)).toBe(2035);
		expect(anosDashboard(hoje, 2023)[0]).toBe(2023);
	});
});

describe('emMilhares (rótulos das barras)', () => {
	it('mostra o valor em milhares, sem casas', () => {
		expect(emMilhares(4_945_000)).toBe('4.945');
		expect(emMilhares(284_000)).toBe('284');
		expect(emMilhares(284_957.41)).toBe('285');
		expect(emMilhares(-12_300)).toBe('-12');
		expect(emMilhares(0)).toBe('0');
	});

	it('valores abaixo de mil mantêm uma casa (não viram zero)', () => {
		expect(emMilhares(450)).toBe('0,5');
		expect(emMilhares(82)).toBe('0,1');
	});
});
