import { CentroCustosService } from "../services/CentroCustosService";

export class CentroCustosController {
  private centroCustosService: CentroCustosService;

  constructor(centroCustosService: CentroCustosService) {
    this.centroCustosService = centroCustosService;
  }

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    console.log(`🔍 CentroCustosController - Method: ${req.method}, Pathname: ${pathname}`);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (req.method === "GET" && pathname === "/api/centro-custos") {
        console.log("✅ Processando GET /api/centro-custos");
        const centroCustos = await this.centroCustosService.listarCentroCustos();
        return new Response(JSON.stringify(centroCustos), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      if (req.method === "GET" && pathname.startsWith("/api/centro-custos/")) {
        const id = parseInt(pathname.split("/")[3]);
        const centroCustos = await this.centroCustosService.buscarCentroCustos(id);
        return centroCustos 
          ? new Response(JSON.stringify(centroCustos), { 
              status: 200, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            })
          : new Response("Centro de Custos não encontrado", { 
              status: 404, 
              headers: corsHeaders 
            });
      }

      if (req.method === "POST" && pathname === "/api/centro-custos") {
        const { descricao }: { descricao: string } = await req.json();
        const centroCustosCriado = await this.centroCustosService.criarCentroCustos(descricao);
        return new Response(JSON.stringify(centroCustosCriado), { 
          status: 201, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      if (req.method === "PUT" && pathname.startsWith("/api/centro-custos/")) {
        const id = parseInt(pathname.split("/")[3]);
        const { descricao }: { descricao: string } = await req.json();
        await this.centroCustosService.atualizarCentroCustos(id, descricao);
        return new Response(JSON.stringify({ message: "Centro de Custos atualizado com sucesso" }), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      if (req.method === "DELETE" && pathname.startsWith("/api/centro-custos/")) {
        const id = parseInt(pathname.split("/")[3]);
        await this.centroCustosService.excluirCentroCustos(id);
        return new Response(JSON.stringify({ message: "Centro de Custos excluído com sucesso" }), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      console.log(`❌ Rota não encontrada: ${req.method} ${pathname}`);
      return new Response("Rota não encontrada", { 
        status: 404, 
        headers: corsHeaders 
      });
    } catch (error: any) {
      console.error("❌ Erro no CentroCustosController:", error);
      return new Response(error.message, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
}
