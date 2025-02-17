import { Pessoa } from "../models/Pessoa";

export class PessoaRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<Pessoa[]> {
        const { results } = await this.db.prepare(`SELECT * FROM pessoa`).all();
        return results.map(result => ({
            id: result.id as number,
            nome: result.nome as string,
            cgcpf: result.cgcpf as string | undefined,
            tipo: result.tipo as "fisica" | "juridica",
            idReceita: result.idReceita as number | null,
            idDespesa: result.idDespesa as number | null,
            dtCadastro: result.dtCadastro as string, // YYYY-MM-DD
            telefone: result.telefone as string | undefined,
            email: result.email as string | undefined,
            observacao: result.observacao as string | undefined,
            ativo: result.ativo === 1,
            fornecedor: result.fornecedor as boolean,
            cliente: result.cliente as boolean
        }));
    }

    async getById(id: number): Promise<Pessoa | null> {
        const { results } = await this.db.prepare(`SELECT * FROM pessoa WHERE id = ?`).bind(id).all();
        if (results.length > 0) {
            const result = results[0];
            return {
                id: result.id as number,
                nome: result.nome as string,
                cgcpf: result.cgcpf as string | undefined,
                tipo: result.tipo as "fisica" | "juridica",
                idReceita: result.idReceita as number | null,
                idDespesa: result.idDespesa as number | null,
                dtCadastro: result.dtCadastro as string,
                telefone: result.telefone as string | undefined,
                email: result.email as string | undefined,
                observacao: result.observacao as string | undefined,
                ativo: result.ativo === 1,
                fornecedor: result.fornecedor as boolean,
                cliente: result.cliente as boolean
            };
        }
        return null;
    }

    async create(pessoa: Pessoa): Promise<number> {
        const { meta } = await this.db.prepare(`
            INSERT INTO pessoa (nome, cgcpf, tipo, idReceita, idDespesa, telefone, email, observacao, ativo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            pessoa.nome,
            pessoa.cgcpf || null,
            pessoa.tipo,
            pessoa.idReceita || null,
            pessoa.idDespesa || null,
            pessoa.telefone || null,
            pessoa.email || null,
            pessoa.observacao || null,
            pessoa.ativo ? 1 : 0
        ).run();
        return meta.last_row_id;
    }

    async updateStatus(id: number, ativo: boolean): Promise<void> {
        await this.db.prepare(`
            UPDATE pessoa 
            SET ativo = ? 
            WHERE id = ?
        `).bind(ativo ? 1 : 0, id).run();
    }

    async update(id: number, pessoa: Pessoa): Promise<void> {
        await this.db.prepare(`
            UPDATE pessoa 
            SET nome = ?, cgcpf = ?, tipo = ?, idReceita = ?, idDespesa = ?, telefone = ?, email = ?, observacao = ?, ativo = ?
            WHERE id = ?
        `).bind(
            pessoa.nome,
            pessoa.cgcpf || null,
            pessoa.tipo,
            pessoa.idReceita || null,
            pessoa.idDespesa || null,
            pessoa.telefone || null,
            pessoa.email || null,
            pessoa.observacao || null,
            pessoa.ativo ? 1 : 0,
            id
        ).run();
    }

    async deleteById(id: number): Promise<void> {
        await this.db.prepare(`DELETE FROM pessoa WHERE id = ?`).bind(id).run();
    }
}
