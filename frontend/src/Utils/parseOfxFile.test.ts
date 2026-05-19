import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  parseOfxAmount,
  parseOFXContent,
  parseOFXFile,
  extractSantanderBoletoPayee,
  isSantanderIof,
} from "./parseOfxFile";
import {
  OFX_CAIXA_MARCO,
  OFX_STANDARD_BANK,
  OFX_WITH_IGNORED,
  OFX_BB_CONS_GROUP,
  OFX_SANTANDER_MARCO,
  OFX_FITID_GENERIC_OTHER_BANK,
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
  describe("real Caixa OFX file from disk", () => {
    const realFile = path.join(
      process.cwd(),
      "e2e/fixtures/extrato-caixa-marco.ofx"
    );

    it.skipIf(!existsSync(realFile))("parses both lines from production Caixa export", () => {
      const content = readFileSync(realFile, "utf8");
      const { movimentos } = parseOFXContent(content);
      expect(movimentos).toHaveLength(2);
      const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");
      expect(consorcio?.valor).toBe(-1061.52);
    });
  });

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

  describe("Santander (BANKID 0033)", () => {
    it("does not use generic FITID grouping", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      expect(movimentos.some((m) => m.historico.includes("Agrupado por FITID"))).toBe(
        false
      );
    });

    it("groups IOF by day", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      const iof = movimentos.find((m) => m.historico.startsWith("IOF - Agrupado"));
      expect(iof?.valor).toBeCloseTo(-767.55, 2);
    });

    it("groups boleto payments by payee on the same day", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      const lafor = movimentos.find((m) =>
        m.historico.includes("LAFOR COMERCIO DE COMBUST")
      );
      expect(lafor?.valor).toBeCloseTo(-53575, 2);
      expect(lafor?.historico).toContain("Agrupado (3)");
    });

    it("groups CARAMURU boletos (2) into one line", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      const caramuru = movimentos.find((m) =>
        m.historico.includes("CARAMURU ALIMENTOS")
      );
      expect(caramuru?.valor).toBeCloseTo(-37662.48, 2);
    });

    it("keeps PIX and remuneracao as individual movements", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      const pixRecebido = movimentos.filter((m) => m.historico.includes("PIX RECEBIDO"));
      const pixEnviado = movimentos.filter((m) => m.historico.includes("PIX ENVIADO"));
      const remuneracao = movimentos.filter((m) =>
        m.historico.includes("REMUNERACAO APLICACAO")
      );
      expect(pixRecebido).toHaveLength(1);
      expect(pixRecebido[0].valor).toBe(200000);
      expect(pixEnviado).toHaveLength(2);
      expect(remuneracao).toHaveLength(2);
    });

    it("keeps boleto without payee name as individual", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      const semDest = movimentos.filter(
        (m) =>
          m.historico.trim() === "PAGAMENTO DE BOLETO" ||
          (m.historico.includes("PAGAMENTO DE BOLETO") && !m.historico.includes("Agrupado"))
      );
      expect(semDest.some((m) => m.valor === -3588.91)).toBe(true);
    });

    it("produces 14 movements from 17 raw lines (grouped IOF + boletos)", () => {
      const { movimentos } = parseOFXContent(OFX_SANTANDER_MARCO);
      expect(movimentos).toHaveLength(14);
    });

    it("preserves statement net total", () => {
      const { totalizadores } = parseOFXContent(OFX_SANTANDER_MARCO);
      expect(totalizadores.liquido).toBeCloseTo(2974.58, 2);
    });
  });

  describe("generic FITID on other banks", () => {
    it("does not merge different memos with FITID 000000", () => {
      const { movimentos } = parseOFXContent(OFX_FITID_GENERIC_OTHER_BANK);
      expect(movimentos).toHaveLength(2);
      expect(movimentos.some((m) => m.historico.includes("Agrupado por FITID"))).toBe(
        false
      );
    });
  });
});

describe("Santander helpers", () => {
  describe("extractSantanderBoletoPayee", () => {
    it("extracts payee after OUTROS BANCOS", () => {
      expect(
        extractSantanderBoletoPayee(
          "PAGAMENTO DE BOLETO OUTROS BANCOS  LAFOR COMERCIO DE COMBUST"
        )
      ).toBe("LAFOR COMERCIO DE COMBUST");
    });

    it("returns null for boleto without payee", () => {
      expect(extractSantanderBoletoPayee("PAGAMENTO DE BOLETO")).toBeNull();
    });

    it("returns null for non-boleto memo", () => {
      expect(extractSantanderBoletoPayee("PIX ENVIADO")).toBeNull();
    });
  });

  describe("isSantanderIof", () => {
    it("detects IOF lines", () => {
      expect(isSantanderIof("IOF ADICIONAL - AUTOMATICO")).toBe(true);
      expect(isSantanderIof("IOF IMPOSTO OPERACOES FINANCEIRAS")).toBe(true);
    });

    it("does not match IOF substring in other words", () => {
      expect(isSantanderIof("PIX ENVIADO")).toBe(false);
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
