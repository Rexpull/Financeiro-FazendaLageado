/**
 * Normalizes monetary values from API/OFX (number or string).
 * Mirrors frontend parseOfxAmount for Caixa-style amounts like "-1.061.52".
 */
export function coerceMonetaryValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const raw = value.trim();
  if (!raw) return 0;

  const isNegative = raw.startsWith("-");
  let unsigned = isNegative ? raw.slice(1) : raw;

  if (unsigned.includes(",") && !unsigned.includes(".")) {
    unsigned = unsigned.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : Number.isFinite(v) ? v : 0;
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
    return isNegative ? -Math.abs(v) : Number.isFinite(v) ? v : 0;
  }

  const parts = unsigned.split(".");
  if (parts.length <= 2) {
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : Number.isFinite(v) ? v : 0;
  }

  const cents = parts[parts.length - 1];
  if (!/^\d{2}$/.test(cents) || parts.some((p) => !/^\d+$/.test(p))) {
    const v = parseFloat(unsigned);
    return Number.isNaN(v) ? 0 : isNegative ? -Math.abs(v) : v;
  }

  const integerPart = parts.slice(0, -1).join("");
  const v = parseFloat(`${integerPart}.${cents}`);
  return isNegative ? -Math.abs(v) : Number.isFinite(v) ? v : 0;
}

/** `|#N` (N≥2): Nth identical line of the same OFX file (appended by the frontend parser). */
const OCORRENCIA_RE = /^#(\d+)$/;
/** `|@c<idConta>[-n]`: stored when the same identificador already exists in another conta. */
const CONTA_SUFIXO_RE = /^@c\d+(?:-\d+)?$/;

/**
 * OFX identificador: `fitid|dtIso|valor[|checkNum][|#N][|@c<idConta>]`.
 * The optional suffixes are recognized by pattern (never by position), so
 * `fitid|dt|valor|#2` has no checkNum and occurrence 2.
 */
export function parseOfxIdentificadorParts(identificadorOfx: string): {
  fitid: string;
  dtIso: string;
  valor?: string;
  checkNum?: string;
  ocorrencia?: number;
  contaSufixo?: string;
} | null {
  if (typeof identificadorOfx !== "string") return null;
  const parts = identificadorOfx.split("|");
  if (parts.length < 2) return null;

  const tail = parts.slice(3);
  let contaSufixo: string | undefined;
  let ocorrencia: number | undefined;
  if (tail.length && CONTA_SUFIXO_RE.test(tail[tail.length - 1])) {
    contaSufixo = tail.pop();
  }
  if (tail.length) {
    const m = OCORRENCIA_RE.exec(tail[tail.length - 1]);
    if (m) {
      ocorrencia = Number(m[1]);
      tail.pop();
    }
  }
  const checkNum = tail.length ? tail.join("|") : undefined;

  return {
    fitid: parts[0],
    dtIso: parts[1],
    valor: parts[2],
    checkNum: checkNum || undefined,
    ocorrencia,
    contaSufixo,
  };
}
