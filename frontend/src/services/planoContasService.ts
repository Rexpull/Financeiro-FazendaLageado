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

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plano),
    });

    const data = await res.json();

    if (!res.ok) {
      if ((data as { error?: string }).error) {
        toast.error((data as { error: string }).error); // 🔹 Exibe o erro vindo da API
      } else {
        toast.error("Erro ao salvar plano de contas");
      }
      throw new Error((data as { error: string }).error || "Erro ao salvar plano de contas");
    }

    toast.success(method === "POST" ? "Plano de Conta criado com sucesso!" : "Plano de Conta editado com sucesso!");
    return data as PlanoConta;

  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Erro ao salvar plano de contas:", error.message, error.stack);
    } else {
      console.error("❌ Erro ao salvar plano de contas:", error);
    }
    throw error;
  }
};


export const excluirPlanoConta = async (id: number): Promise<void> => {
  const res = await fetch(`${API_URL}/api/planoContas/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir plano de contas");
  if (res.ok) toast.success("Plano de Conta excluido com sucesso!");
};

export const atualizarStatusConta = async (id: number, novoStatus: boolean): Promise<void> => {
  try {
    console.log(novoStatus);
    

    const res = await fetch(`${API_URL}/api/planoContas/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inativo: novoStatus }),
    });

    const data = await res.json();


    if (!res.ok) throw new Error( (data as { error: string }).error || "Erro ao atualizar status do plano de contas");

    toast.success(`Plano de Conta ${novoStatus ? "ativada" : "inativada"} com sucesso!`);
  } catch (error) {
    toast.error("Erro ao atualizar status!");
    throw error;
  }
};
