// Period filter of the Dashboard ("Resultado consolidado" and "Financiamentos"): year, quarter,
// semester or the last 12 months, always as a [inicio, fim) range of AAAA-MM-DD (fim exclusive),
// the same shape the backend expects (?inicio=&fim=).

export type TipoPeriodo = 'ano' | 't1' | 't2' | 't3' | 't4' | 's1' | 's2' | '12m';

export const OPCOES_PERIODO: ReadonlyArray<{ valor: TipoPeriodo; rotulo: string }> = [
	{ valor: 'ano', rotulo: 'Ano inteiro' },
	{ valor: 't1', rotulo: '1º trimestre' },
	{ valor: 't2', rotulo: '2º trimestre' },
	{ valor: 't3', rotulo: '3º trimestre' },
	{ valor: 't4', rotulo: '4º trimestre' },
	{ valor: 's1', rotulo: '1º semestre' },
	{ valor: 's2', rotulo: '2º semestre' },
	{ valor: '12m', rotulo: 'Últimos 12 meses' },
];

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** First year with data in the system (same as the Fluxo de Caixa). */
export const PRIMEIRO_ANO_DASHBOARD = 2024;
/** How many years ahead the year filter offers (future parcelas, planning). */
export const ANOS_FUTUROS_DASHBOARD = 5;

export type MesAno = { ano: number; mes: number }; // mes 1..12

export type IntervaloDashboard = {
	inicio: string;
	fim: string;
	/** "2026", "1º trimestre de 2026", "Últimos 12 meses (Nov/2025 a Out/2026)" */
	rotulo: string;
	/** Months of the range, in order (chart categories) */
	meses: MesAno[];
};

const pad = (n: number) => String(n).padStart(2, '0');
const primeiroDia = ({ ano, mes }: MesAno) => `${ano}-${pad(mes)}-01`;
const somarMeses = ({ ano, mes }: MesAno, n: number): MesAno => {
	const total = ano * 12 + (mes - 1) + n;
	return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
};

/** `quantidade` months starting at `inicio`, as an IntervaloDashboard. */
function intervaloDeMeses(inicio: MesAno, quantidade: number, rotulo: string): IntervaloDashboard {
	const meses = Array.from({ length: quantidade }, (_, i) => somarMeses(inicio, i));
	return { inicio: primeiroDia(inicio), fim: primeiroDia(somarMeses(inicio, quantidade)), rotulo, meses };
}

/** "Out/2026" */
export const rotuloMesAno = ({ ano, mes }: MesAno) => `${MESES_CURTOS[mes - 1]}/${ano}`;

/** Chart category of a month: "Out", or "Out/25" when the range crosses years. */
export function rotuloMesGrafico(m: MesAno, variosAnos: boolean): string {
	return variosAnos ? `${MESES_CURTOS[m.mes - 1]}/${String(m.ano).slice(-2)}` : MESES_CURTOS[m.mes - 1];
}

/** Range of the period filter. "Últimos 12 meses" ends with the current month (it ignores `ano`). */
export function intervaloPeriodo(ano: number, tipo: TipoPeriodo, hoje: Date = new Date()): IntervaloDashboard {
	switch (tipo) {
		case 't1':
		case 't2':
		case 't3':
		case 't4': {
			const n = Number(tipo.slice(1));
			return intervaloDeMeses({ ano, mes: (n - 1) * 3 + 1 }, 3, `${n}º trimestre de ${ano}`);
		}
		case 's1':
		case 's2': {
			const n = Number(tipo.slice(1));
			return intervaloDeMeses({ ano, mes: (n - 1) * 6 + 1 }, 6, `${n}º semestre de ${ano}`);
		}
		case '12m': {
			const atual: MesAno = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
			const inicio = somarMeses(atual, -11);
			return intervaloDeMeses(inicio, 12, `Últimos 12 meses (${rotuloMesAno(inicio)} a ${rotuloMesAno(atual)})`);
		}
		default:
			return intervaloDeMeses({ ano, mes: 1 }, 12, String(ano));
	}
}

/** Last day of a range (fim is exclusive): '2026-04-01' → '2026-03-31'. */
export function ultimoDiaDoIntervalo(fim: string): string {
	const d = new Date(Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 1, Number(fim.slice(8, 10)) - 1));
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Month filter of "Receitas e despesas": one month (mesIdx 0..11) or the whole year (-1). */
export function intervaloMes(ano: number, mesIdx: number): IntervaloDashboard {
	return mesIdx >= 0 && mesIdx <= 11
		? intervaloDeMeses({ ano, mes: mesIdx + 1 }, 1, rotuloMesAno({ ano, mes: mesIdx + 1 }))
		: intervaloDeMeses({ ano, mes: 1 }, 12, String(ano));
}

/** Years of the filter: from 2024 to 5 years ahead (2024…2031 in 2026); a selected year outside is kept. */
export function anosDashboard(hoje: Date = new Date(), selecionado?: number): number[] {
	const primeiro = Math.min(PRIMEIRO_ANO_DASHBOARD, selecionado ?? PRIMEIRO_ANO_DASHBOARD);
	const ultimo = Math.max(hoje.getFullYear() + ANOS_FUTUROS_DASHBOARD, PRIMEIRO_ANO_DASHBOARD, selecionado ?? 0);
	return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => primeiro + i);
}

/**
 * Chart data label in thousands of reais, no symbol: 4.945.000,00 → "4.945"; 284.000,00 → "284".
 * Values under R$ 1 mil keep one decimal so they don't read as zero (450 → "0,5").
 */
export function emMilhares(valor: number | null | undefined): string {
	const n = Number(valor) || 0;
	const mil = n / 1000;
	if (n !== 0 && Math.abs(mil) < 1) return mil.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
	return Math.round(mil).toLocaleString('pt-BR');
}
