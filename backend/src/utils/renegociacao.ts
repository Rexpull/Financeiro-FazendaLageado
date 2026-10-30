/**
 * Renegociação de contratos de financiamento (pedido do Ronaldo): regras puras, sem banco.
 *
 * - ADITIVO: o contrato continua com o mesmo número; as parcelas EM ABERTO são substituídas pelas novas
 *   e as condições (valor, taxa, modalidade, garantia) mudam quando informadas.
 * - NOVO_CONTRATO: o contrato atual é encerrado como "Renegociado" (suas parcelas em aberto saem) e um
 *   contrato novo, com outro número, é criado com as novas parcelas (idFinanciamentoOrigem = o antigo).
 *
 * Parcelas Liquidado, vinculadas a lançamento bancário ou a Resultado NUNCA são alteradas nem excluídas.
 * Saldo devedor = soma das parcelas não liquidadas: as removidas saem, as novas entram (a diferença é o
 * que muda). As removidas ficam guardadas no histórico (financiamentoRenegociacao.parcelasAnteriores).
 */
import { coerceMonetaryValue } from './coerceMonetaryValue';
import { MODALIDADES_FINANCIAMENTO, type ModalidadeFinanciamento } from './relatorioFinanciamentos';

export const TIPOS_RENEGOCIACAO = ['ADITIVO', 'NOVO_CONTRATO'] as const;
export type TipoRenegociacao = (typeof TIPOS_RENEGOCIACAO)[number];

export const MAX_PARCELAS_RENEGOCIACAO = 600;

export type ParcelaRenegociacao = { numParcela: number | null; dt_vencimento: string; valor: number };

export type NovoContratoRenegociacao = {
	numeroContrato: string;
	idBanco: number | null;
	idPessoa: number | null;
	responsavel: string | null;
	dataContrato: string;
	valor: number;
	taxaJurosAnual: number | null;
	modalidade: ModalidadeFinanciamento | null;
	nomeModalidadeParticular: string | null;
	numeroGarantia: string | null;
	observacao: string | null;
};

export type CondicoesAditivo = {
	valor: number | null;
	taxaJurosAnual: number | null;
	modalidade: ModalidadeFinanciamento | null;
	nomeModalidadeParticular: string | null;
	numeroGarantia: string | null;
};

export type RenegociacaoValidada = {
	tipo: TipoRenegociacao;
	dataRenegociacao: string;
	observacao: string | null;
	novoContrato: NovoContratoRenegociacao | null;
	condicoes: CondicoesAditivo | null;
	parcelas: ParcelaRenegociacao[];
};

/** Parcela snapshot stored in financiamentoRenegociacao.parcelasAnteriores. */
export type ParcelaAnterior = { numParcela: number; dt_vencimento: string; valor: number; status: string };

export type CondicoesAnteriores = {
	valor: number;
	taxaJurosAnual: number | null;
	totalJuros: number | null;
	modalidade: string | null;
	numeroContrato: string;
	numeroGarantia: string | null;
};

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const centavos = (v: number) => Math.round((Number(v) || 0) * 100);

/** 'AAAA-MM-DD' that exists in the calendar (no 2026-02-30). */
export function dataValida(s: unknown): s is string {
	if (typeof s !== 'string') return false;
	const m = DATA_ISO.exec(s.trim());
	if (!m) return false;
	const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (ano < 1900 || ano > 2200 || mes < 1 || mes > 12 || dia < 1) return false;
	return dia <= new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** 'AAAA-MM-DD…' → 'dd/mm/aaaa' (read from the text, no timezone). */
export function dataBR(iso: string | null | undefined): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
	return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

/**
 * The renegotiation (and, for a new contract, its signing date) must fall between the contract date / the last
 * renegotiation of this contract and today: the saldo devedor history counts the old parcelas until that date.
 */
export function erroDataRenegociacao(
	dados: Pick<RenegociacaoValidada, 'tipo' | 'dataRenegociacao' | 'novoContrato'>,
	limites: { dataContrato?: string | null; ultimaRenegociacao?: string | null; hoje: string },
): string | null {
	const palavra = dados.tipo === 'ADITIVO' ? 'do aditivo' : 'da renegociação';
	const datas = [dados.dataRenegociacao, ...(dados.novoContrato ? [dados.novoContrato.dataContrato] : [])].map((d) => String(d).slice(0, 10));
	const inicio = String(limites.dataContrato ?? '').slice(0, 10);
	const ultima = String(limites.ultimaRenegociacao ?? '').slice(0, 10);
	for (const d of datas) {
		if (d > limites.hoje) return `A data ${palavra} (${dataBR(d)}) não pode ser depois de hoje.`;
		if (inicio && d < inicio) return `A data ${palavra} (${dataBR(d)}) não pode ser antes da data do contrato (${dataBR(inicio)}).`;
		if (ultima && d < ultima) return `A data ${palavra} (${dataBR(d)}) não pode ser antes da última renegociação deste contrato (${dataBR(ultima)}).`;
	}
	return null;
}

/** Appends a line to the contract observation (keeps what was there). */
export function anexarObservacao(atual: string | null | undefined, linha: string): string {
	const texto = String(atual ?? '').trim();
	return texto ? `${texto}\n${linha}` : linha;
}

const texto = (v: unknown): string | null => {
	if (v == null) return null;
	const s = String(v).trim();
	return s ? s : null;
};

const dinheiro = (v: unknown): number => (typeof v === 'number' ? v : coerceMonetaryValue(v));

/** Optional number (taxa, valor): empty → null; anything not numeric → NaN (caller rejects). */
const numeroOpcional = (v: unknown): number | null => {
	if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
	const n = dinheiro(v);
	return Number.isFinite(n) ? n : NaN;
};

const idOpcional = (v: unknown): number | null => {
	if (v == null || v === '' || v === 0) return null;
	const n = Number(v);
	return Number.isInteger(n) && n > 0 ? n : NaN;
};

function modalidadeOpcional(v: unknown): ModalidadeFinanciamento | null | undefined {
	const s = texto(v);
	if (!s) return null;
	const m = s.toUpperCase();
	return (MODALIDADES_FINANCIAMENTO as readonly string[]).includes(m) ? (m as ModalidadeFinanciamento) : undefined;
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** Validates and normalizes the POST /api/financiamento/:id/renegociar body (messages in pt-BR for the client). */
export function validarRenegociacao(body: unknown): Resultado<RenegociacaoValidada> {
	if (!body || typeof body !== 'object') return { ok: false, erro: 'Dados da renegociação não informados.' };
	const b = body as Record<string, unknown>;

	const tipo = String(b.tipo ?? '').toUpperCase();
	if (!(TIPOS_RENEGOCIACAO as readonly string[]).includes(tipo)) {
		return { ok: false, erro: 'Escolha o tipo de renegociação: aditivo (mesmo contrato) ou novo contrato.' };
	}

	// ---- parcelas novas ----
	if (!Array.isArray(b.parcelas) || b.parcelas.length === 0) {
		return { ok: false, erro: 'Informe ao menos uma parcela nova.' };
	}
	if (b.parcelas.length > MAX_PARCELAS_RENEGOCIACAO) {
		return { ok: false, erro: `A renegociação pode ter no máximo ${MAX_PARCELAS_RENEGOCIACAO} parcelas.` };
	}
	const parcelas: ParcelaRenegociacao[] = [];
	const numeros = new Set<number>();
	for (let i = 0; i < b.parcelas.length; i++) {
		const p = (b.parcelas[i] ?? {}) as Record<string, unknown>;
		const rotulo = `Parcela ${i + 1}`;
		const dt = typeof p.dt_vencimento === 'string' ? p.dt_vencimento.trim().slice(0, 10) : '';
		if (!dataValida(dt)) return { ok: false, erro: `${rotulo}: informe uma data de vencimento válida.` };
		const valor = Math.round(dinheiro(p.valor) * 100) / 100;
		if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: `${rotulo}: o valor deve ser maior que zero.` };
		let numParcela: number | null = null;
		if (p.numParcela != null && p.numParcela !== '') {
			const n = Number(p.numParcela);
			if (!Number.isInteger(n) || n < 1) return { ok: false, erro: `${rotulo}: número da parcela inválido.` };
			if (numeros.has(n)) return { ok: false, erro: `O número de parcela ${n} aparece mais de uma vez.` };
			numeros.add(n);
			numParcela = n;
		}
		parcelas.push({ numParcela, dt_vencimento: dt, valor });
	}
	// either every parcela has its number or none (the API numbers them)
	if (numeros.size > 0 && numeros.size !== parcelas.length) {
		return { ok: false, erro: 'Informe o número de todas as parcelas novas, ou de nenhuma.' };
	}

	const observacao = texto(b.observacao);

	if (tipo === 'ADITIVO') {
		const dataRenegociacao = typeof b.dataRenegociacao === 'string' ? b.dataRenegociacao.trim().slice(0, 10) : '';
		if (!dataValida(dataRenegociacao)) return { ok: false, erro: 'Informe a data do aditivo.' };
		const c = (b.condicoes ?? {}) as Record<string, unknown>;
		const valor = numeroOpcional(c.valor);
		if (valor !== null && !(valor > 0)) return { ok: false, erro: 'O novo valor do contrato deve ser maior que zero.' };
		const taxa = numeroOpcional(c.taxaJurosAnual);
		if (taxa !== null && !(taxa >= 0)) return { ok: false, erro: 'A nova taxa de juros deve ser um número (zero ou mais).' };
		const modalidade = modalidadeOpcional(c.modalidade);
		if (modalidade === undefined) return { ok: false, erro: 'Modalidade inválida.' };
		return {
			ok: true,
			dados: {
				tipo: 'ADITIVO',
				dataRenegociacao,
				observacao,
				novoContrato: null,
				condicoes: {
					valor: valor === null ? null : Math.round(valor * 100) / 100,
					taxaJurosAnual: taxa,
					modalidade,
					nomeModalidadeParticular: texto(c.nomeModalidadeParticular),
					numeroGarantia: texto(c.numeroGarantia),
				},
				parcelas,
			},
		};
	}

	// ---- NOVO_CONTRATO ----
	const n = (b.novoContrato ?? null) as Record<string, unknown> | null;
	if (!n || typeof n !== 'object') return { ok: false, erro: 'Informe os dados do novo contrato.' };
	const numeroContrato = texto(n.numeroContrato);
	if (!numeroContrato) return { ok: false, erro: 'Informe o número do novo contrato.' };
	const dataContrato = typeof n.dataContrato === 'string' ? n.dataContrato.trim().slice(0, 10) : '';
	if (!dataValida(dataContrato)) return { ok: false, erro: 'Informe a data do novo contrato.' };
	const valor = numeroOpcional(n.valor);
	if (valor === null || !(valor > 0)) return { ok: false, erro: 'Informe o valor contratado do novo contrato (maior que zero).' };
	const taxa = numeroOpcional(n.taxaJurosAnual);
	if (taxa !== null && !(taxa >= 0)) return { ok: false, erro: 'A taxa de juros deve ser um número (zero ou mais).' };
	const idBanco = idOpcional(n.idBanco);
	const idPessoa = idOpcional(n.idPessoa);
	if (Number.isNaN(idBanco) || Number.isNaN(idPessoa)) return { ok: false, erro: 'Credor inválido.' };
	if (idBanco && idPessoa) return { ok: false, erro: 'Escolha só um credor: banco ou pessoa.' };
	const modalidade = modalidadeOpcional(n.modalidade);
	if (modalidade === undefined) return { ok: false, erro: 'Modalidade inválida.' };
	const dataRenegociacao =
		typeof b.dataRenegociacao === 'string' && b.dataRenegociacao.trim() ? b.dataRenegociacao.trim().slice(0, 10) : dataContrato;
	if (!dataValida(dataRenegociacao)) return { ok: false, erro: 'Informe a data da renegociação.' };

	return {
		ok: true,
		dados: {
			tipo: 'NOVO_CONTRATO',
			dataRenegociacao,
			observacao,
			condicoes: null,
			novoContrato: {
				numeroContrato,
				idBanco,
				idPessoa,
				responsavel: texto(n.responsavel),
				dataContrato,
				valor: Math.round(valor * 100) / 100,
				taxaJurosAnual: taxa,
				modalidade,
				nomeModalidadeParticular: texto(n.nomeModalidadeParticular),
				numeroGarantia: texto(n.numeroGarantia),
				observacao: texto(n.observacao),
			},
			parcelas,
		},
	};
}

/**
 * Final numbering of the new parcelas: the client's numbers, or a sequence that continues after the
 * highest number kept in the contract (aditivo; 0 for a new contract). Error when a number is already
 * used by a parcela that stays (paid).
 */
export function numerarParcelas(
	parcelas: ParcelaRenegociacao[],
	numerosMantidos: number[],
): Resultado<Array<{ numParcela: number; dt_vencimento: string; valor: number }>> {
	const mantidos = new Set(numerosMantidos);
	if (parcelas.every((p) => p.numParcela != null)) {
		const repetido = parcelas.find((p) => mantidos.has(p.numParcela as number));
		if (repetido) {
			return { ok: false, erro: `O número de parcela ${repetido.numParcela} já é de uma parcela paga deste contrato.` };
		}
		return { ok: true, dados: parcelas.map((p) => ({ ...p, numParcela: p.numParcela as number })) };
	}
	const inicio = Math.max(0, ...numerosMantidos);
	return { ok: true, dados: parcelas.map((p, i) => ({ ...p, numParcela: inicio + i + 1 })) };
}

/** Sum to the cent. */
export function somaValores(lista: Array<{ valor: number }>): number {
	return lista.reduce((s, p) => s + centavos(p.valor), 0) / 100;
}

/** Interest of the new contract: what the parcelas add above the contracted value (null when nothing). */
export function jurosDasParcelas(valorContratado: number, parcelas: Array<{ valor: number }>): number | null {
	const juros = centavos(somaValores(parcelas)) - centavos(valorContratado);
	return juros > 0 ? juros / 100 : null;
}

/** Status of a new parcela: Vencido when due before today (São Paulo calendar day), else Aberto. */
export function statusNovaParcela(dtVencimento: string, hoje: string): 'Aberto' | 'Vencido' {
	return dtVencimento.slice(0, 10) < hoje.slice(0, 10) ? 'Vencido' : 'Aberto';
}

/** Why an open parcela cannot be replaced, or null when it can. */
export function motivoParcelaBloqueada(p: { status: string; idMovimentoBancario: number | null; nResultados: number }): string | null {
	if (p.status === 'Liquidado') return 'liquidada';
	if (p.idMovimentoBancario != null) return 'vinculada a lançamento bancário';
	if (p.nResultados > 0) return 'com lançamento de resultado';
	return null;
}

export type RenegociacaoRow = {
	idFinanciamento: number;
	tipo: string;
	dataRenegociacao: string;
	idFinanciamentoNovo: number | null;
};

export type InfoRenegociacao = {
	renegociadoEm: string | null;
	idFinanciamentoNovo: number | null;
	numeroContratoNovo: string | null;
	numeroContratoOrigem: string | null;
	qtdRenegociacoes: number;
	ultimoAditivoEm: string | null;
};

/**
 * Fields the contract list shows for each contract ("Renegociado → nº", "Origem: nº", aditivos), from the
 * history rows (in insertion order). The latest NOVO_CONTRATO wins (by date, then insertion order).
 */
export function infoRenegociacoes(
	contratos: Array<{ id: number; numeroContrato: string; idFinanciamentoOrigem?: number | null }>,
	historico: RenegociacaoRow[],
): Map<number, InfoRenegociacao> {
	const numeroPorId = new Map(contratos.map((c) => [Number(c.id), String(c.numeroContrato ?? '')]));
	const out = new Map<number, InfoRenegociacao>();
	for (const c of contratos) {
		const origem = c.idFinanciamentoOrigem == null ? null : Number(c.idFinanciamentoOrigem);
		out.set(Number(c.id), {
			renegociadoEm: null,
			idFinanciamentoNovo: null,
			numeroContratoNovo: null,
			numeroContratoOrigem: origem != null ? numeroPorId.get(origem) ?? null : null,
			qtdRenegociacoes: 0,
			ultimoAditivoEm: null,
		});
	}
	for (const r of historico) {
		const info = out.get(Number(r.idFinanciamento));
		if (!info) continue;
		const data = String(r.dataRenegociacao ?? '').slice(0, 10);
		info.qtdRenegociacoes++;
		if (r.tipo === 'NOVO_CONTRATO') {
			if (!info.renegociadoEm || data >= info.renegociadoEm) {
				info.renegociadoEm = data;
				info.idFinanciamentoNovo = r.idFinanciamentoNovo == null ? null : Number(r.idFinanciamentoNovo);
				info.numeroContratoNovo = info.idFinanciamentoNovo != null ? numeroPorId.get(info.idFinanciamentoNovo) ?? null : null;
			}
		} else if (!info.ultimoAditivoEm || data >= info.ultimoAditivoEm) {
			info.ultimoAditivoEm = data;
		}
	}
	return out;
}

/** 409 message listing the open parcelas that are linked (pt-BR, for the client). */
export function mensagemParcelasVinculadas(bloqueadas: Array<{ numParcela: number; motivo: string }>): string {
	const itens = bloqueadas.map((p) => `${p.numParcela} (${p.motivo})`);
	const lista = itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : itens[0];
	const varias = bloqueadas.length > 1;
	return (
		`Não é possível renegociar: ${varias ? 'as parcelas em aberto' : 'a parcela em aberto'} ${lista} ` +
		`${varias ? 'estão vinculadas' : 'está vinculada'} a lançamentos. ` +
		'Desfaça a conciliação desses lançamentos (ou liquide a parcela) antes de renegociar.'
	);
}
