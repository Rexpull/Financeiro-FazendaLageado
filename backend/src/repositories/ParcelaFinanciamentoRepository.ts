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
			idFinanciamento: result.idFinanciamento as number,
			valor: result.valor as number,
			status: result.status as 'Aberto' | 'Vencido' | 'Liquidado',
			dt_vencimento: result.dt_vencimento as string,
			dt_liquidacao: result.dt_liquidacao as string | null,
			numParcela: result.numParcela as number
		})) as ParcelaFinanciamento[];
	}

	async getParcelasDoAno(ano: string): Promise<ParcelaFinanciamento[]> {
		const { results } = await this.db
			.prepare(
				`
		  SELECT * FROM ParcelaFinanciamento
		  WHERE STRFTIME('%Y', COALESCE(dt_liquidacao, dt_vencimento)) = ?
		`
			)
			.bind(ano)
			.all();

		return results.map((p) => ({
			id: p.id as number,
			idMovimentoBancario: p.idMovimentoBancario as number | null,
			idFinanciamento: p.idFinanciamento as number,
			valor: p.valor as number,
			status: p.status as 'Aberto' | 'Vencido' | 'Liquidado',
			numParcela: p.numParcela as number,
			dt_lancamento: p.dt_lancamento as string,
			dt_vencimento: p.dt_vencimento as string,
			dt_liquidacao: p.dt_liquidacao as string | null,
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

	async deleteByMovimentoBancario(idMovimentoBancario: number): Promise<void> {
		await this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE idMovimentoBancario = ?`)
			.bind(idMovimentoBancario).run();
	}

	async create(parcela: ParcelaFinanciamento): Promise<number> {
		try {
			const {
				idMovimentoBancario = null,
				idFinanciamento,
				valor,
				status,
				numParcela,
				dt_lancamento,
				dt_vencimento,
				dt_liquidacao = null
			} = parcela;

			console.log("Dados da parcela para inserção:", {
				idMovimentoBancario,
				idFinanciamento,
				valor,
				status,
				numParcela,
				dt_lancamento,
				dt_vencimento,
				dt_liquidacao
			});

			const bindValues = [
				idMovimentoBancario, idFinanciamento, valor, status,
				numParcela, dt_lancamento, dt_vencimento, dt_liquidacao
			];

			// Verificar se há valores undefined no array
			const hasUndefined = bindValues.some(value => value === undefined);
			if (hasUndefined) {
				console.error('❌ Valores undefined detectados no bindValues da ParcelaFinanciamento:', bindValues);
				throw new Error('Valores undefined não são suportados pelo D1 Database');
			}

			const { meta } = await this.db.prepare(`
				INSERT INTO parcelaFinanciamento (
					idMovimentoBancario, idFinanciamento, valor, status,
					numParcela, dt_lancamento, dt_vencimento, dt_liquidacao
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(...bindValues).run();

			return meta.last_row_id;
		} catch (error) {
			console.error("Erro ao criar parcela:", error);
			throw new Error(`Erro ao criar parcela: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
		}
	}

	async update(id: number, parcela: ParcelaFinanciamento): Promise<void> {
		const { 
			idMovimentoBancario, 
			valor, 
			dt_vencimento, 
			numParcela,
			status,
			dt_liquidacao
		} = parcela;

		const bindValues = [
			idMovimentoBancario, 
			valor, 
			dt_vencimento, 
			numParcela,
			status,
			dt_liquidacao,
			id
		];

		// Verificar se há valores undefined no array
		const hasUndefined = bindValues.some(value => value === undefined);
		if (hasUndefined) {
			console.error('❌ Valores undefined detectados no bindValues da ParcelaFinanciamento update:', bindValues);
			throw new Error('Valores undefined não são suportados pelo D1 Database');
		}

		await this.db.prepare(`
			UPDATE parcelaFinanciamento
			SET idMovimentoBancario = ?, 
				valor = ?, 
				dt_vencimento = ?, 
				numParcela = ?,
				status = ?,
				dt_liquidacao = ?
			WHERE id = ?
		`).bind(...bindValues).run();
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE id = ?`).bind(id).run();
	}
}
