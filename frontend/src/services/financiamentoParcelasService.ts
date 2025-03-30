import { ParcelaFinanciamento } from "../../../backend/src/models/ParcelaFinanciamento";

const API_URL = import.meta.env.VITE_API_URL;

export const listarParcelaFinanciamentos = async (): Promise<ParcelaFinanciamento[]> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento`);
	if (!res.ok) throw new Error(`Erro ao listar parcelas do financiamento`);
	return res.json();
};

export const salvarParcelaFinanciamento = async (parcela: ParcelaFinanciamento): Promise<{ id: number }> => {
	const method = parcela.id ? "PUT" : "POST";
	const url = parcela.id ? `${API_URL}/api/parcelaFinanciamento/${parcela.id}` : `${API_URL}/api/parcelaFinanciamento`;

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(parcela),
	});

	if (!res.ok) throw new Error("Erro ao salvar Parcela do Financiamento");
	return res.json();
};

export const excluirParcelaFinanciamento = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Erro ao excluir Parcela do Financiamento");
};

