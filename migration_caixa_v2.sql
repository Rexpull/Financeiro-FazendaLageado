-- Dashboard aba "Caixa" (v2): escolha das parcelas de financiamento que entram na apuração do saldo.
-- caixaParcelaConsiderada: uma linha por parcela que o usuário marcou (considerar = 1) ou desmarcou (0).
-- Sem linha vale o padrão: parcelas abertas/vencidas consideradas, liquidadas não.
-- A parcela é lida pelo id com a dt_vencimento atual do cadastro: se o vencimento mudar, o caixa acompanha.
-- Sem FK para parcelaFinanciamento (o D1 aplica FKs; travaria a exclusão de parcelas no cadastro).
-- Boletos (v2) não mudam o schema: o total do dia fica em caixaLancamento (tipo BOLETO, descricao '').
-- Idempotente (IF NOT EXISTS). CaixaRepository também cria a tabela se faltar.
-- Apply: npx wrangler d1 execute financeiro_db --remote --file=migration_caixa_v2.sql

CREATE TABLE IF NOT EXISTS caixaParcelaConsiderada (
  idParcela INTEGER PRIMARY KEY,
  considerar INTEGER NOT NULL CHECK(considerar IN (0, 1)),
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
