/**
 * Fluxo de Caixa de um ano. POST /api/fluxoCaixa and POST /api/fluxoCaixa/anoAnterior both use
 * montarFluxoCaixaAno, so the Gráfico's previous-year comparison follows exactly the same rules.
 *
 * Centros mode (the only one reachable from the UI):
 * - receitas by centro de custos (credits); despesas split in bucket 1000 (centros CUSTEIO) and 2000 (INVESTIMENTO)
 * - financiamentos.pagos ("Quitados") and .contratados ("Créditos novos"): see financiamentosMensaisFluxo
 * The planos mode is kept for API compatibility only.
 */
import type { MovimentoBancario } from '../models/MovimentoBancario';
import type { PlanoConta } from '../models/PlanoConta';
import type { CentroCustos } from '../models/CentroCustos';
import type { Financiamento } from '../models/Financiamento';
import type { ParcelaFinanciamento } from '../models/ParcelaFinanciamento';
import { excluirMovimentoReceitasDespesasFluxo, type PlanosFinanciamentoParametros } from './isMovimentoFinanciamento';
import { calcularSaldoFinalFluxo } from './fluxoSaldoFinal';
import { liquidacaoEfetiva, parcelasComRenegociacoes, type RenegociacaoSaldoRow } from './saldoDevedor';

export type TipoAgrupamentoFluxo = 'planos' | 'centros';

/** Accepts the old UI label too ("Centro de Custos"). */
export function normalizarTipoAgrupamento(raw: unknown): TipoAgrupamentoFluxo {
	return raw === 'centros' || raw === 'Centro de Custos' ? 'centros' : 'planos';
}

export type ValorCredor = { valor: number; descricao: string };
export type FinanciamentosMesCentros = { pagos: Record<string, ValorCredor>; contratados: Record<string, ValorCredor> };

type Nomeado = { id: number; nome: string };
export type FinanciamentoFluxo = Pick<Financiamento, 'id' | 'idPessoa' | 'idBanco' | 'responsavel' | 'numeroContrato' | 'dataContrato'> & {
	idFinanciamentoOrigem?: number | null;
	parcelasList?: Array<Pick<ParcelaFinanciamento, 'valor' | 'status' | 'dt_vencimento' | 'dt_liquidacao'> & { id?: number; numParcela?: number }>;
};

/** Lender key/label: pessoa, then banco; a contract without lender counts on its own (f_<id>, label = responsável). */
export function credorDoFinanciamento(
	f: Pick<Financiamento, 'id' | 'idPessoa' | 'idBanco' | 'responsavel' | 'numeroContrato'>,
	pessoas: Nomeado[],
	bancos: Nomeado[],
): { key: string; descricao: string } {
	if (f.idPessoa) {
		const pessoa = pessoas.find((p) => p.id === f.idPessoa);
		return { key: `p_${f.idPessoa}`, descricao: pessoa ? pessoa.nome : `Pessoa ${f.idPessoa}` };
	}
	if (f.idBanco) {
		const banco = bancos.find((b) => b.id === f.idBanco);
		return { key: `b_${f.idBanco}`, descricao: banco ? banco.nome : `Banco ${f.idBanco}` };
	}
	return { key: `f_${f.id}`, descricao: f.responsavel || `Contrato ${f.numeroContrato}` };
}

/** Credit like the Dashboard: tipo 'C', or no tipo and a positive value. */
const ehCredito = (mov: Pick<MovimentoBancario, 'tipoMovimento' | 'valor'>) =>
	mov.tipoMovimento === 'C' || (mov.tipoMovimento == null && Number(mov.valor) > 0);

/** Month index (0..11) of an AAAA-MM-DD[...] date inside `ano`, or null. Text compare, no time zone shift. */
function mesNoAno(data: string | null | undefined, ano: string): number | null {
	const d = data ? String(data).slice(0, 10) : '';
	if (d.slice(0, 4) !== ano) return null;
	const m = Number(d.slice(5, 7)) - 1;
	return m >= 0 && m <= 11 ? m : null;
}

/**
 * Financiamentos of the Fluxo (centros), month by month. Same rules as the Dashboard (utils/saldoDevedor)
 * and the Fluxo detail (GET /api/fluxoCaixa/detalhar?planoId=todos):
 * - pagos ("Quitados"): parcelas liquidated in the month (status Liquidado; dt_liquidacao, or dt_vencimento when missing)
 * - contratados ("Créditos novos"): all parcelas of the contracts whose dataContrato is in the month, as the
 *   saldo devedor history sees them (parcelas replaced by a renegotiation still count, aditivo ones do not;
 *   contracts born from a renegotiation are not new credit)
 * Every contract counts, with or without banco/pessoa. Financing is not tied to bank accounts.
 */
export function financiamentosMensaisFluxo(
	ano: string | number,
	financiamentos: FinanciamentoFluxo[],
	pessoas: Nomeado[],
	bancos: Nomeado[],
	renegociacoes: RenegociacaoSaldoRow[] = [],
): FinanciamentosMesCentros[] {
	const anoTxt = String(ano);
	// Summed in cents (like the Dashboard) so the cell matches the detail to the cent
	const centavos = Array.from({ length: 12 }, () => ({ pagos: new Map<string, number>(), contratados: new Map<string, number>() }));
	const descricoes = new Map<string, string>();
	const somar = (mapa: Map<string, number>, key: string, valor: number) => mapa.set(key, (mapa.get(key) ?? 0) + valor);

	const historico = parcelasComRenegociacoes(
		financiamentos.flatMap((f) =>
			(f.parcelasList ?? []).map((p) => ({
				...p,
				dt_liquidacao: p.dt_liquidacao ?? null,
				idFinanciamento: f.id,
				id: p.id ?? 0,
				numParcela: p.numParcela ?? 0,
			})),
		),
		renegociacoes,
	);
	const contratadas = new Map<number, number[]>();
	for (const p of historico) {
		if ('entrada' in p && p.entrada) continue;
		const lista = contratadas.get(p.idFinanciamento) ?? [];
		lista.push(Math.round((Number(p.valor) || 0) * 100));
		contratadas.set(p.idFinanciamento, lista);
	}

	for (const f of financiamentos) {
		const credor = credorDoFinanciamento(f, pessoas, bancos);
		descricoes.set(credor.key, credor.descricao);
		const mesContrato = f.idFinanciamentoOrigem != null ? null : mesNoAno(f.dataContrato, anoTxt);
		if (mesContrato !== null) for (const valor of contratadas.get(f.id) ?? []) somar(centavos[mesContrato].contratados, credor.key, valor);
		for (const p of f.parcelasList ?? []) {
			const mesQuitado = mesNoAno(liquidacaoEfetiva(p), anoTxt);
			if (mesQuitado !== null) somar(centavos[mesQuitado].pagos, credor.key, Math.round((Number(p.valor) || 0) * 100));
		}
	}

	const emReais = (mapa: Map<string, number>) => {
		const out: Record<string, ValorCredor> = {};
		for (const [key, c] of mapa) out[key] = { valor: c / 100, descricao: descricoes.get(key) ?? key };
		return out;
	};
	return centavos.map((m) => ({ pagos: emReais(m.pagos), contratados: emReais(m.contratados) }));
}

type Filhos = { descricao: string; filhos: Record<number, number> };

/* eslint-disable @typescript-eslint/no-explicit-any -- receitas/financiamentos change shape with tipoAgrupamento */
export type FluxoMesAno = {
	receitas: Record<number, any>; // centros: number per centro; planos: Filhos per plano pai
	despesas: Record<number, Filhos>; // centros: 1000 = Custeio, 2000 = Investimentos
	investimentos: Record<number, number>; // planos only
	financiamentos: any; // centros: FinanciamentosMesCentros; planos: Record<credorKey, ValorCredor>
	pendentesSelecao: Record<number, number>; // always empty: pendências belong on Conciliação
	saldoInicial: number;
	saldoFinal: number;
	lucro: number;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FluxoCaixaAno = { dadosMensais: FluxoMesAno[]; parcelasVincendasAnuais: Record<number, number> };

export type EntradaFluxoCaixaAno = {
	ano: string;
	contas: number[];
	tipoAgrupamento: TipoAgrupamentoFluxo;
	movimentos: MovimentoBancario[];
	planos: PlanoConta[];
	centrosCustos: CentroCustos[];
	/** With parcelasList (all parcelas of each contract) */
	financiamentos: FinanciamentoFluxo[];
	/** Parcelas whose COALESCE(dt_liquidacao, dt_vencimento) is in the year (planos financing / vincendas) */
	parcelasDoAno: ParcelaFinanciamento[];
	pessoas: Nomeado[];
	bancos: Nomeado[];
	planosFinanciamento: PlanosFinanciamentoParametros;
	/** financiamentoRenegociacao rows (history of renegotiations), for "Créditos novos" */
	renegociacoes?: RenegociacaoSaldoRow[];
	hoje?: Date;
};

const somaNumeros = (obj: Record<string | number, unknown>) =>
	Object.values(obj).reduce((a: number, b) => a + (typeof b === 'number' ? b : 0), 0);
const somaFilhos = (obj: Record<string | number, { filhos?: Record<number, number> }>) =>
	Object.values(obj).reduce((a: number, sub) => a + somaNumeros(sub?.filhos ?? {}), 0);
const somaValores = (obj: Record<string, { valor?: number }> | undefined) =>
	Object.values(obj ?? {}).reduce((a: number, b) => a + (b?.valor || 0), 0);

export function montarFluxoCaixaAno(e: EntradaFluxoCaixaAno): FluxoCaixaAno {
	const { ano, contas, tipoAgrupamento, planos, centrosCustos } = e;
	const planosComPai170 = new Set(planos.filter((p) => p.idReferente === 170).map((p) => p.id));

	const movimentosFiltrados = e.movimentos.filter((mov) => {
		if (mov.modalidadeMovimento === 'transferencia') return false;
		if (excluirMovimentoReceitasDespesasFluxo(mov, e.planosFinanciamento)) return false;
		const planoContasIds = (mov.resultadoList ?? []).map((r) => r.idPlanoContas);
		if (mov.idPlanoContas) planoContasIds.push(mov.idPlanoContas);
		if (planoContasIds.some((id) => planosComPai170.has(id))) return false;
		return typeof mov.dtMovimento === 'string' && mov.dtMovimento.startsWith(ano) && contas.includes(mov.idContaCorrente);
	});

	const dadosMensais: FluxoMesAno[] = Array.from({ length: 12 }, () => ({
		receitas: {},
		despesas: {},
		investimentos: {},
		financiamentos: tipoAgrupamento === 'centros' ? { pagos: {}, contratados: {} } : {},
		pendentesSelecao: {},
		saldoInicial: 0,
		saldoFinal: 0,
		lucro: 0,
	}));

	if (tipoAgrupamento === 'centros') {
		const centroPorId = new Map(centrosCustos.map((c) => [c.id, c]));
		for (const movimento of movimentosFiltrados) {
			const mes = mesNoAno(movimento.dtMovimento, ano);
			if (mes === null) continue;
			// Rateio (several centros) or a single centro
			const centrosDoMovimento =
				movimento.centroCustosList && movimento.centroCustosList.length > 0
					? movimento.centroCustosList.map((cc) => ({ id: cc.idCentroCustos, valor: Math.abs(cc.valor) }))
					: movimento.idCentroCustos
						? [{ id: movimento.idCentroCustos, valor: Math.abs(movimento.valor) }]
						: [];
			// Missing cost centre → Conciliação (not Fluxo)
			for (const centroMov of centrosDoMovimento) {
				const centro = centroPorId.get(centroMov.id);
				if (!centro) {
					console.warn('⚠️ Centro de custos não encontrado:', centroMov.id);
					continue;
				}
				if (ehCredito(movimento)) {
					// Receitas: flat, by centro
					dadosMensais[mes].receitas[centro.id] = (dadosMensais[mes].receitas[centro.id] ?? 0) + centroMov.valor;
				} else {
					// Despesas: 1000 = Custeio, 2000 = Investimentos
					const categoriaId = centro.tipo === 'CUSTEIO' ? 1000 : 2000;
					const categoria = (dadosMensais[mes].despesas[categoriaId] ??= {
						descricao: centro.tipo === 'CUSTEIO' ? 'Custeio' : 'Investimentos',
						filhos: {},
					});
					categoria.filhos[centro.id] = (categoria.filhos[centro.id] ?? 0) + centroMov.valor;
				}
			}
		}

		const financiamentosMes = financiamentosMensaisFluxo(ano, e.financiamentos, e.pessoas, e.bancos, e.renegociacoes);
		financiamentosMes.forEach((f, i) => (dadosMensais[i].financiamentos = f));
	} else {
		// Planos de contas (legacy layout, not reachable from the UI)
		const planoPorId = new Map(planos.map((p) => [p.id, p]));
		for (const movimento of movimentosFiltrados) {
			const mes = mesNoAno(movimento.dtMovimento, ano);
			if (mes === null || (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado)) continue;

			const classificarPlanosComoPadrao =
				movimento.modalidadeMovimento === 'padrao' ||
				(movimento.modalidadeMovimento === 'financiamento' && movimento.idFinanciamento != null && movimento.idFinanciamento > 0);

			// Without plano / unknown plano / invalid hierarchy → pendência de conciliação (not shown on the Fluxo)
			for (const resultado of movimento.resultadoList ?? []) {
				const plano = planoPorId.get(resultado.idPlanoContas);
				if (!plano || !classificarPlanosComoPadrao || movimento.parcelado) continue;

				if (plano.tipo === 'investimento') {
					dadosMensais[mes].investimentos[resultado.idPlanoContas] =
						(dadosMensais[mes].investimentos[resultado.idPlanoContas] ?? 0) + resultado.valor;
				} else if (plano.tipo === 'custeio') {
					const grupo = plano.hierarquia.startsWith('001.') ? 'receitas' : plano.hierarquia.startsWith('002.') ? 'despesas' : null;
					const idPai = plano.idReferente;
					if (!grupo || !idPai) continue;
					const pai: Filhos = (dadosMensais[mes][grupo][idPai] ??= {
						descricao: planoPorId.get(idPai)?.descricao || 'Outro',
						filhos: {},
					});
					pai.filhos[resultado.idPlanoContas] = (pai.filhos[resultado.idPlanoContas] ?? 0) + resultado.valor;
				}
			}
		}

		const financiamentoPorId = new Map(e.financiamentos.map((f) => [f.id, f]));
		for (const parcela of e.parcelasDoAno) {
			const financiamento = financiamentoPorId.get(parcela.idFinanciamento);
			if (!financiamento || (!financiamento.idPessoa && !financiamento.idBanco)) continue;
			// Only parcelas actually paid
			if (!parcela.dt_liquidacao) continue;
			const credor = credorDoFinanciamento(financiamento, e.pessoas, e.bancos);
			const mes = mesNoAno(parcela.dt_liquidacao, ano);
			if (mes === null) continue;
			const atual = (dadosMensais[mes].financiamentos[credor.key] ??= { valor: 0, descricao: credor.descricao });
			atual.valor += parcela.valor;
		}
	}

	for (let i = 0; i < dadosMensais.length; i++) {
		const mes = dadosMensais[i];
		const receitas = tipoAgrupamento === 'centros' ? somaNumeros(mes.receitas) : somaFilhos(mes.receitas);
		const despesas = somaFilhos(mes.despesas);
		const investimentos = somaNumeros(mes.investimentos);
		const financiamentos =
			tipoAgrupamento === 'centros'
				? somaValores(mes.financiamentos.pagos) - somaValores(mes.financiamentos.contratados)
				: somaValores(mes.financiamentos);

		if (i > 0) mes.saldoInicial = dadosMensais[i - 1].saldoFinal;
		// Management Fluxo: pendências de conciliação do not affect the closing balance
		mes.saldoFinal = calcularSaldoFinalFluxo({ saldoInicial: mes.saldoInicial, receitas, despesas, investimentos, financiamentos });

		if (mes.saldoInicial === 0) {
			mes.lucro = mes.saldoFinal > 0 ? 100 : mes.saldoFinal < 0 ? -100 : 0;
		} else {
			mes.lucro = Number((((mes.saldoFinal - mes.saldoInicial) / Math.abs(mes.saldoInicial)) * 100).toFixed(1));
		}
	}

	// Parcelas vincendas por ano (future due date, not paid)
	const parcelasVincendasAnuais: Record<number, number> = {};
	const hoje = new Date(e.hoje ?? Date.now());
	hoje.setHours(0, 0, 0, 0);
	for (const parcela of e.parcelasDoAno) {
		if (!parcela.dt_vencimento || parcela.dt_liquidacao) continue;
		const vencimento = new Date(parcela.dt_vencimento);
		vencimento.setHours(0, 0, 0, 0);
		if (vencimento >= hoje) {
			const anoVencimento = vencimento.getFullYear();
			parcelasVincendasAnuais[anoVencimento] = (parcelasVincendasAnuais[anoVencimento] ?? 0) + parcela.valor;
		}
	}

	return { dadosMensais, parcelasVincendasAnuais };
}
