/**
 * Fluxo de caixa closing balance for management view.
 * Pendências de conciliação must NOT affect operational / financing balances.
 */
export function calcularSaldoFinalFluxo(args: {
	saldoInicial: number;
	receitas: number;
	despesas: number;
	investimentos?: number;
	financiamentos?: number;
}): number {
	const investimentos = args.investimentos ?? 0;
	const financiamentos = args.financiamentos ?? 0;
	return args.saldoInicial + (args.receitas - args.despesas) + investimentos + financiamentos;
}
