import { Financiamento } from "../../../backend/src/models/Financiamento";

const API_URL = import.meta.env.VITE_API_URL;

export const listarFinanciamentos = async (): Promise<Financiamento[]> => {
	const res = await fetch(`${API_URL}/api/financiamento`);
	if (!res.ok) throw new Error("Erro ao listar financiamentos");
	return res.json();
};

export const salvarFinanciamento = async (financiamento: Financiamento): Promise<{ id: number }> => {
	const method = financiamento.id ? "PUT" : "POST";
	const url = financiamento.id ? `${API_URL}/api/financiamento/${financiamento.id}` : `${API_URL}/api/financiamento`;

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(financiamento),
	});

	if (!res.ok) throw new Error("Erro ao salvar financiamento");
	return res.json();
};

export const excluirFinanciamento = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/financiamento/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Erro ao excluir financiamento");
};
