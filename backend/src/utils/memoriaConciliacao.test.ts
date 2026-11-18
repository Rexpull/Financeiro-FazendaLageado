import { describe, expect, it } from 'vitest';
import { chaveMemoria, escolherMemoria, nomeMemoria, percentuaisDe, valoresDe } from './memoriaConciliacao';

describe('chaveMemoria', () => {
	it('drops dates, times and numbers of a Pix', () => {
		expect(chaveMemoria('Pix - Enviado - 05/11 18:02 Larissa Ferreira')).toBe('PIX - ENVIADO - LARISSA FERREIRA');
		expect(chaveMemoria('Pix - Enviado - 28/10 09:15 Larissa Ferreira')).toBe('PIX - ENVIADO - LARISSA FERREIRA');
	});

	it('the same boleto on different days gives the same key', () => {
		const a = chaveMemoria('Pagamento de Boleto - UNIMED PATOS DE MINAS COOPERAT');
		expect(a).toBe('PAGAMENTO DE BOLETO - UNIMED PATOS DE MINAS COOPERAT');
		expect(chaveMemoria('Pagamento  de Boleto - Unimed Patos de Minas Cooperat ')).toBe(a);
	});

	it('removes accents and document numbers', () => {
		expect(chaveMemoria('DÉB.TIT.COMPE EFETIVADO 001234')).toBe('DEB TIT COMPE EFETIVADO');
		expect(chaveMemoria('Tarifa Pacote Serviços 10/2026')).toBe('TARIFA PACOTE SERVICOS');
	});

	it('nothing but numbers or punctuation is not remembered', () => {
		expect(chaveMemoria('')).toBe('');
		expect(chaveMemoria(null)).toBe('');
		expect(chaveMemoria('000123 - 05/11/2026')).toBe('');
	});
});

describe('percentuaisDe / valoresDe', () => {
	it('R$ → % closes 100 on the last one', () => {
		expect(percentuaisDe([{ id: 1, valor: 1 }, { id: 2, valor: 1 }, { id: 3, valor: 1 }])).toEqual([
			{ id: 1, pct: 33.33 },
			{ id: 2, pct: 33.33 },
			{ id: 3, pct: 33.34 },
		]);
		expect(percentuaisDe([{ id: 7, valor: -50 }])).toEqual([{ id: 7, pct: 100 }]);
		expect(percentuaisDe([])).toEqual([]);
	});

	it('% → R$ sums exactly to the value, remainder on the last', () => {
		const v = valoresDe([{ id: 1, pct: 33.33 }, { id: 2, pct: 33.33 }, { id: 3, pct: 33.34 }], -5344.09);
		expect(v).toEqual([
			{ id: 1, valor: 1781.19 },
			{ id: 2, valor: 1781.19 },
			{ id: 3, valor: 1781.71 },
		]);
		expect(Math.round(v.reduce((s, x) => s + x.valor, 0) * 100)).toBe(534409);
	});

	it('a split remembered from one value applies to another (Unimed 4.705,57 → 5.344,09)', () => {
		const fatias = percentuaisDe([
			{ id: 10, valor: 1000 },
			{ id: 11, valor: 1705.57 },
			{ id: 12, valor: 2000 },
		]);
		const v = valoresDe(fatias, 5344.09);
		expect(v.map((x) => x.id)).toEqual([10, 11, 12]);
		expect(Math.round(v.reduce((s, x) => s + x.valor, 0) * 100)).toBe(534409);
	});
});

describe('nomeMemoria (nome parecido)', () => {
	const nome = (historico: string) => nomeMemoria(chaveMemoria(historico));

	it('the company type at the end is not part of the name', () => {
		expect(nome('LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toBe('LAFOR COMERCIO DE COMBUSTIVEIS');
		expect(nome('LAFOR COMERCIO DE COMBUSTIVEIS')).toBe('LAFOR COMERCIO DE COMBUSTIVEIS');
		expect(nome('CARAMURU ALIMENTOS S A')).toBe('CARAMURU ALIMENTOS');
		expect(nome('CARAMURU ALIMENTOS SA')).toBe('CARAMURU ALIMENTOS');
		expect(nome('Auto Peças Silva ME')).toBe('AUTO PECAS SILVA');
		expect(nome('JOSE DA SILVA EPP LTDA')).toBe('JOSE DA SILVA');
	});

	it('the payment operation before the name is not part of the name (BB files before and after 10/11/2026)', () => {
		expect(nome('Pagamento de Boleto - ERCAL EMPRESAS REUNIDAS DE CALCARIO LT')).toBe(nome('ERCAL EMPRESAS REUNIDAS DE CALCARIO LT'));
		expect(nome('Pagamento de Boleto - LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toBe('LAFOR COMERCIO DE COMBUSTIVEIS');
		expect(nome('Pix - Enviado - 05/11 18:02 Ronaldo Luis Fernandes')).toBe('RONALDO LUIS FERNANDES');
		expect(nome('Transferência enviada - Ronaldo Luis Fernandes')).toBe('RONALDO LUIS FERNANDES');
		expect(nome('LIQUIDACAO BOLETO-   54151744000136 LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toBe('LAFOR COMERCIO DE COMBUSTIVEIS');
		expect(nome('PAGAMENTO DE BOLETO OUTROS BANCOS     LAFOR COMERCIO DE COMBUST')).toBe('LAFOR COMERCIO DE COMBUST');
		expect(nome('BRASILPREV - BRASILPREV SEGUROS')).toBe('BRASILPREV SEGUROS');
	});

	it('other operations stay in the name: "IOF - X" and "Juros - X" are different things', () => {
		expect(nome('IOF - Cheque especial')).toBe('IOF - CHEQUE ESPECIAL');
		expect(nome('Juros - Cheque especial')).toBe('JUROS - CHEQUE ESPECIAL');
		expect(nome('DÉBITO PEDÁGIO SICOOB TAG')).toBe('DEBITO PEDAGIO SICOOB TAG');
		expect(nome('BB Cons - Agrupado (22 movimentos) - REF: 123')).toBe('BB CONS - AGRUPADO MOVIMENTOS - REF');
	});

	it('never returns an empty name for a text that has one', () => {
		expect(nome('Pagamento de Boleto')).toBe('PAGAMENTO DE BOLETO');
		expect(nome('LTDA')).toBe('LTDA');
		expect(nomeMemoria('')).toBe('');
		expect(nomeMemoria(null)).toBe('');
	});
});

describe('escolherMemoria', () => {
	const mem = (id: number, chave: string, atualizadoEm = '2026-11-01 10:00:00') => ({ id, chave, atualizadoEm });
	const LAFOR = mem(13, 'LAFOR COMERCIO DE COMBUSTIVEIS', '2026-11-10 20:00:00');
	const LAFOR_LTDA = mem(47, 'LAFOR COMERCIO DE COMBUSTIVEIS LTDA', '2026-11-18 02:00:00');
	const ERCAL = mem(20, 'ERCAL EMPRESAS REUNIDAS DE CALCARIO LT');

	it('the identical text always wins, and is not "por nome"', () => {
		expect(escolherMemoria([LAFOR, LAFOR_LTDA], 'LAFOR COMERCIO DE COMBUSTIVEIS')).toEqual({ memoria: LAFOR, porNome: false });
		expect(escolherMemoria([LAFOR, LAFOR_LTDA], 'LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toEqual({ memoria: LAFOR_LTDA, porNome: false });
	});

	it('without the identical text, the memory of the same name is used and marked "por nome"', () => {
		expect(escolherMemoria([LAFOR, ERCAL], 'LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toEqual({ memoria: LAFOR, porNome: true });
		expect(escolherMemoria([LAFOR_LTDA, ERCAL], 'LAFOR COMERCIO DE COMBUSTIVEIS')).toEqual({ memoria: LAFOR_LTDA, porNome: true });
		expect(escolherMemoria([ERCAL], 'PAGAMENTO DE BOLETO - ERCAL EMPRESAS REUNIDAS DE CALCARIO LT')).toEqual({ memoria: ERCAL, porNome: true });
		const comOperacao = mem(30, 'PIX - ENVIADO - MARCO AURELIO DE CAMPOS');
		expect(escolherMemoria([comOperacao], 'MARCO AURELIO DE CAMPOS')).toEqual({ memoria: comOperacao, porNome: true });
	});

	it('with the operation in front, the memory of that exact company text comes before the newer one of the same name', () => {
		// production, conta BB GFS: one memory for "LAFOR ..." and a newer one for "LAFOR ... LTDA"
		expect(escolherMemoria([LAFOR, LAFOR_LTDA], 'PAGAMENTO DE BOLETO - LAFOR COMERCIO DE COMBUSTIVEIS')).toEqual({ memoria: LAFOR, porNome: true });
		expect(escolherMemoria([LAFOR, LAFOR_LTDA], 'PAGAMENTO DE BOLETO - LAFOR COMERCIO DE COMBUSTIVEIS LTDA')).toEqual({ memoria: LAFOR_LTDA, porNome: true });
	});

	it('several memories with the same name: the most recently saved one', () => {
		const escolha = escolherMemoria([LAFOR, LAFOR_LTDA], 'PAGAMENTO DE BOLETO - LAFOR COMERCIO DE COMBUSTIVEIS ME');
		expect(escolha).toEqual({ memoria: LAFOR_LTDA, porNome: true });
		// same instant: the one created last
		expect(escolherMemoria([mem(1, 'ACME LTDA'), mem(2, 'ACME SERVICOS'), mem(3, 'ACME SERVICOS ME')], 'ACME SERVICOS EPP')?.memoria.id).toBe(3);
	});

	it('a different name, a part of a name or a short generic word does not match', () => {
		expect(escolherMemoria([LAFOR], 'LAFOR TRANSPORTES LTDA')).toBeNull();
		expect(escolherMemoria([LAFOR], 'LAFOR COMERCIO')).toBeNull();
		expect(escolherMemoria([LAFOR], 'POSTO LAFOR COMERCIO DE COMBUSTIVEIS')).toBeNull();
		expect(escolherMemoria([mem(5, 'ONR')], 'PAGAMENTO DE BOLETO - ONR')).toBeNull();
		expect(escolherMemoria([mem(6, 'JUROS - CHEQUE ESPECIAL')], 'IOF - CHEQUE ESPECIAL')).toBeNull();
		expect(escolherMemoria([LAFOR], '')).toBeNull();
		expect(escolherMemoria([], 'LAFOR COMERCIO DE COMBUSTIVEIS')).toBeNull();
	});
});
