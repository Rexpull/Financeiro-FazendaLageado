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
            tipo TEXT DEFAULT 'CUSTEIO' CHECK(tipo IN ('CUSTEIO', 'INVESTIMENTO')),
            tipoReceitaDespesa TEXT CHECK(tipoReceitaDespesa IN ('RECEITA', 'DESPESA')),
            ordem INTEGER
          )
        `).run();

        console.log('✅ Tabela CentroCustos criada com sucesso');
      } 
    } catch (error) {
      console.error('❌ Erro ao verificar/criar tabela CentroCustos:', error);
    }
  }


  async getAll(): Promise<CentroCustos[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM CentroCustos 
      ORDER BY 
        CASE WHEN tipoReceitaDespesa = 'RECEITA' THEN 1 WHEN tipoReceitaDespesa = 'DESPESA' THEN 2 ELSE 3 END,
        CASE WHEN tipo = 'CUSTEIO' THEN 1 WHEN tipo = 'INVESTIMENTO' THEN 2 ELSE 3 END,
        id
    `).all();
    return results.map(result => ({
      id: result.id as number,
      descricao: result.descricao as string,
      tipo: result.tipo as 'CUSTEIO' | 'INVESTIMENTO' | undefined,
      tipoReceitaDespesa: result.tipoReceitaDespesa as 'RECEITA' | 'DESPESA' | undefined
    })) as CentroCustos[];
  }

  async getById(id: number): Promise<CentroCustos | null> {
    const { results } = await this.db.prepare("SELECT * FROM CentroCustos WHERE id = ?").bind(id).all();
    if (results.length === 0) return null;
    const result = results[0] as any;
    return {
      id: result.id as number,
      descricao: result.descricao as string,
      tipo: result.tipo as 'CUSTEIO' | 'INVESTIMENTO' | undefined,
      tipoReceitaDespesa: result.tipoReceitaDespesa as 'RECEITA' | 'DESPESA' | undefined
    };
  }

  async create(descricao: string, tipo?: 'CUSTEIO' | 'INVESTIMENTO', tipoReceitaDespesa?: 'RECEITA' | 'DESPESA'): Promise<CentroCustos> {
    // Se for Receita e não tiver tipo definido, usar CUSTEIO como padrão
    const tipoFinal = tipo || (tipoReceitaDespesa === 'RECEITA' ? 'CUSTEIO' : null);
    const result = await this.db.prepare(`
      INSERT INTO CentroCustos (descricao, tipo, tipoReceitaDespesa) 
      VALUES (?, ?, ?) 
      RETURNING id, descricao, tipo, tipoReceitaDespesa
    `).bind(descricao, tipoFinal || null, tipoReceitaDespesa || null).first();
    return result as unknown as CentroCustos;
  }

  async update(id: number, descricao: string, tipo?: 'CUSTEIO' | 'INVESTIMENTO', tipoReceitaDespesa?: 'RECEITA' | 'DESPESA'): Promise<void> {
    // Se for Receita e não tiver tipo definido, usar CUSTEIO como padrão
    const tipoFinal = tipo || (tipoReceitaDespesa === 'RECEITA' ? 'CUSTEIO' : null);
    await this.db.prepare(`
      UPDATE CentroCustos 
      SET descricao = ?, tipo = ?, tipoReceitaDespesa = ? 
      WHERE id = ?
    `).bind(descricao, tipoFinal || null, tipoReceitaDespesa || null, id).run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare("DELETE FROM CentroCustos WHERE id = ?").bind(id).run();
  }
}
