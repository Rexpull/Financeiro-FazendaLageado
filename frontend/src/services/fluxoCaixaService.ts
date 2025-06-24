// services/fluxoCaixaService.ts
import { FluxoCaixaMes } from '../../../backend/src/models/FluxoCaixaDTO';
import { MovimentoDetalhado } from '../../../backend/src/models/MovimentoDetalhado';
const API_URL = (import.meta as any).env.VITE_API_URL;

export const buscarFluxoCaixa = async (ano: string, contas: string[]): Promise<FluxoCaixaMes[]> => {

	console.log('ano:', ano);
	console.log('contas:', contas);
	const res = await fetch(`${API_URL}/api/fluxoCaixa`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas }),
	});
	
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido' })) as { error?: string; details?: string };
		console.error('Erro na resposta do servidor:', errorData);
		throw new Error(`Erro ao buscar fluxo de caixa: ${errorData.details || errorData.error || res.statusText}`);
	}
	
	return res.json();
};

export const buscarDetalhamento = async (planoId: string, mes: number, tipo: string, ano: string): Promise<MovimentoDetalhado[] | any[]> => {
	const res = await fetch(`${API_URL}/api/fluxoCaixa/detalhar?planoId=${planoId}&mes=${mes}&tipo=${tipo}&ano=${ano}`, {
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