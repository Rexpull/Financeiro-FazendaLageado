import { MovimentoBancario } from "../../../backend/src/models/MovimentoBancario";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

export const listarMovimentosBancarios = async (): Promise<MovimentoBancario[]> => {
	const res = await fetch(`${API_URL}/api/movBancario`);
	if (!res.ok) throw new Error(`Erro ao listar movimentos bancários`);
	return res.json();
};

export const salvarMovimentoBancario = async (movimento: MovimentoBancario): Promise<{ id: number }> => {
	const method = movimento.id ? "PUT" : "POST";
	const url = movimento.id ? `${API_URL}/api/movBancario/${movimento.id}` : `${API_URL}/api/movBancario`;

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(movimento),
	});

	if (!res.ok) throw new Error("Erro ao salvar movimento bancário");
	return res.json();
};

export const excluirMovimentoBancario = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/movBancario/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Erro ao excluir movimento bancário");
};

export const atualizarStatusIdeagro = async (id: number, ideagro: boolean): Promise<void> => {
	try {

		const res = await fetch(`${API_URL}/api/movBancario/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ideagro }),
		});

		if (!res.ok) throw new Error("Erro ao atualizar status IdeAgro");

		if (ideagro) {
			toast.success(`Movimento conciliado com sucesso!`);
		}
	} catch (error) {
		toast.error("Erro ao atualizar status da conta!");
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
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (res.ok) toast.success("Transferência realizada com sucesso!");

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		console.error("Erro Backend Transfer:", errorData);
		toast.error(errorData.message || "Erro ao realizar transferência!");
		throw new Error(errorData.message || "Erro ao realizar transferência bancária");
	}

	return res.json();
};


export const buscarSaldoContaCorrente = async (idConta: number) => {
	const res = await fetch(`${API_URL}/api/movBancario/saldo/${idConta}`);
	if (!res.ok) throw new Error("Erro ao buscar saldo da conta");
	return res.json();
};


