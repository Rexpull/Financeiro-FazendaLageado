export interface NotificacaoConciliacao {
  idContaCorrente: number;
  nomeConta: string;
  nomeBanco: string;
  numConta: string;
  quantidadePendentes: number;
  dataInicial: string;
  dataFinal: string;
}

export interface NotificacoesResponse {
  notificacoes: NotificacaoConciliacao[];
  total: number;
}

export const getNotificacoesConciliacao = async (): Promise<NotificacaoConciliacao[]> => {
  try {
    const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) ? (import.meta as any).env.VITE_API_URL : '';
    const url = API_URL ? `${API_URL}/api/notificacoes/conciliacao` : `/api/notificacoes/conciliacao`;
    
    console.log('🔍 Tentando buscar notificações em:', url);
    
    const res = await fetch(url);
    console.log('📡 Resposta da API:', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries())
    });
    
    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
        console.log('❌ Erro da API (JSON):', errorData);
      } catch (parseError) {
        console.log('❌ Erro da API (texto):', await res.text());
      }
      
      throw new Error(`HTTP ${res.status}: ${errorData?.error || errorData?.details || res.statusText || 'Erro desconhecido'}`);
    }
    
    const data = await res.json();
    console.log('✅ Notificações recebidas:', data);
    return data as NotificacaoConciliacao[];
  } catch (error) {
    console.error('💥 Erro detalhado ao buscar notificações:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    throw error;
  }
};

export const getNotificacoesComTotal = async (): Promise<NotificacoesResponse> => {
  try {
    const notificacoes = await getNotificacoesConciliacao();
    const total = notificacoes.reduce((total, notif) => total + notif.quantidadePendentes, 0);
    console.log('📊 Total de notificações calculado:', total);
    return { notificacoes, total };
  } catch (error) {
    console.error('💥 Erro ao buscar notificações com total:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return { notificacoes: [], total: 0 };
  }
};

export const getTotalNotificacoes = async (): Promise<number> => {
  try {
    const { total } = await getNotificacoesComTotal();
    return total;
  } catch (error) {
    console.error('💥 Erro ao buscar total de notificações:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return 0;
  }
};
