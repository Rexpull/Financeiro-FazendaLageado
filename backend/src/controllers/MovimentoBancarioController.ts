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

			if (method === "GET" && pathname.startsWith("/api/movBancario/")) {
				const pathParts = pathname.split("/");
				if (pathParts.length === 4 && !isNaN(Number(pathParts[3]))) {
					const id = parseInt(pathParts[3]);
					const movimento = await this.movBancarioRepository.getById(id);
					if (!movimento) {
						return new Response(JSON.stringify({ message: "Movimento não encontrado" }), {
							status: 404,
							headers: corsHeaders,
						});
					}
					return new Response(JSON.stringify(movimento), {
						status: 200,
						headers: corsHeaders,
					});
				}
			}
			

			if (method === "POST" && pathname === "/api/movBancario") {
				try{
					const body: MovimentoBancario = await req.json();
					console.log("🔍 Corpo recebido:", JSON.stringify(body, null, 2));

					if (body.identificadorOfx) {
						const existente = await this.movBancarioRepository.getByIdentificadorOfx(body.identificadorOfx);
						if (existente) {
							return new Response(JSON.stringify({
								id: existente.id,
								message: "Movimento já existente com esse identificador_ofx",
							}), {
								status: 200,
								headers: corsHeaders,
							});
						}
					}
					
					const id = await this.movBancarioRepository.create(body);
					return new Response(JSON.stringify({ id, message: "Movimento bancário criado com sucesso!" }), {
						status: 201,
						headers: corsHeaders,
					});

				} catch (error) {
					console.error("🔥 Erro interno:", (error as Error).message, (error as Error).stack);
					return new Response(JSON.stringify({
						error: "Erro interno",
						message: (error as Error).message,
						stack: (error as Error).stack,
					}), {
						status: 500,
						headers: corsHeaders,
					});
				}
				
				
			}
			

			if (method === "PUT" && pathname.startsWith("/api/movBancario/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: MovimentoBancario = await req.json();
				console.log("Recebido no backend:", JSON.stringify(body, null, 2));
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

			if (method === "PATCH" && pathname.startsWith("/api/movBancario/")) {
				const id = parseInt(pathname.split("/")[3]);
				const body: MovimentoBancario = await req.json();
				if (typeof body.ideagro === "boolean") {
					await this.movBancarioRepository.updateIdeagro(id, body.ideagro);
					return new Response(JSON.stringify({ message: "Status ideagro atualizado!" }), {
						status: 200,
						headers: corsHeaders,
					});
				}
			}

			if (method === "GET" && pathname.startsWith("/api/movBancario/saldo/")) {
				const idConta = parseInt(pathname.split("/")[3]);
				const urlObj = new URL(req.url);
				const data = urlObj.searchParams.get("data");

  				const saldo = await this.movBancarioRepository.getSaldoContaCorrente(idConta, data ?? "");
				return new Response(JSON.stringify({ saldo }), {
				  status: 200,
				  headers: corsHeaders,
				});
			  }
			  

			if (method === "POST" && pathname === "/api/movBancario/transfer") {

				interface MovTransf {
					// Existing properties
					contaOrigemId?: number;
					contaDestinoId?: number;
					valor?: number;
					data?: string;
					descricao?: string;
					idUsuario?: number;
					contaOrigemDescricao?: string;
					contaDestinoDescricao?: string;
				}

				const body: MovTransf = await req.json();

				if (
					!body.contaOrigemId || !body.contaDestinoId ||
					!body.valor || !body.data || !body.descricao || !body.idUsuario ||
					!body.contaOrigemDescricao || !body.contaDestinoDescricao
				) {
					return new Response(JSON.stringify({ error: "Dados incompletos para transferência." }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				try {
					await this.movBancarioRepository.transfer({
						contaOrigemId: body.contaOrigemId!,
						contaOrigemDescricao: body.contaOrigemDescricao!,
						contaDestinoId: body.contaDestinoId!,
						contaDestinoDescricao: body.contaDestinoDescricao!,
						valor: body.valor!,
						descricao: body.descricao!,
						data: body.data!,
						idUsuario: body.idUsuario!,
					});
					return new Response(JSON.stringify({ message: "Transferência realizada com sucesso!" }), {
						status: 201,
						headers: corsHeaders,
					});
				} catch (error) {
					const message = (error as Error).message;
					const stack = (error as Error).stack;
				
					console.error("[TRANSFER ERROR]:", message, stack);
				
					const errorResponse = {
						error: "Erro ao realizar transferência bancária",
						message,
						stack,
					};
				
					return new Response(JSON.stringify(errorResponse), {
						status: 500,
						headers: corsHeaders,
					});
				}
				
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
