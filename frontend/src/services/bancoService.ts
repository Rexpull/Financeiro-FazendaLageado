import { Banco } from "../../../backend/src/models/Banco";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // ✅ Garante que os estilos estão carregados


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const listarBancos = async (): Promise<Banco[]> => {
  try {
    const res = await fetch(`${API_URL}/api/bancos`);
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Erro ao listar bancos:", error);
    toast.error("Erro ao listar bancos!");
    throw error;
  }
};

export const salvarBanco = async (banco: Banco): Promise<Banco> => {
  const method = banco.id ? "PUT" : "POST";
  const url = banco.id ? `${API_URL}/api/bancos/${banco.id}` : `${API_URL}/api/bancos`;

  const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(banco),
  });

  if (!res.ok) throw new Error("Erro ao salvar banco");

  const bancoSalvo: Banco = await res.json(); 

  toast.success(banco.id ? "Banco atualizado com sucesso!" : "Banco criado com sucesso!");

  return bancoSalvo; 
};


  
export const excluirBanco = async (id: number): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/bancos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir banco");

    console.log("✔ Toast de exclusão chamado!");
    toast.success("Banco excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir banco:", error);
    toast.error("Erro ao excluir banco!");
    throw error;
  }
};
