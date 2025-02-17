import { ParametroRepository } from "../repositories/ParametroRepository";
import { Parametro } from "../models/Parametro";

export class ParametroController {
    private parametroRepository: ParametroRepository;

    constructor(parametroRepository: ParametroRepository) {
        this.parametroRepository = parametroRepository;
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
            if (method === "GET" && pathname === "/api/parametro") {
                const parametros = await this.parametroRepository.getAll();
                return new Response(JSON.stringify(parametros), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "PUT" && pathname === "/api/parametro") {
                const body: Parametro = await req.json();
                await this.parametroRepository.update(body);
                return new Response(JSON.stringify({ message: "Parâmetros atualizados com sucesso!" }), { status: 200, headers: corsHeaders });
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
