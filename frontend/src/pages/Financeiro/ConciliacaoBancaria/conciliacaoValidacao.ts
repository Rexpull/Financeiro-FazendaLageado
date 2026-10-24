// Checks of the "Conciliar" modal (padrão modality) that do not depend on React state.

type TipoClassificacao = 'investimento' | 'custeio';

function normalizarTipo(tipo: string | null | undefined): TipoClassificacao | null {
	const t = String(tipo ?? '').trim().toLowerCase();
	return t === 'investimento' || t === 'custeio' ? t : null;
}

function tiposDistintos(tipos: Array<string | null | undefined>): TipoClassificacao[] {
	return [...new Set(tipos.map(normalizarTipo).filter((t): t is TipoClassificacao => t !== null))].sort();
}

/**
 * Non-blocking warning when the plan type (planoContas.tipo: investimento/custeio) disagrees with the
 * cost-centre type (CentroCustos.tipo: INVESTIMENTO/CUSTEIO). The Dashboard splits expenses by centre and
 * the plan-based views by plan, so such a movement shows up differently in each. null = nothing to warn.
 */
export function avisoTipoPlanoCentro(
	tiposPlano: Array<string | null | undefined>,
	tiposCentro: Array<string | null | undefined>,
): string | null {
	const planos = tiposDistintos(tiposPlano);
	const centros = tiposDistintos(tiposCentro);
	if (planos.length === 0 || centros.length === 0) return null;
	if (planos.join() === centros.join()) return null;
	if (planos.length === 1 && centros.length === 1) {
		return `O plano é de ${planos[0]}, mas o centro de custos é de ${centros[0]}. No Dashboard o valor entra como ${centros[0]}.`;
	}
	return (
		`Os planos (${planos.join(' e ')}) e os centros de custos (${centros.join(' e ')}) têm tipos diferentes. ` +
		'No Dashboard o valor entra pelo tipo do centro de custos.'
	);
}

type MovimentoCentro = { idCentroCustos?: number | null; centroCustosList?: unknown[] | null };

/**
 * True when saving a padrão DEBIT would leave it without cost centre (pending by the single
 * "pendente" rule, and invisible in the Dashboard/Fluxo split by centre).
 * - a centre or a centre rateio chosen in the modal → ok;
 * - single movement: an untouched multi-centre rateio is kept by the save → ok; anything else → missing;
 * - several movements: each keeps its own centre when none is chosen → missing if any has none.
 */
export function debitoFicaSemCentro(args: {
	centroEscolhido: boolean;
	rateioCentrosEscolhido: boolean;
	movimento: MovimentoCentro;
	movimentosLote?: MovimentoCentro[];
}): boolean {
	if (args.centroEscolhido || args.rateioCentrosEscolhido) return false;
	const lote = args.movimentosLote ?? [];
	if (lote.length > 1) {
		return lote.some((m) => m.idCentroCustos == null && !(m.centroCustosList && m.centroCustosList.length > 0));
	}
	return !((args.movimento.centroCustosList?.length ?? 0) > 1);
}
