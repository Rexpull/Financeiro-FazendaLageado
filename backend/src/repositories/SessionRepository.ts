import { UserContext } from "../models/UserContext";

export class SessionRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

    // Obtém o usuário pelo email ou nome de usuário
    async getByEmailOrUsuario(identificador: string): Promise<UserContext | null> {
      // Case-insensitive ("Lageado" or "lageado", e-mail in any case); an exact match wins if two differ only in case
      const id = identificador.trim();
      const stmt = this.db.prepare(
        `SELECT * FROM usuario
         WHERE email = ?1 COLLATE NOCASE OR usuario = ?1 COLLATE NOCASE
         ORDER BY (email = ?1 OR usuario = ?1) DESC, id
         LIMIT 1`
      );
      const { results } = await stmt.bind(id).all<UserContext>();
      return results.length ? results[0] : null;
    }
  

  // Atualiza o token do usuário na sessão
  async updateSession(id: number, token: string): Promise<void> {
    await this.db.prepare("UPDATE usuario SET token = ? WHERE id = ?").bind(token, id).run();
}

  // Obtém o usuário pelo ID (NOVO MÉTODO)
  async getById(id: number): Promise<UserContext | null> {
    const stmt = await this.db.prepare("SELECT * FROM usuario WHERE id = ?");
    const { results } = await stmt.bind(id).all<UserContext>();
    return results.length ? results[0] : null;
  }
}
