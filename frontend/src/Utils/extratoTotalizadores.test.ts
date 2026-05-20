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
  it("detects transfer and resgate patterns", () => {
    expect(historicoIndicaSemEfeitoFinanceiro("TRANSFERENCIA ENTRE CONTAS")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("RESGATE AUTOMATICO CDB")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("APLICACAO EM FUNDO")).toBe(true);
    expect(historicoIndicaSemEfeitoFinanceiro("Pagamento de fornecedor")).toBe(false);
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
});

describe("calcularTotalizadoresExtrato", () => {
  it("omits transfers from receitas and keeps operational credits", () => {
    const movimentos = [
      baseMov({ valor: 1000, historico: "Venda soja" }),
      baseMov({ valor: 800, historico: "TRANSFERENCIA RECEBIDA", id: 2 }),
      baseMov({
        valor: 500,
        historico: "RESGATE AUTOMATICO",
        modalidadeMovimento: "transferencia",
        id: 3,
      }),
      baseMov({ valor: -300, historico: "Combustivel", tipoMovimento: "D" }),
    ];

    const t = calcularTotalizadoresExtrato(movimentos);
    expect(t.receitas).toBe(1000);
    expect(t.despesas).toBe(-300);
    expect(t.liquido).toBe(700);
  });
});
