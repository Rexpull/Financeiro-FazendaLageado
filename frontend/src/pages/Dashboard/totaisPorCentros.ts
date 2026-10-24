/**
 * Totals by cost centre, same rule as the Fluxo (centros):
 * receitas = credit centres; despesas split by centro tipo CUSTEIO (operacionais) vs INVESTIMENTO.
 * Used by "Receitas e Despesas" (month) and "Resultado consolidado" (year) so both screens match.
 */
type LinhaAgrupada = {
	descricao: string;
	valor: number | string;
	tipoMovimento?: string;
	subtipoDespesa?: 'custeio' | 'investimento' | string;
};

export type TotaisPorCentros = {
	receitas: number;
	custeio: number;
	investimento: number;
	despesas: number;
	saldo: number;
};

const isOutros = (descricao: string) => {
	const n = (descricao || '').trim().toLowerCase();
	return n === 'outros' || n === 'outros planos';
};

const somaAbs = (rows: LinhaAgrupada[]) => rows.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);

export function totaisPorCentros(rd?: {
	receitasAgrupadoPorCentros?: LinhaAgrupada[];
	agrupadoPor?: LinhaAgrupada[];
}): TotaisPorCentros {
	const receitasRows = (rd?.receitasAgrupadoPorCentros ?? []).filter((r) => !isOutros(r.descricao));
	const despesasRows = (rd?.agrupadoPor ?? []).filter((r) => r.tipoMovimento === 'D' && !isOutros(r.descricao));
	const receitas = somaAbs(receitasRows);
	const custeio = somaAbs(despesasRows.filter((r) => r.subtipoDespesa === 'custeio'));
	const investimento = somaAbs(despesasRows.filter((r) => r.subtipoDespesa === 'investimento'));
	const despesas = custeio + investimento;
	return { receitas, custeio, investimento, despesas, saldo: receitas - despesas };
}
