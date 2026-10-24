import { ContaCorrente } from "../models/ContaCorrente";
import { garantirSemUso, plural } from "../utils/verificarUsoRegistro";

export class ContaCorrenteRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<ContaCorrente[]> {
        const { results } = await this.db.prepare(`
            SELECT c.id, c.tipo, c.idBanco, b.nome as bancoNome, b.codigo as bancoCodigo, c.agencia, c.numConta, 
                   c.numCartao, c.dtValidadeCartao, c.responsavel, c.observacao, c.ativo
            FROM contaCorrente c
            JOIN banco b ON c.idBanco = b.id;
        `).all();

        return results.map(result => ({
            id: result.id as number,
            tipo: result.tipo as string,
            idBanco: result.idBanco as number,
            bancoNome: result.bancoNome as string,
            bancoCodigo: result.bancoCodigo as string,
            agencia: result.agencia as string,
            numConta: result.numConta as string,
            numCartao: result.numCartao as string,
            dtValidadeCartao: result.dtValidadeCartao as string,
            responsavel: result.responsavel as string,
            observacao: result.observacao as string,
            ativo: result.ativo as boolean
        })) as ContaCorrente[];
    }

    async create(conta: ContaCorrente): Promise<number> {
        const { tipo, idBanco, agencia, numConta, numCartao, dtValidadeCartao, responsavel, observacao, ativo } = conta;
    
        const { meta } = await this.db.prepare(`
            INSERT INTO contaCorrente (tipo, idBanco, agencia, numConta, numCartao, dtValidadeCartao, responsavel, observacao, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `).bind(
            tipo,
            idBanco,
            tipo === "contaCorrente" ? agencia : null, // 🔹 Agência só para conta corrente
            tipo === "contaCorrente" ? numConta : null, // 🔹 NumConta só para conta corrente
            tipo === "cartao" ? numCartao : null, // 🔹 NumCartao só para cartões
            tipo === "cartao" ? dtValidadeCartao : null, // 🔹 dtValidadeCartao só para cartões
            responsavel,
            observacao || "",
            ativo ?? 1
        ).run();
    
        return meta.last_row_id;
    }
    
    async updateStatus(id: number, ativo: boolean): Promise<void> {
        await this.db.prepare(`
            UPDATE contaCorrente 
            SET ativo = ? 
            WHERE id = ?
        `).bind(ativo ? 1 : 0, id).run();
    }

    async deleteById(id: number): Promise<void> {
        await garantirSemUso(this.db, [
            {
                sql: `SELECT COUNT(*) AS n FROM MovimentoBancario WHERE idContaCorrente = ?`,
                binds: [id],
                rotulo: (n) => plural(n, "lançamento bancário", "lançamentos bancários"),
            },
            {
                sql: `SELECT COUNT(*) AS n FROM Resultado WHERE idContaCorrente = ?`,
                binds: [id],
                rotulo: (n) => plural(n, "lançamento de resultado (rateio)", "lançamentos de resultado (rateio)"),
            },
        ], "Não é possível excluir esta conta. Ela está em uso em:", "Inative a conta em vez de excluí-la.");
        await this.db.prepare(`
            DELETE FROM contaCorrente WHERE id = ?
        `).bind(id).run();
    }

    async update(id: number, conta: ContaCorrente): Promise<void> {
        const { tipo, idBanco, agencia, numConta, numCartao, dtValidadeCartao, responsavel, observacao, ativo } = conta;
    
        await this.db.prepare(`
            UPDATE contaCorrente 
            SET tipo = ?, idBanco = ?, agencia = ?, numConta = ?, numCartao = ?, 
                dtValidadeCartao = ?, responsavel = ?, observacao = ?, ativo = ?
            WHERE id = ?;
        `).bind(
            tipo,
            idBanco,
            tipo === "contaCorrente" ? agencia : null,
            tipo === "contaCorrente" ? numConta : null,
            tipo === "cartao" ? numCartao : null,
            tipo === "cartao" ? dtValidadeCartao : null,
            responsavel,
            observacao || "",
            ativo ?? 1,
            id
        ).run();
    }
    
}
