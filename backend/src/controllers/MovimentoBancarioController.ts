import { MovimentoBancarioRepository } from "../repositories/MovimentoBancarioRepository";
import { MovimentoBancario } from "../models/MovimentoBancario";

export class MovimentoBancarioController {
	private movBancarioRepository: MovimentoBancarioRepository;

	constructor(movBancarioRepository: MovimentoBancarioRepository) {
		this.movBancarioRepository = movBancarioRepository;
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
			if (method === "GET" && pathname === "/api/movBancario") {
				const movBancario = await this.movBancarioRepository.getAll();
				return new Response(JSON.stringify(movBancario), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
			}

			if (method === "POST" && pathname === "/api/movBancario") {
				const body: MovimentoBancario = await req.json();
				const id = await this.movBancarioRepository.create(body);
				return new Response(JSON.stringify({ id, message: "Movimento bancário criado com sucesso!" }), {
					status: 201,
					headers: corsHeaders,
				});
			}

			if (method === "PUT" && pathname.startsWith("/api/movBancario/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: MovimentoBancario = await req.json();
				await this.movBancarioRepository.update(id, body);
				return new Response(JSON.stringify({ message: "Movimento bancário atualizado com sucesso!" }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			if (method === "DELETE" && pathname.startsWith("/api/movBancario/")) {
				const id = parseInt(pathname.split("/")[3]);
				await this.movBancarioRepository.deleteById(id);
				return new Response(JSON.stringify({ message: "Movimento bancário excluído com sucesso!" }), {
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
