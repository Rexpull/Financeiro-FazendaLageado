import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseOfxAmount,
  parseOFXContent,
  parseOFXFile,
} from "./parseOfxFile";
import {
  OFX_CAIXA_MARCO,
  OFX_STANDARD_BANK,
  OFX_WITH_IGNORED,
  OFX_BB_CONS_GROUP,
} from "./parseOfxFile.fixtures";

describe("parseOfxAmount", () => {
  describe("standard US decimal (most banks)", () => {
    const cases: [string, number][] = [
      ["-114.35", -114.35],
      ["1234.56", 1234.56],
      ["-1000.00", -1000],
      ["-50.5", -50.5],
      ["-1061.52", -1061.52],
      ["0.01", 0.01],
      ["-0.99", -0.99],
      ["999999.99", 999999.99],
      ["-1234567.89", -1234567.89],
      ["1500.00", 1500],
      ["2500.50", 2500.5],
    ];

    it.each(cases)("parses %s as %s", (input, expected) => {
      expect(parseOfxAmount(input)).toBe(expected);
    });
  });

  describe("Caixa-style (multiple dots as thousands)", () => {
    const cases: [string, number][] = [
      ["-1.061.52", -1061.52],
      ["2.648.26", 2648.26],
      ["10.500.00", 10500],
      ["-10.500.00", -10500],
      ["1.000.000,00", 1000000], // comma decimal variant
    ];

    it.each(cases)("parses %s as %s", (input, expected) => {
      expect(parseOfxAmount(input)).toBe(expected);
    });
  });

  describe("comma decimal (Brazilian)", () => {
    const cases: [string, number][] = [
      ["1.061,52", 1061.52],
      ["-1.234,56", -1234.56],
      ["-1061,52", -1061.52],
      ["500,00", 500],
      ["-500,00", -500],
    ];

    it.each(cases)("parses %s as %s", (input, expected) => {
      expect(parseOfxAmount(input)).toBe(expected);
    });
  });

  describe("credits (positive amounts)", () => {
    it("parses positive values", () => {
      expect(parseOfxAmount("1500.25")).toBe(1500.25);
      expect(parseOfxAmount("10.500,00")).toBe(10500);
    });
  });

  describe("whitespace and edge cases", () => {
    it("trims surrounding whitespace", () => {
      expect(parseOfxAmount("  -114.35  ")).toBe(-114.35);
    });

    it("returns NaN for empty or invalid input", () => {
      expect(parseOfxAmount("")).toBeNaN();
      expect(parseOfxAmount("   ")).toBeNaN();
      expect(parseOfxAmount("abc")).toBeNaN();
    });
  });

  describe("regression: Caixa vs standard must not cross-contaminate", () => {
    it("does not shrink Caixa -1.061.52 to -1.061", () => {
      const parsed = parseOfxAmount("-1.061.52");
      expect(parsed).not.toBe(-1.061);
      expect(parsed).toBe(-1061.52);
    });

    it("keeps standard -114.35 unchanged", () => {
      expect(parseOfxAmount("-114.35")).toBe(-114.35);
    });
  });
});

describe("parseOFXContent", () => {
  describe("Caixa extract (March)", () => {
    it("imports both transactions with correct amounts", () => {
      const { movimentos, totalizadores } = parseOFXContent(OFX_CAIXA_MARCO);

      expect(movimentos).toHaveLength(2);

      const capitalizacao = movimentos.find((m) => m.historico.includes("CAPITALIZACAO"));
      const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");

      expect(capitalizacao?.valor).toBe(-114.35);
      expect(capitalizacao?.tipoMovimento).toBe("D");

      expect(consorcio?.valor).toBe(-1061.52);
      expect(consorcio?.valor).not.toBe(-1.061);
      expect(consorcio?.tipoMovimento).toBe("D");
    });

    it("computes correct totals", () => {
      const { totalizadores } = parseOFXContent(OFX_CAIXA_MARCO);
      const expectedLiquido = -114.35 + -1061.52;

      expect(totalizadores.receitas).toBe(0);
      expect(totalizadores.despesas).toBeCloseTo(expectedLiquido, 2);
      expect(totalizadores.liquido).toBeCloseTo(expectedLiquido, 2);
    });

    it("orders movements by date ascending", () => {
      const { movimentos } = parseOFXContent(OFX_CAIXA_MARCO);
      const dates = movimentos.map((m) => new Date(m.dtMovimento).getTime());
      expect(dates[0]).toBeLessThan(dates[1]);
    });

    it("builds identificadorOfx with parsed valor (not truncated)", () => {
      const { movimentos } = parseOFXContent(OFX_CAIXA_MARCO);
      const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");
      expect(consorcio?.identificadorOfx).toContain("374751");
      expect(consorcio?.identificadorOfx).toMatch(/\|-1061\.52\|/);
    });
  });

  describe("standard bank (Itaú-style BANKID)", () => {
    it("parses all movements with US decimal format", () => {
      const { movimentos } = parseOFXContent(OFX_STANDARD_BANK);

      expect(movimentos).toHaveLength(3);
      expect(movimentos.map((m) => m.valor)).toEqual([-500, 1500.25, -1234567.89]);
    });

    it("assigns credit/debit types correctly", () => {
      const { movimentos } = parseOFXContent(OFX_STANDARD_BANK);
      expect(movimentos.find((m) => m.valor > 0)?.tipoMovimento).toBe("C");
      expect(movimentos.every((m) => m.valor < 0 ? m.tipoMovimento === "D" : true)).toBe(true);
    });
  });

  describe("filtered transactions", () => {
    it("ignores blocked deposit, movimento do dia, invalid amount, and missing FITID", () => {
      const { movimentos } = parseOFXContent(OFX_WITH_IGNORED);

      expect(movimentos).toHaveLength(1);
      expect(movimentos[0].historico).toBe("LANCAMENTO VALIDO");
      expect(movimentos[0].valor).toBe(-100);
    });
  });

  describe("Banco do Brasil BB Cons grouping", () => {
    it("groups BB Cons by REFNUM into a single movement", () => {
      const { movimentos } = parseOFXContent(OFX_BB_CONS_GROUP);

      expect(movimentos).toHaveLength(1);
      expect(movimentos[0].valor).toBe(-150);
      expect(movimentos[0].historico).toContain("BB Cons");
      expect(movimentos[0].historico).toContain("Agrupado");
    });
  });

  describe("empty / minimal OFX", () => {
    it("returns empty movimentos when no STMTTRN", () => {
      const { movimentos, totalizadores } = parseOFXContent("<OFX></OFX>");
      expect(movimentos).toHaveLength(0);
      expect(totalizadores.liquido).toBe(0);
    });
  });
});

describe("parseOFXFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads File via FileReader and parses content", async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        queueMicrotask(() => {
          this.onload?.({ target: { result: OFX_CAIXA_MARCO } });
        });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const file = new File([OFX_CAIXA_MARCO], "caixa.ofx", {
      type: "application/octet-stream",
    });
    const { movimentos } = await parseOFXFile(file);

    expect(movimentos).toHaveLength(2);
    const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");
    expect(consorcio?.valor).toBe(-1061.52);
  });
});
