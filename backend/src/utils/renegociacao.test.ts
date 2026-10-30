import { describe, it, expect } from 'vitest';
import {
	anexarObservacao,
	dataValida,
	infoRenegociacoes,
	jurosDasParcelas,
	mensagemParcelasVinculadas,
	numerarParcelas,
	statusNovaParcela,
	validarRenegociacao, erroDataRenegociacao } from './renegociacao';
import { montarRelatorioFinanciamentos } from './relatorioFinanciamentos';

describe('validarRenegociacao', () => {
	const parcelas = [{ dt_vencimento: '2027-01-10', valor: '1.500,50' }];

	it('aditivo: normaliza valores e condições opcionais', () => {
		const r = validarRenegociacao({ tipo: 'aditivo', dataRenegociacao: '2026-10-29', condicoes: { valor: '', taxaJurosAnual: 9.5 }, parcelas });
		expect(r).toEqual({
			ok: true,
			dados: {
				tipo: 'ADITIVO',
				dataRenegociacao: '2026-10-29',
				observacao: null,
				novoContrato: null,
				condicoes: { valor: null, taxaJurosAnual: 9.5, modalidade: null, nomeModalidadeParticular: null, numeroGarantia: null },
				parcelas: [{ numParcela: null, dt_vencimento: '2027-01-10', valor: 1500.5 }],
			},
		});
	});

	it('novo contrato: data da renegociação = data do contrato quando não vem', () => {
		const r = validarRenegociacao({
			tipo: 'NOVO_CONTRATO',
			novoContrato: { numeroContrato: ' N-1 ', dataContrato: '2026-10-15', valor: 100, modalidade: 'custeio' },
			parcelas,
		});
		expect(r.ok && r.dados.dataRenegociacao).toBe('2026-10-15');
		expect(r.ok && r.dados.novoContrato).toMatchObject({ numeroContrato: 'N-1', modalidade: 'CUSTEIO', idBanco: null, idPessoa: null });
	});

	it('recusa dados incompletos com mensagens para o cliente', () => {
		const erro = (b: unknown) => {
			const r = validarRenegociacao(b);
			return r.ok ? null : r.erro;
		};
		expect(erro({ tipo: 'X', parcelas })).toMatch(/Escolha o tipo/);
		expect(erro({ tipo: 'ADITIVO', parcelas })).toBe('Informe a data do aditivo.');
		expect(erro({ tipo: 'NOVO_CONTRATO', parcelas, novoContrato: { dataContrato: '2026-10-15', valor: 1 } })).toBe(
			'Informe o número do novo contrato.',
		);
		expect(erro({ tipo: 'NOVO_CONTRATO', parcelas, novoContrato: { numeroContrato: 'A', dataContrato: '2026-10-15', valor: 0 } })).toMatch(
			/valor contratado/,
		);
		expect(
			erro({ tipo: 'NOVO_CONTRATO', parcelas, novoContrato: { numeroContrato: 'A', dataContrato: '2026-10-15', valor: 1, idBanco: 1, idPessoa: 2 } }),
		).toBe('Escolha só um credor: banco ou pessoa.');
		expect(
			erro({
				tipo: 'ADITIVO',
				dataRenegociacao: '2026-10-29',
				parcelas: [
					{ numParcela: 3, dt_vencimento: '2027-01-10', valor: 1 },
					{ dt_vencimento: '2027-02-10', valor: 1 },
				],
			}),
		).toBe('Informe o número de todas as parcelas novas, ou de nenhuma.');
	});
});

describe('regras auxiliares', () => {
	it('datas, numeração, juros, status e observação', () => {
		expect(dataValida('2028-02-29')).toBe(true);
		expect(dataValida('2027-02-29')).toBe(false);
		expect(numerarParcelas([{ numParcela: null, dt_vencimento: '2027-01-01', valor: 1 }], [1, 2]).ok).toBe(true);
		const n = numerarParcelas(
			[
				{ numParcela: null, dt_vencimento: '2027-01-01', valor: 1 },
				{ numParcela: null, dt_vencimento: '2028-01-01', valor: 1 },
			],
			[1, 2],
		);
		expect(n.ok && n.dados.map((p) => p.numParcela)).toEqual([3, 4]);
		expect(jurosDasParcelas(100, [{ valor: 60 }, { valor: 60.01 }])).toBe(20.01);
		expect(jurosDasParcelas(100, [{ valor: 90 }])).toBeNull();
		expect(statusNovaParcela('2026-10-28', '2026-10-29')).toBe('Vencido');
		expect(statusNovaParcela('2026-10-29', '2026-10-29')).toBe('Aberto');
		expect(anexarObservacao(null, 'Aditivo em 29/10/2026')).toBe('Aditivo em 29/10/2026');
		expect(anexarObservacao('Obs', 'Aditivo em 29/10/2026')).toBe('Obs\nAditivo em 29/10/2026');
		expect(mensagemParcelasVinculadas([{ numParcela: 3, motivo: 'vinculada a lançamento bancário' }, { numParcela: 4, motivo: 'com lançamento de resultado' }])).toBe(
			'Não é possível renegociar: as parcelas em aberto 3 (vinculada a lançamento bancário) e 4 (com lançamento de resultado) estão vinculadas a lançamentos. ' +
				'Desfaça a conciliação desses lançamentos (ou liquide a parcela) antes de renegociar.',
		);
	});

	it('infoRenegociacoes: último novo contrato vale; origem pelo número', () => {
		const info = infoRenegociacoes(
			[
				{ id: 1, numeroContrato: 'A' },
				{ id: 2, numeroContrato: 'B', idFinanciamentoOrigem: 1 },
				{ id: 3, numeroContrato: 'C', idFinanciamentoOrigem: 2 },
			],
			[
				{ idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-01-10', idFinanciamentoNovo: null },
				{ idFinanciamento: 1, tipo: 'NOVO_CONTRATO', dataRenegociacao: '2026-05-10', idFinanciamentoNovo: 2 },
				{ idFinanciamento: 2, tipo: 'NOVO_CONTRATO', dataRenegociacao: '2026-09-10', idFinanciamentoNovo: 3 },
			],
		);
		expect(info.get(1)).toEqual({
			renegociadoEm: '2026-05-10',
			idFinanciamentoNovo: 2,
			numeroContratoNovo: 'B',
			numeroContratoOrigem: null,
			qtdRenegociacoes: 2,
			ultimoAditivoEm: '2026-01-10',
		});
		expect(info.get(2)).toMatchObject({ renegociadoEm: '2026-09-10', numeroContratoNovo: 'C', numeroContratoOrigem: 'A' });
		expect(info.get(3)).toMatchObject({ renegociadoEm: null, numeroContratoOrigem: 'B', qtdRenegociacoes: 0 });
	});
});

describe('relatório: contrato renegociado', () => {
	it('sem parcelas a vencer não é ativo nem quitado; com parcela paga no período conta como renegociado', () => {
		const contratos = [
			{ id: 1, numeroContrato: 'A', responsavel: 'GFS', dataContrato: '2025-01-01', valor: 100, renegociadoEm: '2026-05-10', numeroContratoNovo: 'B' },
			{ id: 3, numeroContrato: 'C', responsavel: 'GFS', dataContrato: '2025-01-01', valor: 100, renegociadoEm: '2026-05-10' },
		];
		const parcelas = [{ id: 1, idFinanciamento: 1, numParcela: 1, valor: 50, status: 'Liquidado', dt_vencimento: '2026-02-01', dt_liquidacao: '2026-02-01' }];
		const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026 }, '2026-10-29');
		expect(r.contratos[0]).toMatchObject({ ativo: false, renegociadoEm: '2026-05-10', numeroContratoNovo: 'B', dataQuitacao: undefined });
		expect(r.contratos[1]).toMatchObject({ ativo: false, renegociadoEm: '2026-05-10' });
		expect(r.ativos.quantidade).toBe(0);
		expect(r.liquidados).toMatchObject({ quantidade: 1, quitados: 0, amortizados: 0, renegociados: 1 });
		expect(r.liquidados.contratos).toEqual([{ idFinanciamento: 1, valor: 50, quitado: false, renegociado: true }]);
	});
});

describe('erroDataRenegociacao', () => {
	const limites = { dataContrato: '2024-01-10', ultimaRenegociacao: '2026-09-10', hoje: '2026-10-29' };
	const aditivo = (d: string) => ({ tipo: 'ADITIVO' as const, dataRenegociacao: d, novoContrato: null });
	it('aceita de a última renegociação até hoje', () => {
		expect(erroDataRenegociacao(aditivo('2026-09-10'), limites)).toBeNull();
		expect(erroDataRenegociacao(aditivo('2026-10-29'), limites)).toBeNull();
		expect(erroDataRenegociacao(aditivo('2025-05-01'), { ...limites, ultimaRenegociacao: null })).toBeNull();
	});
	it('recusa futuro, antes do contrato e antes da última renegociação', () => {
		expect(erroDataRenegociacao(aditivo('2026-10-30'), limites)).toContain('depois de hoje');
		expect(erroDataRenegociacao(aditivo('2024-01-09'), { ...limites, ultimaRenegociacao: null })).toContain('antes da data do contrato (10/01/2024)');
		expect(erroDataRenegociacao(aditivo('2026-09-09'), limites)).toContain('antes da última renegociação');
	});
	it('novo contrato: confere também a data de assinatura do contrato novo', () => {
		const novo = { tipo: 'NOVO_CONTRATO' as const, dataRenegociacao: '2026-10-01', novoContrato: { dataContrato: '2023-01-01' } } as never;
		expect(erroDataRenegociacao(novo, limites)).toContain('(01/01/2023) não pode ser antes da data do contrato');
	});
});
