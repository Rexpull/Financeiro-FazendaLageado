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

  async getDashboardData(ano: number) {
    // Busca totais do ano
    const totaisAno = await this.dashboardRepository.getTotaisAno(ano);

    // Busca receitas/despesas/investimentos por mês
    const receitasDespesas = await this.dashboardRepository.getReceitasDespesasPorMes(ano);
    const investimentos = await this.dashboardRepository.getInvestimentosPorMes(ano);

    // Busca totais do mês atual
    const mesAtual = new Date().getMonth() + 1;
    const totaisMes = await this.dashboardRepository.getTotaisMes(ano, mesAtual);

    // Monta o objeto de retorno igual ao frontend espera
    return {
      totais: {
        receitas: totaisMes.receitas,
        despesas: totaisMes.despesas,
        investimentos: totaisMes.investimentos,
        financiamentos: totaisAno.financiamentos,
      },
      receitasDespesas: {
        ...receitasDespesas,
        detalhamento: [], // Preencher se necessário
      },
      investimentos,
      financiamentos: {
        labels: [], quitado: [], emAberto: [], novosContratos: [], liquidacoes: [], acumuladoAno: 0, porTipo: {}, porBanco: [], porFaixaJuros: []
      },
      financiamentosPorCredor: {
        labels: [], values: [], quitados: [], emAberto: [], detalhamento: []
      },
      parcelasFinanciamento: undefined
    };
  }
} 