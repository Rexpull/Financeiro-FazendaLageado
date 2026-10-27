// Pure helpers of the Relatório de Financiamentos screen: period options, contract lookups, sorting,
// saved preferences and the Excel sheets (which follow the view/chart on the screen).
import type {
	ContratoRelatorioFinanciamentos,
	ModalidadeFinanciamento,
	RelatorioFinanciamentosData,
	ValorContratoFinanciamento,
} from '../../services/relatorioService';
import { intervaloMes, intervaloPeriodo, MESES_CURTOS, OPCOES_PERIODO, type IntervaloDashboard, type TipoPeriodo } from '../Dashboard/periodoDashboard';
import { formatarDataISO } from '../../Utils/dataSemFuso';

export type VisaoFinanciamentos = 'ativos' | 'contratados' | 'liquidados' | 'porTomador';
export type GraficoFinanciamentos = 'novosXLiquidados' | 'compromissosAno' | 'compromissosPorAno';

/** Tabs of the screen (one view at a time). `curto` is the tab label; `rotulo` the title of the view. */
export const VISOES: ReadonlyArray<{ id: VisaoFinanciamentos; rotulo: string; curto: string; usaPeriodo: boolean }> = [
	{ id: 'ativos', rotulo: 'Contratos ativos', curto: 'Ativos', usaPeriodo: false },
	{ id: 'contratados', rotulo: 'Contratados no período', curto: 'Contratados', usaPeriodo: true },
	{ id: 'liquidados', rotulo: 'Liquidados no período', curto: 'Liquidados', usaPeriodo: true },
	{ id: 'porTomador', rotulo: 'Contratos por tomador', curto: 'Por tomador', usaPeriodo: false },
];

export const GRAFICOS: ReadonlyArray<{ id: GraficoFinanciamentos; rotulo: (ano: number) => string }> = [
	{ id: 'novosXLiquidados', rotulo: () => 'Contratos novos x liquidados' },
	{ id: 'compromissosAno', rotulo: (ano) => `Compromissos financeiros de ${ano}` },
	{ id: 'compromissosPorAno', rotulo: () => 'Compromissos financeiros por ano' },
];

/** Period filter: the Dashboard options (ano, trimestres, semestres, 12 meses) plus a single month. */
export type PeriodoRelatorio = TipoPeriodo | `m${number}`;

export const MESES_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const OPCOES_PERIODO_RELATORIO: ReadonlyArray<{ valor: PeriodoRelatorio; rotulo: string; grupo: 'Período' | 'Mês' }> = [
	...OPCOES_PERIODO.map((o) => ({ valor: o.valor as PeriodoRelatorio, rotulo: o.rotulo, grupo: 'Período' as const })),
	...MESES_EXTENSO.map((nome, i) => ({ valor: `m${i + 1}` as PeriodoRelatorio, rotulo: nome, grupo: 'Mês' as const })),
];

/** [inicio, fim) of the selected period (fim exclusive), with a label and its months. */
export function intervaloRelatorio(ano: number, periodo: PeriodoRelatorio, hoje: Date = new Date()): IntervaloDashboard {
	const mes = /^m\d{1,2}$/.test(periodo) ? Number(periodo.slice(1)) : 0;
	if (mes >= 1 && mes <= 12) return { ...intervaloMes(ano, mes - 1), rotulo: `${MESES_EXTENSO[mes - 1]} de ${ano}` };
	return intervaloPeriodo(ano, periodo as TipoPeriodo, hoje);
}

export type LinhaContrato = { contrato: ContratoRelatorioFinanciamentos; valor: number; quitado?: boolean };

/** Joins the {idFinanciamento, valor} references of a view/bar with the contract data. */
export function linhasDe(contratos: ContratoRelatorioFinanciamentos[], refs: ValorContratoFinanciamento[]): LinhaContrato[] {
	const porId = new Map(contratos.map((c) => [c.idFinanciamento, c]));
	return refs.flatMap((r) => {
		const contrato = porId.get(r.idFinanciamento);
		return contrato ? [{ contrato, valor: r.valor, quitado: r.quitado }] : [];
	});
}

/** Adds up several bars (e.g. every month of the period) into one list, contract by contract, biggest first. */
export function somarPorContrato(listas: ValorContratoFinanciamento[][]): ValorContratoFinanciamento[] {
	const centavos = new Map<number, number>();
	for (const lista of listas) {
		for (const r of lista) centavos.set(r.idFinanciamento, (centavos.get(r.idFinanciamento) ?? 0) + Math.round(r.valor * 100));
	}
	return [...centavos.entries()].map(([idFinanciamento, c]) => ({ idFinanciamento, valor: c / 100 })).sort((a, b) => b.valor - a.valor);
}

export const somaValores = (lista: Array<{ valor: number }>) => lista.reduce((s, r) => s + Math.round(r.valor * 100), 0) / 100;

const MODALIDADES: Record<string, string> = {
	INVESTIMENTO: 'Investimento',
	CUSTEIO: 'Custeio',
	PARTICULAR: 'Particular',
	RENEGOCIACAO: 'Renegociação',
};

export const rotuloModalidade = (c: Pick<ContratoRelatorioFinanciamentos, 'modalidade' | 'nomeModalidadeParticular'>) => {
	const label = (c.modalidade && MODALIDADES[c.modalidade]) || c.modalidade || '-';
	return c.modalidade === 'PARTICULAR' && c.nomeModalidadeParticular ? `${label} - ${c.nomeModalidadeParticular}` : label;
};

export const situacaoLiquidado = (l: Pick<LinhaContrato, 'contrato' | 'quitado'>) =>
	l.quitado ? `Quitado em ${formatarDataISO(l.contrato.dataQuitacao)}` : 'Amortizado';

export type PlanilhaExcel = { nome: string; linhas: Array<Record<string, string | number>> };

const colunasContrato = (l: LinhaContrato) => ({
	Contrato: l.contrato.numeroContrato,
	Tomador: l.contrato.tomador || '-',
	'Banco/Credor': l.contrato.credor,
	Modalidade: rotuloModalidade(l.contrato),
	'Data do contrato': formatarDataISO(l.contrato.dataContrato),
	'Valor do contrato': l.contrato.valorContrato,
	'A vencer (parcelas não liquidadas)': l.contrato.valorVincendo,
});

/**
 * Excel sheets of the current screen: one sheet per selected view/chart (same filters, same values),
 * plus "Parcelas" of every contract listed and a "Filtros" sheet describing what was exported.
 */
export function planilhasExcel(
	dados: RelatorioFinanciamentosData,
	visoes: ReadonlySet<VisaoFinanciamentos>,
	graficos: ReadonlySet<GraficoFinanciamentos>,
	filtrosDescritos: Array<[string, string]>,
): PlanilhaExcel[] {
	const planilhas: PlanilhaExcel[] = [{ nome: 'Filtros', linhas: filtrosDescritos.map(([Filtro, Valor]) => ({ Filtro, Valor })) }];
	const listados = new Map<number, ContratoRelatorioFinanciamentos>();
	const contratosDe = (refs: ValorContratoFinanciamento[]) => {
		const linhas = linhasDe(dados.contratos, refs);
		for (const l of linhas) listados.set(l.contrato.idFinanciamento, l.contrato);
		return linhas;
	};

	if (visoes.has('ativos')) {
		planilhas.push({ nome: 'Contratos ativos', linhas: contratosDe(dados.ativos.contratos).map(colunasContrato) });
	}
	if (visoes.has('contratados')) {
		planilhas.push({ nome: 'Contratados no período', linhas: contratosDe(dados.contratados.contratos).map(colunasContrato) });
	}
	if (visoes.has('liquidados')) {
		planilhas.push({
			nome: 'Liquidados no período',
			linhas: contratosDe(dados.liquidados.contratos).map((l) => ({
				...colunasContrato(l),
				'Pago no período': l.valor,
				Situação: situacaoLiquidado(l),
			})),
		});
	}
	if (visoes.has('porTomador')) {
		const total = dados.porTomador.valor;
		planilhas.push({
			nome: 'Por tomador',
			linhas: dados.porTomador.grupos.map((g) => ({
				Tomador: g.tomador,
				Contratos: g.quantidade,
				'Valor dos contratos': g.valorContratos,
				'A vencer (parcelas não liquidadas)': g.valor,
				'% do total a vencer': total ? Math.round((g.valor / total) * 10000) / 100 : 0,
			})),
		});
		for (const g of dados.porTomador.grupos) contratosDe(g.contratos);
	}
	if (graficos.has('novosXLiquidados')) {
		planilhas.push({
			nome: 'Novos x liquidados',
			linhas: dados.graficos.novosXLiquidados.map((m) => ({
				Mês: `${MESES_CURTOS[m.mes - 1]}/${m.ano}`,
				'Novos (parcelas dos contratos assinados)': m.novos.valor,
				'Liquidados (parcelas pagas)': m.liquidados.valor,
			})),
		});
	}
	if (graficos.has('compromissosAno')) {
		const { ano, meses } = dados.graficos.compromissosDoAno;
		planilhas.push({
			nome: `Compromissos ${ano}`,
			linhas: meses.map((m) => ({ Mês: `${MESES_CURTOS[m.mes - 1]}/${ano}`, 'Parcelas a vencer': m.valor })),
		});
	}
	if (graficos.has('compromissosPorAno')) {
		planilhas.push({
			nome: 'Compromissos por ano',
			linhas: dados.graficos.compromissosPorAno.map((a) => ({ Ano: a.ano, 'Parcelas a vencer': a.valor })),
		});
	}

	if (listados.size) {
		planilhas.push({
			nome: 'Parcelas',
			linhas: [...listados.values()].flatMap((c) =>
				c.parcelas.map((p) => ({
					Contrato: c.numeroContrato,
					Tomador: c.tomador || '-',
					'Banco/Credor': c.credor,
					Parcela: p.numParcela,
					Vencimento: formatarDataISO(p.dt_vencimento),
					Valor: p.valor,
					Situação: p.status,
					Liquidação: formatarDataISO(p.dt_liquidacao, ''),
				})),
			),
		});
	}
	return planilhas;
}

// ---- Listing helpers ----

/** Contract with no parcelas registered (0 de 0) and nothing a vencer: shown apart, "conferir no cadastro". */
export const semParcelasCadastradas = (c: Pick<ContratoRelatorioFinanciamentos, 'parcelas' | 'valorVincendo'>) =>
	c.parcelas.length === 0 && !c.valorVincendo;

/** Splits the lines of a list: the main table and the contracts without parcelas (footnote). */
export function separarSemParcelas(linhas: LinhaContrato[]): { principais: LinhaContrato[]; semParcelas: LinhaContrato[] } {
	const principais: LinhaContrato[] = [];
	const semParcelas: LinhaContrato[] = [];
	for (const l of linhas) (semParcelasCadastradas(l.contrato) && !l.valor ? semParcelas : principais).push(l);
	return { principais, semParcelas };
}

/** "7 de 8 parcelas a vencer" · "8 parcelas pagas" · "sem parcelas cadastradas" */
export function textoParcelas(c: Pick<ContratoRelatorioFinanciamentos, 'parcelas' | 'parcelasAbertas'>): string {
	const total = c.parcelas.length;
	if (!total) return 'sem parcelas cadastradas';
	if (!c.parcelasAbertas) return total === 1 ? '1 parcela paga' : `${total} parcelas pagas`;
	return `${c.parcelasAbertas} de ${total} ${total === 1 ? 'parcela' : 'parcelas'} a vencer`;
}

export type ColunaOrdem = 'contrato' | 'tomador' | 'valor' | 'vencer' | 'valorContrato' | 'data';
export type Ordem = { coluna: ColunaOrdem; desc: boolean };

const compararTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

/** Sorted copy of the lines; ties by contract number. */
export function ordenarLinhas(linhas: LinhaContrato[], { coluna, desc }: Ordem): LinhaContrato[] {
	const chave = (l: LinhaContrato): number | string => {
		switch (coluna) {
			case 'contrato':
				return l.contrato.numeroContrato;
			case 'tomador':
				return l.contrato.tomador || '';
			case 'valor':
				return l.valor;
			case 'valorContrato':
				return l.contrato.valorContrato;
			case 'data':
				return l.contrato.dataContrato || '';
			default:
				return l.contrato.valorVincendo;
		}
	};
	const sinal = desc ? -1 : 1;
	return [...linhas].sort((a, b) => {
		const ka = chave(a);
		const kb = chave(b);
		const r = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : compararTexto(String(ka), String(kb));
		return r * sinal || compararTexto(a.contrato.numeroContrato, b.contrato.numeroContrato);
	});
}

/** Parcela still to pay (same rule as the backend: only status "Liquidado" counts as paid). */
const emAberto = (p: { status: string }) => p.status !== 'Liquidado';

/** Same day `meses` months later, as AAAA-MM-DD text (day clamped to 28 so it is always a valid date). */
function somarMesesISO(hoje: string, meses: number): string {
	const total = Number(hoje.slice(0, 4)) * 12 + Number(hoje.slice(5, 7)) - 1 + meses;
	const dia = Math.min(Number(hoje.slice(8, 10)) || 1, 28);
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Parcelas to pay up to `meses` months from today (overdue ones included — they are due now), for the
 * contracts in `refs`. `emAtraso` is the overdue part.
 */
export function proximosMeses(
	contratos: ContratoRelatorioFinanciamentos[],
	refs: ValorContratoFinanciamento[],
	hoje: string,
	meses = 12,
): { valor: number; emAtraso: number; contratos: ValorContratoFinanciamento[] } {
	const limite = somarMesesISO(hoje, meses);
	const ids = new Set(refs.map((r) => r.idFinanciamento));
	let atraso = 0;
	const lista: ValorContratoFinanciamento[] = [];
	for (const c of contratos) {
		if (!ids.has(c.idFinanciamento)) continue;
		let centavos = 0;
		for (const p of c.parcelas) {
			if (!emAberto(p) || !p.dt_vencimento || p.dt_vencimento > limite) continue;
			centavos += Math.round(p.valor * 100);
			if (p.dt_vencimento < hoje) atraso += Math.round(p.valor * 100);
		}
		if (centavos) lista.push({ idFinanciamento: c.idFinanciamento, valor: centavos / 100 });
	}
	const porContrato = somarPorContrato([lista]);
	return { valor: somaValores(porContrato), emAtraso: atraso / 100, contratos: porContrato };
}

/**
 * Years offered by the year filter: years with contracts or parcelas, plus the current year up to 5
 * years ahead (and any extra, e.g. the selected one), newest first.
 */
export function anosDisponiveis(contratos: ContratoRelatorioFinanciamentos[], anoAtual: number, extras: number[] = []): number[] {
	const anos = new Set<number>(extras.filter((a) => Number.isInteger(a) && a > 1900 && a < 3000));
	for (let a = anoAtual; a <= anoAtual + 5; a++) anos.add(a);
	const add = (d?: string) => {
		const a = Number(d?.slice(0, 4));
		if (a > 1900 && a < 3000) anos.add(a);
	};
	for (const c of contratos) {
		add(c.dataContrato);
		for (const p of c.parcelas) {
			add(p.dt_vencimento);
			add(p.dt_liquidacao);
		}
	}
	return [...anos].sort((a, b) => b - a);
}

// ---- Filters and saved preferences ----

export type RefinosFinanciamentos = {
	tomador?: string;
	idBanco?: number;
	modalidade?: ModalidadeFinanciamento;
	numeroGarantia?: string;
	faixaJuros?: string;
};

/** How many of the "Mais filtros" (banco, modalidade, garantia, juros) are in use. */
export const contarFiltrosExtras = (r: RefinosFinanciamentos) => [r.idBanco, r.modalidade, r.numeroGarantia, r.faixaJuros].filter(Boolean).length;

export type ModoCompromissos = 'ano' | 'porAno';

export type PreferenciasFinanciamentos = {
	visao: VisaoFinanciamentos;
	ano: number;
	periodo: PeriodoRelatorio;
	refinos: RefinosFinanciamentos;
	/** "Mostrar gráfico" of each view */
	graficos: Partial<Record<VisaoFinanciamentos, boolean>>;
	compromissos: ModoCompromissos;
};

export const preferenciasPadrao = (anoAtual: number): PreferenciasFinanciamentos => ({
	visao: 'ativos',
	ano: anoAtual,
	periodo: 'ano',
	refinos: {},
	graficos: {},
	compromissos: 'ano',
});

const MODALIDADES_VALIDAS = ['INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'];
const FAIXAS_VALIDAS = ['<=8', '>8<=10', '>10<=12', '>12<=15', '>15'];

/** Reads the saved preferences (localStorage text), ignoring anything invalid. Never throws. */
export function lerPreferencias(texto: string | null | undefined, anoAtual: number): PreferenciasFinanciamentos {
	const padrao = preferenciasPadrao(anoAtual);
	let bruto: Record<string, unknown>;
	try {
		const v: unknown = texto ? JSON.parse(texto) : null;
		if (!v || typeof v !== 'object') return padrao;
		bruto = v as Record<string, unknown>;
	} catch {
		return padrao;
	}
	const textoValido = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined);
	const r = (bruto.refinos && typeof bruto.refinos === 'object' ? bruto.refinos : {}) as Record<string, unknown>;
	const g = (bruto.graficos && typeof bruto.graficos === 'object' ? bruto.graficos : {}) as Record<string, unknown>;
	const ano = Number(bruto.ano);
	const idBanco = Number(r.idBanco);
	return {
		visao: VISOES.some((v) => v.id === bruto.visao) ? (bruto.visao as VisaoFinanciamentos) : padrao.visao,
		ano: Number.isInteger(ano) && ano >= 1990 && ano <= anoAtual + 30 ? ano : padrao.ano,
		periodo: OPCOES_PERIODO_RELATORIO.some((o) => o.valor === bruto.periodo) ? (bruto.periodo as PeriodoRelatorio) : padrao.periodo,
		refinos: {
			tomador: textoValido(r.tomador),
			idBanco: Number.isInteger(idBanco) && idBanco > 0 ? idBanco : undefined,
			modalidade: MODALIDADES_VALIDAS.includes(String(r.modalidade)) ? (r.modalidade as ModalidadeFinanciamento) : undefined,
			numeroGarantia: textoValido(r.numeroGarantia),
			faixaJuros: FAIXAS_VALIDAS.includes(String(r.faixaJuros)) ? String(r.faixaJuros) : undefined,
		},
		graficos: Object.fromEntries(VISOES.filter((v) => g[v.id] === true).map((v) => [v.id, true])),
		compromissos: bruto.compromissos === 'porAno' ? 'porAno' : 'ano',
	};
}

/** Chart sheets exported with the view: only the chart on the screen. */
export function graficosExportados(visao: VisaoFinanciamentos, mostrarGrafico: boolean, modo: ModoCompromissos): Set<GraficoFinanciamentos> {
	if (!mostrarGrafico) return new Set();
	if (visao === 'contratados' || visao === 'liquidados') return new Set(['novosXLiquidados']);
	if (visao === 'ativos') return new Set([modo === 'porAno' ? 'compromissosPorAno' : 'compromissosAno']);
	return new Set();
}
