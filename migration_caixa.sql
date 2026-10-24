-- Dashboard aba "Caixa": previsão de posição de caixa dia a dia.
-- caixaSaldoInicial: saldo inicial digitado pelo usuário, um por mês.
-- caixaLancamento: boletos a pagar (tipo BOLETO, sempre natureza D) e previsões
-- do simulador (tipo PREVISAO, natureza C = entrada ou D = saída). data em 'YYYY-MM-DD'.
-- Financiamentos vêm de parcelaFinanciamento (dt_vencimento), não são gravados aqui.
-- Idempotente (IF NOT EXISTS). CaixaRepository também cria as tabelas se faltarem.
-- Apply: npx wrangler d1 execute financeiro_db --remote --file=migration_caixa.sql

CREATE TABLE IF NOT EXISTS caixaSaldoInicial (
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
  valor REAL NOT NULL,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS caixaLancamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('BOLETO', 'PREVISAO')),
  natureza TEXT NOT NULL CHECK(natureza IN ('C', 'D')),
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL CHECK(valor > 0),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caixa_lancamento_data
  ON caixaLancamento(data);

-- A aba Caixa busca as parcelas do mês por faixa de dt_vencimento. Sem este índice
-- cada abertura da aba varre parcelaFinanciamento inteira (custo de linhas lidas no D1).
CREATE INDEX IF NOT EXISTS idx_pf_vencimento
  ON parcelaFinanciamento(dt_vencimento);
