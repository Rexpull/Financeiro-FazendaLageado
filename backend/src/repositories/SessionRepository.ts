import { UserContext } from "../models/UserContext";

export class SessionRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Obtém o usuário pelo email
  async getByEmail(email: string): Promise<UserContext | null> {
    const stmt = await this.db.prepare("SELECT * FROM usuario WHERE email = ?");
    const { results } = await stmt.bind(email).all<UserContext>();
    return results.length ? results[0] : null;
  }

  // Atualiza o token do usuário na sessão
  async updateSession(id: number, token: string): Promise<void> {
    await this.db.prepare("UPDATE usuario SET token = ? WHERE id = ?").bind(token, id).run();
}

  // Obtém um usuário baseado no token
  async getByToken(token: string): Promise<UserContext | null> {
    const stmt = await this.db.prepare("SELECT * FROM usuario WHERE token = ?");
    const { results } = await stmt.bind(token).all<UserContext>();
    return results.length ? results[0] : null;
}

  // Obtém o usuário pelo ID (NOVO MÉTODO)
  async getById(id: number): Promise<UserContext | null> {
    const stmt = await this.db.prepare("SELECT * FROM usuario WHERE id = ?");
    const { results } = await stmt.bind(id).all<UserContext>();
    return results.length ? results[0] : null;
  }
}
