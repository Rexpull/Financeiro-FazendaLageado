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

export function parseOfxIdentificadorParts(identificadorOfx: string): {
  fitid: string;
  dtIso: string;
  checkNum?: string;
} | null {
  const parts = identificadorOfx.split("|");
  if (parts.length < 2) return null;
  return {
    fitid: parts[0],
    dtIso: parts[1],
    checkNum: parts[3],
  };
}
