import { describe, it, expect } from 'vitest';
import { credorDoFinanciamento, financiamentosMensaisFluxo, montarFluxoCaixaAno, normalizarTipoAgrupamento, type FinanciamentoFluxo } from './fluxoCaixaAno';
import { resumoSaldoDevedor } from './saldoDevedor';
import type { MovimentoBancario } from '../models/MovimentoBancario';

const pessoas = [{ id: 3, nome: 'Fulano' }];
const bancos = [{ id: 1, nome: 'SICREDI' }];

const parcela = (valor: number, status: 'Aberto' | 'Vencido' | 'Liquidado', dt_vencimento: string, dt_liquidacao: string | null = null) => ({
	valor,
	status,
	dt_vencimento,
	dt_liquidacao,
});

const FINANCIAMENTOS: FinanciamentoFluxo[] = [
	{
		id: 1,
		idBanco: 1,
		responsavel: 'GJN',
		numeroContrato: 'A',
		dataContrato: '2025-06-06',
		parcelasList: [
			parcela(300, 'Liquidado', '2026-10-15', '2026-10-14'),
			parcela(200, 'Liquidado', '2026-10-20', null), // liquidated without date → due date
			parcela(999, 'Aberto', '2026-11-15', '2026-10-01'), // date filled but not Liquidado → not quitado
			parcela(450, 'Vencido', '2026-10-25', null),
		],
	},
	// No banco/pessoa: still counts (key f_<id>, label = responsável)
	{
		id: 7,
		responsavel: 'JPT',
		numeroContrato: 'B',
		dataContrato: '2026-10-15T00:00:00.000Z',
		parcelasList: [parcela(3000, 'Aberto', '2027-10-15'), parcela(3000.1, 'Liquidado', '2028-10-15', '2026-10-30')],
	},
	{ id: 9, idPessoa: 3, responsavel: 'X', numeroContrato: 'C', dataContrato: '2025-01-01', parcelasList: [parcela(0.1, 'Liquidado', '2025-12-31', '2026-01-02')] },
];

describe('credorDoFinanciamento', () => {
	it('pessoa, then banco, then the contract itself', () => {
		expect(credorDoFinanciamento({ id: 1, idPessoa: 3, idBanco: 1, responsavel: 'R', numeroContrato: 'N' }, pessoas, bancos)).toEqual({ key: 'p_3', descricao: 'Fulano' });
		expect(credorDoFinanciamento({ id: 1, idBanco: 1, responsavel: 'R', numeroContrato: 'N' }, pessoas, bancos)).toEqual({ key: 'b_1', descricao: 'SICREDI' });
		expect(credorDoFinanciamento({ id: 5, responsavel: 'R', numeroContrato: 'N' }, pessoas, bancos)).toEqual({ key: 'f_5', descricao: 'R' });
		expect(credorDoFinanciamento({ id: 5, responsavel: '', numeroContrato: 'N' }, pessoas, bancos)).toEqual({ key: 'f_5', descricao: 'Contrato N' });
	});
});

describe('financiamentosMensaisFluxo', () => {
	const meses = financiamentosMensaisFluxo('2026', FINANCIAMENTOS, pessoas, bancos);

	it('quitados = parcelas Liquidado in the month (dt_liquidacao, else dt_vencimento), every contract', () => {
		expect(meses[9].pagos).toEqual({
			b_1: { valor: 500, descricao: 'SICREDI' },
			f_7: { valor: 3000.1, descricao: 'JPT' },
		});
		expect(meses[0].pagos).toEqual({ p_3: { valor: 0.1, descricao: 'Fulano' } });
		expect(meses[10].pagos).toEqual({});
	});

	it('créditos novos = all parcelas of the contracts signed in the month', () => {
		expect(meses[9].contratados).toEqual({ f_7: { valor: 6000.1, descricao: 'JPT' } });
		expect(meses.filter((m) => Object.keys(m.contratados).length > 0)).toHaveLength(1);
	});

	it('matches the Dashboard saldo devedor (quitados / créditos novos) month by month', () => {
		const dashboard = resumoSaldoDevedor(
			2026,
			FINANCIAMENTOS.map((f) => ({ id: f.id, dataContrato: f.dataContrato, valor: 0 })),
			FINANCIAMENTOS.flatMap((f) => (f.parcelasList ?? []).map((p) => ({ ...p, idFinanciamento: f.id, dt_liquidacao: p.dt_liquidacao ?? null }))),
		);
		const soma = (o: Record<string, { valor: number }>) => Object.values(o).reduce((a, b) => a + b.valor, 0);
		meses.forEach((m, i) => {
			expect(soma(m.pagos)).toBeCloseTo(dashboard[i].quitados, 6);
			expect(soma(m.contratados)).toBeCloseTo(dashboard[i].creditosNovos, 6);
		});
	});
});

describe('normalizarTipoAgrupamento', () => {
	it('accepts centros and the old label, defaults to planos', () => {
		expect(normalizarTipoAgrupamento('centros')).toBe('centros');
		expect(normalizarTipoAgrupamento('Centro de Custos')).toBe('centros');
		expect(normalizarTipoAgrupamento(undefined)).toBe('planos');
	});
});

describe('montarFluxoCaixaAno (centros)', () => {
	const mov = (id: number, dt: string, valor: number, tipo: 'C' | 'D', extra: Partial<MovimentoBancario> = {}): MovimentoBancario =>
		({ id, dtMovimento: dt, historico: `M${id}`, idContaCorrente: 24, valor, tipoMovimento: tipo, modalidadeMovimento: 'padrao', ...extra }) as MovimentoBancario;

	const base = {
		ano: '2026',
		contas: [24],
		tipoAgrupamento: 'centros' as const,
		planos: [],
		centrosCustos: [
			{ id: 42, descricao: 'Leite', tipo: 'CUSTEIO' as const },
			{ id: 50, descricao: 'Leite', tipo: 'INVESTIMENTO' as const },
			{ id: 60, descricao: 'Venda Leite', tipo: 'CUSTEIO' as const },
		],
		financiamentos: FINANCIAMENTOS,
		parcelasDoAno: [],
		pessoas,
		bancos,
		planosFinanciamento: {},
	};

	const { dadosMensais } = montarFluxoCaixaAno({
		...base,
		movimentos: [
			mov(1, '2026-10-05T00:00:00.000Z', 2000, 'C', { idCentroCustos: 60 }),
			mov(2, '2026-10-06T00:00:00.000Z', -1000, 'D', {
				centroCustosList: [
					{ idMovimentoBancario: 2, idCentroCustos: 42, valor: 700 },
					{ idMovimentoBancario: 2, idCentroCustos: 50, valor: 300 },
				],
			}),
			mov(3, '2026-10-07T00:00:00.000Z', -80, 'D'), // no centro → Conciliação
			mov(4, '2026-10-08T00:00:00.000Z', -90, 'D', { idCentroCustos: 42, modalidadeMovimento: 'transferencia' }),
			mov(5, '2026-10-09T00:00:00.000Z', 5000, 'C', { idCentroCustos: 60, modalidadeMovimento: 'financiamento', idFinanciamento: 1 }),
			mov(6, '2026-10-10T00:00:00.000Z', -40, 'D', { idCentroCustos: 42, idContaCorrente: 99 }), // other account
		],
	});

	it('receitas by centro, despesas split in custeio (1000) / investimento (2000)', () => {
		expect(dadosMensais[9].receitas).toEqual({ 60: 2000 });
		expect(dadosMensais[9].despesas).toEqual({
			1000: { descricao: 'Custeio', filhos: { 42: 700 } },
			2000: { descricao: 'Investimentos', filhos: { 50: 300 } },
		});
	});

	it('fills quitados / créditos novos with the shared rule', () => {
		expect(dadosMensais[9].financiamentos).toEqual(financiamentosMensaisFluxo('2026', FINANCIAMENTOS, pessoas, bancos)[9]);
		expect(dadosMensais.every((m) => Object.keys(m.pendentesSelecao).length === 0)).toBe(true);
	});
});
