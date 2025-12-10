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
	planoDescricao?: string;
	centroCustosDescricao?: string;
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

