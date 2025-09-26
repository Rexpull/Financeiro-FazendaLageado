import { HistoricoImportacaoOFX } from '../../../backend/src/models/HistoricoImportacaoOFX';

const API_URL = import.meta.env.VITE_API_URL;

export interface HistoricoImportacaoOFXCreate {
	idUsuario: number;
	nomeArquivo: string;
	dataImportacao: string;
	idMovimentos: number[];
	totalizadores: {
		receitas: number;
		despesas: number;
		liquido: number;
		saldoFinal: number;
		dtInicialExtrato: string;
		dtFinalExtrato: string;
	};
	novosMovimentos: number;
	existentesMovimentos: number;
	idContaCorrente: number;
}

export const listarHistoricoImportacoes = async (idUsuario: number): Promise<HistoricoImportacaoOFX[]> => {
	try {
		console.log(`📥 Buscando histórico de importações para usuário ${idUsuario}`);
		
		const res = await fetch(`${API_URL}/api/historico-importacao-ofx?idUsuario=${idUsuario}`);
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Erro ao buscar histórico de importações');
		}
		
		const historico = await res.json() as HistoricoImportacaoOFX[];
		console.log(`✅ ${historico.length} registros de histórico encontrados`);
		
		return historico;
	} catch (error) {
		console.error('❌ Erro ao buscar histórico de importações:', error);
		throw error;
	}
};

export const criarHistoricoImportacao = async (historico: HistoricoImportacaoOFXCreate): Promise<{ id: number }> => {
	try {
		console.log('📥 Criando histórico de importação:', historico);
		
		const res = await fetch(`${API_URL}/api/historico-importacao-ofx`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(historico),
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Erro ao criar histórico de importação');
		}
		
		const resultado = await res.json() as { id: number };
		console.log(`✅ Histórico de importação criado com ID: ${resultado.id}`);
		
		return resultado;
	} catch (error) {
		console.error('❌ Erro ao criar histórico de importação:', error);
		throw error;
	}
};

export const limparHistoricoImportacoes = async (idUsuario: number): Promise<void> => {
	try {
		console.log(`🗑️ Limpando histórico de importações para usuário ${idUsuario}`);
		
		const res = await fetch(`${API_URL}/api/historico-importacao-ofx?idUsuario=${idUsuario}`, {
			method: 'DELETE',
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Erro ao limpar histórico de importações');
		}
		
		console.log('✅ Histórico de importações limpo com sucesso');
	} catch (error) {
		console.error('❌ Erro ao limpar histórico de importações:', error);
		throw error;
	}
};

export const deletarHistoricoImportacao = async (id: number, idUsuario: number): Promise<void> => {
	try {
		console.log(`🗑️ Deletando histórico de importação ${id} do usuário ${idUsuario}`);
		
		const res = await fetch(`${API_URL}/api/historico-importacao-ofx/${id}?idUsuario=${idUsuario}`, {
			method: 'DELETE',
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Erro ao deletar histórico de importação');
		}
		
		console.log('✅ Histórico de importação deletado com sucesso');
	} catch (error) {
		console.error('❌ Erro ao deletar histórico de importação:', error);
		throw error;
	}
};
