// Date-only rules for bank movements and installments, read straight from the 'YYYY-MM-DD' text.
// OFX rows are stored as 'YYYY-MM-DDT00:00:00.000Z' (the bank's calendar day). Manual entries and
// transfers used `new Date(local).toISOString()`: 31/01 22:30 in UTC-3 became 2025-02-01T01:30Z
// and showed up in February. They now store the chosen LOCAL day the same way as OFX rows.

const DIA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** 'YYYY-MM-DD' from a date / datetime-local input value or an ISO string (text only, no timezone). */
export function diaDoValor(valor: string | null | undefined): string | null {
	const m = DIA_ISO.exec(String(valor ?? '').trim());
	if (!m) return null;
	const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const d = new Date(Date.UTC(ano, mes - 1, dia));
	if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}

/** dtMovimento of a manual entry / transfer: the chosen calendar day as 'YYYY-MM-DDT00:00:00.000Z' (like OFX rows). */
export function dtMovimentoDoDia(valor: string | null | undefined): string {
	const dia = diaDoValor(valor);
	if (!dia) throw new Error('Data inválida');
	return `${dia}T00:00:00.000Z`;
}

/** Year of a 'YYYY-MM-DD…' value, or null. */
export function anoDaDataISO(valor: string | null | undefined): number | null {
	const dia = diaDoValor(valor);
	return dia ? Number(dia.slice(0, 4)) : null;
}

/** Whole calendar months from `inicio` to `fim` (both 'YYYY-MM-DD…'), ignoring the day; null when invalid. */
export function mesesEntreDatasISO(inicio: string | null | undefined, fim: string | null | undefined): number | null {
	const a = diaDoValor(inicio);
	const b = diaDoValor(fim);
	if (!a || !b) return null;
	return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}
