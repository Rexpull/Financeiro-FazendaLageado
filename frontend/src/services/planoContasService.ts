import { PlanoConta } from "../../../backend/src/models/PlanoConta";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const listarPlanoContas = async (): Promise<PlanoConta[]> => {
  const res = await fetch(`${API_URL}/api/plano-contas`);
  if (!res.ok) throw new Error("Erro ao listar planos de contas");
  return await res.json();
};

export const salvarPlanoConta = async (plano: PlanoConta): Promise<PlanoConta> => {
  const method = plano.id ? "PUT" : "POST";
  const url = plano.id ? `${API_URL}/api/plano-contas/${plano.id}` : `${API_URL}/api/plano-contas`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plano),
  });

  if (!res.ok) throw new Error("Erro ao salvar plano de contas");
  return await res.json();
};

export const excluirPlanoConta = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/api/plano-contas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir plano de contas");
};
