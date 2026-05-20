/** Same rules as dashboard: financing movements are not operational revenue/expense. */
export function isMovimentoFinanciamento(mov: {
	idFinanciamento?: number | null;
	modalidadeMovimento?: string | null;
}): boolean {
	return (mov.idFinanciamento != null && Number(mov.idFinanciamento) > 0)
		|| mov.modalidadeMovimento === 'financiamento';
}

export type PlanosFinanciamentoParametros = {
	entrada?: number | null;
	pagamento?: number | null;
};

/** Chart-of-accounts lines configured for loan/financing in/out (Parameters). */
export function movimentoUsaPlanosFinanciamento(
	mov: {
		idPlanoContas?: number | null;
		resultadoList?: Array<{ idPlanoContas: number }>;
	},
	planos?: PlanosFinanciamentoParametros
): boolean {
	if (!planos) return false;
	const ids = [planos.entrada, planos.pagamento].filter(
		(id): id is number => id != null && Number(id) > 0
	);
	if (ids.length === 0) return false;
	if (mov.idPlanoContas != null && ids.includes(mov.idPlanoContas)) return true;
	return (mov.resultadoList ?? []).some((r) => ids.includes(r.idPlanoContas));
}

/** Exclude from cash-flow receitas/despesas/investimentos; keep only in financiamentos section. */
export function excluirMovimentoReceitasDespesasFluxo(
	mov: {
		idFinanciamento?: number | null;
		modalidadeMovimento?: string | null;
		idPlanoContas?: number | null;
		resultadoList?: Array<{ idPlanoContas: number }>;
	},
	planosFinanciamento?: PlanosFinanciamentoParametros
): boolean {
	return isMovimentoFinanciamento(mov) || movimentoUsaPlanosFinanciamento(mov, planosFinanciamento);
}
