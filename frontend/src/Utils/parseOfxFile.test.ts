import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  parseOfxAmount,
  parseOFXContent,
  parseOFXFile,
  extractSantanderBoletoPayee,
  isSantanderIof,
  decodeOfxBytes,
  desambiguarIdentificadoresRepetidos,
} from "./parseOfxFile";
import {
  OFX_CAIXA_MARCO,
  OFX_STANDARD_BANK,
  OFX_WITH_IGNORED,
  OFX_BB_CONS_GROUP,
  OFX_SANTANDER_MARCO,
  OFX_FITID_GENERIC_OTHER_BANK,
  OFX_BRADESCO_GJN,
  OFX_CP1252_BYTES,
  OFX_XML_CP1252_BYTES,
  OFX_SANTANDER_LINHAS_REPETIDAS,
  OFX_FITID_GENERIC_LINHAS_IDENTICAS,
  toSingleByte,
} from "./parseOfxFile.fixtures";

const BRADESCO_FULL_FIXTURE = path.join(
  __dirname,
  "__fixtures__",
  "extrato-bradesco-gjn-abril.ofx"
);

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

  describe("Bradesco (BANKID 0237, mixed SGML closers)", () => {
    it("parses movements when only STMTTRN is closed (not TRNAMT/FITID)", () => {
      const { movimentos } = parseOFXContent(OFX_BRADESCO_GJN);

      expect(movimentos).toHaveLength(3);
      expect(movimentos.map((m) => m.valor)).toEqual([5000, -5000, -847.87]);
      expect(movimentos[0].historico).toContain("Transfe Pix");
      expect(movimentos[2].historico).toContain("Mardula Engenharia");
    });

    it("parses DTPOSTED with timezone suffix [-03:EST]", () => {
      const { movimentos } = parseOFXContent(OFX_BRADESCO_GJN);
      expect(movimentos[0].dtMovimento).toMatch(/2026-04-13/);
    });

    it("keeps each FITID as a separate movement (no erroneous grouping)", () => {
      const { movimentos } = parseOFXContent(OFX_BRADESCO_GJN);
      expect(movimentos.every((m) => !m.historico.includes("Agrupado por FITID"))).toBe(
        true
      );
    });

    it("parses the full April export fixture (22 movements)", () => {
      if (!existsSync(BRADESCO_FULL_FIXTURE)) return;

      const content = readFileSync(BRADESCO_FULL_FIXTURE, "utf8");
      const { movimentos } = parseOFXContent(content);

      expect(movimentos.length).toBe(22);
      const creditoRural = movimentos.find((m) =>
        m.historico.includes("Operacao Credito Rural")
      );
      expect(creditoRural?.valor).toBe(1300000);
      const aplicacaoCdb = movimentos.find((m) => m.historico.includes("Aplicacao Cdb"));
      expect(aplicacaoCdb?.valor).toBe(-1300000);
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

    it("computes operational net (excludes transfers and application/redemption)", () => {
      const { totalizadores } = parseOFXContent(OFX_SANTANDER_MARCO);
      expect(totalizadores.liquido).toBeCloseTo(2974.48, 2);
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

  it("reads File bytes and parses content", async () => {
    const file = new File([OFX_CAIXA_MARCO], "caixa.ofx", {
      type: "application/octet-stream",
    });
    const { movimentos } = await parseOFXFile(file);

    expect(movimentos).toHaveLength(2);
    const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");
    expect(consorcio?.valor).toBe(-1061.52);
  });

  it("decodes a windows-1252 file (CHARSET:1252) instead of reading it as UTF-8", async () => {
    const file = new File([OFX_CP1252_BYTES], "bradesco.ofx", {
      type: "application/octet-stream",
    });
    const { movimentos } = await parseOFXFile(file);

    expect(movimentos.map((m) => m.historico)).toEqual([
      "DÉB. TARIFA PACOTE",
      "DEPÓSITO EM DINHEIRO",
    ]);
    expect(movimentos.some((m) => m.historico.includes("�"))).toBe(false);
  });

  it("falls back to FileReader.readAsArrayBuffer when File.arrayBuffer is unavailable", async () => {
    class MockFileReader {
      onload: ((ev: { target: { result: ArrayBuffer } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer() {
        queueMicrotask(() => {
          this.onload?.({ target: { result: OFX_CP1252_BYTES.slice().buffer } });
        });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const fakeFile = { name: "x.ofx" } as unknown as File;
    const { movimentos } = await parseOFXFile(fakeFile);
    expect(movimentos[0].historico).toBe("DÉB. TARIFA PACOTE");
  });
});

describe("decodeOfxBytes", () => {
  it("uses windows-1252 when header declares CHARSET:1252", () => {
    const text = decodeOfxBytes(OFX_CP1252_BYTES);
    expect(text).toContain("DÉB. TARIFA PACOTE");
    expect(text).toContain("DEPÓSITO BLOQUEADO");
    expect(text).not.toContain("�");
  });

  it("honours <?xml encoding=\"windows-1252\"?> on OFX 2.x", () => {
    const text = decodeOfxBytes(OFX_XML_CP1252_BYTES);
    expect(text).toContain("DÉBITO TARIFA");
  });

  it("keeps UTF-8 content intact (declared or not)", () => {
    const utf8 = new TextEncoder().encode(
      "OFXHEADER:100\nENCODING:UTF-8\nCHARSET:NONE\n\n<OFX><MEMO>DÉB. AÇÚCAR</MEMO></OFX>"
    );
    expect(decodeOfxBytes(utf8)).toContain("DÉB. AÇÚCAR");

    const semHeader = new TextEncoder().encode("<OFX><MEMO>DEPÓSITO</MEMO></OFX>");
    expect(decodeOfxBytes(semHeader)).toContain("DEPÓSITO");
  });

  it("falls back to windows-1252 when there is no header and bytes are not valid UTF-8", () => {
    const bytes = toSingleByte(`<OFX><MEMO>DEP${String.fromCharCode(0xd3)}SITO</MEMO></OFX>`);
    expect(decodeOfxBytes(bytes)).toContain("DEPÓSITO");
  });

  it("handles a mislabeled file (header 1252 but UTF-8 bytes) without mojibake", () => {
    const bytes = new TextEncoder().encode(
      "OFXHEADER:100\nENCODING:USASCII\nCHARSET:1252\n\n<OFX><MEMO>DÉB.</MEMO></OFX>"
    );
    expect(decodeOfxBytes(bytes)).toContain("DÉB.");
  });
});

describe("windows-1252 OFX content", () => {
  it("filters DEPÓSITO BLOQUEADO and keeps accents in historico", () => {
    const { movimentos, totalizadores } = parseOFXContent(decodeOfxBytes(OFX_CP1252_BYTES));

    expect(movimentos).toHaveLength(2);
    expect(movimentos.some((m) => /BLOQUEADO/.test(m.historico))).toBe(false);
    expect(movimentos.some((m) => m.valor === 9000)).toBe(false);
    expect(movimentos[0].historico).toBe("DÉB. TARIFA PACOTE");
    expect(totalizadores.receitas).toBe(300);
  });
});

describe("identificadorOfx for repeated lines in the same file", () => {
  it("keeps the first occurrence unchanged and suffixes the following with |#2, |#3", () => {
    const { movimentos } = parseOFXContent(OFX_SANTANDER_LINHAS_REPETIDAS);

    expect(movimentos).toHaveLength(4);
    const ids = movimentos.map((m) => m.identificadorOfx);
    expect(ids).toEqual([
      "000000|2026-03-10T00:00:00.000Z|-500.00",
      "000000|2026-03-10T00:00:00.000Z|-500.00|#2",
      "000000|2026-03-10T00:00:00.000Z|-500.00|#3",
      "000000|2026-03-11T00:00:00.000Z|-500.00",
    ]);
    expect(new Set(ids).size).toBe(4);
    expect(movimentos.map((m) => m.numeroDocumento)).toEqual(ids);
  });

  it("keeps identical generic-FITID lines on other banks as separate movements", () => {
    const { movimentos } = parseOFXContent(OFX_FITID_GENERIC_LINHAS_IDENTICAS);

    expect(movimentos).toHaveLength(2);
    expect(movimentos.map((m) => m.identificadorOfx)).toEqual([
      "000000|2026-01-10T00:00:00.000Z|-100.00",
      "000000|2026-01-10T00:00:00.000Z|-100.00|#2",
    ]);
  });

  it("does not change identifiers when there are no repetitions", () => {
    const { movimentos } = parseOFXContent(OFX_CAIXA_MARCO);
    expect(movimentos.every((m) => !m.identificadorOfx.includes("|#"))).toBe(true);
    const consorcio = movimentos.find((m) => m.historico === "CONSORCIO");
    expect(consorcio?.identificadorOfx).toBe("374751|2026-03-10T00:00:00.000Z|-1061.52|374751");
  });

  it("desambiguarIdentificadoresRepetidos avoids clashing with an existing suffixed id", () => {
    expect(desambiguarIdentificadoresRepetidos(["a", "b", "a", "a|#2", "a"])).toEqual([
      "a",
      "b",
      "a|#3",
      "a|#2",
      "a|#4",
    ]);
  });
});
