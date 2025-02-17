import { Parametro } from "../../../backend/src/models/Parametro";
import { toast } from "react-toastify";

const API_URL = import.meta.env.VITE_API_URL;

export const listarParametros = async (): Promise<Parametro[]> => {
    try {
        const res = await fetch(`${API_URL}/api/parametro`);
        if (!res.ok) throw new Error("Erro ao listar parâmetros");
        return await res.json();
    } catch (error) {
        toast.error("Erro ao listar parâmetros!");
        throw error;
    }
};
export const atualizarParametros = async (parametro: Parametro): Promise<void> => {
    try {
        const res = await fetch(`${API_URL}/api/parametro`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parametro),
        });

        if (!res.ok) throw new Error("Erro ao atualizar parâmetros");

        toast.success("Parâmetros atualizados com sucesso!");
    } catch (error) {
        toast.error("Erro ao atualizar parâmetros!");
        console.error("❌ Erro ao atualizar parâmetros:", error);
        throw error;
    }
};
