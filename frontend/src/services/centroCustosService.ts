import { CentroCustos } from "../../../backend/src/models/CentroCustos";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_URL = import.meta.env.VITE_API_URL;

export const listarCentroCustos = async (): Promise<CentroCustos[]> => {
  try {
    const res = await fetch(`${API_URL}/api/centro-custos`);
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Erro ao listar centro de custos:", error);
    console.log("APIurl: " + API_URL);
    
    toast.error("Erro ao listar centro de custos!");
    throw error;
  }
};

export const buscarCentroCustosById = async (id: number): Promise<CentroCustos | null> => {
  try {
    const res = await fetch(`${API_URL}/api/centro-custos/${id}`);
    if (!res.ok) throw new Error("Erro ao buscar centro de custos por ID");
    return await res.json();
  } catch (error) {
    console.error("Erro ao buscar centro de custos:", error);
    toast.error("Erro ao buscar centro de custos!");
    return null;
  }
};

export const salvarCentroCustos = async (centroCustos: CentroCustos): Promise<CentroCustos> => {
  const method = centroCustos.id ? "PUT" : "POST";
  const url = centroCustos.id ? `${API_URL}/api/centro-custos/${centroCustos.id}` : `${API_URL}/api/centro-custos`;

  const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(centroCustos),
  });

  if (!res.ok) throw new Error("Erro ao salvar centro de custos");

  if (centroCustos.id) {
    // Para atualização, retorna o objeto atualizado
    toast.success("Centro de Custos atualizado com sucesso!");
    return centroCustos;
  } else {
    // Para criação, retorna o objeto criado
    const centroCustosSalvo: CentroCustos = await res.json(); 
    toast.success("Centro de Custos criado com sucesso!");
    return centroCustosSalvo; 
  }
};

export const excluirCentroCustos = async (id: number): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/centro-custos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir centro de custos");

    console.log("✔ Toast de exclusão chamado!");
    toast.success("Centro de Custos excluído com sucesso!");
  } catch (error) {
    console.error("Erro ao excluir centro de custos:", error);
    toast.error("Erro ao excluir centro de custos!");
    throw error;
  }
};
