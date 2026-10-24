import { Financiamento } from "../../../backend/src/models/Financiamento";
import { ParcelaFinanciamento } from "../../../backend/src/models/ParcelaFinanciamento";
import { statusParcelaEmAberto } from "../pages/Financeiro/Financiamento/parcelaRegras";

const API_URL = import.meta.env.VITE_API_URL;

const validarStatusParcela = (parcela: ParcelaFinanciamento): ParcelaFinanciamento => {
	// Se a parcela já estiver liquidada, mantém o status
	if (parcela.status === 'Liquidado') {
		return parcela;
	}
	// Dia local lido do texto (new Date('AAAA-MM-DD') é meia-noite UTC: no Brasil vira o dia anterior
	// e a parcela que vence hoje aparecia como Vencido)
	return { ...parcela, status: statusParcelaEmAberto(parcela.dt_vencimento) };
};

export const listarFinanciamentos = async (): Promise<Financiamento[]> => {
	const res = await fetch(`${API_URL}/api/financiamento`);
	if (!res.ok) throw new Error("Erro ao listar financiamentos");
	return res.json();
};

export const salvarFinanciamento = async (financiamento: Financiamento): Promise<{ id: number }> => {
  try {
    const method = financiamento.id ? "PUT" : "POST";
    const url = financiamento.id
      ? `${API_URL}/api/financiamento/${financiamento.id}`
      : `${API_URL}/api/financiamento`;

    // Valida o status de todas as parcelas antes de salvar
    const financiamentoValidado = {
      ...financiamento,
      parcelasList: financiamento.parcelasList?.map(parcela => validarStatusParcela(parcela))
    };

    console.log("Enviando dados:", JSON.stringify(financiamentoValidado, null, 2));

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(financiamentoValidado),
    });

    if (!res.ok) {
      const errorData = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
      console.error("Erro na resposta:", {
        status: res.status,
        statusText: res.statusText,
        errorData
      });
      throw new Error(errorData?.details || errorData?.error || "Erro ao salvar financiamento");
    }

    const data = (await res.json()) as { id?: number };
    return { id: data.id || (financiamento.id as number) };
  } catch (error) {
    console.error("Erro ao salvar financiamento:", error);
    throw error;
  }
};

export const excluirFinanciamento = async (id: number): Promise<void> => {
  // The API deletes the contract and its parcelas atomically and answers 409 (with a message)
  // when bank movements are linked to it.
  const res = await fetch(`${API_URL}/api/financiamento/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
    throw new Error(data?.error || data?.details || "Erro ao excluir financiamento");
  }
};
