import * as XLSX from 'xlsx';

/**
 * Excel number format for money: Excel shows it with the user's separators, so a pt-BR Excel reads
 * R$ 1.268.523,95 — and the cell stays a number (sums and filters keep working).
 */
export const FORMATO_BRL = '"R$" #,##0.00;-"R$" #,##0.00';
/** Fraction (0.1234) shown as 12,34% */
export const FORMATO_PERCENTUAL = '0.00%';

/**
 * Sheet from rows (header = keys of the first row, in order) with number formats per column
 * (`formatos` by header) and column widths in characters.
 */
export function planilhaComFormatos<T extends Record<string, string | number>>(
	linhas: T[],
	formatos: Partial<Record<Extract<keyof T, string>, string>>,
	larguras: Partial<Record<Extract<keyof T, string>, number>> = {},
): XLSX.WorkSheet {
	const ws = XLSX.utils.json_to_sheet(linhas);
	const cabecalho = linhas.length ? (Object.keys(linhas[0]) as Array<Extract<keyof T, string>>) : [];
	cabecalho.forEach((coluna, c) => {
		const formato = formatos[coluna];
		if (!formato) return;
		for (let r = 1; r <= linhas.length; r++) {
			const celula = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
			if (celula && celula.t === 'n') celula.z = formato;
		}
	});
	ws['!cols'] = cabecalho.map((coluna) => ({ wch: larguras[coluna] ?? Math.max(10, coluna.length + 2) }));
	return ws;
}
