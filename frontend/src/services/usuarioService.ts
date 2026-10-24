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

    // The API never returns the stored hash, so `senha` is only filled when the user typed a new one.
    // On edit without a new password it is omitted and the backend keeps the current hash.
    const usuarioValido: Partial<Usuario> = {
        ...rest,
        ...(senha ? { senha: await bcrypt.hash(senha, 10) } : {}),
        ativo: usuario.ativo ?? true,
        cpf_cnpj: usuario.cpf_cnpj ?? "",
        telefone: usuario.telefone ?? "",
        foto_perfil: usuario.foto_perfil ?? "",
        dt_cadastro: usuario.dt_cadastro ?? new Date().toISOString().split("T")[0],
    };

    const method = usuario.id ? "PUT" : "POST";
    const url = usuario.id ? `${API_URL}/api/usuario/${usuario.id}` : `${API_URL}/api/usuario`;

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(usuarioValido),
        });

        const data = (await res.json()) as { id?: number; message?: string; error?: string }; // Converte resposta para JSON

        if (!res.ok) {
            throw new Error(data.error || "Erro desconhecido ao salvar usuário.");
        }

        toast.success(data.message || (usuario.id ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!"));
        const { senha: _hash, ...salvo } = usuarioValido;
        return { ...salvo, id: data.id ?? usuario.id } as Usuario;
    } catch (error: any) {
        console.error("❌ Erro ao salvar usuário:", error);

        if (error.message.includes("Este e-mail já está cadastrado no sistema!")) {
            toast.error("❌ Erro: Este e-mail já está cadastrado no sistema!");
        } else {
            toast.error(`❌ Erro ao salvar: ${error.message}`);
        }

        throw error;
    }
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
