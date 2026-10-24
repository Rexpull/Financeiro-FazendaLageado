import type { DiaCaixa, MinimoCaixa, NaturezaCaixa, TipoLancamentoCaixa, TotaisCaixa } from '../../../backend/src/utils/caixaDiario';

export type { DiaCaixa, MinimoCaixa, NaturezaCaixa, TipoLancamentoCaixa, TotaisCaixa };

const API_URL = import.meta.env.VITE_API_URL ?? '';

export interface CaixaLancamento {
	id: number;
	tipo: TipoLancamentoCaixa;
	natureza: NaturezaCaixa;
	data: string; // YYYY-MM-DD
	descricao: string;
	valor: number;
	criadoEm: string | null;
	atualizadoEm: string | null;
}

export interface CaixaLancamentoInput {
	tipo: TipoLancamentoCaixa;
	natureza: NaturezaCaixa;
	data: string;
	descricao: string;
	valor: number;
}

export interface CaixaParcela {
	id: number;
	data: string;
	valor: number;
	status: string;
	numParcela: number;
	idFinanciamento: number;
	contrato: string | null;
	tomador: string | null;
	banco: string | null;
}

export interface CaixaMes {
	ano: number;
	mes: number;
	saldoInicial: number | null;
	saldoInicialAtualizadoEm: string | null;
	dias: DiaCaixa[];
	totais: TotaisCaixa;
	minimo: MinimoCaixa;
	lancamentos: CaixaLancamento[];
	parcelas: CaixaParcela[];
}

async function requisitar<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		...init,
		headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
	});
	const corpo = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
	if (!res.ok) {
		throw new Error((corpo && (corpo.error || corpo.message)) || `Erro ${res.status} ao acessar o caixa`);
	}
	return corpo as unknown as T;
}

export const getCaixa = (ano: number, mes: number) => requisitar<CaixaMes>(`/api/caixa?ano=${ano}&mes=${mes}`);

/** valor null remove o saldo inicial do mês. */
export const salvarSaldoInicial = (ano: number, mes: number, valor: number | null) =>
	requisitar<{ ano: number; mes: number; valor: number | null; atualizadoEm: string | null }>('/api/caixa/saldo-inicial', {
		method: 'PUT',
		body: JSON.stringify({ ano, mes, valor }),
	});

export const criarLancamentoCaixa = (l: CaixaLancamentoInput) =>
	requisitar<CaixaLancamento>('/api/caixa/lancamentos', { method: 'POST', body: JSON.stringify(l) });

export const atualizarLancamentoCaixa = (id: number, l: Partial<CaixaLancamentoInput>) =>
	requisitar<CaixaLancamento>(`/api/caixa/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(l) });

export const excluirLancamentoCaixa = (id: number) =>
	requisitar<{ ok: true; id: number }>(`/api/caixa/lancamentos/${id}`, { method: 'DELETE' });
