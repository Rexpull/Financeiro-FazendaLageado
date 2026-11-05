-- Migration: nova modalidade de financiamento 'ROTATIVO' (Rotativo)
-- Data: 2026-11-05
-- Descrição: o SQLite não permite alterar um CHECK existente, então a tabela Financiamento é
-- reconstruída com o CHECK novo (mesmas colunas, tipos, defaults e FKs do schema de produção,
-- inclusive idFinanciamentoOrigem), copiando todas as linhas com os mesmos ids.
-- Mesmo procedimento de migration_financiamento_modalidade_renegociacao.sql.
--
-- Executar o arquivo inteiro de uma vez (o D1 roda o arquivo numa única transação):
--   npx wrangler d1 execute financeiro_db --remote --file=migration_financiamento_modalidade_rotativo.sql
-- Antes: backup (npx wrangler d1 export financeiro_db --remote --output backups/...).
--
-- parcelaFinanciamento referencia Financiamento(id): defer_foreign_keys adia a checagem das FKs
-- enquanto a tabela antiga é removida e a nova é renomeada (os ids são preservados).

PRAGMA defer_foreign_keys = true;

CREATE TABLE Financiamento_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idBanco INTEGER,
    idPessoa INTEGER,
    responsavel VARCHAR(255) NOT NULL,
    dataContrato DATE NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    taxaJurosAnual DECIMAL(15,2),
    taxaJurosMensal DECIMAL(15,2),
    numeroContrato VARCHAR(255) NOT NULL,
    numeroGarantia VARCHAR(255),
    observacao VARCHAR(255),
    dataVencimentoPrimeiraParcela DATE,
    dataVencimentoUltimaParcela DATE,
    totalJuros DECIMAL(15,2),
    criadoEm DATE DEFAULT CURRENT_TIMESTAMP,
    atualizadoEm DATE,
    modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO', 'ROTATIVO')),
    nomeModalidadeParticular TEXT,
    idFinanciamentoOrigem INTEGER,
    FOREIGN KEY (idBanco) REFERENCES Banco(id),
    FOREIGN KEY (idPessoa) REFERENCES Pessoa(id)
);

INSERT INTO Financiamento_new (
    id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, taxaJurosMensal,
    numeroContrato, numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
    dataVencimentoUltimaParcela, totalJuros, criadoEm, atualizadoEm, modalidade,
    nomeModalidadeParticular, idFinanciamentoOrigem
)
SELECT
    id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, taxaJurosMensal,
    numeroContrato, numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
    dataVencimentoUltimaParcela, totalJuros, criadoEm, atualizadoEm, modalidade,
    nomeModalidadeParticular, idFinanciamentoOrigem
FROM Financiamento;

-- sqlite_sequence: a tabela nova herda o maior valor já usado (ids nunca são reaproveitados).
UPDATE sqlite_sequence
SET seq = (SELECT MAX(seq) FROM sqlite_sequence WHERE name IN ('Financiamento', 'Financiamento_new'))
WHERE name = 'Financiamento_new';

DROP TABLE Financiamento;

ALTER TABLE Financiamento_new RENAME TO Financiamento;

PRAGMA defer_foreign_keys = false;

-- Conferência pós-migração (rodar separadamente):
-- SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Financiamento';
-- SELECT COUNT(*), MAX(id) FROM Financiamento;   -- antes: 119 / 189
-- SELECT * FROM sqlite_sequence WHERE name LIKE 'Financiamento%';
-- PRAGMA foreign_key_check(parcelaFinanciamento);
