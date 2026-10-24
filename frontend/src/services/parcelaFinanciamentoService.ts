import { ParcelaFinanciamento } from '../../../backend/src/models/ParcelaFinanciamento';
import { statusParcelaEmAberto } from '../pages/Financeiro/Financiamento/parcelaRegras';

const API_URL = import.meta.env.VITE_API_URL;

const validarStatusParcela = (parcela: ParcelaFinanciamento): ParcelaFinanciamento => {
	// Se a parcela já estiver liquidada, mantém o status
	if (parcela.status === 'Liquidado') {
		return parcela;
	}
	// Vencido/Aberto by local calendar day read from the text: new Date('YYYY-MM-DD') is UTC midnight,
	// which in UTC-3 is the previous day and marked an installment due TODAY as Vencido.
	return { ...parcela, status: statusParcelaEmAberto(parcela.dt_vencimento) };
};

export const salvarParcelaFinanciamento = async (parcela: ParcelaFinanciamento): Promise<ParcelaFinanciamento> => {
	try {
		// Valida o status da parcela antes de salvar
		const parcelaValidada = validarStatusParcela(parcela);

		const existingId = parcela.id != null && parcela.id > 0 ? parcela.id : null;
		const response = await fetch(`${API_URL}/api/parcelaFinanciamento${existingId ? `/${existingId}` : ''}`, {
			method: existingId ? 'PUT' : 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(parcelaValidada),
		});

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({ message: 'Erro ao salvar parcela' }))) as { message?: string; error?: string; details?: string };
			throw new Error(errorData.details || errorData.error || errorData.message || 'Erro ao salvar parcela');
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
			const errorData = (await response.json().catch(() => ({ message: 'Erro ao excluir parcela' }))) as { message?: string; error?: string; details?: string };
			throw new Error(errorData.details || errorData.error || errorData.message || 'Erro ao excluir parcela');
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
			const errorData = (await response.json().catch(() => ({ message: 'Erro ao listar parcelas' }))) as { message?: string; error?: string; details?: string };
			throw new Error(errorData.details || errorData.error || errorData.message || 'Erro ao listar parcelas');
		}

		return await response.json();
	} catch (error) {
		console.error('Erro ao listar parcelas:', error);
		throw error;
	}
}; 