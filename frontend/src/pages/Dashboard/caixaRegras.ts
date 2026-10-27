// Pure rules of the Dashboard "Caixa" tab (month navigation, boleto-per-day input, parcelas, tooltips).
import { parseValorMonetario } from '../../Utils/valorMonetario';
import type { CaixaLancamento, CaixaParcela } from '../../services/caixaService';

export const MESES_CAIXA = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** First year offered (same as the Fluxo de Caixa) and last month the Caixa can be planned: Dec/2040. */
export const ANO_MIN_CAIXA = 2024;
export const ANO_MAX_CAIXA = 2040;
/** Same ceiling the backend applies to amounts. */
export const VALOR_MAX_CAIXA = 1e12;

export interface PeriodoCaixa {
	ano: number;
	/** 1–12 */
	mes: number;
}

/** Years of the month/year picker: ANO_MIN_CAIXA (or an earlier year already selected) through 2040. */
export function anosCaixa(anoSelecionado?: number): number[] {
	const inicio = Math.min(ANO_MIN_CAIXA, anoSelecionado ?? ANO_MIN_CAIXA);
	return Array.from({ length: ANO_MAX_CAIXA - inicio + 1 }, (_, i) => inicio + i);
}

/**
 * Month opened from the Dashboard filters: the filter's month ("Jan".."Dez"); with "Todos" (''), the
 * current month when the year is the current one, otherwise January.
 */
export function periodoInicialCaixa(anoSelecionado: number, mesSelecionado: string, hoje: Date = new Date()): PeriodoCaixa {
	const ano = Math.min(anoSelecionado, ANO_MAX_CAIXA);
	const idx = MESES_CAIXA.indexOf(mesSelecionado);
	if (idx >= 0) return { ano, mes: idx + 1 };
	return { ano, mes: ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 1 };
}

/** Month `delta` months away, or null when it leaves [Jan/anoMin, Dez/2040]. */
export function navegarMes(p: PeriodoCaixa, delta: number, anoMin = ANO_MIN_CAIXA): PeriodoCaixa | null {
	const total = p.ano * 12 + (p.mes - 1) + delta;
	const ano = Math.floor(total / 12);
	const mes = total - ano * 12 + 1;
	if (ano < anoMin || ano > ANO_MAX_CAIXA) return null;
	return { ano, mes };
}

export type ValorDiaInterpretado = { ok: true; valor: number | null } | { ok: false; erro: string };

/**
 * Text typed in a day's boleto cell → amount to save. Empty or zero = no boletos that day (null).
 * Accepts "1.234,56", "1234,56", "1234.56", "R$ 1.234,56".
 */
export function interpretarValorDia(texto: string): ValorDiaInterpretado {
	if (!texto.trim()) return { ok: true, valor: null };
	const n = parseValorMonetario(texto);
	if (!Number.isFinite(n)) return { ok: false, erro: 'Valor inválido. Use, por exemplo, 1.234,56' };
	if (n < 0) return { ok: false, erro: 'O valor não pode ser negativo' };
	if (n > VALOR_MAX_CAIXA) return { ok: false, erro: 'Valor muito alto' };
	return { ok: true, valor: n === 0 ? null : n };
}

/** Amount shown inside an editable cell: "1.234,56" (no "R$"); zero/empty → "". */
export function textoValorEditavel(valor: number | null | undefined): string {
	if (!valor) return '';
	return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Same amount in cents (avoids saving when only the formatting changed). */
export const mesmoValor = (a: number | null | undefined, b: number | null | undefined) =>
	Math.round((a ?? 0) * 100) === Math.round((b ?? 0) * 100);

const somaCentavos = (valores: number[]) => valores.reduce((s, v) => s + Math.round(v * 100), 0) / 100;

export interface ResumoParcelas {
	quantidade: number;
	consideradas: number;
	valorConsiderado: number;
	valorNaoConsiderado: number;
}

/** Parcelas of the month (or of one day, with `data`) split into considered / not considered. */
export function resumoParcelas(parcelas: CaixaParcela[], data?: string): ResumoParcelas {
	const lista = data ? parcelas.filter((p) => p.data === data) : parcelas;
	const sim = lista.filter((p) => p.considerada);
	const nao = lista.filter((p) => !p.considerada);
	return {
		quantidade: lista.length,
		consideradas: sim.length,
		valorConsiderado: somaCentavos(sim.map((p) => p.valor)),
		valorNaoConsiderado: somaCentavos(nao.map((p) => p.valor)),
	};
}

/** Previsões of the day for the hover tooltip: entradas first, then saídas, in the order typed. */
export function previsoesDoDia(lancamentos: CaixaLancamento[], data: string): CaixaLancamento[] {
	const doDia = lancamentos.filter((l) => l.tipo === 'PREVISAO' && l.data === data);
	return [...doDia.filter((l) => l.natureza === 'C'), ...doDia.filter((l) => l.natureza === 'D')];
}

/** 'YYYY-MM-DD' accepted by the previsão form: a real calendar date up to 31/12/2040. */
export function dataCaixaValida(data: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
	if (!m) return false;
	const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const dt = new Date(Date.UTC(a, mes - 1, d));
	const existe = dt.getUTCFullYear() === a && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === d;
	return existe && a >= 2000 && a <= ANO_MAX_CAIXA;
}
