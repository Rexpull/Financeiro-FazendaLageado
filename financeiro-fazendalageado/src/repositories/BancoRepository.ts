import { Banco } from "../models/Banco";

export class BancoRepository {
    private db: D1Database;
  
    constructor(db: D1Database) {
      this.db = db;
    }
  
    async getAll(): Promise<Banco[]> {
      const { results } = await this.db.prepare("SELECT * FROM banco").all();
      return results.map(result => ({
        id: result.id as number,
        nome: result.nome as string,
        codigo: result.codigo as string
      })) as Banco[];
    }
  
    async getById(id: number): Promise<Banco | null> {
      const { results } = await this.db.prepare("SELECT * FROM banco WHERE id = ?").bind(id).all();
      return results.length ? (results[0] as unknown as Banco) : null;
    }
  
    async create(nome: string, codigo: string): Promise<void> {
      await this.db.prepare("INSERT INTO banco (nome, codigo) VALUES (?, ?)").bind(nome, codigo).run();
    }
  
    async update(id: number, nome: string, codigo: string): Promise<void> {
      await this.db.prepare("UPDATE banco SET nome = ?, codigo = ? WHERE id = ?").bind(nome, codigo, id).run();
    }
  
    async delete(id: number): Promise<void> {
      await this.db.prepare("DELETE FROM banco WHERE id = ?").bind(id).run();
    }
  }
  