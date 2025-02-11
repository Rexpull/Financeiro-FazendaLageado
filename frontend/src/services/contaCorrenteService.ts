import { ContaCorrente } from "../../../backend/src/models/ContaCorrente";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const listarContas = async (): Promise<ContaCorrente[]> => {
  try {
    const res = await fetch(`${API_URL}/api/contas`);
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
    return await res.json();
  } catch (error) {
    toast.error("Erro ao listar contas!");
    throw error;
  }
};

export const salvarConta = async (conta: ContaCorrente): Promise<ContaCorrente> => {
  const method = conta.id ? "PUT" : "POST";
  const url = conta.id ? `${API_URL}/api/contas/${conta.id}` : `${API_URL}/api/contas`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conta),
  });

  if (!res.ok) throw new Error("Erro ao salvar conta");

  toast.success(conta.id ? "Conta atualizada com sucesso!" : "Conta criada com sucesso!");

  return await res.json();
};

export const excluirConta = async (id: number): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/contas/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir conta");

    toast.success("Conta excluída com sucesso!");
  } catch (error) {
    toast.error("Erro ao excluir conta!");
    throw error;
  }
};

export const atualizarStatusConta = async (id: number, novoStatus: boolean): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/contas/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: novoStatus }),
    });

    if (!res.ok) throw new Error("Erro ao atualizar status da conta");

    toast.success(`Conta ${novoStatus ? "ativada" : "inativada"} com sucesso!`);
  } catch (error) {
    toast.error("Erro ao atualizar status da conta!");
    throw error;
  }
};

