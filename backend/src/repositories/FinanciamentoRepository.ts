import { Financiamento } from "../models/Financiamento";
import { ParcelaFinanciamento } from "../models/ParcelaFinanciamento";

export class FinanciamentoRepository {
	constructor(private db: D1Database) {}

	async getAll(): Promise<Financiamento[]> {
		const { results } = await this.db.prepare(`SELECT * FROM Financiamento`).all();
		return results as Financiamento[];
	}

	async getById(id: number): Promise<Financiamento | null> {
		const result = await this.db.prepare(`SELECT * FROM Financiamento WHERE id = ?`).bind(id).first();
		if (!result) return null;

		const parcelasResult = await this.db.prepare(`SELECT * FROM parcelaFinanciamento WHERE idFinanciamento = ?`).bind(id).all();

		return {
			...result,
			parcelasList: parcelasResult.results as ParcelaFinanciamento[]
		} as Financiamento;
	}

	async create(financiamento: Financiamento): Promise<number> {
		const {
			idBanco, idPessoa, responsavel, dataContrato, valor,
			taxaJurosAnual, taxaJurosMensal, numeroContrato,
			numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
			dataVencimentoUltimaParcela, totalJuros, parcelasList
		} = financiamento;

		const { meta } = await this.db.prepare(`
			INSERT INTO Financiamento (
				idBanco, idPessoa, responsavel, dataContrato, valor,
				taxaJurosAnual, taxaJurosMensal, numeroContrato,
				numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela, totalJuros
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			idBanco, idPessoa, responsavel, dataContrato, valor,
			taxaJurosAnual, taxaJurosMensal, numeroContrato,
			numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
			dataVencimentoUltimaParcela, totalJuros
		).run();

		const financiamentoId = meta.last_row_id;

		if (parcelasList && parcelasList.length > 0) {
			for (const parcela of parcelasList) {
				await this.db.prepare(`
					INSERT INTO parcelaFinanciamento (
						idFinanciamento, idMovimentoBancario, valor, status,
						numParcela, dt_lancamento, dt_vencimento, dt_liquidacao
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`).bind(
					financiamentoId, parcela.idMovimentoBancario, parcela.valor, parcela.status,
					parcela.numParcela, parcela.dt_lancamento, parcela.dt_vencimento, parcela.dt_liquidacao
				).run();
			}
		}

		return financiamentoId;
	}

	async update(id: number, financiamento: Financiamento): Promise<void> {
		await this.db.prepare(`
			UPDATE Financiamento
			SET idBanco = ?, idPessoa = ?, responsavel = ?, dataContrato = ?, valor = ?,
				taxaJurosAnual = ?, taxaJurosMensal = ?, numeroContrato = ?, numeroGarantia = ?,
				observacao = ?, dataVencimentoPrimeiraParcela = ?, dataVencimentoUltimaParcela = ?, totalJuros = ?, atualizadoEm = CURRENT_TIMESTAMP
			WHERE id = ?
		`).bind(
			financiamento.idBanco, financiamento.idPessoa, financiamento.responsavel, financiamento.dataContrato, financiamento.valor,
			financiamento.taxaJurosAnual, financiamento.taxaJurosMensal, financiamento.numeroContrato,
			financiamento.numeroGarantia, financiamento.observacao, financiamento.dataVencimentoPrimeiraParcela,
			financiamento.dataVencimentoUltimaParcela, financiamento.totalJuros, id
		).run();

		// Opcional: apagar e recriar parcelas associadas aqui, se desejar
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE idFinanciamento = ?`).bind(id).run();
		await this.db.prepare(`DELETE FROM Financiamento WHERE id = ?`).bind(id).run();
	}
}
