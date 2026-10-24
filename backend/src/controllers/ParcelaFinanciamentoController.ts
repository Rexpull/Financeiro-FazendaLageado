import { ParcelaFinanciamentoRepository } from "../repositories/ParcelaFinanciamentoRepository";
import { ParcelaFinanciamento } from "../models/ParcelaFinanciamento";
import { erroExclusao } from "../utils/verificarUsoRegistro";

export class ParcelaFinanciamentoController {
	private repository: ParcelaFinanciamentoRepository;

	constructor(repository: ParcelaFinanciamentoRepository) {
		this.repository = repository;
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
			if (method === "GET" && pathname === "/api/parcelaFinanciamento") {
				const parcelas = await this.repository.getAll();
				return new Response(JSON.stringify(parcelas), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// Parcelas de um contrato: /api/parcelaFinanciamento/financiamento/:idFinanciamento
			if (method === "GET" && pathname.startsWith("/api/parcelaFinanciamento/financiamento/")) {
				const raw = pathname.split("/")[4] ?? "";
				if (!/^\d+$/.test(raw)) {
					return new Response(JSON.stringify({ error: "ID do financiamento inválido" }), {
						status: 400,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}
				const parcelas = await this.repository.getByIdFinanciamento(parseInt(raw, 10));
				return new Response(JSON.stringify(parcelas), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// Parcelas vinculadas a um movimento bancário: /api/parcelaFinanciamento/:idMovimentoBancario
			if (method === "GET" && pathname.startsWith("/api/parcelaFinanciamento/")) {
				const idMovimentoBancario = parseInt(pathname.split("/")[3]);
				const parcelas = await this.repository.getByIdMovimentoBancario(idMovimentoBancario);
				return new Response(JSON.stringify(parcelas), {
				  headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			  }		

			if (method === "POST" && pathname === "/api/parcelaFinanciamento") {
				const body: ParcelaFinanciamento = await req.json();
				const id = await this.repository.create(body);
				return new Response(JSON.stringify({ id, message: "Parcela criada com sucesso!" }), {
					status: 201,
					headers: corsHeaders,
				});
			}

			if (method === "PUT" && pathname.startsWith("/api/parcelaFinanciamento/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: ParcelaFinanciamento = await req.json();
				await this.repository.update(id, body);
				return new Response(JSON.stringify({ message: "Parcela atualizada com sucesso!" }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			if (method === "DELETE" && pathname.startsWith("/api/parcelaFinanciamento/")) {
				const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
				const raw = pathname.split("/")[3] ?? "";
				if (!/^\d+$/.test(raw)) {
					return new Response(JSON.stringify({ error: "ID da parcela inválido" }), { status: 400, headers: jsonHeaders });
				}
				const id = parseInt(raw, 10);
				try {
					await this.repository.deleteById(id);
				} catch (error) {
					// In use (liquidated / linked / referenced by Resultado) → 409 with a Portuguese message
					console.error(`Erro ao excluir parcela ${id}:`, error);
					const { status, message } = erroExclusao(error, "a parcela");
					return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
				}
				return new Response(JSON.stringify({ message: "Parcela excluída com sucesso!" }), {
					status: 200,
					headers: corsHeaders,
				});
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
