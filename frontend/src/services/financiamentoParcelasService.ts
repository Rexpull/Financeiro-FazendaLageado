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

	// Converter valor para número, tratando strings com vírgula
	let valorConvertido: number;
	if (typeof parcela.valor === 'string') {
		// Remove pontos e substitui vírgula por ponto
		valorConvertido = parseFloat(parcela.valor.replace(/\./g, '').replace(',', '.'));
	} else {
		valorConvertido = Number(parcela.valor);
	}

	// Validar se o valor é válido
	if (isNaN(valorConvertido) || valorConvertido < 0) {
		throw new Error(`Valor inválido para parcela ${parcela.numParcela}: ${parcela.valor}`);
	}

	const parcelaAtualizada = {
		...parcela,
		valor: valorConvertido,
		dt_liquidacao: parcela.status === 'Liquidado' ? parcela.dt_liquidacao : null
	};

	console.log(`💾 Salvando parcela ${parcela.numParcela}:`, {
		valorOriginal: parcela.valor,
		valorConvertido,
		tipoOriginal: typeof parcela.valor,
		parcelaAtualizada
	});

	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(parcelaAtualizada),
	});

	if (!res.ok) {
		const errorData = await res.json().catch(() => null);
		console.error(`❌ Erro ao salvar parcela ${parcela.numParcela}:`, errorData);
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

