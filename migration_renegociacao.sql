-- Renegociação de contratos de financiamento (aditivo / novo contrato).
-- O backend cria a tabela e a coluna sozinho na primeira chamada (RenegociacaoRepository.garantirSchemaRenegociacao);
-- este arquivo é o mesmo SQL, para rodar antes do deploy se preferir:
--   npx wrangler d1 execute <banco> --remote --file=migration_renegociacao.sql
-- Sem FOREIGN KEY de propósito: o D1 aplica FKs e isso travaria a exclusão de contratos/parcelas pelas telas
-- (FinanciamentoRepository.deleteById limpa as referências na mesma transação).
-- O ALTER TABLE não é idempotente no SQLite: se der "duplicate column name: idFinanciamentoOrigem", a coluna
-- já existe (o backend já criou) e pode ignorar o erro.

CREATE TABLE IF NOT EXISTS financiamentoRenegociacao (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	idFinanciamento INTEGER NOT NULL,
	tipo TEXT NOT NULL CHECK(tipo IN ('ADITIVO', 'NOVO_CONTRATO')),
	dataRenegociacao TEXT NOT NULL,
	idFinanciamentoNovo INTEGER,
	parcelasAnteriores TEXT NOT NULL DEFAULT '[]',
	parcelasNovas TEXT NOT NULL DEFAULT '[]',
	condicoesAnteriores TEXT,
	observacao TEXT,
	criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financiamento_renegociacao_contrato ON financiamentoRenegociacao(idFinanciamento);

CREATE INDEX IF NOT EXISTS idx_financiamento_renegociacao_novo ON financiamentoRenegociacao(idFinanciamentoNovo);

ALTER TABLE Financiamento ADD COLUMN idFinanciamentoOrigem INTEGER;
