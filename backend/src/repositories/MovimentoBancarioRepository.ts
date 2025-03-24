import { MovimentoBancario } from "../models/MovimentoBancario";

export class MovimentoBancarioRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getAll(): Promise<MovimentoBancario[]> {
		const { results } = await this.db.prepare(`
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_Documento, descricao, transf_origem, transf_destino, identificador_ofx, criado_em, atualizado_em
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
			atualizadoEm: result.atualizadoEm as string
		})) as MovimentoBancario[];
	}

	async create(movimento: MovimentoBancario): Promise<number> {
		const { dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx, idUsuario } = movimento;

		const { meta } = await this.db.prepare(`
			INSERT INTO MovimentoBancario (dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_documento, descricao, transf_origem, transf_destino, identificador_ofx, idUsuario, criado_em, atualizado_em)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));
		`).bind(
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx, idUsuario
		).run();

		return meta.last_row_id;
	}

	async update(id: number, movimento: MovimentoBancario): Promise<void> {
		const { dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx } = movimento;

		await this.db.prepare(`
			UPDATE MovimentoBancario
			SET dtMovimento = ?, historico = ?, idPlanoContas = ?, idContaCorrente = ?, valor = ?, saldo = ?, ideagro = ?, numero_documento = ?, descricao = ?, transf_origem = ?, transf_destino = ?, identificador_ofx = ?, atualizado_em = datetime('now')
			WHERE id = ?;
		`).bind(
			dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numeroDocumento, descricao, transfOrigem, transfDestino, identificadorOfx, id
		).run();
	}

	async deleteById(id: number): Promise<void> {
		await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(id).run();
	}

}
