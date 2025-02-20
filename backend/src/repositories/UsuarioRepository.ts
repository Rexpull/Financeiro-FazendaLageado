import { Usuario } from "../models/Usuario";

export class UsuarioRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<Usuario[]> {
        const stmt = await this.db.prepare("SELECT * FROM usuario");
        const { results } = await stmt.all<Usuario>();
        return results;
    }

    async getById(id: number): Promise<Usuario | null> {
        const stmt = await this.db.prepare("SELECT * FROM usuario WHERE id = ?");
        const { results } = await stmt.bind(id).all<Usuario>();
        return results.length ? results[0] : null;
    }

    async create(usuario: Usuario): Promise<number> {
        const stmt = await this.db.prepare(`
            INSERT INTO usuario (nome, usuario, email, senha, ativo, cpfCnpj, telefone, fotoPerfil, dtCadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await stmt.bind(
            usuario.nome, usuario.usuario, usuario.email, usuario.senha,
            usuario.ativo, usuario.cpfCnpj, usuario.telefone, usuario.fotoPerfil, usuario.dtCadastro
        ).run();
        const { results } = await this.db.prepare("SELECT last_insert_rowid() as id").all();
        return results[0].id as number;
    }

    async update(id: number, usuario: Usuario): Promise<void> {
        await this.db.prepare(`
            UPDATE usuario
            SET nome = ?, usuario = ?, email = ?, ativo = ?, cpfCnpj = ?, telefone = ?, fotoPerfil = ?
            WHERE id = ?
        `).bind(
            usuario.nome, usuario.usuario, usuario.email,
            usuario.ativo, usuario.cpfCnpj, usuario.telefone, usuario.fotoPerfil, id
        ).run();
    }

    async deleteById(id: number): Promise<void> {
        await this.db.prepare("DELETE FROM usuario WHERE id = ?").bind(id).run();
    }

    async updateStatus(id: number, ativo: boolean): Promise<void> {
        await this.db.prepare("UPDATE usuario SET ativo = ? WHERE id = ?").bind(ativo, id).run();
    }
}
