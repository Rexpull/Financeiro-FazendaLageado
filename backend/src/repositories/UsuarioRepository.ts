import bcrypt from "bcryptjs";
import { Usuario, UsuarioPublico } from "../models/Usuario";
import { isBcryptHash } from "../utils/authGuard";

// Never select `senha` (bcrypt hash) or `token` for reads that leave the API.
const COLUNAS_PUBLICAS = "id, nome, usuario, email, ativo, cpf_cnpj, telefone, foto_perfil, dt_cadastro";

/**
 * The frontend hashes the password with bcrypt before sending (usuarioService.salvarUsuario).
 * Keep that hash as-is; if a plain password arrives (another client), hash it here so the
 * column always holds bcrypt. Returns null for empty/missing values.
 */
export async function prepararSenha(senha: unknown): Promise<string | null> {
    if (typeof senha !== "string" || senha.trim() === "") return null;
    return isBcryptHash(senha) ? senha : bcrypt.hash(senha, 10);
}

export class UsuarioRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<UsuarioPublico[]> {
        const stmt = await this.db.prepare(`SELECT ${COLUNAS_PUBLICAS} FROM usuario`);
        const { results } = await stmt.all<UsuarioPublico>();
        return results;
    }

    async getById(id: number): Promise<UsuarioPublico | null> {
        const stmt = await this.db.prepare(`SELECT ${COLUNAS_PUBLICAS} FROM usuario WHERE id = ?`);
        const { results } = await stmt.bind(id).all<UsuarioPublico>();
        return results.length ? results[0] : null;
    }

    async create(usuario: Usuario): Promise<number> {
        const senha = await prepararSenha(usuario.senha);
        if (!senha) throw new Error("SENHA_OBRIGATORIA");

        const stmt = await this.db.prepare(`
            INSERT INTO usuario (nome, usuario, email, senha, ativo, cpf_cnpj, telefone, foto_perfil, dt_cadastro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    
        // 🔹 Garante que os valores não sejam `undefined`
        await stmt.bind(
            usuario.nome,
            usuario.usuario,
            usuario.email,
            senha,
            usuario.ativo ?? 1,
            usuario.cpf_cnpj ?? null,
            usuario.telefone ?? null,
            usuario.foto_perfil ?? null,
            usuario.dt_cadastro ?? new Date().toISOString().split("T")[0]
        ).run();
    
        const { results } = await this.db.prepare("SELECT last_insert_rowid() as id").all();
        return results[0].id as number;
    }
    

    async update(id: number, usuario: Partial<Usuario>): Promise<void> {
        // Only replace the password when a new one is sent; empty/undefined keeps the current hash.
        const senha = await prepararSenha(usuario.senha);
        await this.db.prepare(`
            UPDATE usuario
            SET nome = ?, usuario = ?, email = ?, ativo = ?, cpf_cnpj = ?, telefone = ?, foto_perfil = ?,
                senha = COALESCE(?, senha)
            WHERE id = ?
        `).bind(
            usuario.nome, usuario.usuario, usuario.email,
            usuario.ativo ?? 1, usuario.cpf_cnpj ?? null, usuario.telefone ?? null, usuario.foto_perfil ?? null,
            senha, id
        ).run();
    }

    async deleteById(id: number): Promise<void> {
        await this.db.prepare("DELETE FROM usuario WHERE id = ?").bind(id).run();
    }

    async updateStatus(id: number, ativo: boolean): Promise<void> {
        await this.db.prepare("UPDATE usuario SET ativo = ? WHERE id = ?").bind(ativo, id).run();
    }
}
