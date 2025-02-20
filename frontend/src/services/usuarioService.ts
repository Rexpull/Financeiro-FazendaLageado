import { Usuario } from "../../../backend/src/models/Usuario";
import { toast } from "react-toastify";
import bcrypt from "bcryptjs";

const API_URL = import.meta.env.VITE_API_URL;

export const listarUsuarios = async (): Promise<Usuario[]> => {
    try {
        const res = await fetch(`${API_URL}/api/usuario`);
        if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
        return await res.json();
    } catch (error) {
        toast.error("Erro ao listar usuários!");
        throw error;
    }
};

export const salvarUsuario = async (usuario: Usuario): Promise<Usuario> => {
    const { senha, ...rest } = usuario;
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    usuario = { senha: senhaCriptografada, ...rest };

    const method = usuario.id ? "PUT" : "POST";
    const url = usuario.id ? `${API_URL}/api/usuario/${usuario.id}` : `${API_URL}/api/usuario`;

    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usuario),
    });

    if (!res.ok) throw new Error("Erro ao salvar usuário");

    toast.success(usuario.id ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");

    return await res.json();
};

export const excluirUsuario = async (id: number): Promise<void> => {
    try {
        const res = await fetch(`${API_URL}/api/usuario/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao excluir usuário");

        toast.success("Usuário excluído com sucesso!");
    } catch (error) {
        toast.error("Erro ao excluir usuário!");
        throw error;
    }
};

export const atualizarStatusUsuario = async (id: number, novoStatus: boolean): Promise<void> => {
    try {
        const res = await fetch(`${API_URL}/api/usuario/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ativo: novoStatus }),
        });

        if (!res.ok) throw new Error("Erro ao atualizar status do usuário");

        toast.success(`Usuário ${novoStatus ? "ativado" : "inativado"} com sucesso!`);
    } catch (error) {
        toast.error("Erro ao atualizar status do usuário!");
        throw error;
    }
};
