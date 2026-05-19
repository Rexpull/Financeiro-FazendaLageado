import { readFileSync } from "fs";

function normalizarOfxBroken(ofx) {
  return ofx
    .replace(/<(\w+?)>([^<\r\n]+)/g, "<$1>$2</$1>")
    .replace(/\r?\n/g, "")
    .replace(/>\s+</g, "><");
}

function normalizarOfxFixed(ofx) {
  const hasClosingTags = /<\/\w+>/i.test(ofx);
  let s = ofx.replace(/&nbsp;/g, " ").replace(/\r?\n/g, "").replace(/>\s+</g, "><");
  if (!hasClosingTags) {
    s = ofx
      .replace(/<(\w+?)>([^<\r\n]+)/g, "<$1>$2</$1>")
      .replace(/&nbsp;/g, " ")
      .replace(/\r?\n/g, "")
      .replace(/>\s+</g, "><");
  }
  return s;
}

function parseAmount(amountStr) {
  const raw = amountStr.trim();
  const isNegative = raw.startsWith("-");
  let unsigned = isNegative ? raw.slice(1) : raw;
  const parts = unsigned.split(".");
  if (parts.length <= 2) {
    const v = parseFloat(unsigned);
    return isNegative ? -Math.abs(v) : v;
  }
  const cents = parts[parts.length - 1];
  const integerPart = parts.slice(0, -1).join("");
  const v = parseFloat(`${integerPart}.${cents}`);
  return isNegative ? -Math.abs(v) : v;
}

function test(label, normalizar) {
  const content = readFileSync(
    "c:/Users/mvbra/Downloads/extrato - Caixa - Março - Fechado.ofx",
    "utf8"
  );
  const n = normalizar(content);
  const txs = n.match(/<STMTTRN>(.*?)<\/STMTTRN>/gs) || [];
  console.log(`\n=== ${label} ===`);
  console.log("transactions:", txs.length);
  for (const t of txs) {
    const am = t.match(/<TRNAMT>([^<]+)<\/TRNAMT>/);
    const memo = t.match(/<MEMO>(.*?)<\/MEMO>/)?.[1];
    const valor = am ? parseAmount(am[1]) : NaN;
    console.log({ memo, trnamt: am?.[1], valor, ok: !Number.isNaN(valor) });
  }
}

test("BROKEN normalizar", normalizarOfxBroken);
test("FIXED normalizar", normalizarOfxFixed);
