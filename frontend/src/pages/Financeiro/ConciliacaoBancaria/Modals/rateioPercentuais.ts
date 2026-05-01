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
