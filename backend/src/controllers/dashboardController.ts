import { DashboardService } from "../services/dashboardService";

export class DashboardController {
  private dashboardService: any;

  constructor(dashboardService: any) {
    this.dashboardService = dashboardService;
  }

  async handleRequest(req: any): Promise<Response> {
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
      if (method === "GET" && pathname.match(/\/api\/dashboard\/(\d{4})/)) {
        const ano = parseInt(pathname.split("/").pop()!);
        if (isNaN(ano)) {
          return new Response(JSON.stringify({ error: "Ano inválido" }), { status: 400, headers: corsHeaders });
        }
        const data = await this.dashboardService.getDashboardData(ano);
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Erro ao buscar dados do dashboard:", error);
      return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: corsHeaders });
    }
  }
} 