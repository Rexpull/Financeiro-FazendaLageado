import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * DELETE for cadastro screens that surfaces the API message (e.g. 409 "Não é possível excluir este
 * banco. Ele está em uso em: 2 contas correntes/cartões...") in a toast instead of a generic error.
 * Throws so the caller keeps the record in the list.
 */
export async function excluirCadastro(caminho: string, mensagemSucesso: string, mensagemErroPadrao: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${caminho}`, { method: "DELETE" });
  } catch (error) {
    toast.error(mensagemErroPadrao);
    throw error;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    const mensagem = data?.error || data?.message || mensagemErroPadrao;
    toast.error(mensagem);
    throw new Error(mensagem);
  }

  toast.success(mensagemSucesso);
}

export const excluirBancoCadastro = (id: number) =>
  excluirCadastro(`/api/bancos/${id}`, "Banco excluído com sucesso!", "Erro ao excluir banco!");

export const excluirCentroCustosCadastro = (id: number) =>
  excluirCadastro(`/api/centro-custos/${id}`, "Centro de Custos excluído com sucesso!", "Erro ao excluir centro de custos!");

export const excluirContaCadastro = (id: number) =>
  excluirCadastro(`/api/contas/${id}`, "Conta excluída com sucesso!", "Erro ao excluir conta!");

export const excluirPessoaCadastro = (id: number) =>
  excluirCadastro(`/api/pessoa/${id}`, "Pessoa excluída com sucesso!", "Erro ao excluir pessoa!");

export const excluirPlanoContaCadastro = (id: number) =>
  excluirCadastro(`/api/planoContas/${id}`, "Plano de Conta excluído com sucesso!", "Erro ao excluir plano de contas!");
