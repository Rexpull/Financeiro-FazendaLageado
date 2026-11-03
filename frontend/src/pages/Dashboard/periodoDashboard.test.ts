import { describe, it, expect } from 'vitest';
import {
	anosDashboard,
	emMilhares,
	intervaloMes,
	intervaloPeriodo,
	mesAnterior,
	opcaoComMes,
	opcoesPeriodo,
	rotuloFimDeMes,
	rotuloMesGrafico,
	ultimoDiaDoIntervalo,
} from './periodoDashboard';

const hoje = new Date(2026, 9, 27); // 27/10/2026

describe('opcoesPeriodo (filtro do Dashboard: tipo de período e depois qual)', () => {
	const novembro = new Date(2026, 10, 3); // 03/11/2026

	it('meses de outubro/2026 até o mês atual, o mais recente primeiro', () => {
		expect(opcoesPeriodo('mes', novembro).map((o) => o.intervalo.rotulo)).toEqual(['Novembro de 2026', 'Outubro de 2026']);
		expect(opcoesPeriodo('mes', novembro)[1].intervalo).toMatchObject({ inicio: '2026-10-01', fim: '2026-11-01', meses: [{ ano: 2026, mes: 10 }] });
	});

	it('trimestre, semestre e ano começam em outubro/2026 e vão até o mês atual', () => {
		expect(opcoesPeriodo('trimestre', novembro).map((o) => o.intervalo)).toMatchObject([
			{ inicio: '2026-10-01', fim: '2026-12-01', rotulo: '4º trimestre de 2026 (outubro a novembro)' },
		]);
		expect(opcoesPeriodo('semestre', hoje)[0].intervalo).toMatchObject({ inicio: '2026-10-01', fim: '2026-11-01', rotulo: '2º semestre de 2026 (outubro)' });
		expect(opcoesPeriodo('ano', new Date(2027, 11, 10)).map((o) => o.intervalo.rotulo)).toEqual(['2027', '2026 (outubro a dezembro)']);
		expect(opcoesPeriodo('trimestre', new Date(2027, 1, 1)).map((o) => o.intervalo.rotulo)).toEqual([
			'1º trimestre de 2027 (janeiro a fevereiro)',
			'4º trimestre de 2026',
		]);
	});

	it('antes de outubro/2026 só existe outubro/2026', () => {
		expect(opcoesPeriodo('mes', new Date(2026, 4, 1)).map((o) => o.intervalo.rotulo)).toEqual(['Outubro de 2026']);
	});

	it('trocar o tipo mantém o mês escolhido dentro do período', () => {
		expect(opcaoComMes('trimestre', { ano: 2027, mes: 2 }, new Date(2027, 5, 1)).intervalo.rotulo).toBe('1º trimestre de 2027');
		expect(opcaoComMes('mes', undefined, novembro).intervalo.rotulo).toBe('Novembro de 2026');
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

describe('rótulos de mês', () => {
	it('rótulo de posição em fim de mês e mês anterior', () => {
		expect(rotuloFimDeMes({ ano: 2026, mes: 7 })).toBe('fim de jul/2026');
		expect(mesAnterior({ ano: 2026, mes: 1 })).toEqual({ ano: 2025, mes: 12 });
	});
});

describe('intervaloPeriodo (filtro do Relatório de financiamentos)', () => {
	it('ano inteiro, trimestres e semestres do ano escolhido', () => {
		expect(intervaloPeriodo(2026, 'ano', hoje)).toMatchObject({ inicio: '2026-01-01', fim: '2027-01-01', rotulo: '2026' });
		expect(intervaloPeriodo(2026, 't1', hoje)).toMatchObject({ inicio: '2026-01-01', fim: '2026-04-01', rotulo: '1º trimestre de 2026' });
		expect(intervaloPeriodo(2026, 's2', hoje)).toMatchObject({ inicio: '2026-07-01', fim: '2027-01-01', rotulo: '2º semestre de 2026' });
	});

	it('últimos 12 meses terminam no mês atual e um mês do ano escolhido', () => {
		expect(intervaloPeriodo(2024, '12m', hoje)).toMatchObject({ inicio: '2025-11-01', fim: '2026-11-01', rotulo: 'Últimos 12 meses (Nov/2025 a Out/2026)' });
		expect(intervaloPeriodo(2026, 'm7', hoje)).toMatchObject({ inicio: '2026-07-01', fim: '2026-08-01', rotulo: 'Julho de 2026' });
	});
});
