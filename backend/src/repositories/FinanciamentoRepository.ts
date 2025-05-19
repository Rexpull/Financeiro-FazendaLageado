import { Financiamento } from "../models/Financiamento";
import { ParcelaFinanciamento } from "../models/ParcelaFinanciamento";

export class FinanciamentoRepository {
	constructor(private db: D1Database) {}

	async getAll(): Promise<Financiamento[]> {
		try {
			const { results } = await this.db.prepare(`
				SELECT f.*, 
					(SELECT COUNT(*) FROM parcelaFinanciamento WHERE idFinanciamento = f.id) as totalParcelas
				FROM Financiamento f
			`).all();

			const financiamentos = await Promise.all(results.map(async (result) => {
				const parcelas = await this.db.prepare(`
					SELECT * FROM parcelaFinanciamento 
					WHERE idFinanciamento = ?
					ORDER BY numParcela
				`).bind(result.id).all();

				const parcelasList = parcelas.results.map(p => ({
					id: p.id as number,
					idMovimentoBancario: p.idMovimentoBancario as number | null,
					idFinanciamento: p.idFinanciamento as number,
					valor: p.valor as number,
					status: p.status as 'Aberto' | 'Vencido' | 'Liquidado',
					numParcela: p.numParcela as number,
					dt_lancamento: p.dt_lancamento as string,
					dt_vencimento: p.dt_vencimento as string,
					dt_liquidacao: p.dt_liquidacao as string | null
				}));

				return {
					...result,
					parcelasList,
					totalParcelas: result.totalParcelas
				} as Financiamento;
			}));

			return financiamentos;
		} catch (error) {
			console.error("Erro ao buscar todos os financiamentos:", error);
			throw new Error("Erro ao buscar financiamentos");
		}
	}

	async getById(id: number): Promise<Financiamento | null> {
		try {
			const result = await this.db.prepare(`SELECT * FROM Financiamento WHERE id = ?`).bind(id).first();
			if (!result) return null;

			const parcelasResult = await this.db.prepare(`SELECT * FROM parcelaFinanciamento WHERE idFinanciamento = ?`).bind(id).all();

			return {
				...result,
				parcelasList: parcelasResult.results as ParcelaFinanciamento[]
			} as Financiamento;
		} catch (error) {
			console.error(`Erro ao buscar financiamento ${id}:`, error);
			throw new Error("Erro ao buscar financiamento");
		}
	}

	async create(financiamento: Financiamento): Promise<number> {
		try {
			const {
				idBanco = null,
				idPessoa = null,
				responsavel,
				dataContrato,
				valor,
				taxaJurosAnual = null,
				taxaJurosMensal = null,
				numeroContrato,
				numeroGarantia = null,
				observacao = null,
				dataVencimentoPrimeiraParcela = null,
				dataVencimentoUltimaParcela = null,
				totalJuros = null
			} = financiamento;

			console.log("Dados para inserção:", {
				idBanco, idPessoa, responsavel, dataContrato, valor,
				taxaJurosAnual, taxaJurosMensal, numeroContrato,
				numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela, totalJuros
			});

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

			return meta.last_row_id;
		} catch (error) {
			console.error("Erro ao criar financiamento:", error);
			throw new Error(`Erro ao criar financiamento: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
		}
	}

	async update(id: number, financiamento: Financiamento): Promise<void> {
		try {
			const {
				idBanco = null,
				idPessoa = null,
				responsavel,
				dataContrato,
				valor,
				taxaJurosAnual = null,
				taxaJurosMensal = null,
				numeroContrato,
				numeroGarantia = null,
				observacao = null,
				dataVencimentoPrimeiraParcela = null,
				dataVencimentoUltimaParcela = null,
				totalJuros = null
			} = financiamento;

			console.log("Dados para atualização:", {
				id,
				idBanco,
				idPessoa,
				responsavel,
				dataContrato,
				valor,
				taxaJurosAnual,
				taxaJurosMensal,
				numeroContrato,
				numeroGarantia,
				observacao,
				dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela,
				totalJuros
			});

			// Primeiro verifica se o financiamento existe
			const existing = await this.getById(id);
			if (!existing) {
				throw new Error(`Financiamento com ID ${id} não encontrado`);
			}

			const { success } = await this.db.prepare(`
				UPDATE Financiamento
				SET idBanco = ?, 
					idPessoa = ?, 
					responsavel = ?, 
					dataContrato = ?, 
					valor = ?,
					taxaJurosAnual = ?, 
					taxaJurosMensal = ?, 
					numeroContrato = ?, 
					numeroGarantia = ?,
					observacao = ?, 
					dataVencimentoPrimeiraParcela = ?, 
					dataVencimentoUltimaParcela = ?, 
					totalJuros = ?, 
					atualizadoEm = CURRENT_TIMESTAMP
				WHERE id = ?
			`).bind(
				idBanco,
				idPessoa,
				responsavel,
				dataContrato,
				valor,
				taxaJurosAnual,
				taxaJurosMensal,
				numeroContrato,
				numeroGarantia,
				observacao,
				dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela,
				totalJuros,
				id
			).run();

			if (!success) {
				throw new Error("Falha ao atualizar financiamento");
			}
		} catch (error) {
			console.error(`Erro ao atualizar financiamento ${id}:`, error);
			throw new Error(`Erro ao atualizar financiamento: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
		}
	}

	async deleteById(id: number): Promise<void> {
		try {
			await this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE idFinanciamento = ?`).bind(id).run();
			await this.db.prepare(`DELETE FROM Financiamento WHERE id = ?`).bind(id).run();
		} catch (error) {
			console.error(`Erro ao excluir financiamento ${id}:`, error);
			throw new Error("Erro ao excluir financiamento");
		}
	}
}
