import { CentroCustos } from "../models/CentroCustos";
import { garantirSemUso, plural } from "../utils/verificarUsoRegistro";

// Table check runs lazily, awaited, at most once per worker instance (retried only if it failed).
let tabelaVerificada: Promise<boolean> | null = null;

export class CentroCustosRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  private async ready(): Promise<void> {
    if (!tabelaVerificada) tabelaVerificada = this.ensureTableExists();
    const ok = await tabelaVerificada;
    if (!ok) tabelaVerificada = null;
  }

  private async ensureTableExists(): Promise<boolean> {
    try {
      // Verificar se a tabela existe
      const { results } = await this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='CentroCustos'
      `).all();

      if (results.length === 0) {
        console.log('🔧 Criando tabela CentroCustos...');
        
        // Criar a tabela
        // Unique per (descricao, tipo, tipoReceitaDespesa) so CUSTEIO and INVESTIMENTO
        // can share the same label (e.g. "Agricultura", "Corte - Recria").
        await this.db.prepare(`
          CREATE TABLE CentroCustos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            tipo TEXT DEFAULT 'CUSTEIO' CHECK(tipo IN ('CUSTEIO', 'INVESTIMENTO')),
            tipoReceitaDespesa TEXT CHECK(tipoReceitaDespesa IN ('RECEITA', 'DESPESA')),
            ordem INTEGER,
            UNIQUE(descricao, tipo, tipoReceitaDespesa)
          )
        `).run();

        console.log('✅ Tabela CentroCustos criada com sucesso');
      } 
      return true;
    } catch (error) {
      console.error('❌ Erro ao verificar/criar tabela CentroCustos:', error);
      return false;
    }
  }


  async getAll(): Promise<CentroCustos[]> {
    await this.ready();
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
    await this.ready();
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
    await this.ready();
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
    await this.ready();
    // Se for Receita e não tiver tipo definido, usar CUSTEIO como padrão
    const tipoFinal = tipo || (tipoReceitaDespesa === 'RECEITA' ? 'CUSTEIO' : null);
    await this.db.prepare(`
      UPDATE CentroCustos 
      SET descricao = ?, tipo = ?, tipoReceitaDespesa = ? 
      WHERE id = ?
    `).bind(descricao, tipoFinal || null, tipoReceitaDespesa || null, id).run();
  }

  async delete(id: number): Promise<void> {
    await this.ready();
    await garantirSemUso(this.db, [
      {
        // distinct movements using this centro directly or through the rateio table
        sql: `SELECT COUNT(*) AS n FROM (
                SELECT id FROM MovimentoBancario WHERE idCentroCustos = ?
                UNION
                SELECT idMovimentoBancario FROM MovimentoCentroCustos WHERE idCentroCustos = ?
              )`,
        binds: [id, id],
        rotulo: (n) => plural(n, "lançamento bancário", "lançamentos bancários"),
      },
    ], "Não é possível excluir este centro de custos. Ele está em uso em:");
    await this.db.prepare("DELETE FROM CentroCustos WHERE id = ?").bind(id).run();
  }
}
