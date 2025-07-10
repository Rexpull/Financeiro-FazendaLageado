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
			// Tratar valores undefined antes de fazer o bind
			const bindValues = [
				r.dtMovimento || null,
				r.idPlanoContas || null,
				r.idContaCorrente || null,
				r.idMovimentoBancario || null,
				r.idParcelaFinanciamento ?? null,
				r.valor || 0,
				r.tipo || null
			];
			
			await stmt.bind(...bindValues).run();
		}
	}
    
    async update(resultado: Resultado): Promise<void> {
        // Tratar valores undefined antes de fazer o bind
        const bindValues = [
            resultado.dtMovimento || null,
            resultado.idPlanoContas || null,
            resultado.idContaCorrente || null,
            resultado.idMovimentoBancario || null,
            resultado.idParcelaFinanciamento ?? null,
            resultado.valor || 0,
            resultado.tipo || null,
            resultado.id || null
        ];
        
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
        `).bind(...bindValues).run();
    }
}
    
    
     