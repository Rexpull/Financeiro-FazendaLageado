import { ParcelaFinanciamento } from "../models/ParcelaFinanciamento";

export class ParcelaFinanciamentoRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getAll(): Promise<ParcelaFinanciamento[]> {
		const { results } = await this.db.prepare(`
			SELECT id, idMovimentoBancario, valor, dt_vencimento, numParcela
			FROM parcelaFinanciamento
		`).all();

		return results.map(result => ({
			id: result.id as number,
			idMovimentoBancario: result.idMovimentoBancario as number,
			valor: result.valor as number,
			dt_vencimento: result.dt_vencimento as string,
			numParcela: result.numParcela as number
		})) as ParcelaFinanciamento[];
	}

	async getByAno(ano: string): Promise<ParcelaFinanciamento[]> {
		const inicio = `${ano}-01-01`;
		const fim = `${ano}-12-31`;
	
		const { results } = await this.db.prepare(`
			SELECT * FROM ParcelaFinanciamento
			WHERE dt_vencimento BETWEEN ? AND ?
		`).bind(inicio, fim).all();
	
		return results.map(result => ({
			id: result.id as number,
			idMovimentoBancario: result.idMovimentoBancario as number,
			valor: result.valor as number,
			dt_vencimento: result.dt_vencimento as string,
			numParcela: result.numParcela as number
		})) as ParcelaFinanciamento[];
	}
	

	async getByIdMovimentoBancario(idMovimentoBancario: number): Promise<ParcelaFinanciamento[]> {
		const { results } = await this.db.prepare(`
		  SELECT id, idMovimentoBancario, valor, dt_vencimento, numParcela
		  FROM parcelaFinanciamento
		  WHERE idMovimentoBancario = ?
		`).bind(idMovimentoBancario).all();
	
		return results.map(result => ({
		  id: result.id as number,
		  idMovimentoBancario: result.idMovimentoBancario as number,
		  valor: result.valor as number,
		  dt_vencimento: result.dt_vencimento as string,
		  numParcela: result.numParcela as number
		})) as ParcelaFinanciamento[];
	  }

	async create(parcela: ParcelaFinanciamento): Promise<number> {
		const { idMovimentoBancario, valor, dt_vencimento, numParcela } = parcela;

		const { meta } = await this.db.prepare(`
			INSERT INTO parcelaFinanciamento (idMovimentoBancario, valor, dt_vencimento, numParcela)
			VALUES (?, ?, ?, ?)
		`).bind(idMovimentoBancario, valor, dt_vencimento, numParcela).run();

		return meta.last_row_id;
	}

	async update(id: number, parcela: ParcelaFinanciamento): Promise<void> {
		const { idMovimentoBancario, valor, dt_vencimento, numParcela } = parcela;

		await this.db.prepare(`
			UPDATE parcelaFinanciamento
			SET idMovimentoBancario = ?, valor = ?, dt_vencimento = ?, numParcela = ?
			WHERE id = ?
		`).bind(idMovimentoBancario, valor, dt_vencimento, numParcela, id).run();
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE id = ?`).bind(id).run();
	}
}
