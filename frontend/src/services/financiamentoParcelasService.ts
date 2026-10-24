import { ParcelaFinanciamento } from "../../../backend/src/models/ParcelaFinanciamento";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Without arguments lists every parcela. With `filtro`, lists only the parcelas of one contract
 * (`idFinanciamento`) or the ones linked to one bank movement (`idMovimentoBancario`).
 */
export const listarParcelaFinanciamentos = async (
	filtro?: { idFinanciamento?: number | null; idMovimentoBancario?: number | null },
): Promise<ParcelaFinanciamento[]> => {
	let url = `${API_URL}/api/parcelaFinanciamento`;
	if (filtro?.idFinanciamento) url += `/financiamento/${filtro.idFinanciamento}`;
	else if (filtro?.idMovimentoBancario) url += `/${filtro.idMovimentoBancario}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Erro ao listar parcelas do financiamento`);
	return res.json();
};

export const salvarParcelaFinanciamento = async (parcela: ParcelaFinanciamento): Promise<ParcelaFinanciamento> => {
	const existingId = parcela.id != null && parcela.id > 0 ? parcela.id : null;
	const method = existingId ? "PUT" : "POST";
	const url = existingId ? `${API_URL}/api/parcelaFinanciamento/${existingId}` : `${API_URL}/api/parcelaFinanciamento`;

	// Converter valor para número, tratando strings com vírgula
	let valorConvertido: number;
	const valorBruto: unknown = parcela.valor;
	if (typeof valorBruto === 'string') {
		// Remove pontos e substitui vírgula por ponto
		valorConvertido = parseFloat(valorBruto.replace(/\./g, '').replace(',', '.'));
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
		const errorData = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
		console.error(`❌ Erro ao salvar parcela ${parcela.numParcela}:`, errorData);
		throw new Error(errorData?.details || errorData?.error || "Erro ao salvar Parcela do Financiamento");
	}

	const data = await res.json();
	const id = (data as { id?: number }).id ?? existingId ?? parcelaAtualizada.id;
	return { ...parcelaAtualizada, id: id as number };
};

async function mensagemDaApi(res: Response, padrao: string): Promise<string> {
	const body = (await res.json().catch(() => null)) as { error?: unknown; message?: unknown; details?: unknown } | null;
	const detalhe = [body?.error, body?.message, body?.details].find((v) => typeof v === "string" && v.trim());
	return (detalhe as string | undefined) ?? `${padrao} (HTTP ${res.status})`;
}

/** True when parcelas are linked to the movement. Throws when the check itself fails (never "no parcelas" by accident). */
export const verificarParcelasAssociadas = async (idMovimentoBancario: number): Promise<boolean> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento/${idMovimentoBancario}`);
	if (!res.ok) throw new Error(await mensagemDaApi(res, "Erro ao verificar as parcelas vinculadas ao movimento"));
	const parcelas = (await res.json()) as ParcelaFinanciamento[];
	return Array.isArray(parcelas) && parcelas.length > 0;
};

/** The API refuses (409) liquidated/linked parcelas with a Portuguese message, surfaced here. */
export const excluirParcelaFinanciamento = async (id: number): Promise<void> => {
	const res = await fetch(`${API_URL}/api/parcelaFinanciamento/${id}`, { method: "DELETE" });
	if (!res.ok) throw new Error(await mensagemDaApi(res, "Erro ao excluir Parcela do Financiamento"));
};

