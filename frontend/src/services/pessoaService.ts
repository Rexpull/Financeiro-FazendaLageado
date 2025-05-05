import { Pessoa } from "../../../backend/src/models/Pessoa";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

export const listarPessoas = async (): Promise<Pessoa[]> => {
  try {
    const res = await fetch(`${API_URL}/api/pessoa`);
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
    return await res.json();
  } catch (error) {
    toast.error("Erro ao listar pessoas!");
    throw error;
  }
};

export const buscarPessoaById = async (id: number): Promise<Pessoa | null> => {
  try {
    const res = await fetch(`${API_URL}/api/pessoa/${id}`);
    if (!res.ok) throw new Error("Erro ao buscar pessoa por ID");
    return await res.json();
  } catch (error) {
    console.error("Erro ao buscar pessoa:", error);
    toast.error("Erro ao buscar pessoa!");
    return null;
  }
};

export const salvarPessoa = async (pessoa: Pessoa): Promise<Pessoa> => {
  const method = pessoa.id ? "PUT" : "POST";
  const url = pessoa.id ? `${API_URL}/api/pessoa/${pessoa.id}` : `${API_URL}/api/pessoa`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pessoa),
  });

  if (!res.ok) throw new Error("Erro ao salvar pessoa");

  toast.success(pessoa.id ? "Pessoa atualizada com sucesso!" : "Pessoa cadastrada com sucesso!");

  return await res.json();
};

export const excluirPessoa = async (id: number): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/pessoa/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao excluir pessoa");

    toast.success("Pessoa excluída com sucesso!");
  } catch (error) {
    toast.error("Erro ao excluir pessoa!");
    throw error;
  }
};

export const atualizarStatusPessoa = async (id: number, novoStatus: boolean): Promise<void> => {
  try {
    const res = await fetch(`${API_URL}/api/pessoa/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: novoStatus }),
    });

    if (!res.ok) throw new Error("Erro ao atualizar status da pessoa");

    toast.success(`Pessoa ${novoStatus ? "ativada" : "inativada"} com sucesso!`);
  } catch (error) {
    toast.error("Erro ao atualizar status da pessoa!");
    throw error;
  }
};
