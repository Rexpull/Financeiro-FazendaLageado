-- =============================================================================
-- Centro de Custos: inclui "Estrutura e patrimônio" em Custeio / Despesa
-- (ex.: manutenção de casas e dependências). Idempotente via
-- UNIQUE(descricao, tipo, tipoReceitaDespesa).
-- =============================================================================

INSERT OR IGNORE INTO CentroCustos (descricao, tipo, tipoReceitaDespesa)
VALUES ('Estrutura e patrimônio', 'CUSTEIO', 'DESPESA');
