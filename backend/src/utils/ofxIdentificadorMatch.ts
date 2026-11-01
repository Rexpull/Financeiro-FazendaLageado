import { parseOfxIdentificadorParts } from './coerceMonetaryValue';

/**
 * OFX duplicate detection must be scoped by bank account.
 * Same FITID on another ContaCorrente is a different movement — never reuse cross-account.
 */
export function shouldReuseOfxMovimento(args: {
	existingIdContaCorrente: number | null | undefined;
	incomingIdContaCorrente: number | null | undefined;
}): boolean {
	const existing = Number(args.existingIdContaCorrente);
	const incoming = Number(args.incomingIdContaCorrente);
	if (!Number.isFinite(existing) || existing <= 0) return false;
	if (!Number.isFinite(incoming) || incoming <= 0) return false;
	return existing === incoming;
}

/* ------------------------------------------------------------------ */
/* Conta suffix: identificador_ofx is UNIQUE globally, dedupe is per conta.
 * When the same OFX line already exists in ANOTHER conta, the row is stored as
 * `<identificador>|@c<idConta>` (or `|@c<idConta>-<n>` if that one is taken by a
 * row that was later moved to another conta). Lookups for a conta match the bare
 * identificador OR any `|@c…` variant, always filtered by idContaCorrente.
 */

const CONTA_SUFIXO_RE = /\|@c\d+(?:-\d+)?$/;

export function stripContaSuffix(identificadorOfx: string): string {
	return typeof identificadorOfx === 'string' ? identificadorOfx.replace(CONTA_SUFIXO_RE, '') : identificadorOfx;
}

export function contaSuffix(idContaCorrente: number, n = 1): string {
	return `|@c${idContaCorrente}${n > 1 ? `-${n}` : ''}`;
}

/** [from, to) range that contains every `<base>|@c…` string (index-friendly). */
export function contaSuffixRange(base: string): { from: string; to: string } {
	return { from: `${base}|@c`, to: `${base}|@d` };
}

/**
 * Picks the identificador to store for `base` in `idContaCorrente`, given the rows that
 * already hold `base` or one of its conta-suffixed variants (excluding the row being updated).
 * - base free → base
 * - base held by the SAME conta → base (the insert fails on UNIQUE: same-conta duplicates are never created)
 * - otherwise → first `|@c<conta>[-n]` not held by another conta (held by the same conta → same rule as above)
 */
export function escolherIdentificadorParaConta(
	base: string,
	idContaCorrente: number,
	ocupados: Array<{ identificadorOfx: string; idContaCorrente: number }>,
): string {
	const dono = new Map(ocupados.map((o) => [o.identificadorOfx, Number(o.idContaCorrente)]));
	const conta = Number(idContaCorrente);
	if (!dono.has(base) || dono.get(base) === conta) return base;
	for (let n = 1; n <= 50; n++) {
		const candidato = `${base}${contaSuffix(conta, n)}`;
		if (!dono.has(candidato) || dono.get(candidato) === conta) return candidato;
	}
	return `${base}${contaSuffix(conta)}`;
}

/* ------------------------------------------------------------------ */
/* Fallback re-match (FITID + day + conta, valor ignored).
 * It exists ONLY to find the SAME bank line again after a parser fix changed its
 * valor (and therefore its identificador). Distinct real movements must never merge,
 * so every doubt resolves to "no match" (the line is imported as new).
 */

/** FITID that does not identify a line (Santander sends 000000 on every line). */
export function isFitidGenerico(fitid: string | null | undefined): boolean {
	const f = (fitid ?? '').trim();
	return f === '' || /^0+$/.test(f);
}

export function normalizeHistoricoOfx(historico: string | null | undefined): string {
	return (historico ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.toUpperCase();
}

/** Key used to detect FITID+day repeated inside one incoming batch (per conta). */
export function chaveFitidDia(identificadorOfx: string, idContaCorrente: number): string | null {
	const p = parseOfxIdentificadorParts(identificadorOfx);
	if (!p) return null;
	return `${idContaCorrente}|${p.fitid}|${p.dtIso.substring(0, 10)}`;
}

export interface OfxFallbackCandidato {
	id: number;
	identificadorOfx: string;
	historico?: string | null;
	valor: number;
}

export function selecionarCandidatoFallbackOfx<T extends OfxFallbackCandidato>(args: {
	incoming: { identificadorOfx: string; historico?: string | null; valor: number };
	candidatos: T[];
	/** Rows already matched by another line of the same batch. */
	idsJaUsados?: Set<number>;
	/** Identificadores (bare) of every line of the batch for this conta. */
	identificadoresDoLote?: Set<string>;
	/** More than one line of the batch shares this FITID + day + conta. */
	fitidDiaRepetidoNoLote?: boolean;
}): T | null {
	const { incoming, candidatos } = args;
	const p = parseOfxIdentificadorParts(incoming.identificadorOfx);
	if (!p || !p.valor) return null;
	if (isFitidGenerico(p.fitid)) return null;
	if (p.ocorrencia) return null;
	if (args.fitidDiaRepetidoNoLote) return null;

	const dia = p.dtIso.substring(0, 10);
	const historico = normalizeHistoricoOfx(incoming.historico);
	const sinal = Math.sign(Number(incoming.valor));

	const filtrados = candidatos.filter((c) => {
		const cp = parseOfxIdentificadorParts(c.identificadorOfx);
		if (!cp) return false;
		if (cp.fitid !== p.fitid || cp.dtIso.substring(0, 10) !== dia) return false;
		if (cp.ocorrencia) return false;
		if (args.idsJaUsados?.has(c.id)) return false;
		if (args.identificadoresDoLote?.has(stripContaSuffix(c.identificadorOfx))) return false;
		if (normalizeHistoricoOfx(c.historico) !== historico) return false;
		if ((p.checkNum || cp.checkNum) && p.checkNum !== cp.checkNum) return false;
		if (Math.sign(Number(c.valor)) !== sinal) return false;
		return true;
	});

	return filtrados.length === 1 ? filtrados[0] : null;
}

/* ------------------------------------------------------------------ */
/* Content re-match (conta + day + valor + compatible historico).
 * Some banks do not keep the identificador between exports: Bradesco numbers the FITID
 * per file, Santander puts the export time in it, and BB changes REFNUM ("14033" →
 * "14.033") and MEMO ("Rende Facil" → "BB Rende Fácil - Rende Facil") depending on the
 * channel. Without this, re-importing a period creates the lines again as pending.
 * The historico must still match: a card installment ("PARC 12/21" → "PARC 13/21") keeps
 * the purchase date and valor every month and is a NEW line.
 */

/** Letters and digits only (no accents, case, spaces or punctuation). */
function historicoCompacto(historico: string | null | undefined): string {
	return normalizeHistoricoOfx(historico).replace(/[^A-Z0-9]/g, '');
}

/** Same historico, or one contains the other (BB's new MEMO prefixes the old one with the type). */
export function historicoCompativel(a: string | null | undefined, b: string | null | undefined): boolean {
	const x = historicoCompacto(a);
	const y = historicoCompacto(b);
	if (x === y) return x !== '';
	const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
	return curto.length >= 4 && longo.includes(curto);
}

export interface OfxConteudoCandidato {
	id: number;
	identificadorOfx: string;
	historico?: string | null;
	valor: number;
}

const valorCentavos = (v: number) => Math.round(Number(v) * 100);

/**
 * Existing row(s) of the same conta and day that are this incoming line, or [] (import as new).
 * Candidates must already exclude rows matched by another line of the batch and rows whose
 * identificador another line of the batch carries.
 * - one row with the same valor and a compatible historico (same historico wins);
 * - a line grouped by the parser ("… Agrupado (N movimentos) …") against the N individual
 *   rows of an earlier import (same historico, same sign) whose sum is its valor.
 */
export function selecionarCandidatosConteudoOfx<T extends OfxConteudoCandidato>(
	incoming: { historico?: string | null; valor: number },
	candidatos: T[],
): T[] {
	const alvo = valorCentavos(incoming.valor);
	const mesmoValor = candidatos.filter(
		(c) => valorCentavos(c.valor) === alvo && historicoCompativel(c.historico, incoming.historico),
	);
	if (mesmoValor.length) {
		const igual = historicoCompacto(incoming.historico);
		return [mesmoValor.find((c) => historicoCompacto(c.historico) === igual) ?? mesmoValor[0]];
	}

	const agrupado = /Agrupado \((\d+) movimentos\)/i.exec(incoming.historico ?? '');
	if (!agrupado) return [];
	const n = Number(agrupado[1]);
	const porHistorico = new Map<string, T[]>();
	for (const c of candidatos) {
		if (/Agrupado \(/i.test(c.historico ?? '') || Math.sign(c.valor) !== Math.sign(incoming.valor)) continue;
		const chave = historicoCompacto(c.historico);
		porHistorico.set(chave, [...(porHistorico.get(chave) ?? []), c]);
	}
	for (const grupo of porHistorico.values()) {
		if (grupo.length === n && grupo.reduce((s, c) => s + valorCentavos(c.valor), 0) === alvo) return grupo;
	}
	return [];
}
