import type { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import { diaDoValor } from '../../../Utils/dataMovimento';
import { formatarDataISO, hojeISO } from '../../../Utils/dataSemFuso';
import { brl } from '../../../Utils/formatos';
import { dividirValorEmParcelas } from '../../../Utils/parcelamento';

/** "1", "1 e 2", "1, 2 e 3". */
export function juntarLista(itens: Array<string | number>): string {
	const t = itens.map(String);
	return t.length > 1 ? `${t.slice(0, -1).join(', ')} e ${t[t.length - 1]}` : t[0] ?? '';
}

const centavos = (valor: unknown) => Math.round((Number(valor) || 0) * 100);

/** Status of an installment that is not liquidated: Vencido when due before today (local calendar day). */
export function statusParcelaEmAberto(dtVencimento: string | null | undefined, hoje: string = hojeISO()): 'Vencido' | 'Aberto' {
	const dia = diaDoValor(dtVencimento);
	return dia && dia < hoje ? 'Vencido' : 'Aberto';
}

/**
 * "Estorno" of a liquidation: back to Vencido/Aberto, without liquidation date and WITHOUT the bank
 * movement that paid it (otherwise deleting/clearing that movement later would touch it again and
 * the installment would still look paid by it).
 */
export function reabrirParcela<T extends ParcelaFinanciamento>(parcela: T, hoje: string = hojeISO()): T {
	return {
		...parcela,
		status: statusParcelaEmAberto(parcela.dt_vencimento, hoje),
		dt_liquidacao: null,
		idMovimentoBancario: null,
	};
}

/** Liquidated or linked to a bank movement: such an installment must never be deleted. */
export function parcelaEmUso(parcela: Pick<ParcelaFinanciamento, 'status' | 'idMovimentoBancario'>): boolean {
	return parcela.status === 'Liquidado' || parcela.idMovimentoBancario != null;
}

/** Saved installments (id > 0) of `originais` that are not kept in `atuais` and are in use. */
export function parcelasRemovidasEmUso<T extends ParcelaFinanciamento>(originais: T[], atuais: Array<Pick<ParcelaFinanciamento, 'id'>>): T[] {
	const mantidas = new Set(atuais.map((p) => p.id).filter((id) => id > 0));
	return originais.filter((p) => p.id > 0 && !mantidas.has(p.id) && parcelaEmUso(p)).sort((a, b) => a.numParcela - b.numParcela);
}

export function mensagemParcelasEmUso(parcelas: Array<Pick<ParcelaFinanciamento, 'numParcela' | 'status'>>): string {
	const lista = juntarLista(parcelas.map((p) => `${p.numParcela}${p.status === 'Liquidado' ? ' (liquidada)' : ' (vinculada a lançamento)'}`));
	return (
		`Não é possível remover ${parcelas.length > 1 ? 'as parcelas' : 'a parcela'} ${lista}: ` +
		'parcelas liquidadas ou vinculadas a lançamentos bancários não podem ser excluídas. ' +
		'Mantenha o número de parcelas ou estorne a liquidação antes.'
	);
}

/** Unsaved rows get unique negative ids (0 was shared by every new row: editing one changed all). */
export function proximoIdTemporario(parcelas: Array<Pick<ParcelaFinanciamento, 'id'>>): number {
	return Math.min(0, ...parcelas.map((p) => Number(p.id) || 0)) - 1;
}

/** Before saving: temporary (≤ 0) ids become 0, the "new installment" convention of the API services. */
export function semIdTemporario<T extends Pick<ParcelaFinanciamento, 'id'>>(parcela: T): T {
	return parcela.id > 0 ? parcela : { ...parcela, id: 0 };
}

// ---------------------------------------------------------------------------------------------
// Periodicity label (cards, list, ModalParcelas, ModalFinanciamento): one rule for every screen.
// ---------------------------------------------------------------------------------------------

export type Periodicidade = 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';

const DIAS_POR_MES = 365.25 / 12;

function diaAbsoluto(data: string | null | undefined): number | null {
	const dia = diaDoValor(data);
	if (!dia) return null;
	return Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) / 86_400_000;
}

/** Median gap, in months, between consecutive due dates (sorted); null with fewer than 2 valid dates. */
export function intervaloMedianoMeses(datas: Array<string | null | undefined>): number | null {
	const dias = datas.map(diaAbsoluto).filter((d): d is number => d != null).sort((a, b) => a - b);
	if (dias.length < 2) return null;
	const gaps = dias.slice(1).map((d, i) => (d - dias[i]) / DIAS_POR_MES).sort((a, b) => a - b);
	const meio = Math.floor(gaps.length / 2);
	return gaps.length % 2 ? gaps[meio] : (gaps[meio - 1] + gaps[meio]) / 2;
}

/** ≥ 11 months between due dates → Anual, ≥ 5 → Semestral, ≥ 2,5 → Trimestral, otherwise Mensal. */
export function periodicidadeParcelas(datas: Array<string | null | undefined>): Periodicidade | null {
	const meses = intervaloMedianoMeses(datas);
	if (meses == null) return null;
	if (meses >= 11) return 'Anual';
	if (meses >= 5) return 'Semestral';
	if (meses >= 2.5) return 'Trimestral';
	return 'Mensal';
}

/** "24x Mensal", "1x (parcela única)", "Sem parcelas". */
export function descricaoParcelamento(parcelas: Array<Pick<ParcelaFinanciamento, 'dt_vencimento'>> | null | undefined): string {
	const lista = parcelas ?? [];
	if (lista.length === 0) return 'Sem parcelas';
	const periodicidade = periodicidadeParcelas(lista.map((p) => p.dt_vencimento));
	if (periodicidade) return `${lista.length}x ${periodicidade}`;
	return lista.length === 1 ? '1x (parcela única)' : `${lista.length}x`;
}

// ---------------------------------------------------------------------------------------------
// Contract summary: contratado · parcelas (soma) · pago · em aberto (saldo devedor).
// ---------------------------------------------------------------------------------------------

/** Contract interest in R$: totalJuros, or legacy rows that stored that amount in taxaJurosAnual (> 100). */
export function jurosDoContrato(f: Pick<Financiamento, 'totalJuros' | 'taxaJurosAnual'>): number {
	const totalJuros = Number(f.totalJuros) || 0;
	if (totalJuros > 0) return totalJuros;
	const legado = Number(f.taxaJurosAnual) || 0;
	return legado > 100 ? legado : 0;
}

export interface ResumoParcelas {
	/** Principal (valor do contrato). */
	contratado: number;
	juros: number;
	/** contratado + juros: what the parcelas are expected to add up to. */
	previsto: number;
	somaParcelas: number;
	pago: number;
	/** Saldo devedor: parcelas not yet Liquidado (each value already includes its interest). */
	emAberto: number;
	qtdParcelas: number;
	qtdEmAberto: number;
	/** somaParcelas − previsto (0 when they match to the cent). */
	diferenca: number;
}

export function resumoParcelas(
	f: Pick<Financiamento, 'valor' | 'totalJuros' | 'taxaJurosAnual'>,
	parcelas: Array<Pick<ParcelaFinanciamento, 'valor' | 'status'>> | null | undefined,
): ResumoParcelas {
	const lista = parcelas ?? [];
	const contratado = centavos(f.valor);
	const juros = centavos(jurosDoContrato(f));
	let soma = 0;
	let pago = 0;
	let qtdEmAberto = 0;
	for (const p of lista) {
		const v = centavos(p.valor);
		soma += v;
		if (p.status === 'Liquidado') pago += v;
		else qtdEmAberto++;
	}
	return {
		contratado: contratado / 100,
		juros: juros / 100,
		previsto: (contratado + juros) / 100,
		somaParcelas: soma / 100,
		pago: pago / 100,
		emAberto: (soma - pago) / 100,
		qtdParcelas: lista.length,
		qtdEmAberto,
		diferenca: (soma - contratado - juros) / 100,
	};
}

/** Short warning when the parcelas do not add up to contratado + juros (incomplete contract); null when they do. */
export function avisoDiferencaParcelas(resumo: ResumoParcelas): string | null {
	if (resumo.qtdParcelas === 0 || Math.abs(resumo.diferenca) < 0.005) return null;
	const sentido = resumo.diferenca > 0 ? 'a mais' : 'a menos';
	return (
		`A soma das parcelas (${brl(resumo.somaParcelas)}) está ${brl(Math.abs(resumo.diferenca))} ${sentido} ` +
		`que o valor contratado + juros (${brl(resumo.previsto)}). Confira se faltam parcelas ou o total de juros.`
	);
}

// ---------------------------------------------------------------------------------------------
// Generating / recalculating installment values. Base = valor contratado + total de juros, split
// to the cent with the rounding residue on the last installment.
// ---------------------------------------------------------------------------------------------

export const MAX_PARCELAS = 600;

/** Error message for the "Quantidade de parcelas" field, or null when it is a whole number ≥ 1. */
export function erroQuantidadeParcelas(valor: string | number | null | undefined): string | null {
	const texto = String(valor ?? '').trim();
	if (texto === '') return 'Informe a quantidade de parcelas.';
	const n = Number(texto);
	if (!Number.isInteger(n) || n < 1) return 'A quantidade de parcelas deve ser um número inteiro, de 1 para cima.';
	if (n > MAX_PARCELAS) return `A quantidade de parcelas pode ser no máximo ${MAX_PARCELAS}.`;
	return null;
}

/** Values of `quantidade` new installments: (valor + juros) split to the cent, residue on the last one. */
export function valoresDasParcelas(valorContratado: number, totalJuros: number, quantidade: number): number[] {
	const base = (centavos(valorContratado) + centavos(Math.max(0, Number(totalJuros) || 0))) / 100;
	return dividirValorEmParcelas(base, quantidade);
}

export type ResultadoRecalculo<T> =
	| { ok: true; parcelas: T[]; valores: number[]; previsto: number; pago: number; restante: number }
	| { ok: false; erro: string };

/**
 * "Recalcular": (contratado + juros − já pago) split among the installments not yet Liquidado, in list
 * order, residue on the last one. Liquidated installments are kept untouched.
 */
export function recalcularParcelasEmAberto<T extends Pick<ParcelaFinanciamento, 'valor' | 'status'>>(
	parcelas: T[],
	f: Pick<Financiamento, 'valor' | 'totalJuros' | 'taxaJurosAnual'>,
): ResultadoRecalculo<T> {
	const resumo = resumoParcelas(f, parcelas);
	if (parcelas.length === 0) return { ok: false, erro: 'Não há parcelas para recalcular.' };
	if (resumo.qtdEmAberto === 0) return { ok: false, erro: 'Não há parcelas em aberto para recalcular.' };
	const restante = (centavos(resumo.previsto) - centavos(resumo.pago)) / 100;
	if (restante <= 0) {
		return {
			ok: false,
			erro: `O que já foi pago (${brl(resumo.pago)}) cobre o valor contratado + juros (${brl(resumo.previsto)}): não há saldo para dividir.`,
		};
	}
	const valores = dividirValorEmParcelas(restante, resumo.qtdEmAberto);
	let i = 0;
	const novas = parcelas.map((p) => (p.status === 'Liquidado' ? p : { ...p, valor: valores[i++] }));
	return { ok: true, parcelas: novas, valores, previsto: resumo.previsto, pago: resumo.pago, restante };
}

/** Confirmation text for "Recalcular". */
export function mensagemRecalculo(r: { valores: number[]; previsto: number; pago: number; restante: number }): string {
	const n = r.valores.length;
	const primeiro = r.valores[0];
	const ultimo = r.valores[n - 1];
	const frase =
		n === 1
			? `A parcela em aberto passará a ${brl(primeiro)}.`
			: `As ${n} parcelas em aberto passarão a ${brl(primeiro)}` +
				(ultimo !== primeiro ? ` (a última, ${brl(ultimo)}, por causa dos centavos).` : '.');
	const base =
		r.pago > 0
			? `Base: valor contratado + juros (${brl(r.previsto)}) menos o já pago (${brl(r.pago)}) = ${brl(r.restante)}.`
			: `Base: valor contratado + juros = ${brl(r.previsto)}.`;
	return `${frase} Valores digitados serão substituídos.\n\n${base}`;
}

// ---------------------------------------------------------------------------------------------
// Confirmation texts: say exactly what will happen.
// ---------------------------------------------------------------------------------------------

type ParcelaTexto = Pick<ParcelaFinanciamento, 'numParcela' | 'valor' | 'dt_vencimento'>;

/** "Parcela 3 de 24 · R$ 8.750,00 · vencimento 10/09/2026". */
export function descricaoParcela(p: ParcelaTexto, totalParcelas?: number): string {
	const numero = totalParcelas ? `Parcela ${p.numParcela} de ${totalParcelas}` : `Parcela ${p.numParcela}`;
	return `${numero} · ${brl(p.valor)} · vencimento ${formatarDataISO(p.dt_vencimento)}`;
}

export function mensagemEstorno(p: Pick<ParcelaFinanciamento, 'numParcela' | 'valor' | 'dt_liquidacao' | 'idMovimentoBancario'>): string {
	const liquidada = p.dt_liquidacao ? `liquidada em ${formatarDataISO(p.dt_liquidacao)}` : 'liquidada';
	const vinculo = p.idMovimentoBancario != null ? ' e o vínculo com o lançamento bancário é desfeito' : '';
	return `Estornar a parcela ${p.numParcela} (${brl(p.valor)}, ${liquidada})? Ela volta a ficar em aberto${vinculo}.`;
}

export function mensagemExcluirParcela(p: ParcelaTexto): string {
	return (
		`Excluir a parcela ${p.numParcela} (${brl(p.valor)}, vencimento ${formatarDataISO(p.dt_vencimento)})? ` +
		'A exclusão só é gravada ao clicar em Salvar. Depois, se quiser, use "Recalcular" para redistribuir o saldo.'
	);
}

/**
 * Delete-contract confirmation. The API refuses (409) when bank movements are linked to the contract
 * or its installments; installments liquidated by hand (no movement) are deleted with it.
 */
export function mensagemExcluirContrato(
	f: Pick<Financiamento, 'numeroContrato' | 'valor' | 'parcelasList'>,
	credor: string,
): string {
	const parcelas = f.parcelasList ?? [];
	const n = parcelas.length;
	const quais = n === 0 ? '' : n === 1 ? ' e sua parcela' : ` e suas ${n} parcelas`;
	const linhas = [`Excluir o contrato ${f.numeroContrato} (${credor}, ${brl(f.valor)})${quais}?`];
	const vinculadas = parcelas.filter((p) => p.idMovimentoBancario != null).map((p) => p.numParcela);
	const liquidadasSemVinculo = parcelas
		.filter((p) => p.status === 'Liquidado' && p.idMovimentoBancario == null)
		.map((p) => p.numParcela);
	if (vinculadas.length > 0) {
		const varias = vinculadas.length > 1;
		linhas.push(
			`${varias ? 'As parcelas' : 'A parcela'} ${juntarLista(vinculadas)} ${varias ? 'estão vinculadas' : 'está vinculada'} ` +
				'a lançamentos bancários: a exclusão será recusada. Desfaça a conciliação desses lançamentos antes.',
		);
	}
	if (liquidadasSemVinculo.length > 0) {
		const varias = liquidadasSemVinculo.length > 1;
		linhas.push(
			`Atenção: ${varias ? 'as parcelas' : 'a parcela'} ${juntarLista(liquidadasSemVinculo)} já ` +
				`${varias ? 'estão liquidadas e também serão apagadas' : 'está liquidada e também será apagada'}.`,
		);
	}
	return linhas.join('\n\n');
}
