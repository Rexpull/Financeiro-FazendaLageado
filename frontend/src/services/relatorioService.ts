const API_URL = import.meta.env.VITE_API_URL;

export interface RelatorioCentroCustosItem {
	centro: {
		id: number;
		descricao: string;
		tipo?: string;
		tipoReceitaDespesa?: string;
	};
	total: number;
	movimentos: Array<{
		id: number;
		dtMovimento: string;
		historico: string;
		valor: number;
		tipoMovimento: string;
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

export interface FiltrosRelatorioFinanciamentos {
	mesVencimento?: number;
	anoVencimento?: number;
	idBanco?: number;
	idPessoa?: number;
	numeroGarantia?: string;
	modalidade?: 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR';
	dataContratoInicio?: string;
	dataContratoFim?: string;
	faixaJuros?: string;
	statusContrato?: 'ATIVO' | 'QUITADO' | 'NOVO';
}

export interface ItemRelatorioFinanciamentos {
	idFinanciamento: number;
	numeroContrato: string;
	responsavel: string;
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
	statusContrato?: 'ATIVO' | 'QUITADO' | 'NOVO';
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
	totalValorParcelas: number;
	totalParcelas: number;
	totalParcelasLiquidadas: number;
	totalParcelasAberto: number;
	totalParcelasVencidas: number;
}

export interface RelatorioFinanciamentosData {
	itens: ItemRelatorioFinanciamentos[];
	totalizadores: TotalizadoresRelatorioFinanciamentos;
	graficos: {
		mensais: Array<{ mes: string; novos: number; quitados: number; ativos: number }>;
		anuais: Array<{ ano: number; novos: number; quitados: number; ativos: number }>;
	};
}

export const getRelatorioFinanciamentos = async (
	filtros: FiltrosRelatorioFinanciamentos
): Promise<RelatorioFinanciamentosData> => {
	const params = new URLSearchParams();
	if (filtros.mesVencimento) params.append('mesVencimento', filtros.mesVencimento.toString());
	if (filtros.anoVencimento) params.append('anoVencimento', filtros.anoVencimento.toString());
	if (filtros.idBanco) params.append('idBanco', filtros.idBanco.toString());
	if (filtros.idPessoa) params.append('idPessoa', filtros.idPessoa.toString());
	if (filtros.numeroGarantia) params.append('numeroGarantia', filtros.numeroGarantia);
	if (filtros.modalidade) params.append('modalidade', filtros.modalidade);
	if (filtros.dataContratoInicio) params.append('dataContratoInicio', filtros.dataContratoInicio);
	if (filtros.dataContratoFim) params.append('dataContratoFim', filtros.dataContratoFim);
	if (filtros.faixaJuros) params.append('faixaJuros', filtros.faixaJuros);
	if (filtros.statusContrato) params.append('statusContrato', filtros.statusContrato);

	const res = await fetch(`${API_URL}/api/relatorio/financiamentos?${params}`);
	if (!res.ok) throw new Error('Erro ao buscar relatório de financiamentos');
	return res.json();
};

