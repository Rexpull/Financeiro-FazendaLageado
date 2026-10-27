const API_URL = import.meta.env.VITE_API_URL;

export interface RelatorioCentroCustosItem {
	centro: {
		id: number;
		descricao: string;
		tipo?: string;
		/** Block of the report: RECEITA (credits) / DESPESA (debits) by movement direction, or FINANCIAMENTO */
		tipoReceitaDespesa?: 'RECEITA' | 'DESPESA' | 'FINANCIAMENTO';
		/** The centre's own registration (Receita/Despesa) */
		tipoReceitaDespesaCentro?: string;
		/** DESPESA groups: custeio (centre tipo CUSTEIO) or investimento — same rule as Dashboard/Fluxo */
		subtipoDespesa?: 'custeio' | 'investimento';
		/** "Sem centro de custos": pending movements, outside the receitas/despesas totals */
		semCentro?: boolean;
	};
	total: number;
	movimentos: Array<{
		id: number;
		dtMovimento: string;
		historico: string;
		valor: number;
		tipoMovimento: string;
		/** Pending conciliation (single rule): e.g. debit with centre but without plan */
		pendente?: boolean;
		planoDescricao?: string;
		pessoaNome?: string;
		bancoNome?: string;
		bancoCodigo?: string;
		agencia?: string;
		numConta?: string;
		contaDescricao?: string;
	}>;
}

export interface RelatorioItensClassificadosItem {
	id: number;
	dtMovimento: string;
	historico: string;
	valor: number;
	tipoMovimento: string;
	modalidadeMovimento?: string;
	idPlanoContas?: number;
	planoDescricao?: string;
	centroCustosDescricao?: string;
	centroCustosTipo?: string;
	idCentroCustos?: number;
	/** Debit with centre: custeio / investimento (centre tipo) */
	subtipoDespesa?: 'custeio' | 'investimento';
	/** Without cost centre: pending, outside the receitas/despesas totals */
	semCentro?: boolean;
	/** Debit without plan ("Sem plano": pending). Credits without plan are not returned (Centro de Custos report). */
	semPlano?: boolean;
	pendente?: boolean;
	pessoaNome?: string;
	bancoNome?: string;
	bancoCodigo?: string;
	agencia?: string;
	numConta?: string;
	contaDescricao?: string;
}

export const getRelatorioCentroCustos = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	centroCustosId?: number
): Promise<RelatorioCentroCustosItem[]> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (centroCustosId) params.append('centroCustosId', centroCustosId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/centro-custos?${params}`);
	if (!res.ok) throw new Error('Erro ao buscar relatório de centro de custos');
	return res.json();
};

export const getRelatorioItensClassificados = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	planoContasId?: number
): Promise<RelatorioItensClassificadosItem[]> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (planoContasId) params.append('planoContasId', planoContasId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/itens-classificados?${params}`);
	if (!res.ok) throw new Error('Erro ao buscar relatório de itens classificados');
	return res.json();
};

export const exportRelatorioCentroCustosExcel = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	centroCustosId?: number
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (centroCustosId) params.append('centroCustosId', centroCustosId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/centro-custos/excel?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de centro de custos para Excel');
	return res.blob();
};

export const exportRelatorioCentroCustosPDF = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	centroCustosId?: number
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (centroCustosId) params.append('centroCustosId', centroCustosId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/centro-custos/pdf?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de centro de custos para PDF');
	return res.blob();
};

export const exportRelatorioItensClassificadosExcel = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	planoContasId?: number
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (planoContasId) params.append('planoContasId', planoContasId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/itens-classificados/excel?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de itens classificados para Excel');
	return res.blob();
};

export const exportRelatorioItensClassificadosPDF = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string,
	planoContasId?: number
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);
	if (planoContasId) params.append('planoContasId', planoContasId.toString());

	const res = await fetch(`${API_URL}/api/relatorio/itens-classificados/pdf?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de itens classificados para PDF');
	return res.blob();
};

export type ModalidadeFinanciamento = 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR' | 'RENEGOCIACAO';

/** Tomador value that selects the contracts without responsável (same constant as the backend) */
export const SEM_TOMADOR_FINANCIAMENTO = 'Sem tomador';

export interface FiltrosRelatorioFinanciamentos {
	/** Year of the "Compromissos financeiros de <ano>" chart */
	ano: number;
	/** Period [inicio, fim) as AAAA-MM-DD, fim exclusive (contratados, liquidados, novos x liquidados) */
	inicio: string;
	fim: string;
	idBanco?: number;
	tomador?: string; // Financiamento.responsavel
	numeroGarantia?: string;
	modalidade?: ModalidadeFinanciamento;
	faixaJuros?: string;
}

export interface ParcelaRelatorioFinanciamentos {
	idParcela: number;
	numParcela: number;
	valor: number;
	dt_vencimento: string;
	status: string;
	dt_liquidacao?: string;
}

export interface ContratoRelatorioFinanciamentos {
	idFinanciamento: number;
	numeroContrato: string;
	tomador: string;
	credor: string;
	dataContrato: string;
	valorContrato: number;
	totalJuros: number;
	modalidade?: string;
	nomeModalidadeParticular?: string;
	numeroGarantia?: string;
	taxaJurosAnual?: number;
	ativo: boolean;
	/** Sum of the parcelas not liquidated (the value that prevails) */
	valorVincendo: number;
	valorPago: number;
	parcelasAbertas: number;
	dataQuitacao?: string;
	parcelas: ParcelaRelatorioFinanciamentos[];
}

/** A contract inside a view or chart bar, with the value it adds there */
export interface ValorContratoFinanciamento {
	idFinanciamento: number;
	valor: number;
	quitado?: boolean;
}

export interface BlocoContratosFinanciamento {
	quantidade: number;
	valor: number;
	valorContratos: number;
	contratos: ValorContratoFinanciamento[];
}

export interface PontoGraficoFinanciamento {
	valor: number;
	contratos: ValorContratoFinanciamento[];
}

export interface RelatorioFinanciamentosData {
	periodo: { ano: number; inicio: string; fim: string; ultimoDia: string };
	hoje: string;
	tomadores: string[];
	contratos: ContratoRelatorioFinanciamentos[];
	ativos: BlocoContratosFinanciamento;
	contratados: BlocoContratosFinanciamento;
	liquidados: BlocoContratosFinanciamento & { quitados: number; amortizados: number; valorVincendo: number };
	porTomador: {
		grupos: Array<{ tomador: string; quantidade: number; valor: number; valorContratos: number; contratos: ValorContratoFinanciamento[] }>;
		quantidade: number;
		valor: number;
		valorContratos: number;
	};
	graficos: {
		novosXLiquidados: Array<{ ano: number; mes: number; novos: PontoGraficoFinanciamento; liquidados: PontoGraficoFinanciamento }>;
		compromissosDoAno: { ano: number; meses: Array<{ mes: number } & PontoGraficoFinanciamento> };
		compromissosPorAno: Array<{ ano: number } & PontoGraficoFinanciamento>;
	};
}

export const getRelatorioFinanciamentos = async (
	filtros: FiltrosRelatorioFinanciamentos
): Promise<RelatorioFinanciamentosData> => {
	const params = new URLSearchParams();
	params.append('ano', filtros.ano.toString());
	params.append('inicio', filtros.inicio);
	params.append('fim', filtros.fim);
	if (filtros.idBanco) params.append('idBanco', filtros.idBanco.toString());
	if (filtros.tomador) params.append('tomador', filtros.tomador);
	if (filtros.numeroGarantia) params.append('numeroGarantia', filtros.numeroGarantia);
	if (filtros.modalidade) params.append('modalidade', filtros.modalidade);
	if (filtros.faixaJuros) params.append('faixaJuros', filtros.faixaJuros);

	const res = await fetch(`${API_URL}/api/relatorio/financiamentos?${params}`);
	if (!res.ok) throw new Error('Erro ao buscar relatório de financiamentos');
	return res.json();
};
