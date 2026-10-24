// services/fluxoCaixaService.ts
import { FluxoCaixaMes, FluxoCaixaResponse } from '../../../backend/src/models/FluxoCaixaDTO';
import { MovimentoDetalhado } from '../../../backend/src/models/MovimentoDetalhado';
const API_URL = (import.meta as any).env.VITE_API_URL;

/** The Fluxo screen only uses 'centros'; 'planos' is a legacy backend layout. */
type TipoAgrupamento = 'planos' | 'centros';

async function erroDaResposta(res: Response, prefixo: string): Promise<Error> {
	const errorData = (await res.json().catch(() => ({ error: 'Erro desconhecido' }))) as { error?: string; details?: string };
	console.error('Erro na resposta do servidor:', errorData);
	return new Error(`${prefixo}: ${errorData.details || errorData.error || res.statusText}`);
}

export const buscarFluxoCaixa = async (ano: string, contas: string[], tipoAgrupamento: TipoAgrupamento = 'centros'): Promise<FluxoCaixaResponse> => {
	const res = await fetch(`${API_URL}/api/fluxoCaixa`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas, tipoAgrupamento }),
	});
	if (!res.ok) throw await erroDaResposta(res, 'Erro ao buscar fluxo de caixa');
	return res.json();
};

export const buscarDetalhamento = async (
	planoId: string,
	mes: number,
	tipo: string,
	ano: string,
	tipoAgrupamento: TipoAgrupamento = 'centros',
	subtipo?: 'pagos' | 'contratados',
	contas: string[] = [],
): Promise<MovimentoDetalhado[] | any[]> => {
	const params = new URLSearchParams({ planoId, mes: String(mes), tipo, ano, tipoAgrupamento });
	if (subtipo) params.set('subtipo', subtipo);
	if (contas.length > 0) params.set('contas', contas.join(','));
	const res = await fetch(`${API_URL}/api/fluxoCaixa/detalhar?${params.toString()}`, {
		method: 'GET',
		headers: { 'Accept': 'application/json' },
	});

	if (!res.ok) {
		throw new Error(`Erro ao buscar detalhamento (${res.status})`);
	}

	return (await res.json()) as any[];
};

/** Same engine as buscarFluxoCaixa, for the previous year (Gráfico comparison). */
export const buscarFluxoCaixaAnoAnterior = async (ano: string, contas: string[], tipoAgrupamento: TipoAgrupamento = 'centros'): Promise<FluxoCaixaMes[]> => {
	const res = await fetch(`${API_URL}/api/fluxoCaixa/anoAnterior`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas, tipoAgrupamento }),
	});
	if (!res.ok) throw await erroDaResposta(res, 'Erro ao buscar fluxo de caixa do ano anterior');
	const response = (await res.json()) as FluxoCaixaResponse | FluxoCaixaMes[];
	// Compatibility: { dadosMensais } or the array itself
	return Array.isArray(response) ? response : response.dadosMensais;
};
