/**
 * Rule defined by the client on 13/11/2026: in a despesa, what is classified as investimento in the plano de
 * contas goes to a centro de custos of investimento, and what is custeio goes to a centro of custeio.
 *
 * Plans (Resultado) and centres (MovimentoCentroCustos) are stored as two separate lists, so the rule is
 * checked on the totals: the value in investimento plans must equal the value in investimento centres (and
 * therefore custeio equals custeio). One plano type → every centre of that type. Both types in the same line
 * (a card bill) → the totals per type must match, which "Detalhar por itens" guarantees item by item.
 *
 * Used by the conciliation screens (before saving) and by the worker (PUT/POST movBancario, memória).
 */

export type TipoClassificacao = 'custeio' | 'investimento';

/** One plano or one centro of the line: its type (planoContas.tipo / CentroCustos.tipo) and its value. */
export type FatiaTipo = { tipo: string | null | undefined; valor: number };

export function normalizarTipoClassificacao(tipo: string | null | undefined): TipoClassificacao | null {
	const t = String(tipo ?? '').trim().toLowerCase();
	return t === 'investimento' || t === 'custeio' ? t : null;
}

const centavos = (v: number) => Math.round(Math.abs(Number(v) || 0) * 100);
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function totaisPorTipo(fatias: FatiaTipo[]): Record<TipoClassificacao, number> {
	const out = { custeio: 0, investimento: 0 };
	for (const f of fatias) {
		const t = normalizarTipoClassificacao(f.tipo);
		if (t) out[t] += centavos(f.valor);
	}
	return out;
}

/** Type every plano of the line has, or null when there is none or both types are present. */
export function tipoUnico(fatias: FatiaTipo[]): TipoClassificacao | null {
	const tipos = new Set(fatias.map((f) => normalizarTipoClassificacao(f.tipo)).filter((t): t is TipoClassificacao => t !== null));
	return tipos.size === 1 ? [...tipos][0] : null;
}

/**
 * null = the line follows the rule; otherwise the message to show (Portuguese, ready for the screen).
 * Nothing to check when one side is empty or has an entry without a known type.
 */
export function erroTipoPlanoCentro(planos: FatiaTipo[], centros: FatiaTipo[]): string | null {
	if (planos.length === 0 || centros.length === 0) return null;
	if ([...planos, ...centros].some((f) => normalizarTipoClassificacao(f.tipo) === null)) return null;

	const tipoPlano = tipoUnico(planos);
	if (tipoPlano) {
		if (centros.every((c) => normalizarTipoClassificacao(c.tipo) === tipoPlano)) return null;
		return planos.length === 1
			? `O plano de contas é de ${tipoPlano}: o centro de custos também precisa ser de ${tipoPlano}.`
			: `Os planos de contas são de ${tipoPlano}: os centros de custos também precisam ser de ${tipoPlano}.`;
	}

	// Plans of both types: the value of each type must be the same on both sides. Percentage splits are
	// rounded line by line, hence one cent of slack per line.
	const p = totaisPorTipo(planos);
	const c = totaisPorTipo(centros);
	const folga = planos.length + centros.length;
	if (Math.abs(p.investimento - c.investimento) <= folga && Math.abs(p.custeio - c.custeio) <= folga) return null;
	return (
		`Os planos somam ${brl(p.investimento)} de investimento e ${brl(p.custeio)} de custeio, mas os centros somam ` +
		`${brl(c.investimento)} de investimento e ${brl(c.custeio)} de custeio. ` +
		'Use "Detalhar por itens" para colocar cada valor no centro do seu tipo.'
	);
}

/* ------------------------------------------------------------------ */
/* Classification a save would leave on a line (worker side).          */

export type ItemClassificacao = { id: number; valor: number };

type MovimentoClassificado = {
	valor?: number | null;
	tipoMovimento?: string | null;
	modalidadeMovimento?: string | null;
	idPlanoContas?: number | null;
	idCentroCustos?: number | null;
	resultadoList?: Array<{ idPlanoContas?: number | null; valor?: number | null }> | null;
	centroCustosList?: Array<{ idCentroCustos?: number | null; valor?: number | null }> | null;
};

const idValido = (v: unknown): v is number => Number.isInteger(Number(v)) && Number(v) > 0;

function listaOuUnico<T>(lista: T[] | null | undefined, idDe: (x: T) => unknown, valorDe: (x: T) => unknown, unico: unknown, total: number): ItemClassificacao[] {
	const itens = (lista ?? []).filter((x) => idValido(idDe(x))).map((x) => ({ id: Number(idDe(x)), valor: Math.abs(Number(valorDe(x)) || 0) }));
	if (itens.length) return itens;
	return idValido(unico) ? [{ id: Number(unico), valor: total }] : [];
}

/** Plans and centres a stored (or about to be created) line has. */
export function classificacaoDe(m: MovimentoClassificado): { planos: ItemClassificacao[]; centros: ItemClassificacao[] } {
	const total = Math.abs(Number(m.valor) || 0);
	return {
		planos: listaOuUnico(m.resultadoList, (r) => r.idPlanoContas, (r) => r.valor, m.idPlanoContas, total),
		centros: listaOuUnico(m.centroCustosList, (c) => c.idCentroCustos, (c) => c.valor, m.idCentroCustos, total),
	};
}

const CAMPOS_CLASSIFICACAO = ['idPlanoContas', 'idCentroCustos', 'resultadoList', 'centroCustosList'] as const;

/**
 * Classification the line will have after a partial PUT (`body` over the stored `antes`), following what
 * MovimentoBancarioRepository.update does: a non-empty list sent wins; otherwise a single id counts only
 * when it CHANGES the stored column (to an id = one entry, to null = that side is cleared); anything else
 * keeps what is stored. A rateio is stored with the column NULL, so sending null again keeps the rateio.
 * null = the PUT does not touch plano/centro, clears the conciliation, or the line is not a padrão despesa.
 */
export function classificacaoAposPut(
	antes: MovimentoClassificado,
	body: MovimentoClassificado,
): { planos: ItemClassificacao[]; centros: ItemClassificacao[] } | null {
	const b = body as Record<string, unknown>;
	if (!CAMPOS_CLASSIFICACAO.some((c) => b[c] !== undefined)) return null;
	if (b.limparConciliacao) return null; // "Limpar conciliação" drops every plano and centre
	const modalidade = body.modalidadeMovimento ?? antes.modalidadeMovimento ?? 'padrao';
	const valor = Number(body.valor ?? antes.valor) || 0;
	const tipo = body.tipoMovimento ?? antes.tipoMovimento ?? (valor < 0 ? 'D' : 'C');
	if (modalidade !== 'padrao' || tipo !== 'D') return null;

	const guardado = classificacaoDe(antes);
	const total = Math.abs(valor);
	const lado = <T>(lista: T[] | null | undefined, idDe: (x: T) => unknown, valorDe: (x: T) => unknown, unico: unknown, coluna: unknown, atual: ItemClassificacao[]) => {
		const enviada = listaOuUnico(lista, idDe, valorDe, null, total);
		if (enviada.length) return enviada;
		if (unico === undefined || (unico ?? null) === (coluna ?? null)) return atual;
		return idValido(unico) ? [{ id: Number(unico), valor: total }] : [];
	};
	return {
		planos: lado(body.resultadoList, (r) => r.idPlanoContas, (r) => r.valor, body.idPlanoContas, antes.idPlanoContas, guardado.planos),
		centros: lado(body.centroCustosList, (c) => c.idCentroCustos, (c) => c.valor, body.idCentroCustos, antes.idCentroCustos, guardado.centros),
	};
}

/** Same plans and centres with the same values (order ignored)? */
export function mesmaClassificacao(
	a: { planos: ItemClassificacao[]; centros: ItemClassificacao[] },
	b: { planos: ItemClassificacao[]; centros: ItemClassificacao[] },
): boolean {
	const assinatura = (l: ItemClassificacao[]) =>
		l
			.map((i) => `${i.id}:${centavos(i.valor)}`)
			.sort()
			.join(',');
	return assinatura(a.planos) === assinatura(b.planos) && assinatura(a.centros) === assinatura(b.centros);
}
