import { Resultado } from "../models/Resultado";

export class ResultadoRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getByMovimento(idMov: number): Promise<Resultado[]> {
		const { results } = await this.db.prepare(`
			SELECT * FROM Resultado WHERE idMovimentoBancario = ?
		`).bind(idMov).all();

		return results.map((r: any) => ({
			id: r.id,
			dtMovimento: r.dtMovimento,
			idPlanoContas: r.idPlanoContas,
			idContaCorrente: r.idContaCorrente,
			idMovimentoBancario: r.idMovimentoBancario,
			idParcelaFinanciamento: r.idParcelaFinanciamento,
			valor: r.valor,
			tipo: r.tipo,
		}));
	}

	async deleteByMovimento(idMov: number): Promise<void> {
		await this.db.prepare(`DELETE FROM Resultado WHERE idMovimentoBancario = ?`)
			.bind(idMov).run();
	}

	async createMany(resultados: Resultado[]): Promise<void> {
		const stmt = this.db.prepare(`
			INSERT INTO Resultado (
				dtMovimento, idPlanoContas, idContaCorrente, idMovimentoBancario,
				idParcelaFinanciamento, valor, tipo
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`);

		for (const r of resultados) {
			await stmt.bind(
				r.dtMovimento, r.idPlanoContas, r.idContaCorrente,
				r.idMovimentoBancario, r.idParcelaFinanciamento ?? null,
				r.valor, r.tipo
			).run();
		}
	}
    
    async update(resultado: Resultado): Promise<void> {
        await this.db.prepare(`
            UPDATE Resultado SET
                dtMovimento = ?,
                idPlanoContas = ?,
                idContaCorrente = ?,
                idMovimentoBancario = ?,
                idParcelaFinanciamento = ?,
                valor = ?,
                tipo = ?
            WHERE id = ?
        `).bind(
            resultado.dtMovimento, resultado.idPlanoContas, resultado.idContaCorrente,
            resultado.idMovimentoBancario, resultado.idParcelaFinanciamento ?? null,
            resultado.valor, resultado.tipo, resultado.id
        ).run();
    }
}
    
    
     