import { describe, it, expect } from 'vitest';
import type { ContratoRelatorioFinanciamentos, RelatorioFinanciamentosData } from '../../services/relatorioService';
import {
	anosDisponiveis,
	contarFiltrosExtras,
	graficosExportados,
	intervaloRelatorio,
	lerPreferencias,
	linhasDe,
	ordenarLinhas,
	planilhasExcel,
	preferenciasPadrao,
	proximosMeses,
	separarSemParcelas,
	somarPorContrato,
	somaValores,
	situacaoLiquidado,
	textoParcelas,
} from './financiamentosRelatorio';

const contrato = (c: Partial<ContratoRelatorioFinanciamentos> & Pick<ContratoRelatorioFinanciamentos, 'idFinanciamento'>): ContratoRelatorioFinanciamentos => ({
	numeroContrato: `C-${c.idFinanciamento}`,
	tomador: 'GFS',
	credor: 'Banco do Brasil',
	dataContrato: '2026-05-20',
	valorContrato: 1000,
	totalJuros: 0,
	modalidade: 'CUSTEIO',
	ativo: true,
	valorVincendo: 0,
	valorPago: 0,
	parcelasAbertas: 0,
	parcelas: [],
	...c,
});

const ponto = { valor: 0, contratos: [] };
const dados: RelatorioFinanciamentosData = {
	periodo: { ano: 2026, inicio: '2026-01-01', fim: '2027-01-01', ultimoDia: '2026-12-31' },
	hoje: '2026-10-27',
	tomadores: ['CGF', 'GFS'],
	contratos: [
		contrato({
			idFinanciamento: 1,
			valorContrato: 50000,
			valorVincendo: 60000,
			parcelasAbertas: 2,
			parcelas: [
				{ idParcela: 1, numParcela: 1, valor: 30000, dt_vencimento: '2027-05-20', status: 'Aberto' },
				{ idParcela: 2, numParcela: 2, valor: 30000, dt_vencimento: '2028-05-20', status: 'Aberto' },
			],
		}),
		contrato({ idFinanciamento: 2, tomador: 'CGF', credor: 'Sicredi', ativo: false, dataQuitacao: '2026-02-01', modalidade: 'PARTICULAR', nomeModalidadeParticular: 'Vizinho' }),
	],
	ativos: { quantidade: 1, valor: 60000, valorContratos: 50000, contratos: [{ idFinanciamento: 1, valor: 60000 }] },
	contratados: { quantidade: 1, valor: 60000, valorContratos: 50000, contratos: [{ idFinanciamento: 1, valor: 60000 }] },
	liquidados: { quantidade: 1, valor: 11000, valorContratos: 1000, quitados: 1, amortizados: 0, valorVincendo: 0, contratos: [{ idFinanciamento: 2, valor: 11000, quitado: true }] },
	porTomador: { grupos: [{ tomador: 'GFS', quantidade: 1, valor: 60000, valorContratos: 50000, contratos: [{ idFinanciamento: 1, valor: 60000 }] }], quantidade: 1, valor: 60000, valorContratos: 50000 },
	graficos: {
		novosXLiquidados: [{ ano: 2026, mes: 5, novos: { valor: 60000, contratos: [{ idFinanciamento: 1, valor: 60000 }] }, liquidados: ponto }],
		compromissosDoAno: { ano: 2026, meses: [{ mes: 1, ...ponto }] },
		compromissosPorAno: [{ ano: 2027, valor: 30000, contratos: [{ idFinanciamento: 1, valor: 30000 }] }],
	},
};

describe('intervaloRelatorio', () => {
	it('mês, trimestre, semestre e ano (fim exclusivo)', () => {
		expect(intervaloRelatorio(2026, 'm2')).toMatchObject({ inicio: '2026-02-01', fim: '2026-03-01', rotulo: 'Fevereiro de 2026' });
		expect(intervaloRelatorio(2026, 'm12')).toMatchObject({ inicio: '2026-12-01', fim: '2027-01-01' });
		expect(intervaloRelatorio(2026, 't1')).toMatchObject({ inicio: '2026-01-01', fim: '2026-04-01' });
		expect(intervaloRelatorio(2026, 's2')).toMatchObject({ inicio: '2026-07-01', fim: '2027-01-01' });
		expect(intervaloRelatorio(2026, 'ano')).toMatchObject({ inicio: '2026-01-01', fim: '2027-01-01', rotulo: '2026' });
	});

	it('últimos 12 meses termina no mês atual, cruzando o ano', () => {
		const i = intervaloRelatorio(2020, '12m', new Date(2026, 9, 27));
		expect(i).toMatchObject({ inicio: '2025-11-01', fim: '2026-11-01' });
		expect(i.meses).toHaveLength(12);
	});
});

describe('linhasDe / somarPorContrato', () => {
	it('junta referências com os contratos e ignora ids desconhecidos', () => {
		const l = linhasDe(dados.contratos, [{ idFinanciamento: 2, valor: 5, quitado: true }, { idFinanciamento: 99, valor: 1 }]);
		expect(l).toHaveLength(1);
		expect(l[0]).toMatchObject({ valor: 5, quitado: true });
		expect(situacaoLiquidado(l[0])).toBe('Quitado em 01/02/2026');
	});

	it('soma barras contrato a contrato, em centavos, maior primeiro', () => {
		const s = somarPorContrato([
			[{ idFinanciamento: 1, valor: 0.1 }, { idFinanciamento: 2, valor: 5 }],
			[{ idFinanciamento: 1, valor: 0.2 }],
		]);
		expect(s).toEqual([
			{ idFinanciamento: 2, valor: 5 },
			{ idFinanciamento: 1, valor: 0.3 },
		]);
		expect(somaValores(s)).toBe(5.3);
	});
});

describe('planilhasExcel', () => {
	const filtros: Array<[string, string]> = [['Período', '2026']];

	it('só as visões e gráficos escolhidos, mais Filtros e Parcelas', () => {
		const p = planilhasExcel(dados, new Set(['ativos', 'liquidados']), new Set(['compromissosPorAno']), filtros);
		expect(p.map((x) => x.nome)).toEqual(['Filtros', 'Contratos ativos', 'Liquidados no período', 'Compromissos por ano', 'Parcelas']);
		expect(p[0].linhas).toEqual([{ Filtro: 'Período', Valor: '2026' }]);
	});

	it('colunas: valor do contrato + soma das parcelas a vencer, tomador e credor', () => {
		const [, ativos] = planilhasExcel(dados, new Set(['ativos']), new Set(), filtros);
		expect(ativos.linhas).toEqual([
			{
				Contrato: 'C-1',
				Tomador: 'GFS',
				'Banco/Credor': 'Banco do Brasil',
				Modalidade: 'Custeio',
				'Data do contrato': '20/05/2026',
				'Valor do contrato': 50000,
				'A vencer (parcelas não liquidadas)': 60000,
			},
		]);
	});

	it('liquidados trazem o pago no período e a situação; parcelas só dos contratos listados', () => {
		const p = planilhasExcel(dados, new Set(['liquidados']), new Set(), filtros);
		expect(p[1].linhas[0]).toMatchObject({ Contrato: 'C-2', Modalidade: 'Particular - Vizinho', 'Pago no período': 11000, Situação: 'Quitado em 01/02/2026' });
		expect(p.find((x) => x.nome === 'Parcelas')?.linhas).toEqual([]);
		const comAtivos = planilhasExcel(dados, new Set(['porTomador']), new Set(), filtros);
		expect(comAtivos.find((x) => x.nome === 'Por tomador')?.linhas[0]).toMatchObject({ Tomador: 'GFS', Contratos: 1, '% do total a vencer': 100 });
		expect(comAtivos.find((x) => x.nome === 'Parcelas')?.linhas).toHaveLength(2);
	});

	it('somente gráficos: sem aba de parcelas', () => {
		const p = planilhasExcel(dados, new Set(), new Set(['novosXLiquidados', 'compromissosAno']), filtros);
		expect(p.map((x) => x.nome)).toEqual(['Filtros', 'Novos x liquidados', 'Compromissos 2026']);
		expect(p[1].linhas[0]).toEqual({ Mês: 'Mai/2026', 'Novos (parcelas dos contratos assinados)': 60000, 'Liquidados (parcelas pagas)': 0 });
	});

	it('exporta só o gráfico que está na tela', () => {
		expect([...graficosExportados('ativos', false, 'ano')]).toEqual([]);
		expect([...graficosExportados('ativos', true, 'ano')]).toEqual(['compromissosAno']);
		expect([...graficosExportados('ativos', true, 'porAno')]).toEqual(['compromissosPorAno']);
		expect([...graficosExportados('liquidados', true, 'ano')]).toEqual(['novosXLiquidados']);
		expect([...graficosExportados('porTomador', true, 'ano')]).toEqual([]);
	});
});

describe('listagem', () => {
	const semParcelas = contrato({ idFinanciamento: 3, numeroContrato: 'TESTE', valorContrato: 1 });
	const linhas = [...linhasDe(dados.contratos, [{ idFinanciamento: 1, valor: 60000 }]), { contrato: semParcelas, valor: 0 }];

	it('contratos sem parcelas cadastradas (0 de 0, R$ 0 a vencer) vão para a nota', () => {
		const { principais, semParcelas: nota } = separarSemParcelas(linhas);
		expect(principais.map((l) => l.contrato.idFinanciamento)).toEqual([1]);
		expect(nota.map((l) => l.contrato.idFinanciamento)).toEqual([3]);
	});

	it('texto das parcelas', () => {
		expect(textoParcelas(dados.contratos[0])).toBe('2 de 2 parcelas a vencer');
		expect(textoParcelas({ parcelasAbertas: 0, parcelas: dados.contratos[0].parcelas })).toBe('2 parcelas pagas');
		expect(textoParcelas(semParcelas)).toBe('sem parcelas cadastradas');
	});

	it('ordena por a vencer, texto e data, com desempate pelo número', () => {
		const a = contrato({ idFinanciamento: 10, numeroContrato: 'C-10', tomador: 'b', valorVincendo: 5, dataContrato: '2025-01-01' });
		const b = contrato({ idFinanciamento: 2, numeroContrato: 'C-2', tomador: 'A', valorVincendo: 5, dataContrato: '2026-01-01' });
		const c = contrato({ idFinanciamento: 3, numeroContrato: 'C-3', tomador: 'c', valorVincendo: 9, dataContrato: '2024-01-01' });
		const ls = [a, b, c].map((x) => ({ contrato: x, valor: x.valorVincendo }));
		const ids = (o: Parameters<typeof ordenarLinhas>[1]) => ordenarLinhas(ls, o).map((l) => l.contrato.idFinanciamento);
		expect(ids({ coluna: 'vencer', desc: true })).toEqual([3, 2, 10]);
		expect(ids({ coluna: 'tomador', desc: false })).toEqual([2, 10, 3]);
		expect(ids({ coluna: 'data', desc: true })).toEqual([2, 10, 3]);
		expect(ids({ coluna: 'contrato', desc: false })).toEqual([2, 3, 10]);
	});

	it('próximos 12 meses: parcelas não pagas até 1 ano à frente, incluindo as em atraso', () => {
		const c = contrato({
			idFinanciamento: 7,
			parcelas: [
				{ idParcela: 1, numParcela: 1, valor: 100, dt_vencimento: '2026-03-01', status: 'Vencido' },
				{ idParcela: 2, numParcela: 2, valor: 200, dt_vencimento: '2026-12-01', status: 'Aberto' },
				{ idParcela: 3, numParcela: 3, valor: 400, dt_vencimento: '2027-10-27', status: 'Aberto' },
				{ idParcela: 4, numParcela: 4, valor: 800, dt_vencimento: '2027-11-01', status: 'Aberto' },
				{ idParcela: 5, numParcela: 5, valor: 1600, dt_vencimento: '2026-11-01', status: 'Liquidado' },
			],
		});
		const r = proximosMeses([c, ...dados.contratos], [{ idFinanciamento: 7, valor: 0 }], '2026-10-27');
		expect(r).toEqual({ valor: 700, emAtraso: 100, contratos: [{ idFinanciamento: 7, valor: 700 }] });
	});

	it('anos do filtro: anos com dados + atual até +5, do mais novo ao mais antigo', () => {
		expect(anosDisponiveis(dados.contratos, 2026, [2019])).toEqual([2031, 2030, 2029, 2028, 2027, 2026, 2019]);
	});
});

describe('lerPreferencias', () => {
	it('texto inválido ou vazio volta ao padrão (abre em Ativos)', () => {
		expect(lerPreferencias(null, 2026)).toEqual(preferenciasPadrao(2026));
		expect(lerPreferencias('{quebrado', 2026)).toEqual(preferenciasPadrao(2026));
		expect(preferenciasPadrao(2026).visao).toBe('ativos');
	});

	it('mantém só valores válidos', () => {
		const p = lerPreferencias(
			JSON.stringify({
				visao: 'liquidados',
				ano: 2025,
				periodo: 'm3',
				refinos: { tomador: ' GFS ', idBanco: 4, modalidade: 'XYZ', faixaJuros: '>15', numeroGarantia: '' },
				graficos: { ativos: true, contratados: 'sim' },
				compromissos: 'porAno',
			}),
			2026,
		);
		expect(p).toEqual({
			visao: 'liquidados',
			ano: 2025,
			periodo: 'm3',
			refinos: { tomador: 'GFS', idBanco: 4, modalidade: undefined, numeroGarantia: undefined, faixaJuros: '>15' },
			graficos: { ativos: true },
			compromissos: 'porAno',
		});
		expect(contarFiltrosExtras(p.refinos)).toBe(2);
		expect(lerPreferencias(JSON.stringify({ visao: 'outra', periodo: 'm13', ano: 1800 }), 2026)).toMatchObject({ visao: 'ativos', periodo: 'ano', ano: 2026 });
	});
});
