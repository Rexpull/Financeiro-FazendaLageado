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
      data: string;
      classificacao: string;
    }>;
  };
}

// Novas interfaces para os filtros rápidos de financiamentos
export interface ParcelasAVencer {
  labels: string[];
  valores: number[];
  totalVencimento: number;
  detalhes: Array<{
    mes: string;
    ano: number;
    valor: number;
    quantidade: number;
    financiamentos: Array<{
      contrato: string;
      tomador: string;
      banco: string;
      valor: number;
      vencimento: string;
      modalidade: string;
      taxaJuros: number;
      garantia: string;
    }>;
  }>;
}

export interface ContratosLiquidados {
  labels: string[];
  valores: number[];
  totalLiquidado: number;
  detalhes: Array<{
    mes: string;
    ano: number;
    valor: number;
    quantidade: number;
    contratos: Array<{
      numero: string;
      tomador: string;
      banco: string;
      valor: number;
      dataLiquidacao: string;
      modalidade: string;
      taxaJuros: number;
      garantia: string;
    }>;
  }>;
}

export interface ContratosNovos {
  labels: string[];
  valores: number[];
  totalNovos: number;
  detalhes: Array<{
    mes: string;
    ano: number;
    valor: number;
    quantidade: number;
    contratos: Array<{
      numero: string;
      tomador: string;
      banco: string;
      valor: number;
      dataContrato: string;
      modalidade: string;
      taxaJuros: number;
      garantia: string;
      numeroParcelas: number;
    }>;
  }>;
}

export const getDashboardData = async (ano: number, mes?: number): Promise<DashboardData> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      ano: String(ano)
    });
    
    if (mes) {
      params.append('mes', String(mes));
    }
    
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

// Novos métodos para os filtros rápidos de financiamentos
export const getParcelasAVencer = async (ano?: number, mes?: number): Promise<ParcelasAVencer> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      tipo: 'parcelas-vencer'
    });
    
    if (ano) {
      params.append('ano', String(ano));
    }
    
    if (mes) {
      params.append('mes', String(mes));
    }
    
    const url = API_URL ? `${API_URL}/api/dashboard/financiamentos?${params.toString()}` : `/api/dashboard/financiamentos?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorData: any = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || errorData?.details || 'Erro ao buscar parcelas a vencer');
    }
    return await res.json();
  } catch (error) {
    console.error('Erro ao buscar parcelas a vencer:', error);
    throw error;
  }
};

export const getContratosLiquidados = async (ano?: number, mes?: number): Promise<ContratosLiquidados> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      tipo: 'contratos-liquidados'
    });
    
    if (ano) {
      params.append('ano', String(ano));
    }
    
    if (mes) {
      params.append('mes', String(mes));
    }
    
    const url = API_URL ? `${API_URL}/api/dashboard/financiamentos?${params.toString()}` : `/api/dashboard/financiamentos?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorData: any = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || errorData?.details || 'Erro ao buscar contratos liquidados');
    }
    return await res.json();
  } catch (error) {
    console.error('Erro ao buscar contratos liquidados:', error);
    throw error;
  }
};

export const getContratosNovos = async (ano?: number, mes?: number): Promise<ContratosNovos> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      tipo: 'contratos-novos'
    });
    
    if (ano) {
      params.append('ano', String(ano));
    }
    
    if (mes) {
      params.append('mes', String(mes));
    }
    
    const url = API_URL ? `${API_URL}/api/dashboard/financiamentos?${params.toString()}` : `/api/dashboard/financiamentos?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorData: any = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || errorData?.details || 'Erro ao buscar contratos novos');
    }
    return await res.json();
  } catch (error) {
    console.error('Erro ao buscar contratos novos:', error);
    throw error;
  }
}; 