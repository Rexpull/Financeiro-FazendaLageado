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

			const bindValues = [
				idBanco, idPessoa, responsavel, dataContrato, valor,
				taxaJurosAnual, taxaJurosMensal, numeroContrato,
				numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela, totalJuros
			];

			// Verificar se há valores undefined no array
			const hasUndefined = bindValues.some(value => value === undefined);
			if (hasUndefined) {
				console.error('❌ Valores undefined detectados no bindValues do Financiamento:', bindValues);
				throw new Error('Valores undefined não são suportados pelo D1 Database');
			}

			const { meta } = await this.db.prepare(`
				INSERT INTO Financiamento (
					idBanco, idPessoa, responsavel, dataContrato, valor,
					taxaJurosAnual, taxaJurosMensal, numeroContrato,
					numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
					dataVencimentoUltimaParcela, totalJuros
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(...bindValues).run();

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

			const bindValues = [
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
			];

			// Verificar se há valores undefined no array
			const hasUndefined = bindValues.some(value => value === undefined);
			if (hasUndefined) {
				console.error('❌ Valores undefined detectados no bindValues do Financiamento update:', bindValues);
				throw new Error('Valores undefined não são suportados pelo D1 Database');
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
			`).bind(...bindValues).run();

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

	async getFinanciamentosPorMes(ano: number) {
		try {
			const query = `
				SELECT 
					f.data_inicio,
					f.valor_total,
					f.valor_quitado,
					(f.valor_total - f.valor_quitado) as valor_em_aberto
				FROM Financiamento f
				WHERE EXTRACT(YEAR FROM f.data_inicio) = $1
				ORDER BY f.data_inicio
			`;

			const result = await this.db.prepare(query).bind(ano).all();
			
			const quitados = result.results.map(row => ({
				data: row.data_inicio,
				valor: row.valor_quitado
			}));

			const emAberto = result.results.map(row => ({
				data: row.data_inicio,
				valor: row.valor_em_aberto
			}));

			return {
				quitados,
				emAberto
			};
		} catch (error) {
			console.error("Erro ao buscar financiamentos por mês:", error);
			throw error;
		}
	}

	async getFinanciamentosPorCredor(ano: number) {
		try {
			const query = `
				SELECT 
					p.nome as credor,
					SUM(f.valor_total) as valor
				FROM Financiamento f
				JOIN pessoas p ON f.credor_id = p.id
				WHERE EXTRACT(YEAR FROM f.data_inicio) = $1
				GROUP BY p.nome
				ORDER BY valor DESC
			`;

			const result = await this.db.prepare(query).bind(ano).all();
			return result.results;
		} catch (error) {
			console.error("Erro ao buscar financiamentos por credor:", error);
			throw error;
		}
	}
}
