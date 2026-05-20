import { MovimentoBancario } from "../../../backend/src/models/MovimentoBancario";
import { TotalizadoresOFX } from "./parseOfxFile";

/** Parameter plan IDs for movements without operational P&L effect (conciliation). */
export interface PlanosSemEfeitoFinanceiro {
  idPlanoTransferenciaEntreContas?: number | null;
  idPlanoAplicacaoResgateInvestimentos?: number | null;
  idPlanoEstornos?: number | null;
}

const LEGACY_PLANO_APLICACAO_RESGATE = 233;

function normalizeHistorico(historico: string): string {
  return historico
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * OFX / bank statement text that usually indicates transfer between accounts or
 * investment application/redemption (no operational revenue/expense).
 */
export function historicoIndicaSemEfeitoFinanceiro(
  historico: string,
  trnType?: string
): boolean {
  const type = trnType?.trim().toUpperCase();
  if (type === "XFER") {
    return true;
  }

  const h = normalizeHistorico(historico || "");

  const patterns: RegExp[] = [
    /\bresg(ate|\.|to)\b/,
    /\bresgate\s+aut/,
    /\bresg\s+aut\b/,
    /\baplic(acao|\.|ar)\b/,
    /\baplicacao\s+aut/,
    /\btransferencia\b/,
    /\btransf\b/,
    /\bentre\s+contas\b/,
    /\bted\s+(mesma|propria|titular)\b/,
    /\bdoc\s+(mesma|propria|titular)\b/,
    /\bmovimentacao\s+entre\s+contas\b/,
    /\btransf\s+entre\s+contas\b/,
    /\bpix\s+.*\b(mesma\s+titularidade|entre\s+contas)\b/,
    /\b(cdb|lci|lca|fundos?)\b.*\b(resg|aplic)\b/,
    /\b(resg|aplic)\b.*\b(cdb|lci|lca|fundos?)\b/,
    /\bestorno\s+de\s+transferencia\b/,
    /\bdevolucao\s+de\s+transferencia\b/,
  ];

  return patterns.some((p) => p.test(h));
}

function idPlanoContasEfetivo(mov: MovimentoBancario): number | undefined {
  const rl = mov.resultadoList ?? [];
  if (rl.length === 1) {
    return rl[0].idPlanoContas;
  }
  return mov.idPlanoContas ?? undefined;
}

function planoIdsSemEfeito(planos?: PlanosSemEfeitoFinanceiro): number[] {
  if (!planos) {
    return [LEGACY_PLANO_APLICACAO_RESGATE];
  }
  return [
    planos.idPlanoTransferenciaEntreContas,
    planos.idPlanoAplicacaoResgateInvestimentos,
    planos.idPlanoEstornos,
    LEGACY_PLANO_APLICACAO_RESGATE,
  ].filter((id): id is number => id != null && id > 0);
}

/**
 * Transfers between accounts, application/redemption, and estornos must not
 * count as extract revenue/expense (aligned with cash flow exclusion).
 */
export function isMovimentoSemEfeitoFinanceiro(
  mov: MovimentoBancario,
  planosSemEfeito?: PlanosSemEfeitoFinanceiro,
  trnType?: string
): boolean {
  if (mov.modalidadeMovimento === "transferencia") {
    return true;
  }

  if (mov.transfOrigem != null || mov.transfDestino != null) {
    return true;
  }

  const ids = planoIdsSemEfeito(planosSemEfeito);
  if (ids.length > 0) {
    const idPlano = idPlanoContasEfetivo(mov);
    if (idPlano != null && ids.includes(idPlano)) {
      return true;
    }
    const rl = mov.resultadoList ?? [];
    if (rl.some((r) => ids.includes(r.idPlanoContas))) {
      return true;
    }
  }

  return historicoIndicaSemEfeitoFinanceiro(mov.historico, trnType);
}

export function calcularTotalizadoresExtrato(
  movimentos: MovimentoBancario[],
  planosSemEfeito?: PlanosSemEfeitoFinanceiro,
  dtInicialExtrato?: string,
  dtFinalExtrato?: string,
  /** OFX import: TRNTYPE keyed by identificadorOfx when not stored on MovimentoBancario */
  trnTypeByIdentificadorOfx?: Map<string, string | undefined>
): TotalizadoresOFX {
  let receitas = 0;
  let despesas = 0;

  for (const m of movimentos) {
    const trnType = trnTypeByIdentificadorOfx?.get(m.identificadorOfx);
    if (isMovimentoSemEfeitoFinanceiro(m, planosSemEfeito, trnType)) {
      continue;
    }
    if (m.valor > 0) {
      receitas += m.valor;
    } else {
      despesas += m.valor;
    }
  }

  const liquido = receitas + despesas;
  const sorted = [...movimentos].sort(
    (a, b) => new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime()
  );

  return {
    receitas,
    despesas,
    liquido,
    saldoFinal: liquido,
    dtInicialExtrato: dtInicialExtrato ?? sorted[0]?.dtMovimento ?? "",
    dtFinalExtrato: dtFinalExtrato ?? sorted[sorted.length - 1]?.dtMovimento ?? "",
  };
}
