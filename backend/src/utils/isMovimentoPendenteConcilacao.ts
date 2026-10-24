/**
 * ONE rule for "pendente de conciliação", used by every screen (Conciliação lists/exports, Conciliação
 * OFX, notification bell, reports, Dashboard footer). JS version for the frontend + SQL version for
 * queries — keep both in sync (tests cover both).
 *
 * - transferência: pending without plan (MB.idPlanoContas or Resultado rows)
 * - financiamento: pending without a linked contract (idFinanciamento > 0)
 * - padrão crédito: pending without cost centre (MB.idCentroCustos or MovimentoCentroCustos rows)
 * - padrão débito: pending without plan OR without cost centre. Result screens (Dashboard, Fluxo)
 *   split expenses by cost centre (custeio × investimento), so a debit with a plan but no centre
 *   would vanish from them; it must show up here to be completed.
 * tipoMovimento NULL (legacy) falls back to the sign of valor.
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

const ehCredito = (mov: MovimentoPendenteInput) =>
	mov.tipoMovimento === 'C' || (mov.tipoMovimento == null && Number(mov.valor) > 0);

const temPlano = (mov: MovimentoPendenteInput) =>
	mov.idPlanoContas != null || !!(mov.resultadoList && mov.resultadoList.length > 0);

const temCentro = (mov: MovimentoPendenteInput) =>
	mov.idCentroCustos != null || !!(mov.centroCustosList && mov.centroCustosList.length > 0);

export function isMovimentoPendenteConcilacao(mov: MovimentoPendenteInput): boolean {
	if (mov.modalidadeMovimento === 'transferencia') return !temPlano(mov);
	if (mov.modalidadeMovimento === 'financiamento') return mov.idFinanciamento == null || Number(mov.idFinanciamento) <= 0;
	if (ehCredito(mov)) return !temCentro(mov);
	return !temPlano(mov) || !temCentro(mov);
}

/**
 * SQL boolean expression: TRUE when the movement (table alias `mb`) is pending. Same rule as
 * isMovimentoPendenteConcilacao. No bind parameters.
 */
export function sqlMovimentoPendente(alias = 'mb'): string {
	const a = alias;
	const plano = `(${a}.idPlanoContas IS NOT NULL OR EXISTS (SELECT 1 FROM Resultado r_pend WHERE r_pend.idMovimentoBancario = ${a}.id))`;
	const centro = `(${a}.idCentroCustos IS NOT NULL OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc_pend WHERE mcc_pend.idMovimentoBancario = ${a}.id))`;
	const credito = `(${a}.tipoMovimento = 'C' OR (${a}.tipoMovimento IS NULL AND ${a}.valor > 0))`;
	return `(
		(${a}.modalidadeMovimento = 'transferencia' AND NOT ${plano})
		OR (${a}.modalidadeMovimento = 'financiamento' AND (${a}.idFinanciamento IS NULL OR ${a}.idFinanciamento <= 0))
		OR (COALESCE(${a}.modalidadeMovimento, 'padrao') NOT IN ('transferencia', 'financiamento') AND (
			(${credito} AND NOT ${centro})
			OR (NOT ${credito} AND (NOT ${plano} OR NOT ${centro}))
		))
	)`;
}

/** SQL boolean expression: TRUE when the movement is classified (not pending). */
export function sqlMovimentoClassificado(alias = 'mb'): string {
	return `(NOT ${sqlMovimentoPendente(alias)})`;
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
