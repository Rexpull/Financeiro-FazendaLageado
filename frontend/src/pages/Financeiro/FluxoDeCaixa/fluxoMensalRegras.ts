/**
 * Fluxo de caixa (agrupado por centros de custo) in the client's layout: months as rows.
 * - Receitas by centro
 * - Despesas operacionais = centros CUSTEIO (backend bucket 1000), de investimento = centros INVESTIMENTO (bucket 2000)
 * - Financiamentos: Quitados (parcelas liquidadas) and Créditos novos (parcelas dos contratos novos)
 * Totalização: (A) Saldo operacional = R − desp. operacionais; (B) Investimentos realizados;
 * (C) Saldo após investimentos = A − B = R − D. Financiamentos ficam fora dos saldos.
 */
type Valores = Record<string, number>;

export type FluxoMesCentrosInput = {
	receitas?: Record<string, number | unknown>;
	despesas?: Record<string, { descricao?: string; filhos?: Record<string, number> }>;
	financiamentos?: {
		pagos?: Record<string, { valor: number }>;
		contratados?: Record<string, { valor: number }>;
	};
};

export type LinhaFluxo = {
	receitas: Valores;
	operacionais: Valores;
	investimentos: Valores;
	totalReceitas: number;
	totalOperacionais: number;
	totalInvestimentos: number;
	quitados: number;
	creditosNovos: number;
	saldoOperacional: number; // A
	investimentosRealizados: number; // B
	saldoAposInvestimentos: number; // C (= R − D)
	lucratividade: number | null; // C ÷ R, %
};

export const CATEGORIA_CUSTEIO = '1000';
export const CATEGORIA_INVESTIMENTO = '2000';

/** First year offered in the Fluxo filter. */
export const PRIMEIRO_ANO_FLUXO = 2024;

/** Years of the Fluxo filter: from PRIMEIRO_ANO_FLUXO to next year (e.g. 2024…2027 in 2026). */
export function anosFiltroFluxo(hoje: Date = new Date()): string[] {
	const ultimo = Math.max(hoje.getFullYear() + 1, PRIMEIRO_ANO_FLUXO);
	return Array.from({ length: ultimo - PRIMEIRO_ANO_FLUXO + 1 }, (_, i) => String(PRIMEIRO_ANO_FLUXO + i));
}

// No intermediate rounding: rateio values carry 3+ decimals and rounding per month makes the
// annual total drift a cent from the Dashboard. Values are rounded only when displayed.
const soma = (v: Valores) => Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0);

const numeros = (obj: Record<string, unknown> | undefined): Valores => {
	const out: Valores = {};
	for (const [k, v] of Object.entries(obj ?? {})) {
		if (typeof v === 'number' && v !== 0) out[k] = v;
	}
	return out;
};

const somaValor = (obj: Record<string, { valor: number }> | undefined) =>
	Object.values(obj ?? {}).reduce((a, b) => a + (Number(b?.valor) || 0), 0);

function linha(receitas: Valores, operacionais: Valores, investimentos: Valores, quitados: number, creditosNovos: number): LinhaFluxo {
	const totalReceitas = soma(receitas);
	const totalOperacionais = soma(operacionais);
	const totalInvestimentos = soma(investimentos);
	const saldoOperacional = totalReceitas - totalOperacionais;
	const saldoAposInvestimentos = saldoOperacional - totalInvestimentos;
	return {
		receitas,
		operacionais,
		investimentos,
		totalReceitas,
		totalOperacionais,
		totalInvestimentos,
		quitados,
		creditosNovos,
		saldoOperacional,
		investimentosRealizados: totalInvestimentos,
		saldoAposInvestimentos,
		lucratividade: totalReceitas > 0 ? (saldoAposInvestimentos / totalReceitas) * 100 : null,
	};
}

export function montarFluxoMensal(meses: FluxoMesCentrosInput[]): {
	linhas: LinhaFluxo[];
	total: LinhaFluxo;
	/** Centro ids with any value in the year, per group (table columns). */
	colunas: { receitas: string[]; operacionais: string[]; investimentos: string[] };
} {
	const linhas = meses.map((m) =>
		linha(
			numeros(m.receitas),
			numeros(m.despesas?.[CATEGORIA_CUSTEIO]?.filhos),
			numeros(m.despesas?.[CATEGORIA_INVESTIMENTO]?.filhos),
			somaValor(m.financiamentos?.pagos),
			somaValor(m.financiamentos?.contratados),
		),
	);

	const acumular = (k: 'receitas' | 'operacionais' | 'investimentos') => {
		const out: Valores = {};
		for (const l of linhas) for (const [id, v] of Object.entries(l[k])) out[id] = (out[id] ?? 0) + v;
		return out;
	};
	const totReceitas = acumular('receitas');
	const totOperacionais = acumular('operacionais');
	const totInvestimentos = acumular('investimentos');
	const total = linha(
		totReceitas,
		totOperacionais,
		totInvestimentos,
		linhas.reduce((a, l) => a + l.quitados, 0),
		linhas.reduce((a, l) => a + l.creditosNovos, 0),
	);

	// Columns ordered by annual value (largest first)
	const ordenar = (v: Valores) => Object.keys(v).sort((a, b) => v[b] - v[a]);
	return {
		linhas,
		total,
		colunas: {
			receitas: ordenar(totReceitas),
			operacionais: ordenar(totOperacionais),
			investimentos: ordenar(totInvestimentos),
		},
	};
}
