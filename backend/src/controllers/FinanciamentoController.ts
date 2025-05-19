import { FinanciamentoRepository } from "../repositories/FinanciamentoRepository";
import { Financiamento } from "../models/Financiamento";

export class FinanciamentoController {
	constructor(private repository: FinanciamentoRepository) {}

	async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const { pathname } = url;
		const { method } = req;

		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		try {
			if (method === "GET" && pathname === "/api/financiamento") {
				const data = await this.repository.getAll();
				return new Response(JSON.stringify(data), { headers: corsHeaders });
			}

			if (method === "GET" && pathname.startsWith("/api/financiamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				const data = await this.repository.getById(id);
				return new Response(JSON.stringify(data), { headers: corsHeaders });
			}

			if (method === "POST" && pathname === "/api/financiamento") {
				try {
					const body: Financiamento = await req.json();
					console.log("Dados recebidos:", JSON.stringify(body, null, 2));

					// Validação básica
					if (!body.responsavel || !body.dataContrato || !body.valor || !body.numeroContrato) {
						return new Response(
							JSON.stringify({ 
								error: "Dados inválidos", 
								details: "Campos obrigatórios não preenchidos",
								received: body 
							}), 
							{ 
								status: 400, 
								headers: { ...corsHeaders, "Content-Type": "application/json" } 
							}
						);
					}

					const id = await this.repository.create(body);
					return new Response(JSON.stringify({ id }), { 
						status: 201, 
						headers: { ...corsHeaders, "Content-Type": "application/json" } 
					});
				} catch (error) {
					console.error("Erro ao processar POST /api/financiamento:", error);
					return new Response(
						JSON.stringify({ 
							error: "Erro ao processar requisição", 
							details: error instanceof Error ? error.message : "Erro desconhecido"
						}), 
						{ 
							status: 500, 
							headers: { ...corsHeaders, "Content-Type": "application/json" } 
						}
					);
				}
			}

			if (method === "PUT" && pathname.startsWith("/api/financiamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: Financiamento = await req.json();
				await this.repository.update(id, body);
				return new Response(JSON.stringify({ message: "Atualizado com sucesso" }), { 
					headers: { ...corsHeaders, "Content-Type": "application/json" } 
				});
			}

			if (method === "DELETE" && pathname.startsWith("/api/financiamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				await this.repository.deleteById(id);
				return new Response(JSON.stringify({ message: "Financiamento removido" }), { 
					headers: { ...corsHeaders, "Content-Type": "application/json" } 
				});
			}

			return new Response(
				JSON.stringify({ error: "Rota não encontrada" }), 
				{ 
					status: 404, 
					headers: { ...corsHeaders, "Content-Type": "application/json" } 
				}
			);
		} catch (error) {
			console.error("Erro no controller:", error);
			return new Response(
				JSON.stringify({ 
					error: "Erro no servidor", 
					details: error instanceof Error ? error.message : "Erro desconhecido",
					stack: error instanceof Error ? error.stack : undefined
				}), 
				{ 
					status: 500, 
					headers: { ...corsHeaders, "Content-Type": "application/json" } 
				}
			);
		}
	}
}
