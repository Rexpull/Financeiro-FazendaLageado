-- Índices de custo de leitura do D1 (plano gratuito: 5M linhas lidas/dia).
-- idx_mcc_movimento já existia em migration_d1_dashboard_indexes.sql, mas foi perdido quando
-- migration_padronizacao_plano_centro_custos.sql recriou MovimentoCentroCustos (DROP + CREATE).
-- Sem ele, o anti-join do Dashboard (MovimentoBancario LEFT JOIN MovimentoCentroCustos) lia
-- ~2,3M linhas por execução. Recriado em produção em 19/10/2026.
-- Qualquer rebuild futuro de MovimentoCentroCustos deve recriar este índice.
-- Apply: npx wrangler d1 execute financeiro_db --remote --file=migration_d1_indexes_rateio_parcelas.sql

CREATE INDEX IF NOT EXISTS idx_mcc_movimento
  ON MovimentoCentroCustos(idMovimentoBancario);

-- FinanciamentoRepository/RelatorioFinanciamentos buscam parcelas por financiamento (N+1).
CREATE INDEX IF NOT EXISTS idx_pf_financiamento
  ON parcelaFinanciamento(idFinanciamento, numParcela);
