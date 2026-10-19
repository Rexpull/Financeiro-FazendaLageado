/**
 * OFX re-import may correct the valor of an existing movement (parser fix).
 * The movement's rateio (Resultado / MovimentoCentroCustos rows) must survive that
 * correction, re-scaled to the new valor keeping each line's share.
 * Rounds to cents; the residual goes to the last line so the sum matches exactly.
 */
export function reescalarRateio<T extends { valor: number }>(itens: T[] | undefined, novoValorAbs: number): T[] {
	if (!itens?.length) return [];
	const total = itens.reduce((acc, i) => acc + Math.abs(Number(i.valor) || 0), 0);
	const alvoCentavos = Math.round(Math.abs(novoValorAbs) * 100);

	let acumulado = 0;
	return itens.map((item, idx) => {
		if (idx === itens.length - 1) {
			return { ...item, valor: (alvoCentavos - acumulado) / 100 };
		}
		const share = total > 0 ? Math.abs(Number(item.valor) || 0) / total : 1 / itens.length;
		const centavos = Math.round(alvoCentavos * share);
		acumulado += centavos;
		return { ...item, valor: centavos / 100 };
	});
}
