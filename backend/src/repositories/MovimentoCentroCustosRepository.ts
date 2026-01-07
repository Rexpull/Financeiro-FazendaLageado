import { MovimentoCentroCustos } from '../models/MovimentoCentroCustos';

export class MovimentoCentroCustosRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async criar(movimentoCentroCustos: MovimentoCentroCustos): Promise<MovimentoCentroCustos> {
		const sql = `
            INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor)
            VALUES (?, ?, ?)
        `;
		const result = await this.db.prepare(sql)
			.bind(
				movimentoCentroCustos.idMovimentoBancario,
				movimentoCentroCustos.idCentroCustos,
				movimentoCentroCustos.valor
			)
			.run();
		return { ...movimentoCentroCustos, id: (result as any).meta.last_row_id };
	}

	async buscarPorMovimento(idMovimentoBancario: number): Promise<MovimentoCentroCustos[]> {
		const { results } = await this.db
			.prepare(`SELECT * FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`)
			.bind(idMovimentoBancario)
			.all();
		return results as MovimentoCentroCustos[];
	}

	async buscarPorMovimentos(idsMovimentoBancario: number[]): Promise<Map<number, MovimentoCentroCustos[]>> {
		if (idsMovimentoBancario.length === 0) return new Map();

		// Dividir em lotes de 100 para evitar problemas com SQLite
		const batchSize = 100;
		const map = new Map<number, MovimentoCentroCustos[]>();

		for (let i = 0; i < idsMovimentoBancario.length; i += batchSize) {
			const batch = idsMovimentoBancario.slice(i, i + batchSize);
			const placeholders = batch.map(() => '?').join(',');
			
			const { results } = await this.db
				.prepare(`SELECT * FROM MovimentoCentroCustos WHERE idMovimentoBancario IN (${placeholders})`)
				.bind(...batch)
				.all();

			results.forEach((r: any) => {
				const idMov = r.idMovimentoBancario as number;
				if (!map.has(idMov)) {
					map.set(idMov, []);
				}
				map.get(idMov)!.push(r as MovimentoCentroCustos);
			});
		}

		return map;
	}

	async deleteByMovimento(idMovimentoBancario: number): Promise<void> {
		await this.db
			.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`)
			.bind(idMovimentoBancario)
			.run();
	}

	async atualizar(movimentoCentroCustos: MovimentoCentroCustos): Promise<void> {
		await this.db
			.prepare(`
                UPDATE MovimentoCentroCustos
                SET idCentroCustos = ?, valor = ?
                WHERE id = ?
            `)
			.bind(
				movimentoCentroCustos.idCentroCustos,
				movimentoCentroCustos.valor,
				movimentoCentroCustos.id
			)
			.run();
	}
}

