/**
 * Base rule of the result screens (receitas / despesas operacionais / despesas de investimento),
 * the same one the Dashboard (dashboardRepository) and the Fluxo de Caixa (POST /api/fluxoCaixa)
 * apply. Reports use these SQL fragments so their totals match those screens.
 *
 * Outside the results:
 * - transferências (modalidade 'transferencia');
 * - financiamentos: contract linked (idFinanciamento > 0), modalidade 'financiamento', or a plan
 *   (own or any Resultado line) configured in Parametros as financing entry/payment;
 * - "Movimentação Bancária": a plan (own or any Resultado line) that is a child of plano 170
 *   (estornos, aplicação/resgate, ...).
 *
 * Inside: credit by cost centre → receitas; debit by cost centre → custeio when the centre tipo is
 * CUSTEIO, otherwise investimento. Movements without a cost centre are pending (Conciliação).
 */

export type PlanosExclusaoResultado = {
	/** Parametros.idPlanoEntradaFinanciamentos / idPlanoPagamentoFinanciamentos */
	financiamento: number[];
	/** Children of plano 170 ("Movimentação Bancária") */
	movimentacaoBancaria: number[];
};

export type SqlComBind = { sql: string; bind: number[] };

export const PLANO_MOVIMENTACAO_BANCARIA = 170;

const idValido = (v: unknown): v is number | string => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;

/** Loads the plan ids that put a movement outside the results (same lists as Dashboard/Fluxo). */
export async function carregarPlanosExclusaoResultado(db: D1Database): Promise<PlanosExclusaoResultado> {
	const [param, filhos170] = await Promise.all([
		db
			.prepare(`SELECT idPlanoEntradaFinanciamentos, idPlanoPagamentoFinanciamentos FROM parametros WHERE id = 1`)
			.first<Record<string, unknown>>(),
		db.prepare(`SELECT id FROM planoContas WHERE idReferente = ?`).bind(PLANO_MOVIMENTACAO_BANCARIA).all<{ id: number }>(),
	]);
	const financiamento: number[] = [];
	for (const k of ['idPlanoEntradaFinanciamentos', 'idPlanoPagamentoFinanciamentos']) {
		const v = param?.[k];
		if (idValido(v)) financiamento.push(Number(v));
	}
	const movimentacaoBancaria = (filhos170.results ?? []).map((r) => Number(r.id)).filter((id) => idValido(id));
	return { financiamento: [...new Set(financiamento)], movimentacaoBancaria: [...new Set(movimentacaoBancaria)] };
}

/** TRUE when the movement uses one of the plans: own plan or any Resultado line (never NULL). */
export function sqlMovimentoUsaPlanos(alias: string, ids: number[]): SqlComBind {
	if (!ids.length) return { sql: '(1 = 0)', bind: [] };
	const ph = ids.map(() => '?').join(', ');
	return {
		sql: `((${alias}.idPlanoContas IS NOT NULL AND ${alias}.idPlanoContas IN (${ph}))
			OR EXISTS (SELECT 1 FROM Resultado r_px WHERE r_px.idMovimentoBancario = ${alias}.id AND r_px.idPlanoContas IN (${ph})))`,
		bind: [...ids, ...ids],
	};
}

/** TRUE for financing movements (contract, modalidade or Parametros financing plans). Never NULL. */
export function sqlMovimentoFinanciamento(alias: string, planos: PlanosExclusaoResultado): SqlComBind {
	const usa = sqlMovimentoUsaPlanos(alias, planos.financiamento);
	return {
		sql: `(COALESCE(${alias}.idFinanciamento, 0) > 0
			OR COALESCE(${alias}.modalidadeMovimento, '') = 'financiamento'
			OR ${usa.sql})`,
		bind: usa.bind,
	};
}

/** TRUE for transfers and "Movimentação Bancária" (children of 170): outside every result block. */
export function sqlMovimentoForaDosResultados(alias: string, planos: PlanosExclusaoResultado): SqlComBind {
	const usa = sqlMovimentoUsaPlanos(alias, planos.movimentacaoBancaria);
	return {
		sql: `(COALESCE(${alias}.modalidadeMovimento, '') = 'transferencia' OR ${usa.sql})`,
		bind: usa.bind,
	};
}

/** TRUE when the movement belongs to receitas/despesas (Dashboard/Fluxo base): no transfer, financing or 170. */
export function sqlBaseResultado(alias: string, planos: PlanosExclusaoResultado): SqlComBind {
	const fora = sqlMovimentoForaDosResultados(alias, planos);
	const fin = sqlMovimentoFinanciamento(alias, planos);
	return { sql: `(NOT ${fora.sql} AND NOT ${fin.sql})`, bind: [...fora.bind, ...fin.bind] };
}

/**
 * Date-only period filter that keeps the whole last day: dtMovimento is stored as ISO text
 * ('2026-10-31T00:00:00.000Z'), so `BETWEEN '…' AND '2026-10-31'` would drop the 31st.
 */
export function sqlPeriodo(coluna: string, dataInicio?: string, dataFim?: string): { sql: string[]; bind: string[] } {
	const sql: string[] = [];
	const bind: string[] = [];
	if (dataInicio) {
		sql.push(`DATE(${coluna}) >= DATE(?)`);
		bind.push(dataInicio);
	}
	if (dataFim) {
		sql.push(`DATE(${coluna}) <= DATE(?)`);
		bind.push(dataFim);
	}
	return { sql, bind };
}

/** Despesa subtype by the centre tipo — same rule as Dashboard/Fluxo (only CUSTEIO is custeio). */
export function subtipoDespesaPorCentro(tipoCentro: string | null | undefined): 'custeio' | 'investimento' {
	return String(tipoCentro ?? '').trim().toUpperCase() === 'CUSTEIO' ? 'custeio' : 'investimento';
}
