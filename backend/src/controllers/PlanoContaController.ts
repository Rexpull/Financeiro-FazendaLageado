import { PlanoContaRepository } from "../repositories/PlanoContaRepository";
import { PlanoConta } from "../models/PlanoConta";
import { toast } from "react-toastify";

export class PlanoContaController {
    private planoRepository: PlanoContaRepository;

    constructor(planoRepository: PlanoContaRepository) {
        this.planoRepository = planoRepository;
    }

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const { pathname } = url;
        const { method } = req;

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            // 🔹 Listar todos os planos de contas
            if (method === "GET" && pathname === "/api/planoContas") {
                const planos = await this.planoRepository.getAll();
                return new Response(JSON.stringify(planos), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 🔹 Criar um novo plano de contas
            if (method === "POST" && pathname === "/api/planoContas") {
                try {
                    const body: PlanoConta = await req.json();
                
                    if (!body.descricao || !body.nivel || !body.tipo) {
                        return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), { status: 400, headers: corsHeaders });
                    }
                
                    console.log("📥 Recebendo dados do frontend:", body); // 👀 LOG NO BACKEND
                
                    const id = await this.planoRepository.create(body);
                    return new Response(JSON.stringify({ id, message: "Plano de contas criado com sucesso!" }), { status: 201, headers: corsHeaders });
                
                } catch (error) {
                    const errorMessage = (error as Error).message;

                    if (errorMessage.includes("UNIQUE constraint failed: plano_contas.descricao")) {
                        return new Response(JSON.stringify({ error: "Já existe um plano de contas com esta descrição." }), { status: 400, headers: corsHeaders });
                    }
                
                    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
                }
                
            }

            // 🔹 Atualizar um plano de contas
            if (method === "PUT" && pathname.startsWith("/api/planoContas/")) {
                try {
                    const id = parseInt(pathname.split("/")[3]);
                    const body: PlanoConta = await req.json();
                
                    if (!id || isNaN(id)) {
                        return new Response(JSON.stringify({ error: "ID inválido!" }), { status: 400, headers: corsHeaders });
                    }
                
                    if (!body.descricao || !body.tipo) {
                        return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), { status: 400, headers: corsHeaders });
                    }
                
                    await this.planoRepository.update(id, body);
                    return new Response(JSON.stringify({ message: "Plano de contas atualizado com sucesso!" }), { status: 200, headers: corsHeaders });
                
                } catch (error) {
                    const errorMessage = (error as Error).message;
                
                    if (errorMessage.includes("UNIQUE constraint failed: plano_contas.descricao")) {
                        console.error("❌ Já existe um plano de contas com esta descrição.");
                        return new Response(JSON.stringify({ error: "Já existe um plano de contas com esta descrição." }), { status: 400, headers: corsHeaders });
                    }
                
                    console.error("❌ Erro ao atualizar plano de contas:", error);
                    return new Response(JSON.stringify({ error: "Erro ao atualizar plano de contas", details: errorMessage }), { status: 500, headers: corsHeaders });
                }
                
            }

            // 🔹 Atualizar status (Ativar/Inativar)
            if (method === "PATCH" && pathname.startsWith("/api/planoContas/") && pathname.endsWith("/status")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: PlanoConta = await req.json();

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                if (typeof body.inativo !== "boolean") {
                    return new Response(JSON.stringify({ error: "O campo 'inativo' deve ser um booleano (true/false)! atualmente é: " + typeof body.inativo + " - " + body.inativo }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                await this.planoRepository.updateStatus(id, body.inativo);
                return new Response(JSON.stringify({ message: `Plano de contas ${body.inativo ? "inativado" : "ativado"} com sucesso!` }), {
                    status: 200,
                    headers: corsHeaders,
                });
            }

            // 🔹 Excluir plano de contas (com restrição de hierarquia)
            if (method === "DELETE" && pathname.startsWith("/api/planoContas/")) {
                const id = parseInt(pathname.split("/")[3]);

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                try {
                    await this.planoRepository.deleteById(id);
                    return new Response(JSON.stringify({ message: "Plano de contas excluído com sucesso!" }), {
                        status: 200,
                        headers: corsHeaders,
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ error: (error as Error).message }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }
            }

            return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
        } catch (error) {
            console.error("❌ Erro no servidor:", error);
            return new Response(JSON.stringify({ error: "Erro no servidor: " + (error as Error).message, details: (error as Error).message }), {
                status: 500,
                headers: corsHeaders,
            });
        }
    }
}
