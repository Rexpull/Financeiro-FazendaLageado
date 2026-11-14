import { describe, it, expect } from 'vitest';
import { cruzarPlanosCentros } from './cruzamentoPlanoCentro';

const inv = (valor: number) => ({ tipo: 'investimento', valor });
const cus = (valor: number) => ({ tipo: 'custeio', valor });
const INV = (valor: number) => ({ tipo: 'INVESTIMENTO', valor });
const CUS = (valor: number) => ({ tipo: 'CUSTEIO', valor });

const soma = (l: Array<number | null>) => Math.round(l.reduce<number>((s, v) => s + (v ?? 0), 0) * 100) / 100;
const coluna = (m: Array<Array<number | null>>, c: number) => m.map((linha) => linha[c]);

describe('cruzarPlanosCentros — line that follows the plano × centro type rule', () => {
	it('production case of 14/11/2026: the investimento plano goes whole to the investimento centre', () => {
		// fatura 033220877: Energia (custeio) 3.000,00 + Compra de máquinas (investimento) 4.991,09
		expect(cruzarPlanosCentros([cus(3000), inv(4991.09)], [CUS(3000), INV(4991.09)])).toEqual([
			[3000, null],
			[null, 4991.09],
		]);
		// fatura 033227742
		expect(cruzarPlanosCentros([cus(9000), inv(2678.1)], [CUS(9000), INV(2678.1)])).toEqual([
			[9000, null],
			[null, 2678.1],
		]);
	});

	it('never puts a plano in a centre of the other type, whatever the order of the lists', () => {
		const m = cruzarPlanosCentros([inv(4000), cus(5000), cus(2678.1)], [CUS(7678.1), INV(1500), INV(2500)]);
		expect(m[0]).toEqual([null, 1500, 2500]);
		expect(m[1][1]).toBeNull();
		expect(m[2][2]).toBeNull();
	});

	it('inside one type, several planos and centres are split by share and every total is kept', () => {
		const planos = [cus(6000), cus(4000), inv(1000)];
		const centros = [CUS(7000), CUS(3000), INV(1000)];
		const m = cruzarPlanosCentros(planos, centros);
		expect(m).toEqual([
			[4200, 1800, null],
			[2800, 1200, null],
			[null, null, 1000],
		]);
		planos.forEach((p, i) => expect(soma(m[i])).toBe(p.valor));
		centros.forEach((c, j) => expect(soma(coluna(m, j))).toBe(c.valor));
	});

	it('keeps the plano totals to the cent when the shares do not divide evenly', () => {
		const planos = [cus(33.33), cus(33.33), cus(33.34), inv(50)];
		const m = cruzarPlanosCentros(planos, [CUS(70), CUS(30), INV(50)]);
		planos.forEach((p, i) => expect(soma(m[i])).toBe(p.valor));
		expect(m[3]).toEqual([null, null, 50]);
	});

	it('one type only: same as the plain split by share', () => {
		expect(cruzarPlanosCentros([cus(600), cus(400)], [CUS(700), CUS(300)])).toEqual([
			[420, 180],
			[280, 120],
		]);
	});
});

describe('cruzarPlanosCentros — lines the rule does not describe keep the old split', () => {
	it('line classified before the rule (types do not match): every plano across every centre', () => {
		// investimento planos in custeio centres: there is no centre of the plano type to send it to
		expect(cruzarPlanosCentros([inv(600), inv(400)], [CUS(700), CUS(300)])).toEqual([
			[420, 180],
			[280, 120],
		]);
		// both types, but the totals per type differ
		const m = cruzarPlanosCentros([cus(3000), inv(4991.09)], [CUS(5000), INV(2991.09)]);
		expect(m.flat().every((v) => v !== null)).toBe(true);
		expect(soma(m[0])).toBe(3000);
		expect(soma(m[1])).toBe(4991.09);
	});

	it('a plano or a centre without a known type', () => {
		const m = cruzarPlanosCentros([{ tipo: null, valor: 500 }, inv(500)], [CUS(500), INV(500)]);
		expect(m).toEqual([
			[250, 250],
			[250, 250],
		]);
	});

	it('empty sides give an empty matrix', () => {
		expect(cruzarPlanosCentros([], [CUS(10)])).toEqual([]);
		expect(cruzarPlanosCentros([cus(10)], [])).toEqual([[]]);
	});
});
