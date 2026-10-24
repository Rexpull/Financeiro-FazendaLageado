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
                const body = (await req.json().catch(() => null)) as Parametro | null;
                const obrigatorios = [
                    "idPlanoTransferenciaEntreContas",
                    "idPlanoEntradaFinanciamentos",
                    "idPlanoPagamentoFinanciamentos",
                ] as const;
                const opcionais = ["idPlanoEstornos", "idPlanoAplicacaoResgateInvestimentos"] as const;
                // null is accepted (parameter not configured yet); a missing field or a non-id value is not.
                const valido = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v > 0);
                const faltando = !body || typeof body !== "object"
                    ? [...obrigatorios]
                    : [
                        ...obrigatorios.filter((k) => body[k] === undefined || !valido(body[k])),
                        ...opcionais.filter((k) => body[k] !== undefined && !valido(body[k])),
                    ];
                if (faltando.length > 0) {
                    return new Response(JSON.stringify({ error: `Parâmetros inválidos ou ausentes: ${faltando.join(", ")}` }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }
                await this.parametroRepository.update(body!);
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
