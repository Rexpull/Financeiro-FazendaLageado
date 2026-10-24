import { describe, it, expect } from "vitest";
import { coerceMonetaryValue, parseOfxIdentificadorParts } from "./coerceMonetaryValue";

describe("coerceMonetaryValue", () => {
  it("keeps standard decimals", () => {
    expect(coerceMonetaryValue(-114.35)).toBe(-114.35);
    expect(coerceMonetaryValue(-1061.52)).toBe(-1061.52);
  });

  it("parses Caixa-style string amounts", () => {
    expect(coerceMonetaryValue("-1.061.52")).toBe(-1061.52);
  });

  it("does not truncate -1.061.52 to -1.061", () => {
    expect(coerceMonetaryValue("-1.061.52")).not.toBe(-1.061);
  });
});

describe("parseOfxIdentificadorParts", () => {
  const dt = "2026-10-05T00:00:00.000Z";

  it("parses the classic format fitid|dt|valor|checkNum", () => {
    expect(parseOfxIdentificadorParts(`FIT1|${dt}|-10.00|851`)).toEqual({
      fitid: "FIT1",
      dtIso: dt,
      valor: "-10.00",
      checkNum: "851",
      ocorrencia: undefined,
      contaSufixo: undefined,
    });
  });

  it("parses lines without checkNum", () => {
    const p = parseOfxIdentificadorParts(`000000|${dt}|-2300.00`);
    expect(p).toMatchObject({ fitid: "000000", valor: "-2300.00" });
    expect(p?.checkNum).toBeUndefined();
  });

  it("tolerates the |#N occurrence suffix with and without checkNum", () => {
    expect(parseOfxIdentificadorParts(`FIT1|${dt}|-10.00|851|#2`)).toMatchObject({ checkNum: "851", ocorrencia: 2 });
    const semCheck = parseOfxIdentificadorParts(`FIT1|${dt}|-10.00|#3`);
    expect(semCheck).toMatchObject({ ocorrencia: 3 });
    expect(semCheck?.checkNum).toBeUndefined();
  });

  it("recognizes the conta suffix |@c<id> after the other parts", () => {
    expect(parseOfxIdentificadorParts(`FIT1|${dt}|-10.00|851|#2|@c25`)).toMatchObject({
      checkNum: "851",
      ocorrencia: 2,
      contaSufixo: "@c25",
    });
    const p = parseOfxIdentificadorParts(`FIT1|${dt}|-10.00|@c25-2`);
    expect(p).toMatchObject({ contaSufixo: "@c25-2" });
    expect(p?.checkNum).toBeUndefined();
  });

  it("returns null for non-OFX identificadores (uuid)", () => {
    expect(parseOfxIdentificadorParts("2b1f0c1e-1111-4a4a-9999-000000000000")).toBeNull();
  });
});
