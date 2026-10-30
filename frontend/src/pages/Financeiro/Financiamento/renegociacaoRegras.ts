// Renegociação de contratos (aditivo / novo contrato): regras puras usadas pelo ModalRenegociacao, pelos
// cards/lista de contratos e pelo histórico em "Gerenciar parcelas". As mesmas regras valem no backend
// (backend/src/utils/renegociacao.ts): só as parcelas EM ABERTO são substituídas; as pagas ficam como estão.
import type { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import type { RenegociacaoHistorico } from '../../../../../backend/src/repositories/RenegociacaoRepository';
import { formatarDataISO } from '../../../Utils/dataSemFuso';
import { brl } from '../../../Utils/formatos';
import { gerarDatasVencimento } from '../../../Utils/parcelamento';
import { avisoDiferencaParcelas, erroQuantidadeParcelas, valoresDasParcelas, type ResumoParcelas } from './parcelaRegras';

export type TipoRenegociacao = 'ADITIVO' | 'NOVO_CONTRATO';
export type { RenegociacaoHistorico };

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ---------------------------------------------------------------------------------------------
// Situação atual do contrato
// ---------------------------------------------------------------------------------------------

export interface SituacaoContrato {
	abertas: ParcelaFinanciamento[];
	qtdAbertas: number;
	valorAberto: number;
	qtdPagas: number;
	valorPago: number;
	/** Highest numParcela among the paid ones (0 when none): an aditivo numbers the new ones after it. */
	maiorNumeroPago: number;
}

export function situacaoContrato(parcelas: ParcelaFinanciamento[] | null | undefined): SituacaoContrato {
	const lista = parcelas ?? [];
	const abertas = lista.filter((p) => p.status !== 'Liquidado');
	const pagas = lista.filter((p) => p.status === 'Liquidado');
	return {
		abertas,
		qtdAbertas: abertas.length,
		valorAberto: abertas.reduce((s, p) => s + centavos(p.valor), 0) / 100,
		qtdPagas: pagas.length,
		valorPago: pagas.reduce((s, p) => s + centavos(p.valor), 0) / 100,
		maiorNumeroPago: Math.max(0, ...pagas.map((p) => Number(p.numParcela) || 0)),
	};
}

/** "Renegociar" only makes sense with something still to pay. */
export function podeRenegociar(f: Pick<Financiamento, 'parcelasList'>): boolean {
	return (f.parcelasList ?? []).some((p) => p.status !== 'Liquidado');
}

/** Closed as renegotiated into another contract: nothing left to pay here (not "Liquidado"/"Quitado"). */
export function renegociadoEncerrado(f: Pick<Financiamento, 'renegociadoEm' | 'parcelasList'>): boolean {
	return !!f.renegociadoEm && !podeRenegociar(f);
}

/** Contract cards/list: "Renegociado → SIC-200-R" (or without the number when the new one was deleted). */
export function rotuloRenegociado(f: Pick<Financiamento, 'renegociadoEm' | 'numeroContratoNovo'>): string | null {
	if (!f.renegociadoEm) return null;
	return f.numeroContratoNovo ? `Renegociado → ${f.numeroContratoNovo}` : 'Renegociado';
}

export function rotuloOrigem(f: Pick<Financiamento, 'numeroContratoOrigem'>): string | null {
	return f.numeroContratoOrigem ? `Origem: ${f.numeroContratoOrigem}` : null;
}

/**
 * "Parcelas ≠ contratado + juros" warning, except for renegotiated contracts: after an aditivo the parcelas
 * (pagas + novas) no longer follow the original contratado + juros, by design.
 */
export function avisoDiferencaContrato(f: Pick<Financiamento, 'qtdRenegociacoes'>, resumo: ResumoParcelas): string | null {
	return (f.qtdRenegociacoes ?? 0) > 0 ? null : avisoDiferencaParcelas(resumo);
}

// ---------------------------------------------------------------------------------------------
// Novas parcelas (gerador + tabela editável)
// ---------------------------------------------------------------------------------------------

export interface LinhaParcela {
	/** Stable key for React (rows are added/removed). */
	chave: number;
	numParcela: number;
	dt_vencimento: string;
	valor: number;
}

export type Periodicidade = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export const INTERVALO_MESES: Record<Periodicidade, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };

/** First number of the new parcelas: an aditivo continues after the paid ones; a new contract starts at 1. */
export function primeiroNumero(tipo: TipoRenegociacao, situacao: Pick<SituacaoContrato, 'maiorNumeroPago'>): number {
	return tipo === 'ADITIVO' ? situacao.maiorNumeroPago + 1 : 1;
}

export type ResultadoGerar = { ok: true; linhas: LinhaParcela[] } | { ok: false; erro: string };

/**
 * Same rule as "Gerar parcelas" of the contract: (valor + juros) ÷ quantidade, cents residue on the last one;
 * due dates every N months from the 1st (calendar arithmetic, no timezone).
 */
export function gerarParcelas(opcoes: {
	quantidade: string | number;
	primeiroVencimento: string;
	periodicidade: Periodicidade;
	valor: number;
	juros: number;
	numeroInicial: number;
}): ResultadoGerar {
	const erroQtd = erroQuantidadeParcelas(opcoes.quantidade);
	if (erroQtd) return { ok: false, erro: erroQtd };
	if (!opcoes.primeiroVencimento) return { ok: false, erro: 'Informe o 1º vencimento.' };
	if (!(Number(opcoes.valor) > 0)) return { ok: false, erro: 'Informe o valor a parcelar (maior que zero).' };
	const n = Number(opcoes.quantidade);
	const valores = valoresDasParcelas(opcoes.valor, opcoes.juros, n);
	const datas = gerarDatasVencimento(opcoes.primeiroVencimento.slice(0, 10), n, INTERVALO_MESES[opcoes.periodicidade]);
	return {
		ok: true,
		linhas: valores.map((valor, i) => ({ chave: i + 1, numParcela: opcoes.numeroInicial + i, dt_vencimento: datas[i], valor })),
	};
}

/** Numbers again after a row is added/removed (sequence from `inicio`). */
export function renumerar(linhas: LinhaParcela[], inicio: number): LinhaParcela[] {
	return linhas.map((l, i) => (l.numParcela === inicio + i ? l : { ...l, numParcela: inicio + i }));
}

/** New row after the last one: same period as the last two (or 1 month), value of the last one. */
export function novaLinha(linhas: LinhaParcela[], inicio: number, hoje: string): LinhaParcela {
	const ultima = linhas[linhas.length - 1];
	const chave = Math.max(0, ...linhas.map((l) => l.chave)) + 1;
	if (!ultima) return { chave, numParcela: inicio, dt_vencimento: hoje, valor: 0 };
	const penultima = linhas[linhas.length - 2];
	let meses = 1;
	if (penultima?.dt_vencimento && ultima.dt_vencimento) {
		const m = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
		meses = Math.max(1, m(ultima.dt_vencimento) - m(penultima.dt_vencimento));
	}
	const dt = ultima.dt_vencimento ? gerarDatasVencimento(ultima.dt_vencimento.slice(0, 10), 2, meses)[1] : hoje;
	return { chave, numParcela: ultima.numParcela + 1, dt_vencimento: dt, valor: ultima.valor };
}

export function totalLinhas(linhas: Array<{ valor: number }>): number {
	return linhas.reduce((s, l) => s + centavos(l.valor), 0) / 100;
}

/** "Diferença em relação ao que estava a vencer: +R$ 150.000,00" (− when it went down, "sem diferença" at 0). */
export function textoDiferenca(totalNovas: number, valorAberto: number): string {
	const d = (centavos(totalNovas) - centavos(valorAberto)) / 100;
	if (d === 0) return 'Diferença em relação ao que estava a vencer: sem diferença';
	return `Diferença em relação ao que estava a vencer: ${d > 0 ? '+' : '−'}${brl(Math.abs(d))}`;
}

/** The renegotiation date (aditivo / new contract): a new parcela cannot be due before it. */
export interface InicioParcelas {
	data: string;
	/** "do aditivo" / "do novo contrato" */
	rotulo: string;
}

const temData = (l: Pick<LinhaParcela, 'dt_vencimento'>) => /^\d{4}-\d{2}-\d{2}$/.test(String(l.dt_vencimento ?? ''));
/** True when the row is due before the renegotiation date (it would be born overdue). */
export const venceAntes = (l: Pick<LinhaParcela, 'dt_vencimento'>, inicio?: InicioParcelas | null) =>
	!!inicio?.data && temData(l) && l.dt_vencimento < inicio.data;

/** True when this row has a problem (to mark it in the table). */
export function linhaInvalida(l: LinhaParcela, inicio?: InicioParcelas | null): boolean {
	return !temData(l) || !(Number(l.valor) > 0) || venceAntes(l, inicio);
}

/** First problem of the table, or null. */
export function erroLinhas(linhas: LinhaParcela[], inicio?: InicioParcelas | null): string | null {
	if (linhas.length === 0) return 'Gere ou adicione ao menos uma parcela nova.';
	const semData = linhas.find((l) => !temData(l));
	if (semData) return `Parcela ${semData.numParcela}: informe a data de vencimento.`;
	const semValor = linhas.find((l) => !(Number(l.valor) > 0));
	if (semValor) return `Parcela ${semValor.numParcela}: o valor deve ser maior que zero.`;
	const antes = linhas.find((l) => venceAntes(l, inicio));
	if (antes && inicio) {
		return `Parcela ${antes.numParcela}: vence em ${formatarDataISO(antes.dt_vencimento)}, antes da data ${inicio.rotulo} (${formatarDataISO(inicio.data)}).`;
	}
	return null;
}

// ---------------------------------------------------------------------------------------------
// Taxa de juros (% a.a.)
// ---------------------------------------------------------------------------------------------

/** Keeps what a rate can have while typing: digits and one comma ("." becomes ","), up to 4 decimals. */
export function limparTaxa(texto: string): string {
	const s = String(texto ?? '')
		.replace(/\./g, ',')
		.replace(/[^\d,]/g, '');
	const i = s.indexOf(',');
	if (i < 0) return s;
	return `${s.slice(0, i) || '0'},${s
		.slice(i + 1)
		.replace(/,/g, '')
		.slice(0, 4)}`;
}

/** Rate typed in the modal: empty is fine (keeps the current one); otherwise 0 to 100 % a.a. */
export function erroTaxa(texto: string): string | null {
	const t = String(texto ?? '').trim();
	if (!t) return null;
	const n = Number(t.replace(',', '.'));
	if (!Number.isFinite(n)) return 'Taxa inválida (ex.: 12,5).';
	if (n < 0 || n > 100) return 'A taxa deve ficar entre 0 e 100% ao ano.';
	return null;
}

const taxaBR = (n: number) => `${String(n).replace('.', ',')}%`;

/** Lines for the confirmation: what changes in the contract terms ("" when nothing). */
export function mudancasCondicoes(r: {
	taxaAtual?: number | null;
	taxaNova?: number | null;
	valorAtual?: number | null;
	valorNovo?: number | null;
}): string {
	const linhas: string[] = [];
	if (r.taxaNova != null && Number(r.taxaNova) !== Number(r.taxaAtual)) {
		const atual = r.taxaAtual != null && Number(r.taxaAtual) <= 100 ? `${taxaBR(Number(r.taxaAtual))} → ` : '';
		linhas.push(`Taxa: ${atual}${taxaBR(Number(r.taxaNova))} ao ano.`);
	}
	if (r.valorNovo != null && centavos(r.valorNovo) !== centavos(r.valorAtual)) {
		linhas.push(`Valor do contrato: ${r.valorAtual != null ? `${brl(Number(r.valorAtual))} → ` : ''}${brl(Number(r.valorNovo))}.`);
	}
	return linhas.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Confirmação e envio
// ---------------------------------------------------------------------------------------------

/** Says exactly what will happen (confirmation dialog). */
export function mensagemConfirmacao(r: {
	tipo: TipoRenegociacao;
	situacao: Pick<SituacaoContrato, 'qtdAbertas' | 'valorAberto' | 'qtdPagas'>;
	qtdNovas: number;
	valorNovas: number;
	numeroContratoNovo?: string;
}): string {
	const { qtdAbertas, valorAberto, qtdPagas } = r.situacao;
	const abertas =
		qtdAbertas === 1 ? `A parcela em aberto (${brl(valorAberto)})` : `As ${qtdAbertas} parcelas em aberto (${brl(valorAberto)})`;
	const novas = `${plural(r.qtdNovas, 'parcela nova', 'parcelas novas')} (${brl(r.valorNovas)})`;
	const pagas = qtdPagas === 0 ? '' : qtdPagas === 1 ? ' A parcela paga continua como está.' : ' As parcelas pagas continuam como estão.';
	if (r.tipo === 'ADITIVO') {
		const verbo = qtdAbertas === 1 ? 'será substituída' : 'serão substituídas';
		const porNovas = r.qtdNovas === 1 ? `por 1 nova (${brl(r.valorNovas)})` : `por ${r.qtdNovas} novas (${brl(r.valorNovas)})`;
		return `${abertas} deste contrato ${verbo} ${porNovas}.${pagas}`;
	}
	const saem = qtdAbertas === 1 ? 'sai deste contrato' : 'saem deste contrato';
	return (
		`Este contrato será encerrado como renegociado e o contrato ${r.numeroContratoNovo ?? ''} será criado com ${novas}. ` +
		`${abertas} ${saem}.${pagas}`
	);
}

export interface DadosNovoContrato {
	numeroContrato: string;
	dataContrato: string;
	/** 'b:<id>' (banco) or 'p:<id>' (pessoa) */
	credor: string;
	responsavel: string;
	valor: number;
	taxaJurosAnual: number | null;
	modalidade: string;
	nomeModalidadeParticular: string;
	numeroGarantia: string;
	observacao: string;
}

export interface DadosAditivo {
	dataRenegociacao: string;
	valor: number | null;
	taxaJurosAnual: number | null;
	observacao: string;
}

const textoOuNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** Body of POST /api/financiamento/:id/renegociar. */
export function montarPayload(tipo: TipoRenegociacao, linhas: LinhaParcela[], dados: { aditivo: DadosAditivo; novo: DadosNovoContrato }) {
	const parcelas = linhas.map((l) => ({ numParcela: l.numParcela, dt_vencimento: l.dt_vencimento, valor: l.valor }));
	if (tipo === 'ADITIVO') {
		const a = dados.aditivo;
		return {
			tipo,
			dataRenegociacao: a.dataRenegociacao,
			observacao: textoOuNull(a.observacao),
			condicoes: { valor: a.valor, taxaJurosAnual: a.taxaJurosAnual },
			parcelas,
		};
	}
	const n = dados.novo;
	const [tipoCredor, idCredor] = n.credor.split(':');
	return {
		tipo,
		dataRenegociacao: n.dataContrato,
		novoContrato: {
			numeroContrato: n.numeroContrato.trim(),
			idBanco: tipoCredor === 'b' ? Number(idCredor) : null,
			idPessoa: tipoCredor === 'p' ? Number(idCredor) : null,
			responsavel: textoOuNull(n.responsavel),
			dataContrato: n.dataContrato,
			valor: n.valor,
			taxaJurosAnual: n.taxaJurosAnual,
			modalidade: n.modalidade || 'RENEGOCIACAO',
			nomeModalidadeParticular: n.modalidade === 'PARTICULAR' ? textoOuNull(n.nomeModalidadeParticular) : null,
			numeroGarantia: textoOuNull(n.numeroGarantia),
			observacao: textoOuNull(n.observacao),
		},
		parcelas,
	};
}

// ---------------------------------------------------------------------------------------------
// Histórico (detalhes do contrato)
// ---------------------------------------------------------------------------------------------

/** One line per renegotiation, seen from contract `idAtual`. */
export function descricaoHistorico(h: RenegociacaoHistorico, idAtual: number): { titulo: string; detalhe: string } {
	const data = formatarDataISO(h.dataRenegociacao);
	const qtd = h.parcelasAnteriores.length;
	const valor = h.parcelasAnteriores.reduce((s, p) => s + centavos(p.valor), 0) / 100;
	const parcelas = `${plural(qtd, 'parcela em aberto', 'parcelas em aberto')} (${brl(valor)})`;
	if (h.tipo === 'ADITIVO') {
		const ant = h.condicoesAnteriores;
		const condicoes = ant
			? ` Antes: valor ${brl(ant.valor)}${ant.taxaJurosAnual != null ? `, taxa ${String(ant.taxaJurosAnual).replace('.', ',')}% ao ano` : ''}.`
			: '';
		return { titulo: `${data} · Aditivo`, detalhe: `${qtd === 1 ? 'Substituída' : 'Substituídas'}: ${parcelas}.${condicoes}` };
	}
	if (h.idFinanciamentoNovo === idAtual && h.idFinanciamento !== idAtual) {
		return {
			titulo: `${data} · Origem: contrato ${h.numeroContrato ?? '—'}`,
			detalhe: `Este contrato substituiu ${parcelas} do contrato ${h.numeroContrato ?? 'anterior'}.`,
		};
	}
	const destino = h.numeroContratoNovo ? `o contrato ${h.numeroContratoNovo}` : 'um novo contrato (já excluído)';
	return {
		titulo: `${data} · Novo contrato${h.numeroContratoNovo ? ` → ${h.numeroContratoNovo}` : ''}`,
		detalhe: `${parcelas} ${qtd === 1 ? 'foi' : 'foram'} para ${destino}.`,
	};
}

/** Removed parcelas of the snapshot, for the history table: "Parcela 3 · 10/01/2027 · R$ 300.000,00". */
export function linhasSnapshot(h: Pick<RenegociacaoHistorico, 'parcelasAnteriores'>): string[] {
	return h.parcelasAnteriores.map((p) => `Parcela ${p.numParcela} · ${formatarDataISO(p.dt_vencimento)} · ${brl(p.valor)}`);
}
