import { ContaCorrenteRepository } from "../repositories/ContaCorrenteRepository";
import { ContaCorrente } from "../models/ContaCorrente";

export class ContaCorrenteController {
    private contaRepository: ContaCorrenteRepository;

    constructor(contaRepository: ContaCorrenteRepository) {
        this.contaRepository = contaRepository;
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
            if (method === "GET" && pathname === "/api/contas") {
                const contas = await this.contaRepository.getAll();
                return new Response(JSON.stringify(contas), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && pathname === "/api/contas") {
                const body: ContaCorrente = await req.json();
                
                console.log("📥 JSON Recebido na API:", body);
            
                if (!body.tipo || !body.idBanco || !body.responsavel) {
                    return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }
                
                if (body.tipo === "contaCorrente" && (!body.agencia || !body.numConta)) {
                    return new Response(JSON.stringify({ error: "Agência e número da conta são obrigatórios para conta corrente!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }
                
                if (body.tipo === "cartao" && (!body.numCartao || !body.dtValidadeCartao)) {
                    return new Response(JSON.stringify({ error: "Número do cartão e validade são obrigatórios para cartões!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }
                
            
                const id = await this.contaRepository.create(body);
                return new Response(JSON.stringify({ id, message: "Conta criada com sucesso!" }), {
                    status: 201,
                    headers: corsHeaders,
                });
            }

            // 🔹 Atualizar conta corrente
            if (method === "PUT" && pathname.startsWith("/api/contas/")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: ContaCorrente = await req.json();

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                if (!body.tipo || !body.idBanco || !body.responsavel) {
                    return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                await this.contaRepository.update(id, body);
                return new Response(JSON.stringify({ message: "Conta atualizada com sucesso!" }), {
                    status: 200,
                    headers: corsHeaders,
                });
            }

            
            // 🔹 Atualizar Status da Conta (Ativar/Inativar)
            if (method === "PATCH" && pathname.startsWith("/api/contas/") && pathname.endsWith("/status")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: ContaCorrente = await req.json();

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

                await this.contaRepository.updateStatus(id, body.ativo);
                return new Response(JSON.stringify({ message: `Conta ${body.ativo ? "ativada" : "inativada"} com sucesso!` }), {
                    status: 200,
                    headers: corsHeaders,
                });
            }

            // 🔹 Excluir conta corrente
            if (method === "DELETE" && pathname.startsWith("/api/contas/")) {
                const id = parseInt(pathname.split("/")[3]);

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                await this.contaRepository.deleteById(id);
                return new Response(JSON.stringify({ message: "Conta excluída com sucesso!" }), {
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
