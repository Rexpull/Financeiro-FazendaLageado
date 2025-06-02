import { MovimentoBancario } from '../../../backend/src/models/MovimentoBancario';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL;

export const listarMovimentosBancarios = async (): Promise<MovimentoBancario[]> => {
	const res = await fetch(`${API_URL}/api/movBancario`);
	if (!res.ok) throw new Error(`Erro ao listar movimentos bancários`);
	return res.json();
};

export const salvarMovimentoBancario = async (movimento: MovimentoBancario): Promise<{ id: number }> => {
	try {
		if (movimento.tipoMovimento === 'D' && movimento.valor > 0) {
			movimento.valor = -Math.abs(movimento.valor);
		}

		const method = movimento.id ? 'PUT' : 'POST';
		const url = movimento.id ? `${API_URL}/api/movBancario/${movimento.id}` : `${API_URL}/api/movBancario`;

		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(movimento),
		});

		if (!res.ok) throw new Error('Erro ao salvar movimento bancário');
		toast.success(`Movimento criado com sucesso!`);

		return res.json();
	} catch (error) {
		console.error('Erro ao salvar movimento bancário:', error);
		// toast.error(`Falha na criação no movimento!`);
	}
};

export const salvarMovimentosOFX = async (
	movimentos: MovimentoBancario[],
	idContaCorrente: number,
	setCurrentIndex?: (i: number) => void,
	setNovosExistentes?: (novos: number, existentes: number) => void
): Promise<MovimentoBancario[]> => {
	const movimentosFinal: MovimentoBancario[] = [];
	let novos = 0;
	let encontrados = 0;

	console.log('Movimentos a serem salvos:', movimentos);
	for (let i = 0; i < movimentos.length; i++) {
		const mov = movimentos[i];

		if (mov.tipoMovimento === 'D' && mov.valor > 0) {
			mov.valor = -Math.abs(mov.valor);
		}

		try {
			const movComConta: MovimentoBancario = {
				...mov,
				idContaCorrente,
				saldo: mov.saldo ?? 0,
				modalidadeMovimento: mov.modalidadeMovimento ?? 'padrao',
				ideagro: mov.ideagro ?? false,
				parcelado: mov.parcelado ?? false,
				numeroDocumento: mov.numeroDocumento ?? null,
				descricao: mov.descricao ?? null,
				transfOrigem: mov.transfOrigem ?? null,
				transfDestino: mov.transfDestino ?? null,
				idBanco: mov.idBanco ?? null,
				idPessoa: mov.idPessoa ?? null,
				idPlanoContas: mov.idPlanoContas ?? null,
				idUsuario: mov.idUsuario ?? null,
				criadoEm: '',
				atualizadoEm: '',
			};

			Object.keys(movComConta).forEach((key) => {
				if (movComConta[key as keyof MovimentoBancario] === undefined) {
					delete movComConta[key as keyof MovimentoBancario];
				}
			});

			const response = await fetch(`${API_URL}/api/movBancario`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(movComConta),
			});

			const data: MovimentoBancario = await response.json();

			if (response.ok && data?.id) {
				movimentosFinal.push(data);
				if (response.status === 200) {
					encontrados++;
				} else if (response.status === 201) {
					novos++;
				}
			} else {
				console.warn('Movimento não salvo, response:', response.status, data);
			}
		} catch (error) {
			toast.error(`Erro ao salvar movimento bancário: ${error}`);
			console.error('Erro ao salvar/verificar movimento OFX:', error);
		}

		setCurrentIndex?.(i + 1);
		setNovosExistentes?.(novos, encontrados);
	}
	console.log('Movimentos salvos:', movimentosFinal);
	return movimentosFinal;
};

export const buscarMovimentoBancarioById = async (id: number): Promise<MovimentoBancario> => {
	const res = await fetch(`${API_URL}/api/movBancario/${id}`);
	if (!res.ok) throw new Error(`Erro ao buscar movimento bancário id ${id}`);
	return res.json();
};

export const excluirMovimentoBancario = async (id: number): Promise<void> => {
	try {
		const res = await fetch(`${API_URL}/api/movBancario/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Erro ao excluir movimento bancário');
		toast.success('Movimento excluido com sucesso!');
	} catch (error) {
		toast.error(`Falha na exclusão do movimento!`);
	}
};

export const atualizarStatusIdeagro = async (id: number, ideagro: boolean): Promise<any> => {
	try {
		const res = await fetch(`${API_URL}/api/movBancario/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ideagro }),
		});

		if (!res.ok) throw new Error('Erro ao atualizar status IdeAgro');

		const data = await res.json();

		if (ideagro) {
			toast.success(`Movimento conciliado com sucesso!`);
		}

		return data;
	} catch (error) {
		toast.error('Erro ao atualizar status da conta!');
		throw error;
	}
};

export const transferirMovimentoBancario = async (payload: {
	contaOrigemId: number;
	contaOrigemDescricao: string;
	contaDestinoId: number;
	contaDestinoDescricao: string;
	valor: number;
	descricao: string;
	data: string;
	idUsuario: number;
}): Promise<{ message: string }> => {
	const res = await fetch(`${API_URL}/api/movBancario/transfer`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (res.ok) toast.success('Transferência realizada com sucesso!');

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		console.error('Erro Backend Transfer:', errorData);
		toast.error(errorData.message || 'Erro ao realizar transferência!');
		throw new Error(errorData.message || 'Erro ao realizar transferência bancária');
	}

	return res.json();
};

export const buscarSaldoContaCorrente = async (idConta: number, data: string) => {
	const res = await fetch(`${API_URL}/api/movBancario/saldo/${idConta}?data=${encodeURIComponent(data)}`);
	if (!res.ok) throw new Error('Erro ao buscar saldo da conta');
	return res.json();
};
