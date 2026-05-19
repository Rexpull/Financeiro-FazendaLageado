import { MovimentoBancario } from "../../../backend/src/models/MovimentoBancario";

export interface TotalizadoresOFX {
  receitas: number;
  despesas: number;
  liquido: number;
  saldoFinal: number;
  dtInicialExtrato: string;
  dtFinalExtrato: string;
}

interface MovimentoTemporario {
  dtMovimento: string;
  historico: string;
  valor: number;
  tipoMovimento: "C" | "D";
  identificadorOfx: string; // FITID original
  refNum?: string;
  checkNum?: string;
  trnType?: string;
  isBBCons: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

function normalizarOfx(ofx: string): string {
  const compact = ofx
    .replace(/&nbsp;/g, " ")
    .replace(/\r?\n/g, "")
    .replace(/>\s+</g, "><");

  // Caixa / XML-style OFX already has </TAG> closers — auto-closing corrupts TRNAMT/MEMO
  if (/<\/\w+>/i.test(compact)) {
    return compact;
  }

  return compact.replace(/<(\w+?)>([^<\r\n]+)/g, "<$1>$2</$1>");
}

// Chave robusta para deduplicação na importação
function buildIdentificadorImportacao(
  fitid: string,
  dtMovimentoISO: string,
  valor: number,
  refNum?: string,
  checkNum?: string
): string {
  const base = `${fitid}|${dtMovimentoISO}|${valor.toFixed(2)}`;
  const extra = refNum || checkNum;
  return extra ? `${base}|${extra}` : base;
}

/**
 * Parses OFX TRNAMT/BALAMT strings.
 * - Standard (most banks): "-114.35" → -114.35
 * - Brazilian thousands (e.g. Caixa): "-1.061.52" → -1061.52
 * - Comma decimal: "-1061,52" or "1.061,52"
 */
export function parseOfxAmount(amountStr: string): number {
  const raw = amountStr.trim();
  if (!raw) return NaN;

  const isNegative = raw.startsWith("-");
  let unsigned = isNegative ? raw.slice(1) : raw;

  if (unsigned.includes(",") && !unsigned.includes(".")) {
    unsigned = unsigned.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : v;
  }

  if (unsigned.includes(",") && unsigned.includes(".")) {
    const lastComma = unsigned.lastIndexOf(",");
    const lastDot = unsigned.lastIndexOf(".");
    if (lastComma > lastDot) {
      unsigned = unsigned.replace(/\./g, "").replace(",", ".");
    } else {
      unsigned = unsigned.replace(/,/g, "");
    }
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : v;
  }

  const parts = unsigned.split(".");
  if (parts.length <= 2) {
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : v;
  }

  // Multiple dots: Caixa-style grouping (e.g. "1.061.52" → 1061.52).
  // Only when the last segment looks like centavos (2 digits), so standard
  // single-decimal amounts (e.g. "-114.35") are unaffected above.
  const cents = parts[parts.length - 1];
  if (!/^\d{2}$/.test(cents) || parts.some((p) => !/^\d+$/.test(p))) {
    const v = parseFloat(unsigned);
    return Number.isNaN(v) ? NaN : isNegative ? -Math.abs(v) : v;
  }

  const integerPart = parts.slice(0, -1).join("");
  const v = parseFloat(`${integerPart}.${cents}`);
  return isNegative ? -Math.abs(v) : v;
}

const SANTANDER_BANK_ID = "0033";

/** FITID placeholder used by Santander (and others) — must not drive generic grouping. */
function isFitidGenerico(fitid: string): boolean {
  return /^0+$/.test(fitid.trim());
}

function isSantanderBank(bankId: string | undefined, normalizedOfx: string): boolean {
  if (bankId === SANTANDER_BANK_ID || bankId?.replace(/^0+/, "") === "33") {
    return true;
  }
  return /<ORG>\s*SANTANDER/i.test(normalizedOfx);
}

/** IOF lines from Santander OFX (same classification when grouped). */
export function isSantanderIof(historico: string): boolean {
  return /^IOF\b/i.test(historico.trim());
}

/**
 * Payee name after "PAGAMENTO DE BOLETO" / "OUTROS BANCOS" in Santander MEMO.
 * Returns null when there is no identifiable payee (kept as individual movement).
 */
export function extractSantanderBoletoPayee(historico: string): string | null {
  const text = historico.trim();
  if (!/PAGAMENTO\s+DE\s+BOLETO/i.test(text)) return null;

  const withPayee = text.match(
    /PAGAMENTO\s+DE\s+BOLETO(?:\s+OUTROS\s+BANCOS)?\s{2,}(.+)$/i
  );
  if (withPayee?.[1]?.trim()) return withPayee[1].trim();

  if (/^PAGAMENTO\s+DE\s+BOLETO\s*$/i.test(text)) return null;
  return null;
}

function agruparLista(
  lista: MovimentoTemporario[],
  historicoAgrupado: string
): MovimentoTemporario {
  const total = lista.reduce((acc, g) => acc + g.valor, 0);
  const base = { ...lista[0] };
  base.valor = total;
  base.tipoMovimento = total >= 0 ? "C" : "D";
  base.historico = historicoAgrupado;
  base.refNum = undefined;
  base.checkNum = undefined;
  return base;
}

/** Santander: group IOF by day; group boleto payments by day + payee; keep PIX and others individual. */
function agruparMovimentosSantander(movimentos: MovimentoTemporario[]): MovimentoTemporario[] {
  const porChave: Record<string, MovimentoTemporario[]> = {};
  const individuais: MovimentoTemporario[] = [];

  for (const m of movimentos) {
    const dia = m.dtMovimento.substring(0, 10);
    let chave: string | null = null;

    if (isSantanderIof(m.historico)) {
      chave = `${dia}|IOF`;
    } else {
      const payee = extractSantanderBoletoPayee(m.historico);
      if (payee) chave = `${dia}|BOLETO|${payee}`;
    }

    if (!chave) {
      individuais.push(m);
      continue;
    }
    if (!porChave[chave]) porChave[chave] = [];
    porChave[chave].push(m);
  }

  const saida: MovimentoTemporario[] = [...individuais];

  Object.entries(porChave).forEach(([chave, lista]) => {
    if (lista.length === 1) {
      saida.push(lista[0]);
      return;
    }
    if (chave.endsWith("|IOF")) {
      saida.push(
        agruparLista(lista, `IOF - Agrupado (${lista.length} movimentos)`)
      );
    } else {
      const payee = chave.split("|BOLETO|")[1] ?? "";
      saida.push(
        agruparLista(
          lista,
          `Pagamento de Boleto - Agrupado (${lista.length}) - ${payee}`
        )
      );
    }
  });

  return saida;
}

function agruparMovimentosBB(movimentos: MovimentoTemporario[]): MovimentoTemporario[] {
  const movimentosAgrupados: MovimentoTemporario[] = [];
  const porRef: Record<string, MovimentoTemporario[]> = {};
  const naoBB: MovimentoTemporario[] = [];

  movimentos.forEach((m) => {
    if (m.isBBCons && m.refNum) {
      if (!porRef[m.refNum]) porRef[m.refNum] = [];
      porRef[m.refNum].push(m);
    } else {
      naoBB.push(m);
    }
  });

  Object.keys(porRef).forEach((ref) => {
    const grupo = porRef[ref];
    if (grupo.length > 1) {
      const primeiro = grupo[0];
      const total = grupo.reduce((acc, g) => acc + g.valor, 0);
      const tipoMovimento: "C" | "D" = total >= 0 ? "C" : "D";

      const agrupado: MovimentoTemporario = {
        ...primeiro,
        valor: total,
        tipoMovimento,
        historico: `BB Cons - Agrupado (${grupo.length} movimentos) - REF: ${ref}`,
      };

      movimentosAgrupados.push(agrupado);

      console.log(`🔄 BB Cons agrupado por REFNUM ${ref}:`, {
        quantidade: grupo.length,
        valorTotal: formatCurrency(total),
        historico: agrupado.historico,
      });
    } else {
      movimentosAgrupados.push(grupo[0]);
    }
  });

  movimentosAgrupados.push(...naoBB);
  return movimentosAgrupados;
}

function agruparDuplicadosPorFITIDMesmoDia(
  movimentos: MovimentoTemporario[]
): MovimentoTemporario[] {
  const grupos: Record<string, MovimentoTemporario[]> = {};
  const chave = (m: MovimentoTemporario) =>
    `${m.identificadorOfx}|${m.dtMovimento.substring(0, 10)}|${m.tipoMovimento}`;

  for (const m of movimentos) {
    if (isFitidGenerico(m.identificadorOfx)) {
      continue;
    }
    const k = chave(m);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(m);
  }

  // FITID genérico (ex.: 000000): mantém cada lançamento individual
  movimentos
    .filter((m) => isFitidGenerico(m.identificadorOfx))
    .forEach((m) => {
      const k = `__solo__${m.identificadorOfx}|${m.dtMovimento}|${m.valor}|${m.historico}`;
      grupos[k] = [m];
    });

  const saida: MovimentoTemporario[] = [];
  Object.entries(grupos).forEach(([k, lista]) => {
    if (lista.length === 1) {
      // nada a agrupar
      saida.push(lista[0]);
      return;
    }
    // somar valores do grupo
    const total = lista.reduce((acc, it) => acc + it.valor, 0);
    // usar o primeiro como base
    const base = { ...lista[0] };
    base.valor = total;
    base.tipoMovimento = total >= 0 ? "C" : "D";
    base.historico = `Agrupado por FITID (${lista.length} movimentos) - FITID: ${base.identificadorOfx}`;
    // opcional: se REFNUM/CHECKNUM divergirem no grupo, podemos limpar
    // (para evitar associar um único valor a múltiplas refs diferentes)
    const todosRefIgual =
      lista.every((x) => x.refNum === base.refNum) ?? true;
    const todosCheckIgual =
      lista.every((x) => x.checkNum === base.checkNum) ?? true;
    if (!todosRefIgual) base.refNum = undefined;
    if (!todosCheckIgual) base.checkNum = undefined;

    saida.push(base);
  });

  return saida;
}

export function parseOFXContent(
  ofxContent: string
): { movimentos: MovimentoBancario[]; totalizadores: TotalizadoresOFX } {
  const normalized = normalizarOfx(ofxContent);

  // Banco
  const bankIdMatch = normalized.match(/<BANKID>(\d+)<\/BANKID>/);
  const bankId = bankIdMatch?.[1];
  const isBancoBrasil = bankId === "1";
  const isSantander = isSantanderBank(bankId, normalized);

  const transactions = normalized.match(/<STMTTRN>(.*?)<\/STMTTRN>/gs) || [];
  let movimentosTemporarios: MovimentoTemporario[] = [];

  transactions.forEach((transaction) => {
    const dateMatch = transaction.match(/<DTPOSTED>(\d+)/);
    const memoMatch = transaction.match(/<MEMO>(.*?)<\/MEMO>/);
    const nameMatch = transaction.match(/<NAME>(.*?)<\/NAME>/);
    const amountMatch = transaction.match(/<TRNAMT>([^<]+)<\/TRNAMT>/);
    const idOfxMatch = transaction.match(/<FITID>(.*?)<\/FITID>/);
    const refNumMatch = transaction.match(/<REFNUM>(.*?)<\/REFNUM>/);
    const checkNumMatch = transaction.match(/<CHECKNUM>(.*?)<\/CHECKNUM>/);
    const trnTypeMatch = transaction.match(/<TRNTYPE>(.*?)<\/TRNTYPE>/);

    const fitid = idOfxMatch?.[1]?.trim();
    if (!fitid) return;

    const name = nameMatch?.[1]?.trim() ?? "";
    const memo = memoMatch?.[1]?.trim() ?? "";
    const isDepositoBloqueado =
      /dep[oó]sito bloquead/i.test(name) || /dep[oó]sito bloquead/i.test(memo);
    const isMovimentoDoDia =
      /movimento do dia/i.test(name) || /movimento do dia/i.test(memo);
    if (isDepositoBloqueado || isMovimentoDoDia) return;

    const amountStr = amountMatch?.[1];
    const dateStr = dateMatch?.[1];
    if (!amountStr || !dateStr) return;

    const yyyy = dateStr.substring(0, 4);
    const mm = dateStr.substring(4, 6);
    const dd = dateStr.substring(6, 8);
    const dtMovimento = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();

    let historico = "Sem descrição";
    if (memo) historico = memo;
    else if (name) historico = name;

    const valor = parseOfxAmount(amountStr);
    if (Number.isNaN(valor)) return;

    const tipoMovimento: "C" | "D" = valor >= 0 ? "C" : "D";
    const refNum = refNumMatch?.[1]?.trim() || undefined;
    const checkNum = checkNumMatch?.[1]?.trim() || undefined;
    const trnType = trnTypeMatch?.[1]?.trim() || undefined;
    const isBBCons = /^BB\s+CONS/i.test(historico);

    movimentosTemporarios.push({
      dtMovimento,
      historico,
      valor,
      tipoMovimento,
      identificadorOfx: fitid,
      refNum,
      checkNum,
      trnType,
      isBBCons,
    });
  });

  let movimentosProcessados = movimentosTemporarios;
  if (isBancoBrasil) {
    movimentosProcessados = agruparMovimentosBB(movimentosTemporarios);
    movimentosProcessados = agruparDuplicadosPorFITIDMesmoDia(movimentosProcessados);
  } else if (isSantander) {
    movimentosProcessados = agruparMovimentosSantander(movimentosTemporarios);
  } else {
    movimentosProcessados = agruparDuplicadosPorFITIDMesmoDia(movimentosTemporarios);
  }

  const movimentos: MovimentoBancario[] = movimentosProcessados.map((mov) => {
    const identificadorImportacao = buildIdentificadorImportacao(
      mov.identificadorOfx,
      mov.dtMovimento,
      mov.valor,
      mov.refNum,
      mov.checkNum
    );

    return {
      dtMovimento: mov.dtMovimento,
      historico: mov.historico,
      valor: mov.valor,
      tipoMovimento: mov.tipoMovimento,
      identificadorOfx: identificadorImportacao,
      id: 0,
      idContaCorrente: 0,
      saldo: 0,
      ideagro: false,
      parcelado: false,
      modalidadeMovimento: "padrao",
      criadoEm: "",
      atualizadoEm: "",
      numeroDocumento: identificadorImportacao,
      idPlanoContas: undefined,
      idPessoa: undefined,
      idBanco: undefined,
      descricao: undefined,
      transfOrigem: undefined,
      transfDestino: undefined,
      idUsuario: undefined,
      idFinanciamento: undefined,
      resultadoList: undefined,
    };
  });

  let totalReceitasFinal = 0;
  let totalDespesasFinal = 0;
  movimentos.forEach((m) => {
    if (m.valor > 0) totalReceitasFinal += m.valor;
    else totalDespesasFinal += m.valor;
  });

  const liquido = totalReceitasFinal + totalDespesasFinal;

  movimentos.sort(
    (a, b) => new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime()
  );

  const dtInicialExtrato = movimentos.length ? movimentos[0].dtMovimento : "";
  const dtFinalExtrato =
    movimentos.length ? movimentos[movimentos.length - 1].dtMovimento : "";

  return {
    movimentos,
    totalizadores: {
      receitas: totalReceitasFinal,
      despesas: totalDespesasFinal,
      liquido,
      saldoFinal: liquido,
      dtInicialExtrato,
      dtFinalExtrato,
    },
  };
}

export const parseOFXFile = (
  file: File
): Promise<{ movimentos: MovimentoBancario[]; totalizadores: TotalizadoresOFX }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        reject("Erro ao ler o arquivo.");
        return;
      }
      resolve(parseOFXContent(event.target.result as string));
    };
    reader.onerror = () => reject("Erro ao processar o arquivo OFX.");
    reader.readAsText(file);
  });
};
