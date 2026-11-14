// Checks of the "Conciliar" modal (padrão modality) that do not depend on React state.

import { classificacaoDe, erroTipoPlanoCentro, tipoUnico, type FatiaTipo } from '../../../../../backend/src/utils/regraTipoPlanoCentro';

/**
 * What the modal has chosen for one side (planos or centros): ids with a weight (R$ or %, only the
 * proportion matters). null = nothing chosen in the modal, each line keeps what it already has.
 */
export type EscolhaClassificacao = Array<{ id: number; peso: number }> | null;

type MovimentoDaRegra = {
	valor: number;
	tipoMovimento?: string | null;
	historico?: string | null;
	idPlanoContas?: number | null;
	idCentroCustos?: number | null;
	resultadoList?: Array<{ idPlanoContas?: number | null; valor?: number | null }> | null;
	centroCustosList?: Array<{ idCentroCustos?: number | null; valor?: number | null }> | null;
};

type ArgsRegraTipo = {
	escolhaPlanos: EscolhaClassificacao;
	escolhaCentros: EscolhaClassificacao;
	/** the line being classified, or every selected line in batch mode */
	movimentos: MovimentoDaRegra[];
	tipoPlano: (id: number) => string | null | undefined;
	tipoCentro: (id: number) => string | null | undefined;
};

const ehDebito = (m: MovimentoDaRegra) => (m.tipoMovimento ? m.tipoMovimento === 'D' : Number(m.valor) < 0);

/** Planos and centros one line will have after the save, each with its type and its share of the line value. */
function fatiasDoMovimento(args: ArgsRegraTipo, m: MovimentoDaRegra): { planos: FatiaTipo[]; centros: FatiaTipo[] } {
	const total = Math.abs(Number(m.valor) || 0);
	const atual = classificacaoDe(m);
	const lado = (escolha: EscolhaClassificacao, guardado: Array<{ id: number; valor: number }>, tipo: (id: number) => string | null | undefined) => {
		const itens = escolha && escolha.length ? escolha : guardado.map((g) => ({ id: g.id, peso: g.valor }));
		const soma = itens.reduce((a, i) => a + Math.abs(i.peso), 0);
		return itens.map((i) => ({ tipo: tipo(i.id), valor: soma > 0 ? (Math.abs(i.peso) / soma) * total : 0 }));
	};
	return { planos: lado(args.escolhaPlanos, atual.planos, args.tipoPlano), centros: lado(args.escolhaCentros, atual.centros, args.tipoCentro) };
}

/**
 * Rule of 13/11/2026 (backend/src/utils/regraTipoPlanoCentro): in a despesa, investimento planos go to
 * investimento centres and custeio to custeio. Blocking: the message to show, or null. In batch mode every
 * selected despesa is checked with what it will have after the save, and the message names the first one
 * that breaks the rule.
 */
export function erroTipoPlanoCentroConciliacao(args: ArgsRegraTipo): string | null {
	for (const m of args.movimentos) {
		if (!ehDebito(m)) continue;
		const { planos, centros } = fatiasDoMovimento(args, m);
		const erro = erroTipoPlanoCentro(planos, centros);
		if (erro) return args.movimentos.length > 1 ? `"${(m.historico ?? '').trim() || 'Lançamento'}": ${erro}` : erro;
	}
	return null;
}

/**
 * Centre type the planos demand, to filter the centre lists: 'CUSTEIO' / 'INVESTIMENTO' when every despesa
 * being classified ends up with planos of one and the same type; null when there is no plano yet or both
 * types are involved (then only the totals per type are checked, see "Detalhar por itens").
 */
export function tipoCentroExigido(args: Omit<ArgsRegraTipo, 'escolhaCentros' | 'tipoCentro'>): 'CUSTEIO' | 'INVESTIMENTO' | null {
	const fatias: FatiaTipo[] = [];
	for (const m of args.movimentos) {
		if (!ehDebito(m)) continue;
		const { planos } = fatiasDoMovimento({ ...args, escolhaCentros: null, tipoCentro: () => null }, m);
		if (planos.length === 0 || planos.some((f) => !f.tipo)) return null;
		fatias.push(...planos);
	}
	const tipo = tipoUnico(fatias);
	return tipo === 'investimento' ? 'INVESTIMENTO' : tipo === 'custeio' ? 'CUSTEIO' : null;
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
