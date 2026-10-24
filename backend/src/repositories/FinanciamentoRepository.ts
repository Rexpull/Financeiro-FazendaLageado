import { Financiamento } from "../models/Financiamento";
import { ParcelaFinanciamento } from "../models/ParcelaFinanciamento";
import { garantirSemUso, plural } from "../utils/verificarUsoRegistro";

// PRAGMA/ALTER check runs at most once per worker instance (not on every request).
let colunasVerificadas: Promise<void> | null = null;

function mapParcela(p: Record<string, unknown>): ParcelaFinanciamento {
	return {
		id: p.id as number,
		idMovimentoBancario: p.idMovimentoBancario as number | null,
		idFinanciamento: p.idFinanciamento as number,
		valor: p.valor as number,
		status: p.status as 'Aberto' | 'Vencido' | 'Liquidado',
		numParcela: p.numParcela as number,
		dt_lancamento: p.dt_lancamento as string,
		dt_vencimento: p.dt_vencimento as string,
		dt_liquidacao: p.dt_liquidacao as string | null
	} as ParcelaFinanciamento;
}

export class FinanciamentoRepository {
	constructor(private db: D1Database) {}

	private ensureColumnsExist(): Promise<void> {
		if (!colunasVerificadas) {
			colunasVerificadas = this.verificarColunas().catch((error) => {
				colunasVerificadas = null; // allow a retry on the next call
				throw error;
			});
		}
		return colunasVerificadas.catch(() => undefined);
	}

	private async verificarColunas(): Promise<void> {
		try {
			// Verificar se as colunas modalidade e nomeModalidadeParticular existem
			const { results } = await this.db.prepare(`
				PRAGMA table_info(Financiamento)
			`).all();

			const columns = results.map((r: any) => r.name);
			const needsModalidade = !columns.includes('modalidade');
			const needsNomeModalidadeParticular = !columns.includes('nomeModalidadeParticular');

			if (needsModalidade) {
				console.log('🔧 Adicionando coluna modalidade à tabela Financiamento...');
				await this.db.prepare(`
					ALTER TABLE Financiamento ADD COLUMN modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'))
				`).run();
				console.log('✅ Coluna modalidade adicionada com sucesso');
			}

			if (needsNomeModalidadeParticular) {
				console.log('🔧 Adicionando coluna nomeModalidadeParticular à tabela Financiamento...');
				await this.db.prepare(`
					ALTER TABLE Financiamento ADD COLUMN nomeModalidadeParticular TEXT
				`).run();
				console.log('✅ Coluna nomeModalidadeParticular adicionada com sucesso');
			}
		} catch (error) {
			console.error('❌ Erro ao verificar/criar colunas do Financiamento:', error);
			// ensureColumnsExist swallows it (does not break the request) and retries on the next call
			throw error;
		}
	}

	async getAll(): Promise<Financiamento[]> {
		try {
			await this.ensureColumnsExist();
			// 2 queries in one round trip (was 1 + one per contract).
			const [financiamentos, parcelas] = await this.db.batch([
				this.db.prepare(`SELECT * FROM Financiamento`),
				this.db.prepare(`SELECT * FROM parcelaFinanciamento ORDER BY idFinanciamento, numParcela`),
			]);

			const parcelasPorFinanciamento = new Map<number, ParcelaFinanciamento[]>();
			for (const row of parcelas.results as Record<string, unknown>[]) {
				const parcela = mapParcela(row);
				const lista = parcelasPorFinanciamento.get(parcela.idFinanciamento);
				if (lista) lista.push(parcela);
				else parcelasPorFinanciamento.set(parcela.idFinanciamento, [parcela]);
			}

			return (financiamentos.results as Record<string, unknown>[]).map((result) => {
				const parcelasList = parcelasPorFinanciamento.get(result.id as number) ?? [];
				return {
					...result,
					parcelasList,
					totalParcelas: parcelasList.length
				} as unknown as Financiamento;
			});
		} catch (error) {
			console.error("Erro ao buscar todos os financiamentos:", error);
			throw new Error("Erro ao buscar financiamentos");
		}
	}

	async getById(id: number): Promise<Financiamento | null> {
		try {
			await this.ensureColumnsExist();
			const result = await this.db.prepare(`SELECT * FROM Financiamento WHERE id = ?`).bind(id).first();
			if (!result) return null;

			const parcelasResult = await this.db.prepare(`SELECT * FROM parcelaFinanciamento WHERE idFinanciamento = ? ORDER BY numParcela`).bind(id).all();

			return {
				...result,
				parcelasList: parcelasResult.results as unknown as ParcelaFinanciamento[]
			} as unknown as Financiamento;
		} catch (error) {
			console.error(`Erro ao buscar financiamento ${id}:`, error);
			throw new Error("Erro ao buscar financiamento");
		}
	}

	async create(financiamento: Financiamento): Promise<number> {
		try {
			await this.ensureColumnsExist();
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
				totalJuros = null,
				modalidade = null,
				nomeModalidadeParticular = null
			} = financiamento;

			console.log("Dados para inserção:", {
				idBanco, idPessoa, responsavel, dataContrato, valor,
				taxaJurosAnual, taxaJurosMensal, numeroContrato,
				numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela, totalJuros, modalidade,
				nomeModalidadeParticular
			});

			const bindValues = [
				idBanco, idPessoa, responsavel, dataContrato, valor,
				taxaJurosAnual, taxaJurosMensal, numeroContrato,
				numeroGarantia, observacao, dataVencimentoPrimeiraParcela,
				dataVencimentoUltimaParcela, totalJuros, modalidade,
				nomeModalidadeParticular
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
					dataVencimentoUltimaParcela, totalJuros, modalidade,
					nomeModalidadeParticular
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(...bindValues).run();

			return meta.last_row_id;
		} catch (error) {
			console.error("Erro ao criar financiamento:", error);
			throw new Error(`Erro ao criar financiamento: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
		}
	}

	async update(id: number, financiamento: Financiamento): Promise<void> {
		try {
			await this.ensureColumnsExist();
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
				totalJuros = null,
				modalidade = null,
				nomeModalidadeParticular = null
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
				totalJuros,
				modalidade,
				nomeModalidadeParticular
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
				modalidade,
				nomeModalidadeParticular,
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
					modalidade = ?,
					nomeModalidadeParticular = ?,
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

	/** Throws RegistroEmUsoError when bank movements/resultados are linked to the contract or its parcelas. */
	async assertPodeExcluir(id: number): Promise<void> {
		await garantirSemUso(
			this.db,
			[
				{
					// distinct existing movements linked to the contract itself, its parcelas, or their Resultado rows
					sql: `SELECT COUNT(*) AS n FROM (
						SELECT mb.id FROM MovimentoBancario mb WHERE mb.idFinanciamento = ?
						UNION
						SELECT mb.id FROM parcelaFinanciamento p JOIN MovimentoBancario mb ON mb.id = p.idMovimentoBancario
						WHERE p.idFinanciamento = ?
						UNION
						SELECT mb.id FROM Resultado r
						JOIN parcelaFinanciamento p ON p.id = r.idParcelaFinanciamento
						JOIN MovimentoBancario mb ON mb.id = r.idMovimentoBancario
						WHERE p.idFinanciamento = ?
					)`,
					binds: [id, id, id],
					rotulo: (n) => plural(n, 'lançamento bancário vinculado', 'lançamentos bancários vinculados'),
				},
				{
					sql: `SELECT COUNT(*) AS n FROM Resultado r
						JOIN parcelaFinanciamento p ON p.id = r.idParcelaFinanciamento
						WHERE p.idFinanciamento = ? AND r.idMovimentoBancario IS NULL`,
					binds: [id],
					rotulo: (n) => plural(n, 'lançamento de resultado vinculado às parcelas', 'lançamentos de resultado vinculados às parcelas'),
				},
			],
			'Este financiamento tem',
			'Desvincule-os antes de excluir.',
		);
	}

	/** Deletes the contract and its parcelas atomically; refuses (409) when movements are linked. */
	async deleteById(id: number): Promise<void> {
		await this.assertPodeExcluir(id);
		await this.db.batch([
			this.db.prepare(`DELETE FROM parcelaFinanciamento WHERE idFinanciamento = ?`).bind(id),
			this.db.prepare(`DELETE FROM Financiamento WHERE id = ?`).bind(id),
		]);
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
