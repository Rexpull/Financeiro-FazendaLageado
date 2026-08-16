import { describe, it, expect } from "vitest";
import {
  calcularTotalizadoresExtrato,
  historicoIndicaSemEfeitoFinanceiro,
  isMovimentoSemEfeitoFinanceiro,
} from "./extratoTotalizadores";
import { MovimentoBancario } from "../../../backend/src/models/MovimentoBancario";

const baseMov = (overrides: Partial<MovimentoBancario>): MovimentoBancario =>
  ({
    id: 1,
    dtMovimento: "2025-03-01T00:00:00.000Z",
    historico: "Pagamento fornecedor",
    idContaCorrente: 1,
    valor: 100,
    saldo: 0,
    ideagro: false,
    parcelado: false,
    identificadorOfx: "x",
    criadoEm: "",
    atualizadoEm: "",
    tipoMovimento: "C",
    modalidadeMovimento: "padrao",
    ...overrides,
  }) as MovimentoBancario;

describe("historicoIndicaSemEfeitoFinanceiro", () => {
  it("detects strong transfer and resgate patterns", () => {
    expect(historicoIndicaSemEfeitoFinanceiro("TRANSFERENCIA ENTRE CONTAS")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("RESGATE AUTOMATICO CDB")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("APLICACAO EM FUNDO")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("Pagamento de fornecedor")).toBe(false);
  });

  it("does not treat bare TRANSF in operational memos as sem efeito", () => {
    // Bank memos often contain TRANSF/TED without meaning internal transfer
    expect(
      historicoIndicaSemEfeitoFinanceiro(
        "TED Transf.Eletr.Disponv - 237 2042 MINERVA S/A VENDA LEITE"
      )
    ).toBe(false);
    expect(historicoIndicaSemEfeitoFinanceiro("TRANSF RECEBIDA VENDA")).toBe(false);
  });

  it("detects OFX XFER type", () => {
    expect(historicoIndicaSemEfeitoFinanceiro("Qualquer texto", "XFER")).toBe(true);
  });
});

describe("isMovimentoSemEfeitoFinanceiro", () => {
  it("excludes modalidade transferencia", () => {
    expect(
      isMovimentoSemEfeitoFinanceiro(
        baseMov({ modalidadeMovimento: "transferencia", valor: 500 })
      )
    ).toBe(true);
  });

  it("excludes configured plan ids", () => {
    expect(
      isMovimentoSemEfeitoFinanceiro(
        baseMov({ idPlanoContas: 99, valor: 200 }),
        { idPlanoTransferenciaEntreContas: 99 }
      )
    ).toBe(true);
  });

  it("includes padrao operational credit even when historico has TRANSF", () => {
    // Regression: SICOOB GJN milk sale was excluded from Conciliação receitas
    expect(
      isMovimentoSemEfeitoFinanceiro(
        baseMov({
          valor: 793319.71,
          historico: "TED Transf.Eletr.Disponv - VENDA DE LEITE",
          modalidadeMovimento: "padrao",
          idPlanoContas: 42,
        }),
        { idPlanoTransferenciaEntreContas: 10 }
      )
    ).toBe(false);
  });

  it("still excludes unclassified credit with entre contas historico", () => {
    expect(
      isMovimentoSemEfeitoFinanceiro(
        baseMov({
          valor: 1000,
          historico: "PIX ENTRE CONTAS MESMA TITULARIDADE",
          modalidadeMovimento: "padrao",
          idPlanoContas: null,
        })
      )
    ).toBe(true);
  });
});

describe("calcularTotalizadoresExtrato", () => {
  it("omits true transfers and keeps operational credits including TRANSF memos", () => {
    const movimentos = [
      baseMov({ valor: 1000, historico: "Venda soja", idPlanoContas: 1 }),
      baseMov({
        valor: 793319.71,
        historico: "TED Transf.Eletr.Disponv - VENDA DE LEITE",
        idPlanoContas: 42,
        id: 2,
      }),
      baseMov({
        valor: 12512.08,
        historico: "Prestacao de servicos",
        idPlanoContas: 43,
        id: 4,
      }),
      baseMov({
        valor: 800,
        historico: "TRANSFERENCIA ENTRE CONTAS",
        idPlanoContas: null,
        id: 5,
      }),
      baseMov({
        valor: 500,
        historico: "RESGATE AUTOMATICO",
        modalidadeMovimento: "transferencia",
        id: 3,
      }),
      baseMov({ valor: -300, historico: "Combustivel", tipoMovimento: "D", id: 6 }),
    ];

    const t = calcularTotalizadoresExtrato(movimentos);
    expect(t.receitas).toBe(1000 + 793319.71 + 12512.08);
    expect(t.despesas).toBe(-300);
    expect(t.liquido).toBe(1000 + 793319.71 + 12512.08 - 300);
  });
});
