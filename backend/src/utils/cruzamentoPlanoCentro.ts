import { erroTipoPlanoCentro, normalizarTipoClassificacao, type FatiaTipo, type TipoClassificacao } from './regraTipoPlanoCentro';

/**
 * A line with several planos AND several centres is stored as two separate lists (Resultado and
 * MovimentoCentroCustos): which plano went to which centre is not kept. A report that shows plano × centro
 * (Relatório Itens Classificados) has to rebuild the pairs.
 *
 * With the plano × centro type rule (utils/regraTipoPlanoCentro) the value of each type is the same on both
 * sides, so each plano is split only among the centres of ITS type: an investimento plano never shows up in
 * a custeio centre. Inside one type the split is by the share of each plano (the pairs are still unknown).
 *
 * A line outside the rule (classified before it) or with an unknown type keeps the old split: every plano
 * across every centre, by its share of the line.
 *
 * Returns valores[plano][centro]; null = that pair does not exist (no row in the report).
 */
export function cruzarPlanosCentros(planos: FatiaTipo[], centros: FatiaTipo[]): Array<Array<number | null>> {
	const arred = (v: number) => Math.round(v * 100) / 100;
	const valores: Array<Array<number | null>> = planos.map(() => centros.map(() => null));

	/** Splits the planos `ps` among the centres `cs` (indexes): each centre value by the plano share. */
	const ratear = (ps: number[], cs: number[]) => {
		const somaPlanos = ps.reduce((s, p) => s + planos[p].valor, 0);
		const somaCentros = cs.reduce((s, c) => s + centros[c].valor, 0);
		for (const p of ps) {
			const proporcao = ps.length === 1 || somaPlanos === 0 ? 1 : planos[p].valor / somaPlanos;
			let parcial = 0;
			for (const c of cs) {
				valores[p][c] = arred(centros[c].valor * proporcao);
				parcial += valores[p][c]!;
			}
			// Rounding residue goes to the last centre so the plano total stays exact
			const ultimo = cs[cs.length - 1];
			valores[p][ultimo] = arred(valores[p][ultimo]! + arred(somaCentros * proporcao) - parcial);
		}
	};

	const todos = (n: number) => Array.from({ length: n }, (_, i) => i);
	const doTipo = (fatias: FatiaTipo[], tipo: TipoClassificacao) => todos(fatias.length).filter((i) => normalizarTipoClassificacao(fatias[i].tipo) === tipo);
	const tiposConhecidos = [...planos, ...centros].every((f) => normalizarTipoClassificacao(f.tipo) !== null);
	const grupos = (['custeio', 'investimento'] as const).map((t) => ({ ps: doTipo(planos, t), cs: doTipo(centros, t) }));
	const porTipo =
		planos.length > 0 &&
		centros.length > 0 &&
		tiposConhecidos &&
		erroTipoPlanoCentro(planos, centros) === null &&
		grupos.every((g) => (g.ps.length === 0) === (g.cs.length === 0));

	if (porTipo) {
		for (const g of grupos) if (g.ps.length) ratear(g.ps, g.cs);
	} else if (planos.length && centros.length) {
		ratear(todos(planos.length), todos(centros.length));
	}
	return valores;
}
