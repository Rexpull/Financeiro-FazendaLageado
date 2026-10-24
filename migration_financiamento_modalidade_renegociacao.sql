-- Migration: nova modalidade de financiamento 'RENEGOCIACAO' (Renegociação)
-- Data: 2026-10-24
-- Descrição: o SQLite não permite alterar um CHECK existente, então a tabela Financiamento é
-- reconstruída com o CHECK novo (mesmas colunas, tipos, defaults e FKs do schema de produção,
-- test/fixtures/schema.sql), copiando todas as linhas com os mesmos ids.
--
-- Executar o arquivo inteiro de uma vez (o D1 roda o arquivo numa única transação):
--   npx wrangler d1 execute <banco> --remote --file=migration_financiamento_modalidade_renegociacao.sql
-- Recomendado: exportar/backup antes (wrangler d1 export) ou anotar o bookmark do Time Travel.
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
    modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO')),
    nomeModalidadeParticular TEXT,
    FOREIGN KEY (idBanco) REFERENCES Banco(id),
    FOREIGN KEY (idPessoa) REFERENCES Pessoa(id)
);

INSERT INTO Financiamento_new (
    id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, taxaJurosMensal,
    numeroContrato, numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
    dataVencimentoUltimaParcela, totalJuros, criadoEm, atualizadoEm, modalidade,
    nomeModalidadeParticular
)
SELECT
    id, idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, taxaJurosMensal,
    numeroContrato, numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
    dataVencimentoUltimaParcela, totalJuros, criadoEm, atualizadoEm, modalidade,
    nomeModalidadeParticular
FROM Financiamento;

-- sqlite_sequence: a tabela nova herda o maior valor já usado (ids nunca são reaproveitados,
-- mesmo que os últimos contratos tenham sido excluídos). O RENAME leva a linha junto.
UPDATE sqlite_sequence
SET seq = (SELECT MAX(seq) FROM sqlite_sequence WHERE name IN ('Financiamento', 'Financiamento_new'))
WHERE name = 'Financiamento_new';

DROP TABLE Financiamento;

ALTER TABLE Financiamento_new RENAME TO Financiamento;

-- Encerra o adiamento antes do commit (as referências de parcelaFinanciamento voltam a valer
-- porque os ids foram preservados; conferir com PRAGMA foreign_key_check abaixo).
PRAGMA defer_foreign_keys = false;

-- Conferência pós-migração (rodar separadamente):
-- SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Financiamento';
-- SELECT COUNT(*) FROM Financiamento;
-- SELECT * FROM sqlite_sequence WHERE name LIKE 'Financiamento%';
-- PRAGMA foreign_key_check(parcelaFinanciamento);
