import { PlanoConta } from "../models/PlanoConta";

export class PlanoContaRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<PlanoConta[]> {
        const { results } = await this.db.prepare(`
            SELECT * FROM planoContas
        `).all();

        return results.map(result => ({
            id: result.id as number,
            nivel: result.nivel as number,
            hierarquia: result.hierarquia as string,
            descricao: result.descricao as string,
            inativo: result.inativo as boolean,
            tipo: result.tipo as string,
            idReferente: result.idReferente as number | null
        })) as PlanoConta[];
    }

    async getById(id: number): Promise<PlanoConta | null> {
        const { results } = await this.db.prepare(`
            SELECT * FROM planoContas WHERE id = ?
        `).bind(id).all();

        if (results.length > 0) {
            const result = results[0];
            return {
                id: result.id as number,
                nivel: result.nivel as number,
                hierarquia: result.hierarquia as string,
                descricao: result.descricao as string,
                inativo: result.inativo as boolean,
                tipo: result.tipo as string,
                idReferente: result.idReferente as number | null
            } as PlanoConta;
        }
        return null;
    }

    async create(plano: PlanoConta): Promise<number> {
        const { meta } = await this.db.prepare(`
            INSERT INTO planoContas (nivel, hierarquia, descricao, inativo, tipo, idReferente)
            VALUES (?, ?, ?, ?, ?, ?);
        `).bind(
            plano.nivel,
            plano.hierarquia,
            plano.descricao,
            plano.inativo ? 1 : 0,
            plano.tipo,
            plano.idReferente
        ).run();

        return meta.last_row_id;
    }

    async update(id: number,plano: PlanoConta): Promise<void> {
        await this.db.prepare(`
            UPDATE planoContas 
            SET nivel = ?, hierarquia = ?, descricao = ?, inativo = ?, tipo = ?, idReferente = ?
            WHERE id = ?
        `).bind(
            plano.nivel,
            plano.hierarquia,
            plano.descricao,
            plano.inativo ? 1 : 0,
            plano.tipo,
            plano.idReferente,
            plano.id
        ).run();
    }

    async updateStatus(id: number, ativo: boolean): Promise<void> {
        await this.db.prepare(`
            UPDATE contaCorrente 
            SET ativo = ? 
            WHERE id = ?
        `).bind(ativo ? 1 : 0, id).run();
    }


    async deleteById(id: number): Promise<void> {
        // Verifica se existem planos referenciando o ID antes de excluir
        const { results } = await this.db.prepare(`
            SELECT id FROM planoContas WHERE idReferente = ?
        `).bind(id).all();

        if (results.length > 0) {
            throw new Error("Não é possível excluir este plano de contas, pois ele está referenciado em outros registros.");
        }

        await this.db.prepare(`
            DELETE FROM planoContas WHERE id = ?
        `).bind(id).run();
    }
}
