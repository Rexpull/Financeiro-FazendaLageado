import { ParcelaFinanciamento } from '../../../../backend/src/models/ParcelaFinanciamento';

const API_URL = import.meta.env.VITE_API_URL;

const validarStatusParcela = (parcela: ParcelaFinanciamento): ParcelaFinanciamento => {
	// Se a parcela já estiver liquidada, mantém o status
	if (parcela.status === 'Liquidado') {
		return parcela;
	}

	// Verifica se a data de vencimento é menor que a data atual
	const dataVencimento = new Date(parcela.dt_vencimento);
	const dataAtual = new Date();
	
	// Ajusta as datas para comparar apenas dia/mês/ano
	dataVencimento.setHours(0, 0, 0, 0);
	dataAtual.setHours(0, 0, 0, 0);
	
	// Se a data de vencimento for menor que a data atual, marca como vencido
	if (dataVencimento < dataAtual) {
		return {
			...parcela,
			status: 'Vencido'
		};
	}

	// Se não estiver vencido, mantém como aberto
	return {
		...parcela,
		status: 'Aberto'
	};
};

export const salvarParcelaFinanciamento = async (parcela: ParcelaFinanciamento): Promise<ParcelaFinanciamento> => {
	try {
		// Valida o status da parcela antes de salvar
		const parcelaValidada = validarStatusParcela(parcela);

		const response = await fetch(`${API_URL}/api/parcelaFinanciamento${parcela.id ? `/${parcela.id}` : ''}`, {
			method: parcela.id ? 'PUT' : 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(parcelaValidada),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ message: 'Erro ao salvar parcela' }));
			throw new Error(errorData.message || 'Erro ao salvar parcela');
		}

		return await response.json();
	} catch (error) {
		console.error('Erro ao salvar parcela:', error);
		throw error;
	}
};

export const excluirParcelaFinanciamento = async (id: number): Promise<void> => {
	try {
		const response = await fetch(`${API_URL}/api/parcelaFinanciamento/${id}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ message: 'Erro ao excluir parcela' }));
			throw new Error(errorData.message || 'Erro ao excluir parcela');
		}
	} catch (error) {
		console.error('Erro ao excluir parcela:', error);
		throw error;
	}
};

export const listarParcelasFinanciamento = async (idFinanciamento: number): Promise<ParcelaFinanciamento[]> => {
	try {
		const response = await fetch(`${API_URL}/api/parcelaFinanciamento/financiamento/${idFinanciamento}`);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ message: 'Erro ao listar parcelas' }));
			throw new Error(errorData.message || 'Erro ao listar parcelas');
		}

		return await response.json();
	} catch (error) {
		console.error('Erro ao listar parcelas:', error);
		throw error;
	}
}; 