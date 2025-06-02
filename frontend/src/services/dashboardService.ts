const API_URL = import.meta.env.VITE_API_URL;

export interface DashboardData {
  totais: {
    receitas: number;
    despesas: number;
    investimentos: number;
    financiamentos: {
      contratosAtivos: number;
      totalFinanciado: number;
      totalQuitado: number;
      totalEmAberto: number;
    };
  };
  receitasDespesas: {
    labels: string[];
    receitas: number[];
    despesas: number[];
  };
  investimentos: {
    labels: string[];
    values: number[];
  };
  financiamentos: {
    labels: string[];
    quitado: number[];
    emAberto: number[];
  };
  financiamentosPorCredor: {
    labels: string[];
    values: number[];
    quitados: number[];
    emAberto: number[];
  };
}

export const getDashboardData = async (ano: number): Promise<DashboardData> => {
  try {
    const response = await fetch(`${API_URL}/dashboard/${ano}`);
    if (!response.ok) {
      throw new Error("Erro ao buscar dados do dashboard");
    }
    return response.json();
  } catch (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    throw error;
  }
}; 