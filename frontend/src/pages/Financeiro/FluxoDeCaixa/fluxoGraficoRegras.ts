/**
 * Aba "Gráfico" do Fluxo de Caixa: cards, série do gráfico e Top 10 calculados com as mesmas regras da tabela
 * (montarFluxoMensal): (A) saldo operacional, (B) investimentos, (C) saldo após investimentos = R − D,
 * lucratividade = C ÷ R. Financiamentos ficam fora desses resultados.
 */
import { montarFluxoMensal, FluxoMesCentrosInput, LinhaFluxo } from './fluxoMensalRegras';

export type MesDestaque = { idx: number; valor: number };

export type ResumoAnoFluxo = {
	linhas: LinhaFluxo[];
	total: LinhaFluxo;
	/** Some month with receitas or despesas */
	temDados: boolean;
	/** (C) of the year */
	acumulado: number;
	/** C ÷ R of the year, % (null without revenue) */
	lucratividade: number | null;
	/** By (C), only months with receitas or despesas */
	melhorMes: MesDestaque | null;
	piorMes: MesDestaque | null;
	series: {
		receitas: number[];
		operacionais: number[];
		investimentos: number[];
		saldoOperacional: number[];
		saldoAposInvestimentos: number[];
	};
};

const temMovimento = (l: LinhaFluxo) => l.totalReceitas !== 0 || l.totalOperacionais !== 0 || l.totalInvestimentos !== 0;

export function resumoAnoFluxo(dados: FluxoMesCentrosInput[]): ResumoAnoFluxo {
	const { linhas, total } = montarFluxoMensal(dados);
	let melhorMes: MesDestaque | null = null;
	let piorMes: MesDestaque | null = null;
	for (let idx = 0; idx < linhas.length; idx++) {
		if (!temMovimento(linhas[idx])) continue;
		const valor = linhas[idx].saldoAposInvestimentos;
		if (!melhorMes || valor > melhorMes.valor) melhorMes = { idx, valor };
		if (!piorMes || valor < piorMes.valor) piorMes = { idx, valor };
	}
	return {
		linhas,
		total,
		temDados: linhas.some(temMovimento),
		acumulado: total.saldoAposInvestimentos,
		lucratividade: total.lucratividade,
		melhorMes,
		piorMes,
		series: {
			receitas: linhas.map((l) => l.totalReceitas),
			operacionais: linhas.map((l) => l.totalOperacionais),
			investimentos: linhas.map((l) => l.totalInvestimentos),
			saldoOperacional: linhas.map((l) => l.saldoOperacional),
			saldoAposInvestimentos: linhas.map((l) => l.saldoAposInvestimentos),
		},
	};
}

/** Current vs previous year: C difference (R$) and lucratividade difference (percentage points). */
export function compararAnos(atual: ResumoAnoFluxo, anterior: ResumoAnoFluxo) {
	return {
		diferencaAcumulado: anterior.temDados ? atual.acumulado - anterior.acumulado : null,
		diferencaLucratividade:
			anterior.temDados && atual.lucratividade != null && anterior.lucratividade != null
				? atual.lucratividade - anterior.lucratividade
				: null,
	};
}

export type CentroInfo = { id: number | string; descricao: string; tipo?: string };
export type ItemTop = { key: string; descricao: string; valor: number };

const SUFIXO: Record<string, string> = { CUSTEIO: 'Custeio', INVESTIMENTO: 'Investimento' };

/**
 * Top N centros of the year, grouped by id (never by name). When two centros share a name
 * (e.g. "Leite" custeio and "Leite" investimento) the label gets "· Custeio" / "· Investimento", like the Dashboard.
 */
export function topCentros(total: LinhaFluxo, tipo: 'receitas' | 'despesas', centros: CentroInfo[], limite = 10): ItemTop[] {
	const info = new Map(centros.map((c) => [String(c.id), c]));
	const itens =
		tipo === 'receitas'
			? Object.entries(total.receitas).map(([id, valor]) => ({ id, valor, grupo: info.get(id)?.tipo ?? '' }))
			: [
					...Object.entries(total.operacionais).map(([id, valor]) => ({ id, valor, grupo: 'CUSTEIO' })),
					...Object.entries(total.investimentos).map(([id, valor]) => ({ id, valor, grupo: 'INVESTIMENTO' })),
				];

	const nome = (id: string) => info.get(id)?.descricao || `Centro ${id}`;
	const contar = (rotulos: string[]) => rotulos.reduce((m, r) => m.set(r, (m.get(r) ?? 0) + 1), new Map<string, number>());

	const porNome = contar(itens.map((it) => nome(it.id)));
	let rotulos = itens.map((it) => {
		const base = nome(it.id);
		return porNome.get(base)! > 1 && SUFIXO[it.grupo] ? `${base} · ${SUFIXO[it.grupo]}` : base;
	});
	// Still ambiguous (same name and same type): add the id
	const repetidos = contar(rotulos);
	rotulos = rotulos.map((r, i) => (repetidos.get(r)! > 1 ? `${r} (#${itens[i].id})` : r));

	return itens
		.map((it, i) => ({ key: `${tipo === 'receitas' ? 'receitas' : it.grupo}:${it.id}`, descricao: rotulos[i], valor: it.valor }))
		.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
		.slice(0, limite);
}
