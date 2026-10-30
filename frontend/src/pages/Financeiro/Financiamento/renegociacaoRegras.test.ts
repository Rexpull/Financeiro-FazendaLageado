import { describe, it, expect } from 'vitest';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import type { RenegociacaoHistorico } from '../../../../../backend/src/repositories/RenegociacaoRepository';
import { resumoParcelas } from './parcelaRegras';
import {
	avisoDiferencaContrato,
	descricaoHistorico,
	erroLinhas,
	erroTaxa,
	limparTaxa,
	linhaInvalida,
	mudancasCondicoes,
	gerarParcelas,
	linhasSnapshot,
	mensagemConfirmacao,
	montarPayload,
	novaLinha,
	podeRenegociar,
	primeiroNumero,
	renegociadoEncerrado,
	renumerar,
	rotuloOrigem,
	rotuloRenegociado,
	situacaoContrato,
	textoDiferenca,
	totalLinhas,
	type DadosAditivo,
	type DadosNovoContrato,
} from './renegociacaoRegras';

/** brl() uses a no-break space after "R$"; compare with plain spaces. */
const txt = (s: string | null) => (s ?? '').replace(/ /g, ' ');

const p = (over: Partial<ParcelaFinanciamento>): ParcelaFinanciamento => ({
	id: 1,
	idFinanciamento: 1,
	idMovimentoBancario: null,
	valor: 100,
	status: 'Aberto',
	numParcela: 1,
	dt_lancamento: '2025-01-01',
	dt_vencimento: '2025-01-10',
	dt_liquidacao: null,
	...over,
});

const parcelas = [
	p({ id: 1, numParcela: 1, valor: 200, status: 'Liquidado', dt_liquidacao: '2025-01-10' }),
	p({ id: 2, numParcela: 2, valor: 200, status: 'Liquidado', dt_liquidacao: '2026-01-10' }),
	p({ id: 3, numParcela: 3, valor: 300.5, status: 'Vencido', dt_vencimento: '2026-06-10' }),
	p({ id: 4, numParcela: 4, valor: 300, status: 'Aberto', dt_vencimento: '2027-06-10' }),
];

describe('situação do contrato', () => {
	it('separa em aberto (Aberto + Vencido) e pagas', () => {
		const s = situacaoContrato(parcelas);
		expect(s).toMatchObject({ qtdAbertas: 2, valorAberto: 600.5, qtdPagas: 2, valorPago: 400, maiorNumeroPago: 2 });
		expect(s.abertas.map((x) => x.id)).toEqual([3, 4]);
		expect(situacaoContrato(null)).toMatchObject({ qtdAbertas: 0, valorAberto: 0, maiorNumeroPago: 0 });
	});

	it('pode renegociar só com parcela em aberto; renegociado encerrado = sem nada a pagar', () => {
		expect(podeRenegociar({ parcelasList: parcelas })).toBe(true);
		expect(podeRenegociar({ parcelasList: parcelas.slice(0, 2) })).toBe(false);
		expect(podeRenegociar({ parcelasList: [] })).toBe(false);
		expect(renegociadoEncerrado({ renegociadoEm: '2026-10-15', parcelasList: parcelas.slice(0, 2) })).toBe(true);
		expect(renegociadoEncerrado({ renegociadoEm: '2026-10-15', parcelasList: [] })).toBe(true);
		expect(renegociadoEncerrado({ renegociadoEm: null, parcelasList: [] })).toBe(false);
		expect(renegociadoEncerrado({ renegociadoEm: '2026-10-15', parcelasList: parcelas })).toBe(false);
	});

	it('rótulos dos cards', () => {
		expect(rotuloRenegociado({ renegociadoEm: '2026-10-15', numeroContratoNovo: 'SIC-200-R' })).toBe('Renegociado → SIC-200-R');
		expect(rotuloRenegociado({ renegociadoEm: '2026-10-15', numeroContratoNovo: null })).toBe('Renegociado');
		expect(rotuloRenegociado({ renegociadoEm: null, numeroContratoNovo: null })).toBeNull();
		expect(rotuloOrigem({ numeroContratoOrigem: 'SIC-200' })).toBe('Origem: SIC-200');
		expect(rotuloOrigem({ numeroContratoOrigem: null })).toBeNull();
	});

	it('aviso "parcelas ≠ contratado + juros" some depois de uma renegociação', () => {
		const resumo = resumoParcelas({ valor: 1000, totalJuros: 0, taxaJurosAnual: null }, parcelas);
		expect(avisoDiferencaContrato({ qtdRenegociacoes: 0 }, resumo)).not.toBeNull();
		expect(avisoDiferencaContrato({ qtdRenegociacoes: 1 }, resumo)).toBeNull();
	});
});

describe('novas parcelas', () => {
	it('numeração: aditivo continua depois das pagas; novo contrato começa em 1', () => {
		expect(primeiroNumero('ADITIVO', { maiorNumeroPago: 2 })).toBe(3);
		expect(primeiroNumero('NOVO_CONTRATO', { maiorNumeroPago: 2 })).toBe(1);
	});

	it('gera com (valor + juros) ÷ quantidade, centavos na última, vencimentos pela periodicidade', () => {
		const r = gerarParcelas({
			quantidade: '3',
			primeiroVencimento: '2027-01-31',
			periodicidade: 'mensal',
			valor: 1000,
			juros: 0.01,
			numeroInicial: 3,
		});
		expect(r).toEqual({
			ok: true,
			linhas: [
				{ chave: 1, numParcela: 3, dt_vencimento: '2027-01-31', valor: 333.33 },
				{ chave: 2, numParcela: 4, dt_vencimento: '2027-02-28', valor: 333.33 },
				{ chave: 3, numParcela: 5, dt_vencimento: '2027-03-31', valor: 333.35 },
			],
		});
		const anual = gerarParcelas({
			quantidade: 2,
			primeiroVencimento: '2027-06-10',
			periodicidade: 'anual',
			valor: 100,
			juros: 0,
			numeroInicial: 1,
		});
		expect(anual.ok && anual.linhas.map((l) => l.dt_vencimento)).toEqual(['2027-06-10', '2028-06-10']);
	});

	it('recusa gerar sem quantidade, vencimento ou valor', () => {
		const base = {
			quantidade: '2',
			primeiroVencimento: '2027-01-10',
			periodicidade: 'mensal' as const,
			valor: 100,
			juros: 0,
			numeroInicial: 1,
		};
		expect(gerarParcelas({ ...base, quantidade: '0' })).toMatchObject({ ok: false });
		expect(gerarParcelas({ ...base, primeiroVencimento: '' })).toEqual({ ok: false, erro: 'Informe o 1º vencimento.' });
		expect(gerarParcelas({ ...base, valor: 0 })).toEqual({ ok: false, erro: 'Informe o valor a parcelar (maior que zero).' });
	});

	it('adicionar / remover / renumerar linhas', () => {
		const linhas = [
			{ chave: 1, numParcela: 3, dt_vencimento: '2027-01-10', valor: 100 },
			{ chave: 2, numParcela: 4, dt_vencimento: '2027-07-10', valor: 150 },
		];
		expect(novaLinha(linhas, 3, '2026-10-29')).toEqual({ chave: 3, numParcela: 5, dt_vencimento: '2028-01-10', valor: 150 });
		expect(novaLinha([], 1, '2026-10-29')).toEqual({ chave: 1, numParcela: 1, dt_vencimento: '2026-10-29', valor: 0 });
		expect(renumerar([linhas[1]], 3)).toEqual([{ ...linhas[1], numParcela: 3 }]);
		expect(totalLinhas(linhas)).toBe(250);
	});

	it('diferença em relação ao que estava a vencer', () => {
		expect(txt(textoDiferenca(1410000, 1260000))).toBe('Diferença em relação ao que estava a vencer: +R$ 150.000,00');
		expect(txt(textoDiferenca(100, 150.5))).toBe('Diferença em relação ao que estava a vencer: −R$ 50,50');
		expect(textoDiferenca(100, 100)).toBe('Diferença em relação ao que estava a vencer: sem diferença');
	});

	it('valida a tabela', () => {
		expect(erroLinhas([])).toBe('Gere ou adicione ao menos uma parcela nova.');
		expect(erroLinhas([{ chave: 1, numParcela: 3, dt_vencimento: '', valor: 1 }])).toBe('Parcela 3: informe a data de vencimento.');
		expect(erroLinhas([{ chave: 1, numParcela: 3, dt_vencimento: '2027-01-01', valor: 0 }])).toBe(
			'Parcela 3: o valor deve ser maior que zero.',
		);
		expect(erroLinhas([{ chave: 1, numParcela: 3, dt_vencimento: '2027-01-01', valor: 1 }])).toBeNull();
	});
});

describe('confirmação e envio', () => {
	it('aditivo: diz exatamente o que acontece', () => {
		const msg = mensagemConfirmacao({
			tipo: 'ADITIVO',
			situacao: { qtdAbertas: 7, valorAberto: 1260000, qtdPagas: 3 },
			qtdNovas: 8,
			valorNovas: 1410000,
		});
		expect(txt(msg)).toBe(
			'As 7 parcelas em aberto (R$ 1.260.000,00) deste contrato serão substituídas por 8 novas (R$ 1.410.000,00). As parcelas pagas continuam como estão.',
		);
		const um = mensagemConfirmacao({
			tipo: 'ADITIVO',
			situacao: { qtdAbertas: 1, valorAberto: 10, qtdPagas: 0 },
			qtdNovas: 1,
			valorNovas: 12,
		});
		expect(txt(um)).toBe('A parcela em aberto (R$ 10,00) deste contrato será substituída por 1 nova (R$ 12,00).');
	});

	it('novo contrato: encerra este e cria o outro', () => {
		const msg = mensagemConfirmacao({
			tipo: 'NOVO_CONTRATO',
			situacao: { qtdAbertas: 2, valorAberto: 100000, qtdPagas: 1 },
			qtdNovas: 3,
			valorNovas: 120000,
			numeroContratoNovo: 'SIC-200-R',
		});
		expect(txt(msg)).toBe(
			'Este contrato será encerrado como renegociado e o contrato SIC-200-R será criado com 3 parcelas novas (R$ 120.000,00). ' +
				'As 2 parcelas em aberto (R$ 100.000,00) saem deste contrato. A parcela paga continua como está.',
		);
	});

	const linhas = [{ chave: 1, numParcela: 3, dt_vencimento: '2027-01-10', valor: 100 }];
	const aditivo: DadosAditivo = { dataRenegociacao: '2026-10-29', valor: null, taxaJurosAnual: 9.5, observacao: '  ' };
	const novo: DadosNovoContrato = {
		numeroContrato: ' N-1 ',
		dataContrato: '2026-10-15',
		credor: 'p:7',
		responsavel: 'GFS',
		valor: 100,
		taxaJurosAnual: null,
		modalidade: '',
		nomeModalidadeParticular: 'ignorado',
		numeroGarantia: '',
		observacao: 'obs',
	};

	it('payload do aditivo e do novo contrato', () => {
		expect(montarPayload('ADITIVO', linhas, { aditivo, novo })).toEqual({
			tipo: 'ADITIVO',
			dataRenegociacao: '2026-10-29',
			observacao: null,
			condicoes: { valor: null, taxaJurosAnual: 9.5 },
			parcelas: [{ numParcela: 3, dt_vencimento: '2027-01-10', valor: 100 }],
		});
		expect(montarPayload('NOVO_CONTRATO', linhas, { aditivo, novo })).toEqual({
			tipo: 'NOVO_CONTRATO',
			dataRenegociacao: '2026-10-15',
			novoContrato: {
				numeroContrato: 'N-1',
				idBanco: null,
				idPessoa: 7,
				responsavel: 'GFS',
				dataContrato: '2026-10-15',
				valor: 100,
				taxaJurosAnual: null,
				modalidade: 'RENEGOCIACAO',
				nomeModalidadeParticular: null,
				numeroGarantia: null,
				observacao: 'obs',
			},
			parcelas: [{ numParcela: 3, dt_vencimento: '2027-01-10', valor: 100 }],
		});
	});
});

describe('histórico', () => {
	const base: RenegociacaoHistorico = {
		id: 1,
		idFinanciamento: 2,
		numeroContrato: 'SIC-200',
		tipo: 'NOVO_CONTRATO',
		dataRenegociacao: '2026-10-15',
		idFinanciamentoNovo: 6,
		numeroContratoNovo: 'SIC-200-R',
		parcelasAnteriores: [
			{ numParcela: 2, dt_vencimento: '2027-03-01', valor: 50000, status: 'Aberto' },
			{ numParcela: 3, dt_vencimento: '2028-03-01', valor: 50000, status: 'Aberto' },
		],
		condicoesAnteriores: {
			valor: 150000,
			taxaJurosAnual: 10,
			totalJuros: null,
			modalidade: 'INVESTIMENTO',
			numeroContrato: 'SIC-200',
			numeroGarantia: null,
		},
		observacao: null,
		criadoEm: null,
	};

	it('visto do contrato antigo, do novo e de um aditivo', () => {
		const antigo = descricaoHistorico(base, 2);
		expect(antigo.titulo).toBe('15/10/2026 · Novo contrato → SIC-200-R');
		expect(txt(antigo.detalhe)).toBe('2 parcelas em aberto (R$ 100.000,00) foram para o contrato SIC-200-R.');
		const novo = descricaoHistorico(base, 6);
		expect(novo.titulo).toBe('15/10/2026 · Origem: contrato SIC-200');
		expect(txt(novo.detalhe)).toBe('Este contrato substituiu 2 parcelas em aberto (R$ 100.000,00) do contrato SIC-200.');
		const aditivo = descricaoHistorico({ ...base, tipo: 'ADITIVO', idFinanciamentoNovo: null, numeroContratoNovo: null }, 2);
		expect(aditivo.titulo).toBe('15/10/2026 · Aditivo');
		expect(txt(aditivo.detalhe)).toBe('Substituídas: 2 parcelas em aberto (R$ 100.000,00). Antes: valor R$ 150.000,00, taxa 10% ao ano.');
		expect(txt(linhasSnapshot(base)[0])).toBe('Parcela 2 · 01/03/2027 · R$ 50.000,00');
	});
});

describe('regras do modal (vencimento, taxa, confirmação)', () => {
	const inicio = { data: '2026-10-29', rotulo: 'do aditivo' };
	it('blocks a new parcela due before the renegotiation date', () => {
		const linhas = [
			{ chave: 1, numParcela: 2, dt_vencimento: '2027-01-01', valor: 10 },
			{ chave: 2, numParcela: 3, dt_vencimento: '2026-10-28', valor: 10 },
		];
		expect(erroLinhas(linhas, inicio)).toBe('Parcela 3: vence em 28/10/2026, antes da data do aditivo (29/10/2026).');
		expect(erroLinhas(linhas)).toBeNull();
		expect(erroLinhas([{ chave: 1, numParcela: 1, dt_vencimento: '2026-10-29', valor: 10 }], inicio)).toBeNull();
		expect(linhas.map((l) => linhaInvalida(l, inicio))).toEqual([false, true]);
		expect(linhaInvalida({ chave: 1, numParcela: 1, dt_vencimento: '', valor: 10 })).toBe(true);
		expect(linhaInvalida({ chave: 1, numParcela: 1, dt_vencimento: '2027-01-01', valor: 0 })).toBe(true);
	});

	it('rate: keeps digits and one comma, up to 4 decimals; 0 to 100', () => {
		expect(limparTaxa('abc')).toBe('');
		expect(limparTaxa('12.5')).toBe('12,5');
		expect(limparTaxa('-3')).toBe('3');
		expect(limparTaxa('9,123456')).toBe('9,1234');
		expect(limparTaxa('1,2,3')).toBe('1,23');
		expect(limparTaxa(',5')).toBe('0,5');
		expect(erroTaxa('')).toBeNull();
		expect(erroTaxa('12,5')).toBeNull();
		expect(erroTaxa('0')).toBeNull();
		expect(erroTaxa('150')).toBe('A taxa deve ficar entre 0 e 100% ao ano.');
	});

	it('confirmation lists the changed terms only', () => {
		expect(mudancasCondicoes({ taxaAtual: 9.5, taxaNova: 8.5, valorAtual: 480432.92, valorNovo: null })).toBe('Taxa: 9,5% → 8,5% ao ano.');
		expect(mudancasCondicoes({ taxaAtual: 9.5, taxaNova: 9.5 })).toBe('');
		expect(txt(mudancasCondicoes({ valorAtual: 100, valorNovo: 150 }))).toBe('Valor do contrato: R$ 100,00 → R$ 150,00.');
		expect(mudancasCondicoes({ taxaAtual: 1500, taxaNova: 12 })).toBe('Taxa: 12% ao ano.');
	});
});
