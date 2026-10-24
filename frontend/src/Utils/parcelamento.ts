import { adicionarMeses } from './dataSemFuso';

/**
 * Due dates for `quantidade` installments starting at `primeiroVencimento` ('YYYY-MM-DD'),
 * every `intervaloMeses` months (1 = mensal, 12 = anual). Pure string/UTC arithmetic: no month is
 * skipped and the original day is kept whenever the month has it (31/01 -> 28/02 -> 31/03).
 */
export function gerarDatasVencimento(primeiroVencimento: string, quantidade: number, intervaloMeses = 1): string[] {
	const dia = Number(primeiroVencimento.slice(8, 10));
	return Array.from({ length: Math.max(0, quantidade) }, (_, i) =>
		adicionarMeses(primeiroVencimento, i * intervaloMeses, dia),
	);
}

/**
 * Splits `total` into `quantidade` installments with 2 decimals; the rounding residual goes to the
 * last one, so the sum is always exactly `total` (R$ 100 em 3 = 33,33 + 33,33 + 33,34).
 */
export function dividirValorEmParcelas(total: number, quantidade: number): number[] {
	if (!Number.isFinite(total) || quantidade < 1) return [];
	const centavos = Math.round(total * 100);
	const base = Math.trunc(centavos / quantidade);
	return Array.from({ length: quantidade }, (_, i) =>
		(i === quantidade - 1 ? centavos - base * (quantidade - 1) : base) / 100,
	);
}
