// Date-only helpers ('YYYY-MM-DD') that never go through the local timezone.
// `new Date('2025-01-31')` is UTC midnight: in UTC-3 it is still 30/01 locally, so
// toLocaleDateString() shows the previous day and setMonth() can skip months.

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

function ultimoDiaDoMes(ano: number, mesZeroBased: number): number {
	return new Date(Date.UTC(ano, mesZeroBased + 1, 0)).getUTCDate();
}

/**
 * 'YYYY-MM-DD' (or an ISO string starting with it) -> 'DD/MM/YYYY', read straight from the text.
 * Anything else falls back to the browser's pt-BR formatting; empty/invalid -> `vazio`.
 */
export function formatarDataISO(data: string | null | undefined, vazio = '-'): string {
	if (!data) return vazio;
	const m = DATA_ISO.exec(String(data).trim());
	if (m) return `${m[3]}/${m[2]}/${m[1]}`;
	const d = new Date(data);
	return Number.isNaN(d.getTime()) ? vazio : d.toLocaleDateString('pt-BR');
}

/**
 * Adds calendar months to 'YYYY-MM-DD'. The day is clamped to the last day of the target month
 * (31/01 + 1 -> 28 or 29/02); `diaPreferido` (default: the input's day) is kept whenever it fits,
 * so a series started on 31/01 continues 28/02, 31/03, 30/04, ...
 */
export function adicionarMeses(dataISO: string, meses: number, diaPreferido?: number): string {
	const m = DATA_ISO.exec(dataISO);
	if (!m) throw new Error(`Data inválida: ${dataISO}`);
	const dia = diaPreferido ?? Number(m[3]);
	const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
	const ano = Math.floor(total / 12);
	const mes = total - ano * 12;
	return `${pad(ano, 4)}-${pad(mes + 1)}-${pad(Math.min(dia, ultimoDiaDoMes(ano, mes)))}`;
}

/** Local (browser timezone) calendar date as 'YYYY-MM-DD' — unlike toISOString(), which is UTC. */
export function hojeISO(agora: Date = new Date()): string {
	return `${pad(agora.getFullYear(), 4)}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}
