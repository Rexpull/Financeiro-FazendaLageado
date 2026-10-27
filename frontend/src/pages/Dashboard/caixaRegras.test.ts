import { describe, it, expect } from 'vitest';
import {
	ANO_MAX_CAIXA,
	anosCaixa,
	dataCaixaValida,
	interpretarValorDia,
	mesmoValor,
	navegarMes,
	periodoInicialCaixa,
	previsoesDoDia,
	resumoParcelas,
	textoValorEditavel,
} from './caixaRegras';
import type { CaixaLancamento, CaixaParcela } from '../../services/caixaService';

describe('navegação de mês/ano', () => {
	it('oferece anos até 2040', () => {
		const anos = anosCaixa();
		expect(anos[0]).toBe(2024);
		expect(anos.at(-1)).toBe(2040);
		expect(ANO_MAX_CAIXA).toBe(2040);
		expect(anosCaixa(2022)[0]).toBe(2022);
	});

	it('mês inicial vem do filtro; com "Todos", o mês atual (ano atual) ou janeiro', () => {
		const hoje = new Date(2026, 9, 27);
		expect(periodoInicialCaixa(2026, 'Mar', hoje)).toEqual({ ano: 2026, mes: 3 });
		expect(periodoInicialCaixa(2026, '', hoje)).toEqual({ ano: 2026, mes: 10 });
		expect(periodoInicialCaixa(2027, '', hoje)).toEqual({ ano: 2027, mes: 1 });
	});

	it('avança e volta virando o ano, travado entre o ano mínimo e dez/2040', () => {
		expect(navegarMes({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
		expect(navegarMes({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
		expect(navegarMes({ ano: 2040, mes: 11 }, 1)).toEqual({ ano: 2040, mes: 12 });
		expect(navegarMes({ ano: 2040, mes: 12 }, 1)).toBeNull();
		expect(navegarMes({ ano: 2024, mes: 1 }, -1)).toBeNull();
		expect(navegarMes({ ano: 2024, mes: 1 }, -1, 2020)).toEqual({ ano: 2023, mes: 12 });
	});
});

describe('valor de boletos do dia', () => {
	it('aceita formatos pt-BR e en, vazio e zero removem o dia', () => {
		expect(interpretarValorDia('1.234,56')).toEqual({ ok: true, valor: 1234.56 });
		expect(interpretarValorDia('R$ 1.234,56')).toEqual({ ok: true, valor: 1234.56 });
		expect(interpretarValorDia('1234.5')).toEqual({ ok: true, valor: 1234.5 });
		expect(interpretarValorDia('1.500')).toEqual({ ok: true, valor: 1500 });
		expect(interpretarValorDia('')).toEqual({ ok: true, valor: null });
		expect(interpretarValorDia('   ')).toEqual({ ok: true, valor: null });
		expect(interpretarValorDia('0,00')).toEqual({ ok: true, valor: null });
	});

	it('rejeita texto, negativo e valor absurdo', () => {
		expect(interpretarValorDia('abc').ok).toBe(false);
		expect(interpretarValorDia('-10').ok).toBe(false);
		expect(interpretarValorDia('9999999999999').ok).toBe(false);
	});

	it('mostra o valor gravado sem "R$" e compara em centavos', () => {
		expect(textoValorEditavel(1234.5)).toBe('1.234,50');
		expect(textoValorEditavel(0)).toBe('');
		expect(textoValorEditavel(null)).toBe('');
		expect(mesmoValor(1234.5, 1234.5000001)).toBe(true);
		expect(mesmoValor(null, 0)).toBe(true);
		expect(mesmoValor(10, 10.01)).toBe(false);
	});
});

const parcela = (id: number, data: string, valor: number, considerada: boolean): CaixaParcela => ({
	id,
	data,
	valor,
	considerada,
	consideradaManual: false,
	status: considerada ? 'Aberto' : 'Liquidado',
	numParcela: 1,
	idFinanciamento: 1,
	contrato: null,
	tomador: null,
	banco: null,
	modalidade: null,
});

describe('resumo das parcelas', () => {
	const parcelas = [
		parcela(1, '2026-10-01', 10000, true),
		parcela(2, '2026-10-15', 2500.1, false),
		parcela(3, '2026-10-15', 0.2, true),
	];

	it('separa consideradas e não consideradas no mês', () => {
		expect(resumoParcelas(parcelas)).toEqual({ quantidade: 3, consideradas: 2, valorConsiderado: 10000.2, valorNaoConsiderado: 2500.1 });
	});

	it('filtra pelo dia', () => {
		expect(resumoParcelas(parcelas, '2026-10-15')).toEqual({ quantidade: 2, consideradas: 1, valorConsiderado: 0.2, valorNaoConsiderado: 2500.1 });
		expect(resumoParcelas(parcelas, '2026-10-02').quantidade).toBe(0);
	});
});

describe('previsões do dia (tooltip)', () => {
	const l = (id: number, natureza: 'C' | 'D', data: string, descricao: string): CaixaLancamento => ({
		id,
		tipo: 'PREVISAO',
		natureza,
		data,
		descricao,
		valor: 100,
		criadoEm: null,
		atualizadoEm: null,
	});

	it('lista entradas antes das saídas, só do dia', () => {
		const out = previsoesDoDia(
			[l(1, 'D', '2026-10-10', 'Ração'), l(2, 'C', '2026-10-10', 'Venda de gado'), l(3, 'C', '2026-10-11', 'Outro dia')],
			'2026-10-10',
		);
		expect(out.map((x) => x.descricao)).toEqual(['Venda de gado', 'Ração']);
	});
});

describe('data da previsão', () => {
	it('aceita datas reais até 31/12/2040', () => {
		expect(dataCaixaValida('2040-12-31')).toBe(true);
		expect(dataCaixaValida('2026-02-29')).toBe(false);
		expect(dataCaixaValida('2041-01-01')).toBe(false);
		expect(dataCaixaValida('31/12/2040')).toBe(false);
	});
});
