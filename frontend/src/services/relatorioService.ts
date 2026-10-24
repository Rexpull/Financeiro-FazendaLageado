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
	/** Classified only by cost centre (normal for receitas) */
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
	status?: string
): Promise<RelatorioItensClassificadosItem[]> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);

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
	status?: string
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);

	const res = await fetch(`${API_URL}/api/relatorio/itens-classificados/excel?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de itens classificados para Excel');
	return res.blob();
};

export const exportRelatorioItensClassificadosPDF = async (
	dataInicio?: string,
	dataFim?: string,
	contaId?: number,
	status?: string
): Promise<Blob> => {
	const params = new URLSearchParams();
	if (dataInicio) params.append('dataInicio', dataInicio);
	if (dataFim) params.append('dataFim', dataFim);
	if (contaId) params.append('contaId', contaId.toString());
	if (status) params.append('status', status);

	const res = await fetch(`${API_URL}/api/relatorio/itens-classificados/pdf?${params}`);
	if (!res.ok) throw new Error('Erro ao exportar relatório de itens classificados para PDF');
	return res.blob();
};

export type StatusContratoFinanciamento = 'NOVO' | 'ATIVO' | 'QUITADO';
export type ModalidadeFinanciamento = 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR' | 'RENEGOCIACAO';

export interface FiltrosRelatorioFinanciamentos {
	ano: number;
	mes?: number; // 1..12; sem mês = ano inteiro
	idBanco?: number;
	tomador?: string; // Financiamento.responsavel
	numeroGarantia?: string;
	modalidade?: ModalidadeFinanciamento;
	faixaJuros?: string;
	statusContrato?: StatusContratoFinanciamento;
}

export interface ItemRelatorioFinanciamentos {
	idFinanciamento: number;
	numeroContrato: string;
	responsavel: string; // tomador
	banco?: string;
	pessoa?: string;
	dataContrato: string;
	valorContrato: number;
	totalJuros: number;
	valorTotal: number;
	modalidade?: string;
	nomeModalidadeParticular?: string;
	numeroGarantia?: string;
	taxaJurosAnual?: number;
	statusContrato: StatusContratoFinanciamento;
	valor: number; // NOVO: valor do contrato; ATIVO: parcelas não liquidadas; QUITADO: valor pago
	valorPago: number;
	valorVincendo: number;
	dataQuitacao?: string;
	parcelas: Array<{
		idParcela: number;
		numParcela: number;
		valor: number;
		dt_vencimento: string;
		status: string;
		dt_liquidacao?: string;
	}>;
}

export interface TotalizadoresRelatorioFinanciamentos {
	totalContratos: number;
	totalValorContratos: number;
	totalJuros: number;
	totalValor: number;
	totalValorParcelas: number;
	totalParcelas: number;
	totalParcelasLiquidadas: number;
	totalParcelasAberto: number;
	totalParcelasVencidas: number;
}

export interface RelatorioFinanciamentosData {
	periodo: { ano: number; mes: number | null; inicio: string; fim: string };
	tomadores: string[];
	itens: ItemRelatorioFinanciamentos[];
	totalizadores: TotalizadoresRelatorioFinanciamentos;
	resumoStatus: Record<StatusContratoFinanciamento, { quantidade: number; valor: number }>;
	graficos: {
		mensal: Array<{ mes: number; novos: number; liquidados: number; compromissos: number }>;
		compromissosPorAno: Array<{ ano: number; valor: number }>;
		liquidadosPorAno: Array<{ ano: number; valor: number }>;
	};
}

export const getRelatorioFinanciamentos = async (
	filtros: FiltrosRelatorioFinanciamentos
): Promise<RelatorioFinanciamentosData> => {
	const params = new URLSearchParams();
	params.append('ano', filtros.ano.toString());
	if (filtros.mes) params.append('mes', filtros.mes.toString());
	if (filtros.idBanco) params.append('idBanco', filtros.idBanco.toString());
	if (filtros.tomador) params.append('tomador', filtros.tomador);
	if (filtros.numeroGarantia) params.append('numeroGarantia', filtros.numeroGarantia);
	if (filtros.modalidade) params.append('modalidade', filtros.modalidade);
	if (filtros.faixaJuros) params.append('faixaJuros', filtros.faixaJuros);
	if (filtros.statusContrato) params.append('statusContrato', filtros.statusContrato);

	const res = await fetch(`${API_URL}/api/relatorio/financiamentos?${params}`);
	if (!res.ok) throw new Error('Erro ao buscar relatório de financiamentos');
	return res.json();
};
