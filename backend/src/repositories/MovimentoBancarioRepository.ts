import { MovimentoBancario } from "../models/MovimentoBancario";
import { ResultadoRepository } from "./ResultadoRepository";

export class MovimentoBancarioRepository {
	private db: D1Database;
	private resultadoRepo: ResultadoRepository;

	constructor(db: D1Database) {
		this.db = db;
		this.resultadoRepo = new ResultadoRepository(db);
	}

	async getAll(): Promise<MovimentoBancario[]> {
		const { results } = await this.db.prepare(`
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_Documento, descricao, transf_origem, transf_destino, identificador_ofx, criado_em, atualizado_em, idBanco, idPessoa, parcelado
			FROM MovimentoBancario
		`).all();

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
					resultadoList: resultadoList,
				};
			})
		);
	
		return movimentos;
	}

	async create(movimento: MovimentoBancario): Promise<number> {
		const {
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
			numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx,
			idUsuario, tipoMovimento, modalidadeMovimento, idBanco, idPessoa, parcelado
		} = movimento;

		const { meta } = await this.db.prepare(`
			INSERT INTO MovimentoBancario (
				dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
				ideagro, numero_documento, descricao, transf_origem, transf_destino,
				identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
				criado_em, atualizado_em, idBanco, idPessoa, parcelado
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
			ideagro, numeroDocumento, descricao, transfOrigem, transfDestino,
			identificadorOfx, idUsuario, tipoMovimento, modalidadeMovimento,
			new Date().toISOString(), new Date().toISOString(), idBanco, idPessoa, parcelado ? 1 : 0
		).run();

		const idMov = meta.last_row_id;

		
		let resultadoList = movimento.resultadoList;
		if (!resultadoList || resultadoList.length === 0) {
			if (idPlanoContas) {
			resultadoList = [{
				dtMovimento,
				idPlanoContas,
				idContaCorrente,
				idMovimentoBancario: idMov,
				valor: Math.abs(valor),
				tipo: tipoMovimento || (valor >= 0 ? "C" : "D")
			}];
			}
		}

		if (resultadoList?.length) {
			await this.resultadoRepo.createMany(
			resultadoList.map(r => ({ ...r, idMovimentoBancario: idMov }))
			);
		}


		
		return idMov;
	}


	async update(id: number, movimento: MovimentoBancario): Promise<void> {
		console.log("🔧 Atualizando movimento:", id);
		console.log("📄 Dados recebidos:", JSON.stringify(movimento, null, 2));
	
		const {
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
			ideagro, numeroDocumento, descricao, transfOrigem, transfDestino,
			identificadorOfx, tipoMovimento, modalidadeMovimento,
			idBanco, idPessoa, parcelado
		} = movimento;
	
		await this.db.prepare(`
			UPDATE MovimentoBancario
			SET dtMovimento = ?, historico = ?, idPlanoContas = ?, idContaCorrente = ?, valor = ?, saldo = ?, ideagro = ?, numero_documento = ?, descricao = ?, transf_origem = ?, transf_destino = ?, identificador_ofx = ?, atualizado_em = datetime('now'), tipoMovimento = ?, modalidadeMovimento = ?,  idBanco = ?, idPessoa = ?, parcelado = ?
			WHERE id = ?;
		`).bind(
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
			ideagro, numeroDocumento, descricao, transfOrigem, transfDestino,
			identificadorOfx, tipoMovimento, modalidadeMovimento, idBanco, idPessoa,
			parcelado ? 1 : 0, id
		).run();
	
		console.log("🧹 Limpando resultados antigos...");
		await this.resultadoRepo.deleteByMovimento(id);
	
		let resultadoList = movimento.resultadoList;
	
		// fallback automático
		if (!resultadoList || resultadoList.length === 0) {
			if (idPlanoContas) {
				const tipo = tipoMovimento || (valor >= 0 ? "C" : "D");
				const valorAbs = Math.abs(valor);
	
				console.log("⚠️ Nenhum resultado informado. Criando resultado padrão com:");
				console.log(`📌 Plano: ${idPlanoContas}, Valor: ${valorAbs}, Tipo: ${tipo}`);
	
				resultadoList = [{
					dtMovimento,
					idPlanoContas,
					idContaCorrente,
					idMovimentoBancario: id,
					valor: valorAbs,
					tipo
				}];
			}
		}
	
		if (resultadoList?.length) {
			console.log(`📝 Salvando ${resultadoList.length} resultados para o movimento ID ${id}...`);
			await this.resultadoRepo.createMany(
				resultadoList.map(r => ({
					dtMovimento: r.dtMovimento,
					idPlanoContas: r.idPlanoContas,
					idContaCorrente: r.idContaCorrente,
					idMovimentoBancario: id,
					idParcelaFinanciamento: r.idParcelaFinanciamento ?? undefined,
					valor: r.valor,
					tipo: r.tipo,
				}))
				
			);
			console.log("✅ Resultados atualizados com sucesso.");
		} else {
			console.warn("⚠️ Nenhum resultado foi salvo. (idPlanoContas ausente?)");
		}
	}
	

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(id).run();

		await this.resultadoRepo.deleteByMovimento(id);
	}

	async updateIdeagro(id: number, ideagro: boolean): Promise<void> {
		await this.db.prepare(`
		  UPDATE MovimentoBancario
		  SET ideagro = ?, atualizado_em = datetime('now')
		  WHERE id = ?
		`).bind(ideagro ? 1 : 0, id).run();
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
	
			const { meta: saida } = await this.db.prepare(`
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)
				VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, null, ?, ?, ?, 'D', 'transferencia', datetime('now'), datetime('now'))
			`).bind(
				data.data, historicoSaida, planoTransferencia, data.contaOrigemId, -data.valor,
				data.descricao, data.contaDestinoId, identificador, data.idUsuario
			).run();
	
			const idSaida = saida.last_row_id;
	
			await this.resultadoRepo.createMany([{
				dtMovimento: data.data,
				idPlanoContas: planoTransferencia,
				idContaCorrente: data.contaOrigemId,
				valor: -data.valor,
				tipo: 'D',
				idMovimentoBancario: idSaida,
			}]);
	
			// Movimento de entrada
			const historicoEntrada = `Transferência da conta corrente ${data.contaOrigemDescricao} com descrição: ${data.descricao}`;
			const { meta: entrada } = await this.db.prepare(`
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)
				VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, ?, null, ?, ?, 'C', 'transferencia', datetime('now'), datetime('now'))
			`).bind(
				data.data, historicoEntrada, planoTransferencia, data.contaDestinoId, data.valor,
				data.descricao, idSaida, identificador, data.idUsuario
			).run();
	
			const idEntrada = entrada.last_row_id;
	
			// Inserir resultado da entrada
			await this.resultadoRepo.createMany([{
				dtMovimento: data.data,
				idPlanoContas: planoTransferencia,
				idContaCorrente: data.contaDestinoId,
				valor: data.valor,
				tipo: 'C',
				idMovimentoBancario: idEntrada,
			}]);
	
		} catch (error) {
			console.error("Erro ao processar transferência:", error);
			throw error;
		}
	}
	

	async getByIdentificadorOfx(identificadorOfx: string): Promise<MovimentoBancario | null> {
		const { results } = await this.db
			.prepare(`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					idBanco, idPessoa, parcelado
				FROM MovimentoBancario
				WHERE identificador_ofx = ?
			`)
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
			.prepare(`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					   numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					   criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					   idBanco, idPessoa, parcelado
				FROM MovimentoBancario
				WHERE id = ?
			`)
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
			tipoMovimento: result.tipoMovimento as "C" | "D",
			modalidadeMovimento: result.modalidadeMovimento as "padrao" | "financiamento" | "transferencia",
			idBanco: result.idBanco as number,
			idPessoa: result.idPessoa as number,
			parcelado: result.parcelado === 1,

			resultadoList: 	resultadoList,
		};
	}
	


}
