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
      
      // Parsear contas da query string (formato: ?contas=1,2,3)
      const contasParam = url.searchParams.get("contas");
      const contas: number[] = contasParam 
        ? contasParam.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c))
        : [];

      // Parsear tipoAgrupamento da query string (padrão: 'planos')
      const tipoAgrupamentoParam = url.searchParams.get("tipoAgrupamento");
      const tipoAgrupamento: 'planos' | 'centros' = (tipoAgrupamentoParam === 'centros' ? 'centros' : 'planos');

      /** Add ?dashboardDebug=1 to log reconciled figures vs filters (wrangler tail / worker logs). */
      const dashboardDebug = url.searchParams.get("dashboardDebug") === "1";

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
          this.repository.getTotaisAno(ano, contas, dashboardDebug),
          this.repository.getReceitasDespesasPorMes(ano, contas, dashboardDebug),
          this.repository.getInvestimentosPorMes(ano, contas),
          this.repository.getFinanciamentosPorMes(ano),
          this.repository.getFinanciamentosPorCredor(ano),
          this.repository.getFinanciamentosPorFaixaJuros(ano),
          this.repository.getFinanciamentosPorBanco(ano),
          this.repository.getParcelasFinanciamento(ano),
          this.repository.getReceitasDespesas(ano, mes, contas, tipoAgrupamento, dashboardDebug)
        ]);

        // Buscar totais do mês se especificado
        let totaisMes = null;
        if (mes) {
          totaisMes = await this.repository.getTotaisMes(ano, mes, contas, dashboardDebug);
        }

        if (dashboardDebug) {
          const mesIdx = mes != null ? mes - 1 : -1;
          const agr = receitasDespesas.agrupadoPor || [];
          const sumCAgr = agr
            .filter((x) => x.tipoMovimento === "C")
            .reduce((s, x) => s + x.valor, 0);
          const sumDAgr = agr
            .filter((x) => x.tipoMovimento === "D")
            .reduce((s, x) => s + x.valor, 0);
          const rdArrR = receitasDespesas.receitas || [];
          const rdArrD = receitasDespesas.despesas || [];
          console.log(
            "[dashboard:debug] GET /api/dashboard controller cross-check",
            JSON.stringify({
              ano,
              mesQueryParam: mes ?? null,
              mesIndex0Based: mesIdx,
              tipoAgrupamento,
              contasCount: contas.length,
              contasPreviewIds: contas.slice(0, 40),
              contasTruncated: contas.length > 40,
              // Headline source (MovimentoBancario by month)
              receitasDespesasPorMes_receitas_at_mes:
                mesIdx >= 0 ? receitasDespesasPorMes.receitas[mesIdx] : null,
              receitasDespesasPorMes_despesas_at_mes:
                mesIdx >= 0 ? receitasDespesasPorMes.despesas[mesIdx] : null,
              investimentosPorMes_at_mes:
                mesIdx >= 0 ? Math.abs(investimentosPorMes.values[mesIdx] || 0) : null,
              totaisMes_from_getTotaisMes: totaisMes,
              totaisAno_receitas_despesas: {
                receitas: totaisAno.receitas,
                despesas: totaisAno.despesas,
              },
              // Detail payload: Resultado-based monthly arrays inside receitasDespesas
              receitasDespesas_Resultado_monthSlice:
                mesIdx >= 0
                  ? {
                      receitas: rdArrR[mesIdx],
                      despesas: rdArrD[mesIdx],
                    }
                  : null,
              receitasDespesas_apiFields: {
                totalReceitas: receitasDespesas.totalReceitas,
                totalDespesas: receitasDespesas.totalDespesas,
              },
              agrupadoPor_rows: agr.length,
              agrupadoPor_sumCredito: sumCAgr,
              agrupadoPor_sumDebito: sumDAgr,
              agrupadoPor_top5: agr.slice(0, 5),
              receitasAgrupadoPorCentros_len: receitasDespesas.receitasAgrupadoPorCentros?.length ?? 0,
              receitasAgrupadoPorCentros_sum:
                receitasDespesas.receitasAgrupadoPorCentros?.reduce((s, r) => s + r.valor, 0) ?? 0,
            })
          );
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
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            ...(dashboardDebug ? { "X-Dashboard-Debug": "1" } : {}),
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