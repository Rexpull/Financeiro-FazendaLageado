// services/fluxoCaixaService.ts
import { FluxoCaixaMes, FluxoCaixaResponse } from '../../../backend/src/models/FluxoCaixaDTO';
import { MovimentoDetalhado } from '../../../backend/src/models/MovimentoDetalhado';
const API_URL = (import.meta as any).env.VITE_API_URL;

export const buscarFluxoCaixa = async (ano: string, contas: string[], tipoAgrupamento: 'planos' | 'centros' = 'planos'): Promise<FluxoCaixaResponse> => {

	console.log('ano:', ano);
	console.log('contas:', contas);
	console.log('tipoAgrupamento:', tipoAgrupamento);
	const res = await fetch(`${API_URL}/api/fluxoCaixa`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas, tipoAgrupamento }),
	});
	
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido' })) as { error?: string; details?: string };
		console.error('Erro na resposta do servidor:', errorData);
		throw new Error(`Erro ao buscar fluxo de caixa: ${errorData.details || errorData.error || res.statusText}`);
	}
	
	return res.json();
};

export const buscarDetalhamento = async (
	planoId: string,
	mes: number,
	tipo: string,
	ano: string,
	tipoAgrupamento: 'planos' | 'centros' = 'planos',
	subtipo?: 'pagos' | 'contratados'
): Promise<MovimentoDetalhado[] | any[]> => {
	const params = new URLSearchParams({ planoId, mes: String(mes), tipo, ano, tipoAgrupamento });
	if (subtipo) params.set('subtipo', subtipo);
	const res = await fetch(`${API_URL}/api/fluxoCaixa/detalhar?${params.toString()}`, {
		method: 'GET',
		headers: { 'Accept': 'application/json' },
	});

	if (!res.ok) {
		throw new Error(`Erro ao buscar detalhamento (${res.status})`);
	}

	const data = await res.json() as any[];
	console.log('Retorno buscarDetalhamento:', data);
	return data;
};

export const buscarFluxoCaixaAnoAnterior = async (ano: string, contas: string[], tipoAgrupamento: 'planos' | 'centros' = 'planos'): Promise<FluxoCaixaMes[]> => {
	const res = await fetch(`${API_URL}/api/fluxoCaixa/anoAnterior`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas, tipoAgrupamento }),
	});
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido' })) as { error?: string; details?: string };
		throw new Error(`Erro ao buscar fluxo de caixa do ano anterior: ${errorData.details || errorData.error || res.statusText}`);
	}
	const response = await res.json();
	// Compatibilidade: se retornar objeto com dadosMensais, usar isso; senão, usar diretamente
	return response.dadosMensais || response;
};