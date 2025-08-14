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

        // Buscar totais do mês se especificado
        let totaisMes = null;
        if (mes) {
          totaisMes = await this.repository.getTotaisMes(ano, mes, []); // Array vazio para contas
        }

        return new Response(JSON.stringify({
          totaisAno,
          totais: totaisMes ? {
            receitas: totaisMes.receitas,
            despesas: totaisMes.despesas,
            investimentos: totaisMes.investimentos,
            financiamentos: {
              contratosAtivos: totaisAno.financiamentos.contratosAtivos,
              totalFinanciado: totaisMes.financiamentos,
              totalQuitado: 0,
              totalEmAberto: totaisMes.financiamentos,
            },
          } : null,
          receitasDespesasPorMes,
          investimentosPorMes,
          financiamentosPorMes,
          financiamentosPorCredor,
          financiamentos: {
            porFaixaJuros: financiamentosPorFaixaJuros.values,
            porBanco: financiamentosPorBanco.values
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
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return new Response(JSON.stringify({ error: errorMessage }), {
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

    // Novo endpoint para filtros rápidos de financiamentos
    if (method === "GET" && path === "/api/dashboard/financiamentos") {
      const ano = url.searchParams.get("ano") ? parseInt(url.searchParams.get("ano")!) : undefined;
      const mes = url.searchParams.get("mes") ? parseInt(url.searchParams.get("mes")!) : undefined;
      const tipo = url.searchParams.get("tipo");

      try {
        let data;
        
        switch (tipo) {
          case "parcelas-vencer":
            data = await this.repository.getParcelasAVencer(ano, mes);
            break;
          case "contratos-liquidados":
            data = await this.repository.getContratosLiquidados(ano, mes);
            break;
          case "contratos-novos":
            data = await this.repository.getContratosNovos(ano, mes);
            break;
          default:
            return new Response(JSON.stringify({ error: "Tipo de filtro inválido" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
              }
            });
        }

        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return new Response(JSON.stringify({ error: errorMessage }), {
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