// services/fluxoCaixaService.ts
import { FluxoCaixaMes } from '../../../backend/src/models/FluxoCaixaDTO';

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
