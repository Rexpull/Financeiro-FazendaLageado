/** Ex.: "40, 30, 30" or "40% 30% 30%" → list of percentages */
export function parsePercentuaisLinha(raw: string): number[] {
	const s = raw.trim();
	if (!s) return [];
	const parts = s
		.split(/[,;]+/)
		.map((p) => p.trim().replace(/%/g, '').replace(/\s+/g, ''))
		.filter(Boolean);
	return parts.map((p) => {
		const n = parseFloat(p.replace(',', '.'));
		return Number.isFinite(n) ? n : NaN;
	});
}

/** Equal splits in hundredths basis; rounding remainder stays on last row */
export function splitPercentEquallyWithRemainderOnLast(n: number): number[] {
	if (n <= 0) return [];
	const bp = 10000;
	const each = Math.floor(bp / n);
	const rem = bp - each * n;
	const out: number[] = [];
	for (let i = 0; i < n - 1; i++) out.push(each / 100);
	out.push((each + rem) / 100);
	return out;
}

/** R$: first n-1 rounded; last absorbs difference to hit totalAbsoluto */
export function aplicarPercentuaisEmValoresMonetarios<T extends { valor: number }>(
	rateios: T[],
	percentuais: number[],
	totalAbsoluto: number
): T[] {
	const n = rateios.length;
	const out = rateios.map((r) => ({ ...r }));
	for (let i = 0; i < n - 1; i++) {
		const v = (percentuais[i] / 100) * totalAbsoluto;
		out[i].valor = Math.round(v * 100) / 100;
	}
	const sumPrev = out.slice(0, n - 1).reduce((a, r) => a + r.valor, 0);
	out[n - 1].valor = Math.round((totalAbsoluto - sumPrev) * 100) / 100;
	return out;
}

/** Non-blank percent > 0 (centros table: blank / 0 = excluded from rateio). */
export function isPercentualPreenchido(raw: string | undefined | null): boolean {
	if (raw == null) return false;
	const t = String(raw).trim().replace(/%/g, '');
	if (!t) return false;
	const n = parseFloat(t.replace(',', '.'));
	return Number.isFinite(n) && n > 0;
}

/** Parse a single table cell; null if blank / invalid / ≤ 0. */
export function parsePercentualCampo(raw: string | undefined | null): number | null {
	if (!isPercentualPreenchido(raw)) return null;
	const n = parseFloat(String(raw).trim().replace(/%/g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

export function somarPercentuaisPreenchidos(draft: Record<string, string>): number {
	return Object.values(draft).reduce((acc, raw) => {
		const n = parsePercentualCampo(raw);
		return acc + (n ?? 0);
	}, 0);
}

/**
 * Equal-split only among keys that already have a filled %.
 * Blank rows stay untouched (and stay out of rateio).
 */
export function dividirIgualmenteEntrePreenchidos(
	draft: Record<string, string>
): Record<string, string> {
	const filledIds = Object.keys(draft).filter((id) => isPercentualPreenchido(draft[id]));
	if (filledIds.length === 0) return { ...draft };
	const pcts = splitPercentEquallyWithRemainderOnLast(filledIds.length);
	const next = { ...draft };
	filledIds.forEach((id, i) => {
		next[id] = String(pcts[i]);
	});
	return next;
}

/** Build confirm rows from draft: only filled % > 0. */
export function rateiosCentrosFromDraft(
	draft: Record<string, string>,
	centrosById: Map<number, { id: number; descricao: string }>,
	opts: { multi: boolean; totalAbsoluto: number }
): { idCentro: number; descricao: string; valor: number }[] {
	const filled: { idCentro: number; descricao: string; pct: number }[] = [];

	for (const [idStr, raw] of Object.entries(draft)) {
		const pct = parsePercentualCampo(raw);
		if (pct == null) continue;
		const idCentro = Number(idStr);
		const centro = centrosById.get(idCentro);
		filled.push({
			idCentro,
			descricao: centro?.descricao || `Centro ${idCentro}`,
			pct,
		});
	}

	if (filled.length === 0) return [];

	if (opts.multi) {
		return filled.map((f) => ({
			idCentro: f.idCentro,
			descricao: f.descricao,
			valor: f.pct,
		}));
	}

	const percentuais = filled.map((f) => f.pct);
	const withMoney = aplicarPercentuaisEmValoresMonetarios(
		filled.map((f) => ({ idCentro: f.idCentro, descricao: f.descricao, valor: 0 })),
		percentuais,
		opts.totalAbsoluto
	);
	return withMoney;
}

