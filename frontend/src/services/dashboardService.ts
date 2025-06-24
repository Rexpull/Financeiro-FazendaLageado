export interface DashboardData {
  totaisAno: {
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
  receitasDespesasPorMes: {
    labels: string[];
    receitas: number[];
    despesas: number[];
  };
  investimentosPorMes: {
    labels: string[];
    values: number[];
  };
  financiamentosPorMes: {
    labels: string[];
    quitado: number[];
    emAberto: number[];
  };
  financiamentosPorCredor: {
    labels: string[];
    values: number[];
    quitados: number[];
    emAberto: number[];
    detalhamento: Array<{
      tomador: string;
      banco: string;
      dataFinanciamento: string;
      valor: number;
      tipo: string;
    }>;
  };
  financiamentos: {
    porFaixaJuros: Array<{
      faixa: string;
      valor: number;
    }>;
    porBanco: Array<{
      nome: string;
      total: number;
      comGarantia: number;
      semGarantia: number;
    }>;
  };
  parcelasFinanciamento: {
    labels: string[];
    pagas: number[];
    vencidas: number[];
    totalPagas: number;
    totalVencidas: number;
    detalhes: Array<{
      mes: string;
      valor: number;
      status: string;
    }>;
  };
  receitasDespesas: {
    receitas: number[];
    despesas: number[];
    detalhamento: Array<{
      descricao: string;
      valor: number;
      mes: string;
      classificacao: string;
    }>;
  };
}

export const getDashboardData = async (ano: number): Promise<DashboardData> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      ano: String(ano)
    });
    const url = API_URL ? `${API_URL}/api/dashboard?${params.toString()}` : `/api/dashboard?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorData: any = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || errorData?.details || 'Erro ao buscar dados do dashboard');
    }
    return await res.json();
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    throw error;
  }
}; 