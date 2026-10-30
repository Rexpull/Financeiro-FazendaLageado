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
    agrupadoPor?: Array<{
      descricao: string;
      valor: number;
      tipoMovimento: 'C' | 'D';
      conciliado: boolean;
      subtipoDespesa?: 'custeio' | 'investimento';
      /** Cost centres behind the row (detail modal: GET /api/dashboard/detalhar) */
      idsCentros?: number[];
    }>;
    /** Revenues by cost center — prefer this for comparative receitas chart */
    receitasAgrupadoPorCentros?: Array<{
      descricao: string;
      valor: number;
      tipoMovimento: 'C';
      conciliado: boolean;
      idsCentros?: number[];
    }>;
    /** Full-year centro breakdown when ?mes= is set (same payload avoids a 2nd dashboard call). */
    agrupadoPorAno?: Array<{
      descricao: string;
      valor: number;
      tipoMovimento: 'C' | 'D';
      conciliado: boolean;
      subtipoDespesa?: 'custeio' | 'investimento';
    }>;
    receitasAgrupadoPorCentrosAno?: Array<{
      descricao: string;
      valor: number;
      tipoMovimento: 'C';
      conciliado: boolean;
    }>;
    totalConciliado?: number;
    totalSemConciliar?: number;
    /** Movements of the period still without a cost centre (pending conciliation) */
    semCentroCustos?: { receitas: number; despesas: number };
    totalReceitas?: number;
    totalDespesas?: number;
  };
  /** Full-year breakdown kept when a month filter is active (for annual captions). */
  receitasDespesasAno?: DashboardData['receitasDespesas'];
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

export const getDashboardData = async (ano: number, mes?: number, contas?: number[], tipoAgrupamento?: 'planos' | 'centros'): Promise<DashboardData> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const params = new URLSearchParams({
      ano: String(ano)
    });
    
    if (mes) {
      params.append('mes', String(mes));
    }
    
    if (contas && contas.length > 0) {
      params.append('contas', contas.join(','));
    }
    
    if (tipoAgrupamento) {
      params.append('tipoAgrupamento', tipoAgrupamento);
    }

    const viteDebug =
      typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_DASHBOARD_DEBUG === '1';
    if (viteDebug) {
      params.append('dashboardDebug', '1');
    }

    const url = API_URL ? `${API_URL}/api/dashboard?${params.toString()}` : `/api/dashboard?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorData: any = await res.json().catch(() => ({}));
      throw new Error(errorData?.error || errorData?.details || 'Erro ao buscar dados do dashboard');
    }
    const data: DashboardData = await res.json();
    if (viteDebug) {
      const mesIdx = mes != null ? mes - 1 : -1;
      const agr = data.receitasDespesas?.agrupadoPor ?? [];
      const centros = data.receitasDespesas?.receitasAgrupadoPorCentros ?? [];
      const sumCentros = centros.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);
      const sumDesp = agr
        .filter((r) => r.tipoMovimento === 'D')
        .reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);
      console.log(
        '[dashboard:debug] client /api/dashboard snapshot (see worker logs for SQL steps)',
        JSON.stringify({
          requestUrl: url,
          xDashboardDebugHeader: res.headers.get('X-Dashboard-Debug'),
          receitasDespesasPorMes_at_mes:
            mesIdx >= 0 ? data.receitasDespesasPorMes?.receitas?.[mesIdx] : null,
          despesasPorMes_at_mes:
            mesIdx >= 0 ? data.receitasDespesasPorMes?.despesas?.[mesIdx] : null,
          sumReceitasCentros: sumCentros,
          sumDespesasAgrupado: sumDesp,
          apiTotalReceitas: data.receitasDespesas?.totalReceitas ?? null,
          apiTotalDespesas: data.receitasDespesas?.totalDespesas ?? null,
          receitasAgrupadoPorCentros_len: centros.length,
          agrupadoPor_len: agr.length,
          totaisMes: (data as any).totais ?? null,
        })
      );
    }
    return data;
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
export interface ResumoSaldoDevedorMes {
  ano?: number;
  mes: number; // 1..12
  saldoInicial: number;
  quitados: number;
  creditosNovos: number;
  valorContratadoNovos: number;
  contratosNovos: number;
  /** Net effect of renegotiations in the month: new parcelas − replaced ones (not new credit, not paid) */
  renegociacoes?: number;
  saldoFinal: number;
}

const apiUrl = (caminho: string, params: URLSearchParams) => {
  const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
  return `${API_URL}${caminho}?${params.toString()}`;
};

async function getJson<T>(caminho: string, params: URLSearchParams, mensagemErro: string): Promise<T> {
  const res = await fetch(apiUrl(caminho, params));
  if (!res.ok) {
    const errorData: any = await res.json().catch(() => ({}));
    throw new Error(errorData?.error || mensagemErro);
  }
  return (await res.json()) as T;
}

/** Date range [inicio, fim) as AAAA-MM-DD (fim exclusive). */
export type FaixaDatas = { inicio: string; fim: string };

/**
 * Saldo devedor mês a mês: saldo inicial, quitados, créditos novos e saldo final (parcelas não liquidadas).
 * A year (12 months) or any range of months (trimestre, semestre, últimos 12 meses).
 */
export const getResumoSaldoDevedor = async (periodo: number | FaixaDatas): Promise<ResumoSaldoDevedorMes[]> => {
  const params = new URLSearchParams({ tipo: 'saldo-devedor' });
  if (typeof periodo === 'number') params.set('ano', String(periodo));
  else {
    params.set('inicio', periodo.inicio);
    params.set('fim', periodo.fim);
  }
  return getJson('/api/dashboard/financiamentos', params, 'Erro ao buscar saldo devedor');
};

export interface ParcelaContratoPeriodo {
  id: number;
  numParcela: number;
  valor: number;
  status: string;
  dt_vencimento: string;
  dt_liquidacao: string | null;
}

export interface ContratoPeriodo {
  id: number;
  numeroContrato: string;
  credor: string;
  tomador: string;
  dataContrato: string;
  valorContratado: number;
  /** What the contract adds to the card: all its parcelas (créditos novos) or those liquidated in the period (quitados) */
  valorNoPeriodo: number;
  parcelas: ParcelaContratoPeriodo[];
}

/** Contracts behind "Créditos novos" and "Quitados" of the period (the lists add up to the cards). */
export const getContratosPeriodo = async (periodo: FaixaDatas): Promise<{ novos: ContratoPeriodo[]; quitados: ContratoPeriodo[] }> =>
  getJson('/api/dashboard/financiamentos', new URLSearchParams({ tipo: 'contratos-periodo', ...periodo }), 'Erro ao buscar os contratos do período');

type LinhaCentro = NonNullable<DashboardData['receitasDespesas']['agrupadoPor']>[number];

/** Receitas / despesas by cost centre of a date range (Resultado consolidado). */
export interface ReceitasDespesasPeriodo {
  periodo: FaixaDatas;
  receitasAgrupadoPorCentros: Array<LinhaCentro & { tipoMovimento: 'C' }>;
  agrupadoPor: LinhaCentro[];
  semCentroCustos: { receitas: number; despesas: number };
  totalReceitas: number;
  totalDespesas: number;
}

export const getReceitasDespesasPeriodo = async (periodo: FaixaDatas, contas: number[] = []): Promise<ReceitasDespesasPeriodo> => {
  const params = new URLSearchParams({ ...periodo });
  if (contas.length) params.set('contas', contas.join(','));
  return getJson('/api/dashboard/periodo', params, 'Erro ao buscar o resultado do período');
};

/** Movement behind a value of the "Detalhamento" (detail modal). */
export interface MovimentoDashboard {
  id: number;
  data: string;
  historico: string;
  conta: string;
  valor: number;
}

export const getMovimentosDashboard = async (args: {
  tipo: 'C' | 'D';
  centros: number[];
  periodo: FaixaDatas;
  contas?: number[];
}): Promise<MovimentoDashboard[]> => {
  const params = new URLSearchParams({ tipo: args.tipo, centros: args.centros.join(','), ...args.periodo });
  if (args.contas?.length) params.set('contas', args.contas.join(','));
  return getJson('/api/dashboard/detalhar', params, 'Erro ao buscar os lançamentos');
};
