import { RelatorioFinanciamentosRepository, FiltrosRelatorioFinanciamentos } from '../repositories/RelatorioFinanciamentosRepository';
import { MODALIDADES_FINANCIAMENTO, FAIXAS_JUROS, hojeISO } from '../utils/relatorioFinanciamentos';

export class RelatorioFinanciamentosController {
  constructor(private repository: RelatorioFinanciamentosRepository) {}

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
      if (method === "GET" && pathname === "/api/relatorio/financiamentos") {
        const hoje = hojeISO();

        // Ano (gráfico "Compromissos de <ano>"; sem ano: ano atual). Período: inicio/fim (AAAA-MM-DD,
        // fim exclusivo); sem eles, o mês `mes` do ano ou o ano inteiro.
        const ano = parseInt(url.searchParams.get("ano") || "");
        const filtros: FiltrosRelatorioFinanciamentos = {
          ano: ano >= 1900 && ano <= 2100 ? ano : Number(hoje.slice(0, 4)),
        };

        const mes = parseInt(url.searchParams.get("mes") || "");
        if (mes >= 1 && mes <= 12) filtros.mes = mes;

        const dataIso = /^\d{4}-\d{2}-\d{2}$/;
        const inicio = url.searchParams.get("inicio") || "";
        const fim = url.searchParams.get("fim") || "";
        if (dataIso.test(inicio) && dataIso.test(fim) && inicio < fim) {
          filtros.inicio = inicio;
          filtros.fim = fim;
        }

        const idBanco = parseInt(url.searchParams.get("idBanco") || "");
        if (idBanco) filtros.idBanco = idBanco;

        // Tomador = Financiamento.responsavel
        const tomador = url.searchParams.get("tomador")?.trim();
        if (tomador) filtros.tomador = tomador;

        const numeroGarantia = url.searchParams.get("numeroGarantia")?.trim();
        if (numeroGarantia) filtros.numeroGarantia = numeroGarantia;

        const modalidade = url.searchParams.get("modalidade")?.toUpperCase();
        if (modalidade && (MODALIDADES_FINANCIAMENTO as readonly string[]).includes(modalidade)) {
          filtros.modalidade = modalidade;
        }

        const faixaJuros = url.searchParams.get("faixaJuros");
        if (faixaJuros && (FAIXAS_JUROS as readonly string[]).includes(faixaJuros)) {
          filtros.faixaJuros = faixaJuros;
        }

        const data = await this.repository.getRelatorioFinanciamentos(filtros, hoje);

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({ error: "Rota não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Erro no controller:", error);
      return new Response(
        JSON.stringify({
          error: "Erro no servidor",
          details: error instanceof Error ? error.message : "Erro desconhecido"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
}
