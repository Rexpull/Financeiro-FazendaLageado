import { ParcelaFinanciamento } from "../../../backend/src/models/ParcelaFinanciamento";

const API_URL = import.meta.env.VITE_API_URL;

export const listarParcelaFinanciamentos = async (): Promise<ParcelaFinanciamento[]> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento`);
	if (!res.ok) throw new Error(`Erro ao listar parcelas do financiamento`);
	return res.json();
};

export const salvarParcelaFinanciamento = async (parcela: ParcelaFinanciamento): Promise<ParcelaFinanciamento> => {
	const method = parcela.id ? "PUT" : "POST";
	const url = parcela.id ? `${API_URL}/api/parcelaFinanciamento/${parcela.id}` : `${API_URL}/api/parcelaFinanciamento`;

	const parcelaAtualizada = {
		...parcela,
		valor: Number(parcela.valor),
		dt_liquidacao: parcela.status === 'Liquidado' ? parcela.dt_liquidacao : null
	};

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(parcelaAtualizada),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => null);
		throw new Error(errorData?.details || errorData?.error || "Erro ao salvar Parcela do Financiamento");
	}

	const data = await res.json();
	return { ...parcelaAtualizada, id: data.id };
};

export const verificarParcelasAssociadas = async (idMovimentoBancario: number) => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento/${idMovimentoBancario}`);
	const parcelas: ParcelaFinanciamento[] = await res.json();
	return parcelas.length > 0; 
};

export const excluirParcelaFinanciamento = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error("Erro ao excluir Parcela do Financiamento");
};

