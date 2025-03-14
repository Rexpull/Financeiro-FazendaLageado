import { MovimentoBancario } from "../../../backend/src/models/MovimentoBancario";

const API_URL = import.meta.env.VITE_API_URL;

export const listarMovimentosBancarios = async (): Promise<MovimentoBancario[]> => {
	const res = await fetch(`${API_URL}/api/movBancario`);
	if (!res.ok) throw new Error(`Erro ao listar movimentos bancários`);
	return res.json();
};

export const salvarMovimentoBancario = async (movimento: MovimentoBancario): Promise<void> => {
	const method = movimento.id ? "PUT" : "POST";
	const url = movimento.id ? `${API_URL}/api/movBancario/${movimento.id}` : `${API_URL}/api/movBancario`;

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(movimento),
	});

	if (!res.ok) throw new Error("Erro ao salvar movimento bancário");
};

export const excluirMovimentoBancario = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/movBancario/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Erro ao excluir movimento bancário");
};

