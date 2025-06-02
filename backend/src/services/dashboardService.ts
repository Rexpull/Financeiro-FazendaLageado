import { DashboardRepository } from "../repositories/dashboardRepository";

export class DashboardService {
  private dashboardRepository: DashboardRepository;

  constructor(dashboardRepository: DashboardRepository) {
    this.dashboardRepository = dashboardRepository;
  }

  async getDashboardData(ano: number) {
    // Buscar totais do ano
    const totais = await this.dashboardRepository.getTotaisAno(ano);
    // Buscar dados por mês
    const receitasDespesas = await this.dashboardRepository.getReceitasDespesasPorMes(ano);
    const investimentos = await this.dashboardRepository.getInvestimentosPorMes(ano);
    const financiamentos = await this.dashboardRepository.getFinanciamentosPorMes(ano);
    const financiamentosPorCredor = await this.dashboardRepository.getFinanciamentosPorCredor(ano);

    return {
      totais,
      receitasDespesas,
      investimentos,
      financiamentos,
      financiamentosPorCredor,
    };
  }
} 