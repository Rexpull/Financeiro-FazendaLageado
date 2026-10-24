import { PessoaRepository } from "../repositories/PessoaRepository";
import { Pessoa } from "../models/Pessoa";
import { erroExclusao } from "../utils/verificarUsoRegistro";

export class PessoaController {
    private pessoaRepository: PessoaRepository;

    constructor(pessoaRepository: PessoaRepository) {
        this.pessoaRepository = pessoaRepository;
    }

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const { pathname } = url;
        const { method } = req;

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            if (method === "GET" && pathname === "/api/pessoa") {
                const pessoas = await this.pessoaRepository.getAll();
                return new Response(JSON.stringify(pessoas), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            
            if (method === "GET" && pathname.startsWith("/api/pessoa/")) {
                const raw = pathname.split("/")[3] ?? "";
                const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
                if (!/^\d+$/.test(raw)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), { status: 400, headers: jsonHeaders });
                }
                const pessoa = await this.pessoaRepository.getById(parseInt(raw, 10));
                return pessoa
                    ? new Response(JSON.stringify(pessoa), { headers: jsonHeaders })
                    : new Response(JSON.stringify({ error: "Pessoa não encontrada" }), { status: 404, headers: jsonHeaders });
            }

            if (method === "POST" && pathname === "/api/pessoa") {
                const body: Pessoa = await req.json();
                const id = await this.pessoaRepository.create(body);
                return new Response(JSON.stringify({ id, message: "Pessoa cadastrada com sucesso!" }), { status: 201, headers: corsHeaders });
            }

            if (method === "PUT" && pathname.startsWith("/api/pessoa/")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: Pessoa = await req.json();
                await this.pessoaRepository.update(id, body);
                return new Response(JSON.stringify({ message: "Pessoa atualizada com sucesso!" }), { status: 200, headers: corsHeaders });
            }

            if (method === "DELETE" && pathname.startsWith("/api/pessoa/")) {
                const id = parseInt(pathname.split("/")[3]);
                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), { status: 400, headers: corsHeaders });
                }
                try {
                    await this.pessoaRepository.deleteById(id);
                } catch (error) {
                    console.error("❌ Erro ao excluir pessoa:", error);
                    const { status, message } = erroExclusao(error, "a pessoa");
                    return new Response(JSON.stringify({ error: message }), {
                        status,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
                return new Response(JSON.stringify({ message: "Pessoa excluída com sucesso!" }), { status: 200, headers: corsHeaders });
            }

            if (method === "PATCH" && pathname.startsWith("/api/pessoa/") && pathname.endsWith("/status")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: Pessoa = await req.json();

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                if (typeof body.ativo !== "boolean") {
                    return new Response(JSON.stringify({ error: "O campo 'ativo' deve ser um booleano (true/false)!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                await this.pessoaRepository.updateStatus(id, body.ativo);
                return new Response(JSON.stringify({ message: `Pessoa ${body.ativo ? "ativada" : "inativada"} com sucesso!` }), {
                    status: 200,
                    headers: corsHeaders,
                });
            }

            return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
        } catch (error) {
            console.error("❌ Erro no servidor:", error);
            return new Response(JSON.stringify({ error: "Erro no servidor", details: (error as Error).message }), {
                status: 500,
                headers: corsHeaders,
            });
        }
    }
}
