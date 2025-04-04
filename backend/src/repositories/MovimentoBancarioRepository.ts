import { MovimentoBancario } from "../models/MovimentoBancario";

export class MovimentoBancarioRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getAll(): Promise<MovimentoBancario[]> {
		const { results } = await this.db.prepare(`
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_Documento, descricao, transf_origem, transf_destino, identificador_ofx, criado_em, atualizado_em, idBanco, idPessoa, parcelado
			FROM MovimentoBancario
		`).all();

		return results.map(result => ({
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
		})) as MovimentoBancario[];
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

		return meta.last_row_id;
	}


	async update(id: number, movimento: MovimentoBancario): Promise<void> {
		const { dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx, tipoMovimento, modalidadeMovimento, idBanco, idPessoa, parcelado } = movimento;

		await this.db.prepare(`
			UPDATE MovimentoBancario
			SET dtMovimento = ?, historico = ?, idPlanoContas = ?, idContaCorrente = ?, valor = ?, saldo = ?, ideagro = ?, numero_documento = ?, descricao = ?, transf_origem = ?, transf_destino = ?, identificador_ofx = ?, atualizado_em = datetime('now'), tipoMovimento = ?, modalidadeMovimento = ?,  idBanco = ?, idPessoa = ?, parcelado = ?
			WHERE id = ?;
		`).bind(
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx, tipoMovimento, modalidadeMovimento, idBanco, idPessoa, parcelado ? 1 : 0, id
		).run();
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(id).run();
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
				data.descricao, data.contaDestinoId, crypto.randomUUID(), data.idUsuario
			).run();

			const idSaida = saida.last_row_id;

			// Movimento de entrada
			const historicoEntrada = `Transferência da conta corrente ${data.contaOrigemDescricao} com descrição: ${data.descricao}`;
			await this.db.prepare(`
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)
				VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, ?, null, ?, ?, 'C', 'transferencia', datetime('now'), datetime('now'))
			`).bind(
				data.data, historicoEntrada, planoTransferencia, data.contaDestinoId, data.valor,
				data.descricao, idSaida, crypto.randomUUID(), data.idUsuario
			).run();
		} catch (error) {
			throw error;
		}
	}


	async getSaldoContaCorrente(idContaCorrente: number): Promise<number> {
		const { results } = await this.db
			.prepare(`SELECT SUM(valor) AS saldo FROM MovimentoBancario WHERE idContaCorrente = ?`)
			.bind(idContaCorrente)
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
		};
	}
	


}
