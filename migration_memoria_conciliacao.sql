-- Migration: memória de conciliação
-- Data: 2026-11-06
-- Descrição: tabela memoriaConciliacao (classificação lembrada por conta + entrada/saída + texto do
-- histórico sem datas e números) e a coluna MovimentoBancario.idMemoriaConciliacao (etiqueta "memória").
--
-- OPCIONAL: o backend cria a tabela e a coluna sozinho na primeira chamada
-- (MemoriaConciliacaoRepository.garantirSchemaMemoria). Mesmo SQL, para rodar antes se preferir:
--   npx wrangler d1 execute financeiro_db --remote --file=migration_memoria_conciliacao.sql
-- Rodar só uma vez: o ALTER TABLE falha se a coluna já existir.

CREATE TABLE IF NOT EXISTS memoriaConciliacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idContaCorrente INTEGER NOT NULL,
    tipoMovimento TEXT NOT NULL CHECK(tipoMovimento IN ('C', 'D')),
    chave TEXT NOT NULL,
    historicoExemplo TEXT,
    modalidadeMovimento TEXT NOT NULL DEFAULT 'padrao',
    planosJson TEXT NOT NULL DEFAULT '[]',
    centrosJson TEXT NOT NULL DEFAULT '[]',
    idPessoa INTEGER,
    usos INTEGER NOT NULL DEFAULT 0,
    ultimoUsoEm TEXT,
    criadoEm TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizadoEm TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memoria_conciliacao_chave ON memoriaConciliacao(idContaCorrente, tipoMovimento, chave);

ALTER TABLE MovimentoBancario ADD COLUMN idMemoriaConciliacao INTEGER;
