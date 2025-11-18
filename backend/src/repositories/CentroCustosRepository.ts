import { CentroCustos } from "../models/CentroCustos";

export class CentroCustosRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
    this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    try {
      // Verificar se a tabela existe
      const { results } = await this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='CentroCustos'
      `).all();

      if (results.length === 0) {
        console.log('🔧 Criando tabela CentroCustos...');
        
        // Criar a tabela
        await this.db.prepare(`
          CREATE TABLE CentroCustos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL UNIQUE,
            tipo TEXT NOT NULL DEFAULT 'CUSTEIO' CHECK(tipo IN ('CUSTEIO', 'INVESTIMENTO'))
          )
        `).run();

        console.log('✅ Tabela CentroCustos criada com sucesso');
      } 
    } catch (error) {
      console.error('❌ Erro ao verificar/criar tabela CentroCustos:', error);
    }
  }


  async getAll(): Promise<CentroCustos[]> {
    const { results } = await this.db.prepare("SELECT * FROM CentroCustos").all();
    return results.map(result => ({
      id: result.id as number,
      descricao: result.descricao as string,
      tipo: (result.tipo as 'CUSTEIO' | 'INVESTIMENTO') || 'CUSTEIO'
    })) as CentroCustos[];
  }

  async getById(id: number): Promise<CentroCustos | null> {
    const { results } = await this.db.prepare("SELECT * FROM CentroCustos WHERE id = ?").bind(id).all();
    if (results.length === 0) return null;
    const result = results[0] as any;
    return {
      id: result.id as number,
      descricao: result.descricao as string,
      tipo: (result.tipo as 'CUSTEIO' | 'INVESTIMENTO') || 'CUSTEIO'
    };
  }

  async create(descricao: string, tipo: 'CUSTEIO' | 'INVESTIMENTO' = 'CUSTEIO'): Promise<CentroCustos> {
    const result = await this.db.prepare("INSERT INTO CentroCustos (descricao, tipo) VALUES (?, ?) RETURNING id, descricao, tipo").bind(descricao, tipo).first();
    return result as unknown as CentroCustos;
  }

  async update(id: number, descricao: string, tipo: 'CUSTEIO' | 'INVESTIMENTO'): Promise<void> {
    await this.db.prepare("UPDATE CentroCustos SET descricao = ?, tipo = ? WHERE id = ?").bind(descricao, tipo, id).run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare("DELETE FROM CentroCustos WHERE id = ?").bind(id).run();
  }
}
