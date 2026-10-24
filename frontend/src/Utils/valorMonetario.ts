// Money amounts typed in the UI. CurrencyInput without an explicit locale formats with the
// BROWSER locale (en-US: "1,234.56"), and the old `replace('.', '').replace(',', '.')` parsing
// turned that into 123456. Every money field uses PROPS_MOEDA_BRL and parseValorMonetario.

/** Props for react-currency-input-field: always pt-BR / BRL ("1.234,56"), whatever the browser locale. */
export const PROPS_MOEDA_BRL = {
	intlConfig: { locale: 'pt-BR', currency: 'BRL' },
	decimalSeparator: ',',
	groupSeparator: '.',
	decimalsLimit: 2,
} as const;

/**
 * Parses a money amount: "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "1,234.56", "-50,00" or a number.
 * - both separators present: the LAST one is the decimal separator;
 * - only commas: one comma = decimal ("1234,5"), several = thousands ("1,234,567");
 * - only dots: several = thousands ("1.234.567") unless the last group has 1–2 digits (cents, "1.061.52");
 *   a single dot followed by exactly 3 digits after a non-zero integer part is pt-BR thousands
 *   ("1.500" = 1500), otherwise decimal ("1500.50", "0.500").
 * Rounded to cents. Returns NaN for anything that is not a number ("", ",", "abc").
 */
export function parseValorMonetario(valor: unknown): number {
	if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : NaN;
	if (typeof valor !== 'string') return NaN;

	let s = valor.replace(/R\$/gi, '').replace(/[\s ]/g, '');
	const negativo = s.startsWith('-');
	if (negativo) s = s.slice(1);
	if (!/\d/.test(s) || !/^[\d.,]+$/.test(s)) return NaN;

	const ultimaVirgula = s.lastIndexOf(',');
	const ultimoPonto = s.lastIndexOf('.');
	let normalizado: string;
	if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
		normalizado =
			ultimaVirgula > ultimoPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
	} else if (ultimaVirgula >= 0) {
		const partes = s.split(',');
		normalizado = partes.length === 2 ? `${partes[0]}.${partes[1]}` : partes.join('');
	} else if (ultimoPonto >= 0) {
		const partes = s.split('.');
		const ultima = partes[partes.length - 1];
		if (partes.length > 2) {
			normalizado = /^\d{1,2}$/.test(ultima) ? `${partes.slice(0, -1).join('')}.${ultima}` : partes.join('');
		} else {
			const milhar = /^\d{3}$/.test(ultima) && /^[1-9]\d{0,2}$/.test(partes[0]);
			normalizado = milhar ? partes.join('') : s;
		}
	} else {
		normalizado = s;
	}

	if (!/^\d*\.?\d*$/.test(normalizado)) return NaN;
	const n = parseFloat(normalizado);
	if (!Number.isFinite(n)) return NaN;
	const arredondado = Math.round(n * 100) / 100;
	return negativo ? -arredondado : arredondado;
}

/** parseValorMonetario, but only a value > 0 is accepted (null otherwise). */
export function valorMonetarioPositivo(valor: unknown): number | null {
	const n = parseValorMonetario(valor);
	return Number.isFinite(n) && n > 0 ? n : null;
}
