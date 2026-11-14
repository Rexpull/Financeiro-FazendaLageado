import { erroTipoPlanoCentro, type ItemClassificacao } from '../utils/regraTipoPlanoCentro';

/**
 * Rule "investimento plano → investimento centre, custeio → custeio" (utils/regraTipoPlanoCentro) for a
 * classification given by ids: reads planoContas.tipo and CentroCustos.tipo and returns the message to
 * show, or null when the classification follows the rule.
 */
export async function erroTipoPlanoCentroNoBanco(
	db: D1Database,
	classificacao: { planos: ItemClassificacao[]; centros: ItemClassificacao[] },
): Promise<string | null> {
	const { planos, centros } = classificacao;
	if (!planos.length || !centros.length) return null;

	const tiposDe = async (tabela: 'planoContas' | 'CentroCustos', ids: number[]) => {
		const unicos = [...new Set(ids)];
		const { results } = await db
			.prepare(`SELECT id, tipo FROM ${tabela} WHERE id IN (${unicos.map(() => '?').join(',')})`)
			.bind(...unicos)
			.all<{ id: number; tipo: string | null }>();
		return new Map(results.map((r) => [Number(r.id), r.tipo]));
	};
	const [tiposPlano, tiposCentro] = await Promise.all([
		tiposDe('planoContas', planos.map((p) => p.id)),
		tiposDe('CentroCustos', centros.map((c) => c.id)),
	]);

	return erroTipoPlanoCentro(
		planos.map((p) => ({ tipo: tiposPlano.get(p.id), valor: p.valor })),
		centros.map((c) => ({ tipo: tiposCentro.get(c.id), valor: c.valor })),
	);
}
