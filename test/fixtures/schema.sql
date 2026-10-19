-- Schema snapshot of production D1 (sqlite_master), 2026-10-19. Used by integration tests only.
CREATE TABLE "CentroCustos" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'CUSTEIO' CHECK(tipo IN ('CUSTEIO', 'INVESTIMENTO')),
  tipoReceitaDespesa TEXT CHECK(tipoReceitaDespesa IN ('RECEITA', 'DESPESA')),
  ordem INTEGER DEFAULT 0,
  UNIQUE(descricao, tipo, tipoReceitaDespesa)
);

CREATE TABLE Financiamento (     id INTEGER PRIMARY KEY AUTOINCREMENT,      idBanco INTEGER,     idPessoa INTEGER,      responsavel VARCHAR(255) NOT NULL,     dataContrato DATE NOT NULL,     valor DECIMAL(15,2) NOT NULL,     taxaJurosAnual DECIMAL(15,2),     taxaJurosMensal DECIMAL(15,2),     numeroContrato VARCHAR(255) NOT NULL,     numeroGarantia VARCHAR(255),     observacao VARCHAR(255),      dataVencimentoPrimeiraParcela DATE,     dataVencimentoUltimaParcela DATE,     totalJuros DECIMAL(15,2),      criadoEm DATE DEFAULT CURRENT_TIMESTAMP,     atualizadoEm DATE, modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR')), nomeModalidadeParticular TEXT,      FOREIGN KEY (idBanco) REFERENCES Banco(id),     FOREIGN KEY (idPessoa) REFERENCES Pessoa(id) );

CREATE TABLE HistoricoImportacaoOFX (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idUsuario INTEGER NOT NULL,
    nomeArquivo TEXT NOT NULL,
    dataImportacao TEXT NOT NULL,
    idMovimentos TEXT NOT NULL,
    totalizadores TEXT NOT NULL,
    novosMovimentos INTEGER NOT NULL,
    existentesMovimentos INTEGER NOT NULL,
    idContaCorrente INTEGER NOT NULL,
    criadoEm TEXT NOT NULL,
    atualizadoEm TEXT NOT NULL
);

CREATE TABLE MovimentoBancario (  id INTEGER PRIMARY KEY AUTOINCREMENT,  dtMovimento DATE NOT NULL,  historico TEXT NOT NULL,  idPlanoContas INTEGER,  idPessoa INTEGER, idBanco INTEGER, parcelado BOOLEAN,  idContaCorrente INTEGER NOT NULL,  valor DECIMAL(15,2) NOT NULL, saldo DECIMAL(15,2) NOT NULL, ideagro BOOLEAN DEFAULT FALSE, numero_documento VARCHAR(50), descricao TEXT, transf_origem INTEGER, transf_destino INTEGER, identificador_ofx VARCHAR(255) UNIQUE NOT NULL, criado_em DATE NOT NULL DEFAULT CURRENT_DATE, atualizado_em DATE NOT NULL DEFAULT CURRENT_DATE, idUsuario INTEGER, tipoMovimento VARCHAR(2), modalidadeMovimento VARCHAR(30), idFinanciamento INTEGER, idCentroCustos INTEGER, CONSTRAINT fk_movimento_plano_contas FOREIGN KEY (idPlanoContas) REFERENCES PlanoContas(id) ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT fk_movimento_conta_corrente FOREIGN KEY (idContaCorrente) REFERENCES ContaCorrente(id) ON DELETE RESTRICT ON UPDATE CASCADE);

CREATE TABLE MovimentoCentroCustos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idMovimentoBancario INTEGER NOT NULL,
  idCentroCustos INTEGER NOT NULL,
  valor REAL NOT NULL,
  FOREIGN KEY (idMovimentoBancario) REFERENCES MovimentoBancario(id) ON DELETE CASCADE,
  FOREIGN KEY (idCentroCustos) REFERENCES CentroCustos(id) ON DELETE RESTRICT
);

CREATE TABLE Resultado (     id INTEGER PRIMARY KEY AUTOINCREMENT,     dtMovimento DATE NOT NULL,     idMovimentoBancario INTEGER,     idPlanoContas INTEGER NOT NULL,     idContaCorrente INTEGER NOT NULL,     idParcelaFinanciamento INTEGER,      valor DECIMAL(15,2) NOT NULL,     tipo VARCHAR(2) NOT NULL,       FOREIGN KEY (idMovimentoBancario) REFERENCES MovimentoBancario(id),     FOREIGN KEY (idPlanoContas) REFERENCES PlanoContas(id),     FOREIGN KEY (idContaCorrente) REFERENCES ContaCorrente(id),     FOREIGN KEY (idParcelaFinanciamento) REFERENCES ParcelaFinanciamento(id) );

CREATE TABLE banco (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo TEXT NOT NULL
);

CREATE TABLE contaCorrente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo VARCHAR(15) NOT NULL,
    idBanco INTEGER NOT NULL,
    agencia VARCHAR(10) NULL,
    numConta VARCHAR(20) NULL,
    numCartao VARCHAR(25) NULL,
    responsavel VARCHAR(100) NOT NULL,
    observacao TEXT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1, dtValidadeCartao DATE NULL,
    FOREIGN KEY (idBanco) REFERENCES banco (id)
);

CREATE TABLE parametros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idPlanoTransferenciaEntreContas INTEGER,
    idPlanoEntradaFinanciamentos INTEGER,
    idPlanoPagamentoFinanciamentos INTEGER, idPlanoAplicacaoResgateInvestimentos INTEGER, idPlanoEstornos INTEGER,
    FOREIGN KEY (idPlanoTransferenciaEntreContas) REFERENCES planoContas(id) ON DELETE RESTRICT,
    FOREIGN KEY (idPlanoEntradaFinanciamentos) REFERENCES planoContas(id) ON DELETE RESTRICT,
    FOREIGN KEY (idPlanoPagamentoFinanciamentos) REFERENCES planoContas(id) ON DELETE RESTRICT
);

CREATE TABLE parcelaFinanciamento (     id INTEGER PRIMARY KEY AUTOINCREMENT,      idMovimentoBancario INTEGER,     idFinanciamento INTEGER NOT NULL,     valor DECIMAL(15,2) NOT NULL,     status VARCHAR(30) NOT NULL,     numParcela INTEGER NOT NULL,     dt_lancamento DATE DEFAULT CURRENT_TIMESTAMP,     dt_vencimento DATE NOT NULL,     dt_liquidacao DATE,      FOREIGN KEY (idMovimentoBancario) REFERENCES MovimentoBancario(id),     FOREIGN KEY (idFinanciamento) REFERENCES Financiamento(id) );

CREATE TABLE pessoa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(255) NOT NULL,
    cgcpf VARCHAR(20) NULL, 
    tipo VARCHAR(10) CHECK (tipo IN ('fisica', 'juridica')) NOT NULL, 
    idReceita INTEGER NULL,
    idDespesa INTEGER NULL,
    dtCadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    telefone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    observacao VARCHAR(255) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    fornecedor BOOLEAN NOT NULL DEFAULT FALSE,
    cliente BOOLEAN NOT NULL DEFAULT FALSE,

    -- ðŸ”¹ FKs para plano de contas
    FOREIGN KEY (idReceita) REFERENCES planoContas (id) ON DELETE RESTRICT,
    FOREIGN KEY (idDespesa) REFERENCES planoContas (id) ON DELETE RESTRICT
);

CREATE TABLE planoContas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nivel INT NOT NULL,
    hierarquia VARCHAR(255) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    inativo BOOLEAN DEFAULT FALSE,
    tipo VARCHAR(50) NOT NULL,
    idReferente INT NULL,
    FOREIGN KEY (idReferente) REFERENCES planoContas(id) ON DELETE RESTRICT
);

CREATE TABLE usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(150) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE, 
    email VARCHAR(100) NOT NULL UNIQUE, 
    senha VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT 1,
    cpf_cnpj VARCHAR(20) NULL,
    telefone VARCHAR(20) NULL,
    foto_perfil TEXT NULL, -- Armazena a imagem em Base64 (mantido como TEXT devido ao tamanho variÃ¡vel)
    dt_cadastro DATE NOT NULL DEFAULT (CURRENT_DATE)
, token TEXT);

CREATE INDEX idx_historico_data ON HistoricoImportacaoOFX(dataImportacao DESC);

CREATE INDEX idx_historico_usuario ON HistoricoImportacaoOFX(idUsuario);

CREATE INDEX idx_mb_centro
  ON MovimentoBancario(idCentroCustos);

CREATE INDEX idx_mb_conta_dt
  ON MovimentoBancario(idContaCorrente, dtMovimento);

CREATE INDEX idx_mb_dtMovimento
  ON MovimentoBancario(dtMovimento);

CREATE INDEX idx_mb_plano
  ON MovimentoBancario(idPlanoContas);

CREATE INDEX idx_movimento_bancario_centro_custos 
ON MovimentoBancario(idCentroCustos);

CREATE INDEX idx_pc_idReferente
  ON planoContas(idReferente);

CREATE INDEX idx_pc_tipo
  ON planoContas(tipo);

CREATE INDEX idx_resultado_dt
  ON Resultado(dtMovimento);

CREATE INDEX idx_resultado_movimento
  ON Resultado(idMovimentoBancario);

CREATE INDEX idx_resultado_movimento_plano
  ON Resultado(idMovimentoBancario, idPlanoContas);

CREATE UNIQUE INDEX unique_descricao ON planoContas (descricao);


CREATE INDEX idx_mcc_movimento ON MovimentoCentroCustos(idMovimentoBancario);

CREATE INDEX idx_pf_financiamento ON parcelaFinanciamento(idFinanciamento, numParcela);
