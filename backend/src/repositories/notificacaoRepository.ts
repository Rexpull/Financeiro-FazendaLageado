import { D1Database } from "@cloudflare/workers-types";

export interface NotificacaoConciliacao {
  idContaCorrente: number;
  nomeConta: string;
  nomeBanco: string;
  numConta: string;
  quantidadePendentes: number;
  dataInicial: string;
  dataFinal: string;
}

export class NotificacaoRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getNotificacoesConciliacao(): Promise<NotificacaoConciliacao[]> {
    const query = `
      SELECT 
        cc.id as idContaCorrente,
        cc.responsavel as nomeConta,
        b.nome as nomeBanco,
        cc.numConta,
        COUNT(mb.id) as quantidadePendentes,
        MIN(mb.dtMovimento) as dataInicial,
        MAX(mb.dtMovimento) as dataFinal
      FROM ContaCorrente cc
      LEFT JOIN banco b ON cc.idBanco = b.id
      LEFT JOIN MovimentoBancario mb ON cc.id = mb.idContaCorrente
      WHERE mb.idPlanoContas IS NULL 
        AND mb.dtMovimento IS NOT NULL
      GROUP BY cc.id, cc.responsavel, b.nome, cc.numConta
      HAVING quantidadePendentes > 0
      ORDER BY quantidadePendentes DESC, dataFinal DESC
    `;

    const result = await this.db.prepare(query).all();
    
    return result.results.map((row: any) => ({
      idContaCorrente: row.idContaCorrente,
      nomeConta: row.nomeConta,
      nomeBanco: row.nomeBanco || 'Banco não informado',
      numConta: row.numConta,
      quantidadePendentes: row.quantidadePendentes,
      dataInicial: row.dataInicial,
      dataFinal: row.dataFinal
    }));
  }

  async getTotalNotificacoes(): Promise<number> {
    const query = `
      SELECT COUNT(*) as total
      FROM MovimentoBancario mb
      WHERE mb.idPlanoContas IS NULL 
        AND mb.dtMovimento IS NOT NULL
    `;

    const result = await this.db.prepare(query).first();
    return result && typeof result.total === 'number' ? result.total : 0;
  }
}
