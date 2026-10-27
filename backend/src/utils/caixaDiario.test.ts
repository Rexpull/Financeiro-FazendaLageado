import { describe, it, expect } from 'vitest';
import { calcularCaixaDiario, datasDoMes, diasNoMes, intervaloDoMes, parcelaConsiderada, parcelaConsideradaPadrao } from './caixaDiario';

describe('datas do mês', () => {
	it('gera um dia por data do calendário, sem depender de fuso', () => {
		expect(diasNoMes(2026, 10)).toBe(31);
		expect(diasNoMes(2026, 2)).toBe(28);
		expect(diasNoMes(2028, 2)).toBe(29);
		expect(diasNoMes(2026, 4)).toBe(30);
		const out = datasDoMes(2026, 10);
		expect(out).toHaveLength(31);
		expect(out[0]).toBe('2026-10-01');
		expect(out[30]).toBe('2026-10-31');
	});

	it('intervalo do mês vira o ano em dezembro', () => {
		expect(intervaloDoMes(2026, 10)).toEqual({ inicio: '2026-10-01', fimExclusivo: '2026-11-01' });
		expect(intervaloDoMes(2026, 12)).toEqual({ inicio: '2026-12-01', fimExclusivo: '2027-01-01' });
	});
});

describe('calcularCaixaDiario', () => {
	it('exemplo do cliente: 100.000 − boleto 1.000 − financiamento 10.000 = 89.000 no dia 01', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 10,
			saldoInicial: 100000,
			lancamentos: [{ tipo: 'BOLETO', natureza: 'D', data: '2026-10-01', valor: 1000 }],
			parcelas: [{ data: '2026-10-01', valor: 10000 }],
		});
		expect(r.dias).toHaveLength(31);
		expect(r.dias[0]).toEqual({
			data: '2026-10-01',
			boletos: 1000,
			financiamento: 10000,
			saldo: 89000,
			previsaoC: 0,
			previsaoD: 0,
			previsao: 0,
			saldoFinal: 89000,
		});
		// acumulado: dias sem movimento mantêm o saldo
		expect(r.dias[30].saldo).toBe(89000);
		expect(r.totais.saldo).toBe(89000);
	});

	it('acumula saldo e saldo final (com previsões C/D) dia a dia', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 10,
			saldoInicial: 50000,
			lancamentos: [
				{ tipo: 'BOLETO', natureza: 'D', data: '2026-10-03', valor: 20000 },
				{ tipo: 'BOLETO', natureza: 'D', data: '2026-10-03', valor: 5000.5 },
				{ tipo: 'PREVISAO', natureza: 'C', data: '2026-10-05', valor: 30000 },
				{ tipo: 'PREVISAO', natureza: 'D', data: '2026-10-05', valor: 1000 },
				{ tipo: 'PREVISAO', natureza: 'D', data: '2026-10-20', valor: 70000 },
			],
			parcelas: [
				{ data: '2026-10-10', valor: 40000 },
				{ data: '2026-10-10T03:00:00.000Z', valor: 2000 }, // timestamp: conta pelo dia
			],
		});
		const dia = (d: number) => r.dias[d - 1];

		expect(dia(3).boletos).toBe(25000.5);
		expect(dia(3).saldo).toBe(24999.5);
		expect(dia(3).saldoFinal).toBe(24999.5);

		expect(dia(5).previsaoC).toBe(30000);
		expect(dia(5).previsaoD).toBe(1000);
		expect(dia(5).previsao).toBe(29000);
		expect(dia(5).saldo).toBe(24999.5);
		expect(dia(5).saldoFinal).toBe(53999.5);

		expect(dia(10).financiamento).toBe(42000);
		expect(dia(10).saldo).toBe(-17000.5);
		expect(dia(10).saldoFinal).toBe(11999.5);

		expect(dia(20).saldoFinal).toBe(-58000.5);
		expect(dia(31).saldo).toBe(-17000.5);
		expect(dia(31).saldoFinal).toBe(-58000.5);

		expect(r.totais).toEqual({
			boletos: 25000.5,
			financiamento: 42000,
			previsaoC: 30000,
			previsaoD: 71000,
			previsao: -41000,
			saldo: -17000.5,
			saldoFinal: -58000.5,
		});

		// necessidade mínima de caixa
		expect(r.minimo.saldo).toEqual({ valor: -17000.5, data: '2026-10-10', aporteNecessario: 17000.5, caixaNecessario: 67000.5 });
		expect(r.minimo.saldoFinal).toEqual({
			valor: -58000.5,
			data: '2026-10-20',
			aporteNecessario: 58000.5,
			caixaNecessario: 108000.5,
		});
	});

	it('o mínimo do saldo final pode cair no meio do mês e é o primeiro dia em que ocorre', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 10,
			saldoInicial: 1000,
			lancamentos: [
				{ tipo: 'PREVISAO', natureza: 'D', data: '2026-10-08', valor: 3000 },
				{ tipo: 'PREVISAO', natureza: 'C', data: '2026-10-15', valor: 5000 },
			],
			parcelas: [],
		});
		expect(r.minimo.saldoFinal.valor).toBe(-2000);
		expect(r.minimo.saldoFinal.data).toBe('2026-10-08');
		expect(r.minimo.saldoFinal.aporteNecessario).toBe(2000);
		expect(r.minimo.saldoFinal.caixaNecessario).toBe(3000);
		expect(r.totais.saldoFinal).toBe(3000);
		// sem saída, o saldo (sem previsões) fica no inicial desde o dia 01
		expect(r.minimo.saldo).toEqual({ valor: 1000, data: '2026-10-01', aporteNecessario: 0, caixaNecessario: 0 });
	});

	it('ignora itens fora do mês e trata saldo inicial ausente como zero', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 10,
			saldoInicial: null,
			lancamentos: [
				{ tipo: 'BOLETO', natureza: 'D', data: '2026-09-30', valor: 999 },
				{ tipo: 'BOLETO', natureza: 'D', data: '2026-11-01', valor: 999 },
				{ tipo: 'BOLETO', natureza: 'D', data: '2026-10-31', valor: 100 },
			],
			parcelas: [{ data: '2026-11-01', valor: 5000 }],
		});
		expect(r.totais.boletos).toBe(100);
		expect(r.totais.financiamento).toBe(0);
		expect(r.dias[30].saldo).toBe(-100);
		expect(r.minimo.saldo).toEqual({ valor: -100, data: '2026-10-31', aporteNecessario: 100, caixaNecessario: 100 });
	});

	it('não acumula erro de ponto flutuante', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 2,
			saldoInicial: 0.3,
			lancamentos: Array.from({ length: 28 }, (_, i) => ({
				tipo: 'BOLETO' as const,
				natureza: 'D' as const,
				data: `2026-02-${String(i + 1).padStart(2, '0')}`,
				valor: 0.1,
			})),
			parcelas: [],
		});
		expect(r.dias).toHaveLength(28);
		expect(r.dias[2].saldo).toBe(0);
		expect(r.totais.boletos).toBe(2.8);
		expect(r.totais.saldo).toBe(-2.5);
	});
});

describe('parcelas consideradas na apuração', () => {
	it('padrão: abertas e vencidas entram, liquidadas não', () => {
		expect(parcelaConsideradaPadrao('Aberto')).toBe(true);
		expect(parcelaConsideradaPadrao('Vencido')).toBe(true);
		expect(parcelaConsideradaPadrao('Liquidado')).toBe(false);
		expect(parcelaConsideradaPadrao(' liquidado ')).toBe(false);
		expect(parcelaConsideradaPadrao(null)).toBe(true);
	});

	it('a escolha gravada prevalece sobre o status', () => {
		expect(parcelaConsiderada('Liquidado', 1)).toBe(true);
		expect(parcelaConsiderada('Aberto', 0)).toBe(false);
		expect(parcelaConsiderada('Aberto', false)).toBe(false);
		expect(parcelaConsiderada('Liquidado', null)).toBe(false);
		expect(parcelaConsiderada('Vencido', undefined)).toBe(true);
	});

	it('parcela não considerada fica fora do saldo', () => {
		const r = calcularCaixaDiario({
			ano: 2026,
			mes: 10,
			saldoInicial: 10000,
			lancamentos: [],
			parcelas: [
				{ data: '2026-10-05', valor: 1000, considerada: true },
				{ data: '2026-10-05', valor: 2000, considerada: false },
				{ data: '2026-10-06', valor: 500 }, // sem o campo: considerada
			],
		});
		expect(r.dias[4]).toMatchObject({ financiamento: 1000, saldo: 9000 });
		expect(r.totais).toMatchObject({ financiamento: 1500, saldo: 8500, saldoFinal: 8500 });
	});
});
