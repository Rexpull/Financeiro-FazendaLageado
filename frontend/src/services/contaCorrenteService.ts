export interface ContaCorrente {
  id: number;
  nome: string;
  numero: string;
  inativo?: boolean;
}

interface ErrorResponse {
  details?: string;
  error?: string;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

export const listarContas = async (): Promise<ContaCorrente[]> => {
  try {
    const res = await fetch(`${API_URL}/api/contas`);
    if (!res.ok) throw new Error("Erro ao listar contas");
    return res.json();
  } catch (error) {
    console.error("Erro ao listar contas:", error);
    throw error;
  }
};

export const salvarConta = async (conta: ContaCorrente): Promise<ContaCorrente> => {
  try {
    const method = conta.id ? "PUT" : "POST";
    const url = conta.id ? `${API_URL}/api/contas/${conta.id}` : `${API_URL}/api/contas`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conta),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({})) as ErrorResponse;
      throw new Error(errorData?.details || errorData?.error || "Erro ao salvar conta");
    }

    return res.json();
  } catch (error) {
    console.error("Erro ao salvar conta:", error);
    throw error;
  }
};

export const excluirConta = async (id: number): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/contas/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir conta");
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    throw error;
  }
};

export const atualizarStatusConta = async (id: number, novoStatus: boolean): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/contas/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inativo: novoStatus }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({})) as ErrorResponse;
      throw new Error(errorData?.details || errorData?.error || "Erro ao atualizar status da conta");
    }
  } catch (error) {
    console.error("Erro ao atualizar status da conta:", error);
    throw error;
  }
};

export const getContasCorrentes = async (): Promise<ContaCorrente[]> => {
  try {
    const res = await fetch(`${API_URL}/api/contas`);
    if (!res.ok) throw new Error("Erro ao buscar contas correntes");
    return res.json();
  } catch (error) {
    console.error("Erro ao buscar contas correntes:", error);
    throw error;
  }
};

