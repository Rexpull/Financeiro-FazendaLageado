import { DashboardRepository } from "../repositories/dashboardRepository";

export class DashboardController {
  private repository: DashboardRepository;

  constructor(repository: DashboardRepository) {
    this.repository = repository;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "GET" && path === "/api/dashboard") {
      const ano = parseInt(url.searchParams.get("ano") || new Date().getFullYear().toString());
      const mes = url.searchParams.get("mes") ? parseInt(url.searchParams.get("mes")!) : undefined;

      try {
        const [
          totaisAno,
          receitasDespesasPorMes,
          investimentosPorMes,
          financiamentosPorMes,
          financiamentosPorCredor,
          financiamentosPorFaixaJuros,
          financiamentosPorBanco,
          parcelasFinanciamento,
          receitasDespesas
        ] = await Promise.all([
          this.repository.getTotaisAno(ano),
          this.repository.getReceitasDespesasPorMes(ano),
          this.repository.getInvestimentosPorMes(ano),
          this.repository.getFinanciamentosPorMes(ano),
          this.repository.getFinanciamentosPorCredor(ano),
          this.repository.getFinanciamentosPorFaixaJuros(ano),
          this.repository.getFinanciamentosPorBanco(ano),
          this.repository.getParcelasFinanciamento(ano),
          this.repository.getReceitasDespesas(ano, mes)
        ]);

        return new Response(JSON.stringify({
          totaisAno,
          receitasDespesasPorMes,
          investimentosPorMes,
          financiamentosPorMes,
          financiamentosPorCredor,
          financiamentos: {
            porFaixaJuros: financiamentosPorFaixaJuros,
            porBanco: financiamentosPorBanco
          },
          parcelasFinanciamento,
          receitasDespesas
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
} 