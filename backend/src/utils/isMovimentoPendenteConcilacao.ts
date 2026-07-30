/**
 * Same rules as Conciliação OFX "Pendentes de conciliação":
 * - transferência: pending without plan/resultadoList
 * - financiamento: pending without linked contract
 * - crédito (C): pending without cost center
 * - débito (D): pending without plan/resultadoList (centro alone does NOT make it pending)
 *
 * This differs from Fluxo "Pendentes Seleção" (centros mode), which treated any
 * movement without centro as pending — including classified despesas with a plan.
 */
export type MovimentoPendenteInput = {
	tipoMovimento?: string | null;
	modalidadeMovimento?: string | null;
	idPlanoContas?: number | null;
	idFinanciamento?: number | null;
	idCentroCustos?: number | null;
	resultadoList?: Array<{ idPlanoContas: number }> | null;
	centroCustosList?: Array<{ idCentroCustos: number }> | null;
	valor?: number | null;
};

export function isMovimentoPendenteConcilacao(mov: MovimentoPendenteInput): boolean {
	if (mov.modalidadeMovimento === 'transferencia') {
		const temPlanoUnico = mov.idPlanoContas != null;
		const temResultadoList = !!(mov.resultadoList && mov.resultadoList.length > 0);
		return !temPlanoUnico && !temResultadoList;
	}

	if (mov.modalidadeMovimento === 'financiamento') {
		return mov.idFinanciamento == null || Number(mov.idFinanciamento) <= 0;
	}

	if (mov.tipoMovimento === 'C') {
		const temCentroUnico = mov.idCentroCustos != null;
		const temCentroCustosList = !!(mov.centroCustosList && mov.centroCustosList.length > 0);
		return !temCentroUnico && !temCentroCustosList;
	}

	const temPlanoUnico = mov.idPlanoContas != null;
	const temResultadoList = !!(mov.resultadoList && mov.resultadoList.length > 0);
	return !temPlanoUnico && !temResultadoList;
}

export type ResumoPendentesConcilacao = {
	todos: { quantidade: number; valorTotal: number };
	pendentes: { quantidade: number; valorTotal: number };
};

/** Aggregate count + absolute value for "Mostrar todos" vs "Pendentes de conciliação". */
export function resumirPendentesConcilacao(
	movimentos: MovimentoPendenteInput[],
): ResumoPendentesConcilacao {
	let todosValor = 0;
	let pendentesQtd = 0;
	let pendentesValor = 0;

	for (const mov of movimentos) {
		const v = Math.abs(Number(mov.valor) || 0);
		todosValor += v;
		if (isMovimentoPendenteConcilacao(mov)) {
			pendentesQtd += 1;
			pendentesValor += v;
		}
	}

	return {
		todos: { quantidade: movimentos.length, valorTotal: todosValor },
		pendentes: { quantidade: pendentesQtd, valorTotal: pendentesValor },
	};
}
