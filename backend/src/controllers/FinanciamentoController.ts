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
				const body: Financiamento = await req.json();
				const id = await this.repository.create(body);
				return new Response(JSON.stringify({ id }), { status: 201, headers: corsHeaders });
			}

			if (method === "PUT" && pathname.startsWith("/api/financiamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: Financiamento = await req.json();
				await this.repository.update(id, body);
				return new Response(JSON.stringify({ message: "Atualizado com sucesso" }), { headers: corsHeaders });
			}

			if (method === "DELETE" && pathname.startsWith("/api/financiamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				await this.repository.deleteById(id);
				return new Response(JSON.stringify({ message: "Financiamento removido" }), { headers: corsHeaders });
			}

			return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
		} catch (error) {
			return new Response(JSON.stringify({ error: "Erro no servidor", details: (error as Error).message }), {
				status: 500,
				headers: corsHeaders,
			});
		}
	}
}
