import { CentroCustosService, CentroCustosValidacaoError } from "../services/CentroCustosService";
import { RegistroEmUsoError, isForeignKeyError } from "../utils/verificarUsoRegistro";

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
        if (isNaN(id)) {
          return new Response(JSON.stringify({ error: "ID inválido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
        const { descricao, tipo, tipoReceitaDespesa }: { 
          descricao: string; 
          tipo?: 'CUSTEIO' | 'INVESTIMENTO';
          tipoReceitaDespesa?: 'RECEITA' | 'DESPESA';
        } = await req.json();
        const centroCustosCriado = await this.centroCustosService.criarCentroCustos(descricao, tipo, tipoReceitaDespesa);
        return new Response(JSON.stringify(centroCustosCriado), { 
          status: 201, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      if (req.method === "PUT" && pathname.startsWith("/api/centro-custos/")) {
        const id = parseInt(pathname.split("/")[3]);
        const { descricao, tipo, tipoReceitaDespesa }: { 
          descricao: string; 
          tipo?: 'CUSTEIO' | 'INVESTIMENTO';
          tipoReceitaDespesa?: 'RECEITA' | 'DESPESA';
        } = await req.json();
        await this.centroCustosService.atualizarCentroCustos(id, descricao, tipo, tipoReceitaDespesa);
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
      const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
      if (error instanceof CentroCustosValidacaoError) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      if (error instanceof RegistroEmUsoError) {
        return new Response(JSON.stringify({ error: error.message }), { status: 409, headers: jsonHeaders });
      }
      if (isForeignKeyError(error)) {
        return new Response(
          JSON.stringify({ error: "Não é possível excluir este centro de custos: há registros vinculados." }),
          { status: 409, headers: jsonHeaders },
        );
      }
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        return new Response(
          JSON.stringify({ error: "Já existe um centro de custos com esta descrição e tipo." }),
          { status: 409, headers: jsonHeaders },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erro no servidor", details: error instanceof Error ? error.message : String(error) }),
        { status: 500, headers: jsonHeaders },
      );
    }
  }
}
