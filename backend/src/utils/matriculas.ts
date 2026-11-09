/**
 * Matrículas of rural properties given as guarantee (Financiamento.numeroGarantia).
 * numeroGarantia keeps the matrículas of a contract as text, one canonical form: digits only (no thousands
 * dots), sorted, separated by ", " — e.g. "2319, 21175, 21471". Old free-text values ("2.319, 21.175 e
 * 21.471") are read the same way, so filters match exactly on each matrícula.
 */

/** "21.175" / " 21175 " → "21175" (dots and spaces out, letters upper case) */
export const normalizarMatricula = (s: string | null | undefined): string =>
	String(s ?? '')
		.replace(/[.\s]/g, '')
		.toUpperCase();

/** "2.319, 21.175 e 21.471" → ["2319", "21175", "21471"] (no repeats, original order) */
export function separarMatriculas(texto: string | null | undefined): string[] {
	const out: string[] = [];
	for (const parte of String(texto ?? '').split(/[,;/]+|\s+e\s+|\s+/i)) {
		const m = normalizarMatricula(parte);
		if (m && !out.includes(m)) out.push(m);
	}
	return out;
}

const compararMatricula = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/** Canonical numeroGarantia of a list: sorted, ", " separated; null when empty. */
export function juntarMatriculas(lista: ReadonlyArray<string>): string | null {
	const unicas = separarMatriculas(lista.join(','));
	return unicas.length ? unicas.sort(compararMatricula).join(', ') : null;
}

/** numeroGarantia in canonical form (any old free text included). */
export const normalizarGarantia = (texto: string | null | undefined): string | null => juntarMatriculas(separarMatriculas(texto));

/** Does this numeroGarantia include the matrícula? (exact, "3041" does not match "13041") */
export const garantiaInclui = (texto: string | null | undefined, matricula: string): boolean =>
	separarMatriculas(texto).includes(normalizarMatricula(matricula));

/** "3041" → "3.041" (how the client writes them); anything not purely numeric stays as is. */
export const formatarMatricula = (m: string): string => (/^\d+$/.test(m) ? m.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : m);

export const ordenarMatriculas = <T extends { numero: string }>(lista: T[]): T[] => [...lista].sort((a, b) => compararMatricula(a.numero, b.numero));
