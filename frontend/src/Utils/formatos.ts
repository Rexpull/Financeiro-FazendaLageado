// Number formats shared by every screen (pt-BR). Use these instead of ad-hoc toFixed()/toLocaleString().

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** R$ 1.234,56 (negative: -R$ 1.234,56). Invalid/empty → R$ 0,00. */
export function brl(valor: number | string | null | undefined): string {
	const n = Number(valor);
	return BRL.format(Number.isFinite(n) ? n : 0);
}

/** 12,5% — percentage already in 0..100 scale, comma as decimal separator. Invalid → "—". */
export function pct(valor: number | null | undefined, casas = 1): string {
	const n = Number(valor);
	if (valor == null || !Number.isFinite(n)) return '—';
	return `${n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Short money for chart axes: R$ 950, R$ 12 mil, R$ 1,5 mi, R$ 2 bi. */
export function brlCompacto(valor: number | null | undefined): string {
	const n = Number(valor) || 0;
	const abs = Math.abs(n);
	const sinal = n < 0 ? '-' : '';
	const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 });
	if (abs >= 1e9) return `${sinal}R$ ${fmt(abs / 1e9)} bi`;
	if (abs >= 1e6) return `${sinal}R$ ${fmt(abs / 1e6)} mi`;
	if (abs >= 1e3) return `${sinal}R$ ${fmt(abs / 1e3)} mil`;
	return `${sinal}R$ ${fmt(abs)}`;
}
