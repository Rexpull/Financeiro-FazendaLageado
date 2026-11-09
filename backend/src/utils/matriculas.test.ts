import { describe, expect, it } from 'vitest';
import { formatarMatricula, garantiaInclui, juntarMatriculas, normalizarGarantia, separarMatriculas } from './matriculas';

describe('matrículas da garantia', () => {
	it('lê os textos antigos do cadastro', () => {
		expect(separarMatriculas('2.319, 21.175, 21.176 e 21.471')).toEqual(['2319', '21175', '21176', '21471']);
		expect(separarMatriculas('20804, 29984 e 86220')).toEqual(['20804', '29984', '86220']);
		expect(separarMatriculas('3041')).toEqual(['3041']);
		expect(separarMatriculas('  ')).toEqual([]);
		expect(separarMatriculas(null)).toEqual([]);
		expect(separarMatriculas('3041; 3041 / 9167')).toEqual(['3041', '9167']);
	});

	it('grava sempre na mesma forma, ordenada', () => {
		expect(normalizarGarantia('29984, 20804')).toBe('20804, 29984');
		expect(normalizarGarantia('2.319, 21.175, 21.176 e 21.471')).toBe('2319, 21175, 21176, 21471');
		expect(normalizarGarantia('')).toBeNull();
		expect(juntarMatriculas(['113895', '9167', '9167'])).toBe('9167, 113895');
	});

	it('filtra pela matrícula exata', () => {
		expect(garantiaInclui('20804, 29984 e 86220', '86220')).toBe(true);
		expect(garantiaInclui('2.319, 21.175', '2319')).toBe(true);
		expect(garantiaInclui('2.319, 21.175', '2.319')).toBe(true);
		expect(garantiaInclui('113041', '3041')).toBe(false);
		expect(garantiaInclui(null, '3041')).toBe(false);
	});

	it('mostra com ponto de milhar', () => {
		expect(formatarMatricula('3041')).toBe('3.041');
		expect(formatarMatricula('113894')).toBe('113.894');
		expect(formatarMatricula('885')).toBe('885');
		expect(formatarMatricula('R-12')).toBe('R-12');
	});
});
