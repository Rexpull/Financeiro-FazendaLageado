import { MovimentoBancario } from '../models/MovimentoBancario';
import { ResultadoRepository } from './ResultadoRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';
import { FinanciamentoDetalhadoDTO } from '../models/FinanciamentoDetalhadoDTO';

export class MovimentoBancarioRepository {
	private db: D1Database;
	private resultadoRepo: ResultadoRepository;

	constructor(db: D1Database) {
		this.db = db;
		this.resultadoRepo = new ResultadoRepository(db);
	}

	async getMovimentosPorDetalhamento(planoId: number, mes: number, tipo: string): Promise<MovimentoDetalhado[]> {
		let sql = '';
		let params: any[] = [];

		const primeiroDiaMes = `${new Date().getFullYear()}-${String(mes + 1).padStart(2, '0')}-01`;
		const ultimoDiaMes = `${new Date().getFullYear()}-${String(mes + 1).padStart(2, '0')}-31`;

		if (tipo === 'receitas' || tipo === 'despesas' || tipo === 'investimentos' ) {
			sql = `
				SELECT
					mb.id,
					mb.dtMovimento,
					mb.historico,
					r.valor,
					b.nome AS bancoNome,
					cc.numConta,
					cc.numCartao,
					cc.responsavel
				FROM MovimentoBancario mb
				INNER JOIN Resultado r ON mb.id = r.idMovimentoBancario
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				WHERE r.idPlanoContas = ?
				AND mb.dtMovimento BETWEEN ? AND ?
				ORDER BY mb.dtMovimento ASC
			`;
			params = [planoId, primeiroDiaMes, ultimoDiaMes];
		} else if ( tipo === 'pendentesSelecao') {
			sql = `
				SELECT
					mb.id,
					mb.dtMovimento,
					mb.historico,
					mb.valor,
					b.nome AS bancoNome,
					cc.numConta,
					cc.numCartao,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				WHERE mb.idContaCorrente = ?
				AND mb.dtMovimento BETWEEN ? AND ?
				ORDER BY mb.dtMovimento ASC
			`;
			params = [planoId, primeiroDiaMes, ultimoDiaMes];
		} else if (tipo === 'financiamentos') {
			sql = `
				SELECT
					pf.id,
					pf.valor,
					pf.dt_vencimento,
					pf.numParcela,
					b.nome AS bancoNome,
					cc.numConta,
					cc.numCartao,
					cc.responsavel
				FROM parcelaFinanciamento pf
				INNER JOIN MovimentoBancario mb ON pf.idMovimentoBancario = mb.id
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				WHERE mb.idContaCorrente = ?
				AND pf.dt_vencimento BETWEEN ? AND ?
				ORDER BY pf.dt_vencimento ASC
			`;
			params = [planoId, primeiroDiaMes, ultimoDiaMes];
		}
		
		const { results } = await this.db
			.prepare(sql)
			.bind(...params)
			.all();

		return results.map((row: any) => {
			const contaFormatada = `${row.bancoNome || 'Banco'} - ${row.numConta || row.numCartao || '???'} - ${
				row.responsavel || 'Responsável'
			}`;
			return {
				id: row.id,
				data: row.dt_vencimento || row.dtMovimento,
				descricao: row.historico || (row.numParcela ? `Parcela ${row.numParcela}` : ''),
				valor: Number(row.valor),
				conta: contaFormatada,
			};
		});
	}

	async getAll(): Promise<MovimentoBancario[]> {
		const { results } = await this.db
			.prepare(
				`
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_Documento, descricao, transf_origem, transf_destino, identificador_ofx, criado_em, atualizado_em, idBanco, idPessoa, parcelado, idFinanciamento
			FROM MovimentoBancario
		`
			)
			.all();

		const movimentos = await Promise.all(
			results.map(async (result) => {
				const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);
				return {
					id: result.id as number,
					dtMovimento: result.dtMovimento as string,
					historico: result.historico as string,
					idPlanoContas: result.idPlanoContas as number,
					idContaCorrente: result.idContaCorrente as number,
					valor: result.valor as number,
					saldo: result.saldo as number,
					ideagro: result.ideagro as boolean,
					numeroDocumento: result.numeroDocumento as string,
					descricao: result.descricao as string,
					transfOrigem: result.transfOrigem as number | null,
					transfDestino: result.transfDestino as number | null,
					identificadorOfx: result.identificadorOfx as string,
					criadoEm: result.criadoEm as string,
					atualizadoEm: result.atualizadoEm as string,
					idBanco: result.idBanco as number,
					idPessoa: result.idPessoa as number,
					parcelado: result.parcelado === 1,
					idFinanciamento: result.idFinanciamento as number | undefined,
					resultadoList: resultadoList,
				};
			})
		);

		return movimentos;
	}

	async getAllFiltrado(ano: string, contas: number[]): Promise<MovimentoBancario[]> {
		const inicioAno = `${ano}-01-01`;
		const fimAno = `${ano}-12-31`;

		const { results } = await this.db
			.prepare(
				`
				SELECT
					id,
					dtMovimento,
					historico,
					idPlanoContas,
					idPessoa,
					idBanco,
					parcelado,
					idContaCorrente,
					valor,
					saldo,
					ideagro,
					numero_documento,
					descricao,
					transf_origem,
					transf_destino,
					identificador_ofx,
					criado_em,
					atualizado_em,
					idUsuario,
					tipoMovimento,
					modalidadeMovimento,
					idFinanciamento
				FROM MovimentoBancario
				WHERE dtMovimento BETWEEN ? AND ?
				AND idContaCorrente IN (${contas.map(() => '?').join(',')})
				`
			)
			.bind(inicioAno, fimAno, ...contas)
			.all();

		const movimentos = await Promise.all(
			results.map(async (result) => {
				const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);
				return {
					id: result.id as number,
					dtMovimento: result.dtMovimento as string,
					historico: result.historico as string,
					idPlanoContas: result.idPlanoContas as number,
					idPessoa: result.idPessoa as number,
					idBanco: result.idBanco as number,
					parcelado: result.parcelado === 1,
					idContaCorrente: result.idContaCorrente as number,
					valor: result.valor as number,
					saldo: result.saldo as number,
					ideagro: result.ideagro === 1,
					numeroDocumento: result.numero_documento as string,
					descricao: result.descricao as string,
					transfOrigem: result.transf_origem as number | null,
					transfDestino: result.transf_destino as number | null,
					identificadorOfx: result.identificador_ofx as string,
					criadoEm: result.criado_em as string,
					atualizadoEm: result.atualizado_em as string,
					idUsuario: result.idUsuario as number,
					tipoMovimento: result.tipoMovimento as 'C' | 'D' | undefined,
					modalidadeMovimento: result.modalidadeMovimento as 'padrao' | 'financiamento' | 'transferencia' | undefined,
					idFinanciamento: result.idFinanciamento as number | undefined,
					resultadoList,
				};
			})
		);

		return movimentos;
	}

	async create(movimento: MovimentoBancario): Promise<number> {
		const {
			dtMovimento,
			historico,
			idPlanoContas,
			idContaCorrente,
			valor,
			saldo,
			ideagro,
			numeroDocumento,
			descricao,
			transfOrigem,
			transfDestino,
			identificadorOfx,
			idUsuario,
			tipoMovimento,
			modalidadeMovimento,
			idBanco,
			idPessoa,
			parcelado,
			idFinanciamento,
		} = movimento;

		// Tratar valores undefined antes de fazer o bind
		const bindValues = [
			dtMovimento || null,
			historico || null,
			idPlanoContas || null,
			idContaCorrente || null,
			valor || 0,
			saldo || 0,
			ideagro ? 1 : 0,
			numeroDocumento || null,
			descricao || null,
			transfOrigem || null,
			transfDestino || null,
			identificadorOfx || null,
			idUsuario || null,
			tipoMovimento || null,
			modalidadeMovimento || null,
			new Date().toISOString(),
			new Date().toISOString(),
			idBanco || null,
			idPessoa || null,
			parcelado ? 1 : 0,
			idFinanciamento || null
		];

		// Verificar se há valores undefined no array
		const hasUndefined = bindValues.some(value => value === undefined);
		if (hasUndefined) {
			console.error('❌ Valores undefined detectados no bindValues:', bindValues);
			throw new Error('Valores undefined não são suportados pelo D1 Database');
		}

		const { meta } = await this.db
			.prepare(
				`
			INSERT INTO MovimentoBancario (
				dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
				ideagro, numero_documento, descricao, transf_origem, transf_destino,
				identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
				criado_em, atualizado_em, idBanco, idPessoa, parcelado, idFinanciamento
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
			)
			.bind(...bindValues)
			.run();

		const idMov = meta.last_row_id;

		let resultadoList = movimento.resultadoList;
		if (!resultadoList || resultadoList.length === 0) {
			if (idPlanoContas) {
				resultadoList = [
					{
						dtMovimento,
						idPlanoContas,
						idContaCorrente,
						idMovimentoBancario: idMov,
						valor: Math.abs(valor),
						tipo: tipoMovimento || (valor >= 0 ? 'C' : 'D'),
					},
				];
			}
		}

		if (resultadoList?.length) {
			await this.resultadoRepo.createMany(resultadoList.map((r) => ({ ...r, idMovimentoBancario: idMov })));
		}

		return idMov;
	}

	async update(id: number, movimento: MovimentoBancario): Promise<void> {
		console.log('🔧 Atualizando movimento:', id);
		console.log('📄 Dados recebidos:', JSON.stringify(movimento, null, 2));

		const {
			dtMovimento,
			historico,
			idPlanoContas,
			idContaCorrente,
			valor,
			saldo,
			ideagro,
			numeroDocumento,
			descricao,
			transfOrigem,
			transfDestino,
			identificadorOfx,
			tipoMovimento,
			modalidadeMovimento,
			idBanco,
			idPessoa,
			parcelado,
			idFinanciamento,
		} = movimento;

		// Tratar valores undefined antes de fazer o bind
		const bindValues = [
			dtMovimento || null,
			historico || null,
			idPlanoContas || null,
			idContaCorrente || null,
			valor || 0,
			saldo || 0,
			ideagro ? 1 : 0,
			numeroDocumento || null,
			descricao || null,
			transfOrigem || null,
			transfDestino || null,
			identificadorOfx || null,
			tipoMovimento || null,
			modalidadeMovimento || null,
			idBanco || null,
			idPessoa || null,
			parcelado ? 1 : 0,
			idFinanciamento || null,
			id
		];

		// Verificar se há valores undefined no array
		const hasUndefined = bindValues.some(value => value === undefined);
		if (hasUndefined) {
			console.error('❌ Valores undefined detectados no bindValues:', bindValues);
			throw new Error('Valores undefined não são suportados pelo D1 Database');
		}

		await this.db
			.prepare(
				`
			UPDATE MovimentoBancario
			SET dtMovimento = ?, historico = ?, idPlanoContas = ?, idContaCorrente = ?, valor = ?, saldo = ?, ideagro = ?, numero_documento = ?, descricao = ?, transf_origem = ?, transf_destino = ?, identificador_ofx = ?, atualizado_em = datetime('now'), tipoMovimento = ?, modalidadeMovimento = ?,  idBanco = ?, idPessoa = ?, parcelado = ?, idFinanciamento = ?
			WHERE id = ?;
		`
			)
			.bind(...bindValues)
			.run();

		console.log('🧹 Limpando resultados antigos...');
		await this.resultadoRepo.deleteByMovimento(id);

		let resultadoList = movimento.resultadoList;

		if (!resultadoList || resultadoList.length === 0) {
			if (idPlanoContas) {
				const tipo = tipoMovimento || (valor >= 0 ? 'C' : 'D');
				const valorAbs = Math.abs(valor);

				console.log('⚠️ Nenhum resultado informado. Criando resultado padrão com:');
				console.log(`📌 Plano: ${idPlanoContas}, Valor: ${valorAbs}, Tipo: ${tipo}`);

				resultadoList = [
					{
						dtMovimento,
						idPlanoContas,
						idContaCorrente,
						idMovimentoBancario: id,
						valor: valorAbs,
						tipo,
					},
				];
			}
		}

		if (resultadoList?.length) {
			console.log(`📝 Salvando ${resultadoList.length} resultados para o movimento ID ${id}...`);
			await this.resultadoRepo.createMany(
				resultadoList.map((r) => ({
					dtMovimento: r.dtMovimento,
					idPlanoContas: r.idPlanoContas,
					idContaCorrente: r.idContaCorrente,
					idMovimentoBancario: id,
					idParcelaFinanciamento: r.idParcelaFinanciamento ?? undefined,
					valor: r.valor,
					tipo: r.tipo,
				}))
			);
			console.log('✅ Resultados atualizados com sucesso.');
		} else {
			console.warn('⚠️ Nenhum resultado foi salvo. (idPlanoContas ausente?)');
		}
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(id).run();

		await this.resultadoRepo.deleteByMovimento(id);
	}

	async updateIdeagro(id: number, ideagro: boolean): Promise<void> {
		await this.db
			.prepare(
				`
		  UPDATE MovimentoBancario
		  SET ideagro = ?, atualizado_em = datetime('now')
		  WHERE id = ?
		`
			)
			.bind(ideagro ? 1 : 0, id)
			.run();
	}

	async getPlanoTransferencia(): Promise<number> {
		const { results } = await this.db.prepare(`SELECT idPlanoTransferenciaEntreContas FROM Parametros WHERE id = 1`).all();
		return Number(results[0]?.idPlanoTransferenciaEntreContas) ?? 0;
	}

	async transfer(data: {
		contaOrigemId: number;
		contaOrigemDescricao: string;
		contaDestinoId: number;
		contaDestinoDescricao: string;
		valor: number;
		descricao: string;
		data: string;
		idUsuario: number;
	}): Promise<void> {
		try {
			const planoTransferencia = await this.getPlanoTransferencia();

			// Movimento de saída
			const historicoSaida = `Transferência para a conta corrente ${data.contaDestinoDescricao} com descrição: ${data.descricao}`;
			const identificador = crypto.randomUUID();

			const { meta: saida } = await this.db
				.prepare(
					`
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)
				VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, null, ?, ?, ?, 'D', 'transferencia', datetime('now'), datetime('now'))
			`
				)
				.bind(
					data.data,
					historicoSaida,
					planoTransferencia,
					data.contaOrigemId,
					-data.valor,
					data.descricao,
					data.contaDestinoId,
					identificador,
					data.idUsuario
				)
				.run();

			const idSaida = saida.last_row_id;

			await this.resultadoRepo.createMany([
				{
					dtMovimento: data.data,
					idPlanoContas: planoTransferencia,
					idContaCorrente: data.contaOrigemId,
					valor: -data.valor,
					tipo: 'D',
					idMovimentoBancario: idSaida,
				},
			]);

			// Movimento de entrada
			const historicoEntrada = `Transferência da conta corrente ${data.contaOrigemDescricao} com descrição: ${data.descricao}`;
			const { meta: entrada } = await this.db
				.prepare(
					`
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)
				VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, ?, null, ?, ?, 'C', 'transferencia', datetime('now'), datetime('now'))
			`
				)
				.bind(
					data.data,
					historicoEntrada,
					planoTransferencia,
					data.contaDestinoId,
					data.valor,
					data.descricao,
					idSaida,
					identificador,
					data.idUsuario
				)
				.run();

			const idEntrada = entrada.last_row_id;

			// Inserir resultado da entrada
			await this.resultadoRepo.createMany([
				{
					dtMovimento: data.data,
					idPlanoContas: planoTransferencia,
					idContaCorrente: data.contaDestinoId,
					valor: data.valor,
					tipo: 'C',
					idMovimentoBancario: idEntrada,
				},
			]);
		} catch (error) {
			console.error('Erro ao processar transferência:', error);
			throw error;
		}
	}

	async getByIdentificadorOfx(identificadorOfx: string): Promise<MovimentoBancario | null> {
		const { results } = await this.db
			.prepare(
				`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					idBanco, idPessoa, parcelado, idFinanciamento
				FROM MovimentoBancario
				WHERE identificador_ofx = ?
			`
			)
			.bind(identificadorOfx)
			.all();

		const result = results[0];
		if (!result) return null;

		const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);

		return {
			id: result.id,
			dtMovimento: result.dtMovimento,
			historico: result.historico,
			idPlanoContas: result.idPlanoContas,
			idContaCorrente: result.idContaCorrente,
			valor: result.valor,
			saldo: result.saldo,
			ideagro: result.ideagro,
			numeroDocumento: result.numero_documento,
			descricao: result.descricao,
			transfOrigem: result.transf_origem,
			transfDestino: result.transf_destino,
			identificadorOfx: result.identificador_ofx,
			criadoEm: result.criado_em,
			atualizadoEm: result.atualizado_em,
			idUsuario: result.idUsuario,
			tipoMovimento: result.tipoMovimento,
			modalidadeMovimento: result.modalidadeMovimento,
			idBanco: result.idBanco,
			idPessoa: result.idPessoa,
			parcelado: result.parcelado === 1,
			idFinanciamento: result.idFinanciamento as number | undefined,
			resultadoList: resultadoList,
		} as MovimentoBancario;
	}

	async getSaldoContaCorrente(idContaCorrente: number, dataLimite: string): Promise<number> {
		const { results } = await this.db
			.prepare(`SELECT SUM(valor) AS saldo FROM MovimentoBancario WHERE idContaCorrente = ? AND dtMovimento < ?`)
			.bind(idContaCorrente, dataLimite)
			.all();

		return Number(results[0]?.saldo ?? 0);
	}

	async getById(id: number): Promise<MovimentoBancario | null> {
		const { results } = await this.db
			.prepare(
				`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					   numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					   criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					   idBanco, idPessoa, parcelado, idFinanciamento
				FROM MovimentoBancario
				WHERE id = ?
			`
			)
			.bind(id)
			.all();

		const result = results[0];

		if (!result) return null;

		const resultadoList = await this.resultadoRepo.getByMovimento(id);

		return {
			id: result.id as number,
			dtMovimento: result.dtMovimento as string,
			historico: result.historico as string,
			idPlanoContas: result.idPlanoContas as number,
			idContaCorrente: result.idContaCorrente as number,
			valor: result.valor as number,
			saldo: result.saldo as number,
			ideagro: result.ideagro as boolean,
			numeroDocumento: result.numero_documento as string,
			descricao: result.descricao as string,
			transfOrigem: result.transf_origem as number | null,
			transfDestino: result.transf_destino as number | null,
			identificadorOfx: result.identificador_ofx as string,
			criadoEm: result.criado_em as string,
			atualizadoEm: result.atualizado_em as string,
			idUsuario: result.idUsuario as number,
			tipoMovimento: result.tipoMovimento as 'C' | 'D' | undefined,
			modalidadeMovimento: result.modalidadeMovimento as 'padrao' | 'financiamento' | 'transferencia' | undefined,
			idBanco: result.idBanco as number,
			idPessoa: result.idPessoa as number,
			parcelado: result.parcelado === 1,
			idFinanciamento: result.idFinanciamento as number | undefined,
			resultadoList: resultadoList,
		};
	}

	async getDetalhesFinanciamento(credorKey: string, mes: number, ano: number): Promise<FinanciamentoDetalhadoDTO[]> {
		const [credorType, credorIdStr] = credorKey.split('_');
		const credorId = parseInt(credorIdStr, 10);

		if (isNaN(credorId)) {
			return [];
		}

		const primeiroDiaMes = new Date(ano, mes, 1).toISOString().split('T')[0];
		const ultimoDiaMes = new Date(ano, mes + 1, 0).toISOString().split('T')[0];

		let credorField = '';
		if (credorType === 'p') {
			credorField = 'f.idPessoa';
		} else if (credorType === 'b') {
			credorField = 'f.idBanco';
		} else {
			return [];
		}

		const sql = `
			SELECT
				f.id as idFinanciamento,
				f.numeroContrato,
				f.valor as valorFinanciamento,
				p.nome as nomePessoa,
				b.nome as nomeBanco,
				pf.id as idParcela,
				pf.numParcela,
				pf.valor as valorParcela,
				pf.dt_vencimento,
				pf.dt_liquidacao,
				pf.status
			FROM parcelaFinanciamento pf
			JOIN Financiamento f ON pf.idFinanciamento = f.id
			LEFT JOIN Pessoa p ON f.idPessoa = p.id
			LEFT JOIN Banco b ON f.idBanco = b.id
			WHERE ${credorField} = ?
			  AND COALESCE(pf.dt_liquidacao, pf.dt_vencimento) BETWEEN ? AND ?
			ORDER BY f.id, pf.numParcela
		`;

		const { results } = await this.db.prepare(sql).bind(credorId, primeiroDiaMes, ultimoDiaMes).all();

		const financiamentosMap = new Map<number, FinanciamentoDetalhadoDTO>();

		for (const row of results as any[]) {
			if (!financiamentosMap.has(row.idFinanciamento)) {
				financiamentosMap.set(row.idFinanciamento, {
					id: row.idFinanciamento,
					numeroContrato: row.numeroContrato,
					valorTotal: row.valorFinanciamento,
					credor: row.nomePessoa || row.nomeBanco || 'Não identificado',
					parcelas: [],
				});
			}

			financiamentosMap.get(row.idFinanciamento)!.parcelas.push({
				id: row.idParcela,
				numParcela: row.numParcela,
				valor: row.valorParcela,
				dt_vencimento: row.dt_vencimento,
				dt_liquidacao: row.dt_liquidacao,
				status: row.status,
			});
		}

		return Array.from(financiamentosMap.values());
	}

	async getByIds(ids: number[]): Promise<MovimentoBancario[]> {
		if (ids.length === 0) return [];

		const placeholders = ids.map(() => '?').join(',');
		const { results } = await this.db
			.prepare(
				`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					   numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					   criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					   idBanco, idPessoa, parcelado, idFinanciamento
				FROM MovimentoBancario
				WHERE id IN (${placeholders})
				ORDER BY dtMovimento ASC
			`
			)
			.bind(...ids)
			.all();

		const movimentos = await Promise.all(
			results.map(async (result) => {
				const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);
				return {
					id: result.id as number,
					dtMovimento: result.dtMovimento as string,
					historico: result.historico as string,
					idPlanoContas: result.idPlanoContas as number,
					idContaCorrente: result.idContaCorrente as number,
					valor: result.valor as number,
					saldo: result.saldo as number,
					ideagro: result.ideagro as boolean,
					numeroDocumento: result.numero_documento as string,
					descricao: result.descricao as string,
					transfOrigem: result.transf_origem as number | null,
					transfDestino: result.transf_destino as number | null,
					identificadorOfx: result.identificador_ofx as string,
					criadoEm: result.criado_em as string,
					atualizadoEm: result.atualizado_em as string,
					idUsuario: result.idUsuario as number,
					tipoMovimento: result.tipoMovimento as 'C' | 'D' | undefined,
					modalidadeMovimento: result.modalidadeMovimento as 'padrao' | 'financiamento' | 'transferencia' | undefined,
					idBanco: result.idBanco as number,
					idPessoa: result.idPessoa as number,
					parcelado: result.parcelado === 1,
					idFinanciamento: result.idFinanciamento as number | undefined,
					resultadoList: resultadoList,
				};
			})
		);

		return movimentos;
	}
}
