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

