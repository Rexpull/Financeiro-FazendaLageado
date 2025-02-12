import { PlanoConta } from "../../../backend/src/models/PlanoConta";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

export const listarPlanoContas = async (): Promise<PlanoConta[]> => {
  try{
    const res = await fetch(`${API_URL}/api/planoContas`);
    if (!res.ok) throw new Error("Erro ao listar planos de contas");
    return await res.json();
  } catch (error) {
      toast.error("Erro ao listar contas!");
      throw error;
    }
};

export const salvarPlanoConta = async (plano: PlanoConta): Promise<PlanoConta> => {
  const method = plano.id ? "PUT" : "POST";
  const url = plano.id ? `${API_URL}/api/planoContas/${plano.id}` : `${API_URL}/api/planoContas`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plano),
  });

  if (!res.ok) throw new Error("Erro ao salvar plano de contas");
  return await res.json();
};

export const excluirPlanoConta = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/api/planoContas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir plano de contas");
};

export const atualizarStatusConta = async (id: number, novoStatus: boolean): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/planoContas/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: novoStatus }),
    });

    if (!res.ok) throw new Error("Erro ao atualizar status do plano de contas");

    toast.success(`Plano de Conta ${novoStatus ? "ativada" : "inativada"} com sucesso!`);
  } catch (error) {
    toast.error("Erro ao atualizar status do Plano de Conta!");
    throw error;
  }
};
