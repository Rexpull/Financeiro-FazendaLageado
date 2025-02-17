import { Parametro } from "../models/Parametro";

export class ParametroRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<Parametro[]> {
        const { results } = await this.db.prepare(`
            SELECT * FROM parametro
        `).all();

        return results.map(result => ({
            idPlanoTransferenciaEntreContas: result.idPlanoTransferenciaEntreContas as number,
            idPlanoEntradaFinanciamentos: result.idPlanoEntradaFinanciamentos as number,
            idPlanoPagamentoFinanciamentos: result.idPlanoPagamentoFinanciamentos as number
        })) as Parametro[];
    }

    async update(parametro: Parametro): Promise<void> {
        await this.db.prepare(`
            UPDATE parametro 
            SET idPlanoTransferenciaEntreContas = ?, 
                idPlanoEntradaFinanciamentos = ?, 
                idPlanoPagamentoFinanciamentos = ?
            WHERE id = 1
        `).bind(
            parametro.idPlanoTransferenciaEntreContas,
            parametro.idPlanoEntradaFinanciamentos,
            parametro.idPlanoPagamentoFinanciamentos
        ).run();
    }
}
