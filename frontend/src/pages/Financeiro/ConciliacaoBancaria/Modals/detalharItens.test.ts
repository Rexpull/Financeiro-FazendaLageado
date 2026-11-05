import { describe, expect, it } from 'vitest';
import { agruparItens, itensIniciais, somaItensCentavos } from './detalharItens';

// SICREDI bill of 23/10: energy 70% Leite-Produção / 30% Recria (custeio), machines to Leite-Produção investimento
const ENERGIA = 250;
const MAQUINAS = 279;
const LP_CUSTEIO = 42;
const LR_CUSTEIO = 43;
const LP_INVEST = 52;

describe('agruparItens', () => {
	it('groups the SICREDI bill by plano and by centro', () => {
		const r = agruparItens(
			[
				{ valor: '2.927,10', idPlano: ENERGIA, idCentro: LP_CUSTEIO },
				{ valor: '1.254,47', idPlano: ENERGIA, idCentro: LR_CUSTEIO },
				{ valor: '3.809,52', idPlano: MAQUINAS, idCentro: LP_INVEST },
			],
			-7991.09,
			true,
		);
		expect(r).toEqual({
			ok: true,
			planos: [
				{ id: ENERGIA, valor: 4181.57 },
				{ id: MAQUINAS, valor: 3809.52 },
			],
			centros: [
				{ id: LP_CUSTEIO, valor: 2927.1 },
				{ id: LR_CUSTEIO, valor: 1254.47 },
				{ id: LP_INVEST, valor: 3809.52 },
			],
		});
	});

	it('refuses a total that does not match the line, saying how much is missing or over', () => {
		const falta = agruparItens([{ valor: '100,00', idPlano: ENERGIA, idCentro: LP_CUSTEIO }], -150, true);
		expect(falta).toEqual({ ok: false, erro: expect.stringContaining('Faltam') });
		expect(!falta.ok && falta.erro).toContain('50,00');
		const passa = agruparItens([{ valor: '200,00', idPlano: ENERGIA, idCentro: LP_CUSTEIO }], -150, true);
		expect(!passa.ok && passa.erro).toContain('passam');
	});

	it('names the item with a missing value, plano or centro', () => {
		expect(agruparItens([{ valor: '', idPlano: ENERGIA, idCentro: LP_CUSTEIO }], -1, true)).toEqual({ ok: false, erro: 'Item 1: informe um valor maior que zero.' });
		expect(
			agruparItens(
				[
					{ valor: '0,50', idPlano: ENERGIA, idCentro: LP_CUSTEIO },
					{ valor: '0,50', idPlano: null, idCentro: LP_CUSTEIO },
				],
				-1,
				true,
			),
		).toEqual({ ok: false, erro: 'Item 2: escolha o plano de contas.' });
		expect(agruparItens([{ valor: '1,00', idPlano: ENERGIA, idCentro: null }], -1, true)).toEqual({ ok: false, erro: 'Item 1: escolha o centro de custos.' });
	});

	it('credits only need the centre', () => {
		const r = agruparItens(
			[
				{ valor: '60,00', idPlano: null, idCentro: 32 },
				{ valor: '40,00', idPlano: null, idCentro: 33 },
			],
			100,
			false,
		);
		expect(r).toEqual({ ok: true, planos: [], centros: [{ id: 32, valor: 60 }, { id: 33, valor: 40 }] });
	});

	it('sums in cents (0,10 + 0,20 = 0,30)', () => {
		expect(somaItensCentavos([{ valor: '0,10', idPlano: 1, idCentro: 1 }, { valor: '0,20', idPlano: 1, idCentro: 1 }])).toBe(30);
		expect(agruparItens([{ valor: '0,10', idPlano: 1, idCentro: 1 }, { valor: '0,20', idPlano: 1, idCentro: 1 }], -0.3, true).ok).toBe(true);
	});
});

describe('itensIniciais', () => {
	it('one plano and one centro: a single item with the whole value', () => {
		expect(itensIniciais([{ id: ENERGIA, valor: 7991.09 }], [{ id: LP_CUSTEIO, valor: 7991.09 }], -7991.09)).toEqual([
			{ valor: '7.991,09', idPlano: ENERGIA, idCentro: LP_CUSTEIO },
		]);
	});

	it('several planos and one centro: one item per plano', () => {
		expect(
			itensIniciais(
				[
					{ id: ENERGIA, valor: 4181.57 },
					{ id: MAQUINAS, valor: 3809.52 },
				],
				[{ id: LP_CUSTEIO, valor: 7991.09 }],
				-7991.09,
			),
		).toEqual([
			{ valor: '4.181,57', idPlano: ENERGIA, idCentro: LP_CUSTEIO },
			{ valor: '3.809,52', idPlano: MAQUINAS, idCentro: LP_CUSTEIO },
		]);
	});

	it('several on both sides cannot be paired: starts over with the whole value', () => {
		expect(
			itensIniciais(
				[
					{ id: ENERGIA, valor: 1 },
					{ id: MAQUINAS, valor: 1 },
				],
				[
					{ id: LP_CUSTEIO, valor: 1 },
					{ id: LP_INVEST, valor: 1 },
				],
				-2,
			),
		).toEqual([{ valor: '2,00', idPlano: null, idCentro: null }]);
	});
});
