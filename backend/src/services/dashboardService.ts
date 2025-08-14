import { D1Database } from "@cloudflare/workers-types";
import { DashboardRepository } from "../repositories/dashboardRepository";
import { ParcelaFinanciamentoRepository } from "../repositories/ParcelaFinanciamentoRepository";

export class DashboardService {
  private dashboardRepository: DashboardRepository;
  private parcelaFinanciamentoRepository: ParcelaFinanciamentoRepository;

  constructor(db: D1Database) {
    this.dashboardRepository = new DashboardRepository(db);
    this.parcelaFinanciamentoRepository = new ParcelaFinanciamentoRepository(db);
  }

  async getDashboardData(ano: number, mes?: number) {
    // Busca totais do ano
    const totaisAno = await this.dashboardRepository.getTotaisAno(ano);

    // Busca receitas/despesas/investimentos por mês
    const receitasDespesas = await this.dashboardRepository.getReceitasDespesasPorMes(ano);
    const investimentos = await this.dashboardRepository.getInvestimentosPorMes(ano);

    // Busca totais do mês atual ou mês especificado
    const mesAtual = mes || new Date().getMonth() + 1;
    const totaisMes = await this.dashboardRepository.getTotaisMes(ano, mesAtual, []); // Array vazio para contas

    // Busca dados de financiamentos
    const financiamentosPorMes = await this.dashboardRepository.getFinanciamentosPorMes(ano);
    const financiamentosPorCredor = await this.dashboardRepository.getFinanciamentosPorCredor(ano);
    const financiamentosPorFaixaJuros = await this.dashboardRepository.getFinanciamentosPorFaixaJuros(ano);
    const financiamentosPorBanco = await this.dashboardRepository.getFinanciamentosPorBanco(ano);
    const parcelasFinanciamento = await this.dashboardRepository.getParcelasFinanciamento(ano);

    // Monta o objeto de retorno igual ao frontend espera
    return {
      totaisAno: {
        receitas: totaisAno.receitas,
        despesas: totaisAno.despesas,
        investimentos: totaisAno.investimentos,
        financiamentos: totaisAno.financiamentos,
      },
      totais: {
        receitas: totaisMes.receitas,
        despesas: totaisMes.despesas,
        investimentos: totaisMes.investimentos,
        financiamentos: {
          contratosAtivos: totaisAno.financiamentos.contratosAtivos,
          totalFinanciado: totaisMes.financiamentos,
          totalQuitado: 0,
          totalEmAberto: totaisMes.financiamentos,
        },
      },
      receitasDespesasPorMes: receitasDespesas,
      investimentosPorMes: investimentos,
      financiamentosPorMes,
      financiamentosPorCredor,
      financiamentos: {
        porFaixaJuros: financiamentosPorFaixaJuros.values,
        porBanco: financiamentosPorBanco.values
      },
      parcelasFinanciamento,
      receitasDespesas: {
        receitas: [],
        despesas: [],
        detalhamento: []
      }
    };
  }
} 