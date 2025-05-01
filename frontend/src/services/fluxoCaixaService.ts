// services/fluxoCaixaService.ts
import { FluxoCaixaMes } from '../../../backend/src/models/FluxoCaixaDTO';
import { MovimentoDetalhado } from '../../../backend/src/models/MovimentoDetalhado';
const API_URL = import.meta.env.VITE_API_URL;

export const buscarFluxoCaixa = async (ano: string, contas: string[]): Promise<FluxoCaixaMes[]> => {

	console.log('ano:', ano);
	console.log('contas:', contas);
	const res = await fetch(`${API_URL}/api/fluxoCaixa`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ano, contas }),
	});
	if (!res.ok) throw new Error('Erro ao buscar fluxo de caixa');
	return res.json();
};

export const buscarDetalhamento = async (planoId: string, mes: number, tipo: string): Promise<MovimentoDetalhado[]> => {
	const res = await fetch(`${API_URL}/api/fluxoCaixa/detalhar?planoId=${planoId}&mes=${mes}&tipo=${tipo}`, {
		method: 'GET',
		headers: { 'Accept': 'application/json' },
	});

	if (!res.ok) {
		throw new Error(`Erro ao buscar detalhamento (${res.status})`);
	}

	return res.json();
};