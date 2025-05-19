import { Financiamento } from "../../../backend/src/models/Financiamento";
import { ParcelaFinanciamento } from "../../../backend/src/models/ParcelaFinanciamento";
import { excluirParcelaFinanciamento } from "./financiamentoParcelasService";

const API_URL = import.meta.env.VITE_API_URL;

const validarStatusParcela = (parcela: ParcelaFinanciamento): ParcelaFinanciamento => {
	// Se a parcela já estiver liquidada, mantém o status
	if (parcela.status === 'Liquidado') {
		return parcela;
	}

	// Verifica se a data de vencimento é menor que a data atual
	const dataVencimento = new Date(parcela.dt_vencimento);
	const dataAtual = new Date();
	
	// Ajusta as datas para comparar apenas dia/mês/ano
	dataVencimento.setHours(0, 0, 0, 0);
	dataAtual.setHours(0, 0, 0, 0);
	
	// Se a data de vencimento for menor que a data atual, marca como vencido
	if (dataVencimento < dataAtual) {
		return {
			...parcela,
			status: 'Vencido'
		};
	}

	// Se não estiver vencido, mantém como aberto
	return {
		...parcela,
		status: 'Aberto'
	};
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
      const errorData = await res.json().catch(() => null);
      console.error("Erro na resposta:", {
        status: res.status,
        statusText: res.statusText,
        errorData
      });
      throw new Error(errorData?.details || errorData?.error || "Erro ao salvar financiamento");
    }

    const data = await res.json();
    return { id: data.id || financiamento.id };
  } catch (error) {
    console.error("Erro ao salvar financiamento:", error);
    throw error;
  }
};

export const excluirFinanciamento = async (id: number): Promise<void> => {
  try {
    // Primeiro, buscar o financiamento para obter suas parcelas
    const res = await fetch(`${API_URL}/api/financiamento/${id}`);
    if (!res.ok) throw new Error("Erro ao buscar financiamento");
    
    const financiamento: Financiamento = await res.json();
    
    // Excluir todas as parcelas associadas
    if (financiamento.parcelasList && financiamento.parcelasList.length > 0) {
      await Promise.all(
        financiamento.parcelasList.map(parcela => 
          excluirParcelaFinanciamento(parcela.id)
        )
      );
    }

    // Depois excluir o financiamento
    const deleteRes = await fetch(`${API_URL}/api/financiamento/${id}`, { 
      method: "DELETE" 
    });
    
    if (!deleteRes.ok) {
      throw new Error("Erro ao excluir financiamento");
    }
  } catch (error) {
    console.error("Erro ao excluir financiamento:", error);
    throw error;
  }
};
