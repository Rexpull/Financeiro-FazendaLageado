import { MovimentoBancario } from '../models/MovimentoBancario';
import { ResultadoRepository } from './ResultadoRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';
import { FinanciamentoDetalhadoDTO } from '../models/FinanciamentoDetalhadoDTO';
import { ParcelaFinanciamentoRepository } from './ParcelaFinanciamentoRepository';
import { MovimentoCentroCustosRepository } from './MovimentoCentroCustosRepository';
import {
	coerceMonetaryValue,
	parseOfxIdentificadorParts,
} from '../utils/coerceMonetaryValue';
import {
	chaveFitidDia,
	contaSuffixRange,
	escolherIdentificadorParaConta,
	selecionarCandidatoFallbackOfx,
	shouldReuseOfxMovimento,
	stripContaSuffix,
} from '../utils/ofxIdentificadorMatch';
import { reescalarRateio } from '../utils/rateioOfxCorrecao';
import {
	TransferenciaInvalidaError,
	identificadoresTransferencia,
	parsePlanoTransferencia,
	validarTransferencia,
} from '../utils/transferencia';
import * as XLSX from 'xlsx';
import { sqlMovimentoClassificado, sqlMovimentoPendente } from '../utils/isMovimentoPendenteConcilacao';
import {
	carregarPlanosExclusaoResultado,
	sqlBaseResultado,
	sqlMovimentoFinanciamento,
	sqlMovimentoForaDosResultados,
	sqlPeriodo,
	subtipoDespesaPorCentro,
} from '../utils/sqlBaseResultado';

/** Result of MovimentoBancarioRepository.updateContaMovimentosOFX ("Editar conta" of an OFX import). */
export interface ResultadoMudancaContaOFX {
	atualizados: number;
	/** Already in the destination account (nothing to do). */
	jaNaConta: number;
	/** Ids no longer in the database (e.g. deleted after the import). */
	naoEncontrados: number;
	/** Lines the destination account already had: NOT moved (they stay in the original account). */
	duplicados: number;
	movimentosDuplicados: Array<{ id: number; idExistente: number; dtMovimento: string; historico: string; valor: number }>;
	falhas: number;
	detalhesFalhas: string[];
	historicoAtualizado: boolean;
	/** New HistoricoImportacaoOFX.idMovimentos when the history was updated. */
	idMovimentosHistorico?: number[];
}

/** Filters of the Conciliação exports: exactly the list filters (getPaginado) without the paging. */
export type FiltrosExportacaoConciliacao = Omit<Parameters<MovimentoBancarioRepository['getPaginado']>[0], 'page' | 'limit'>;

/** Note under the title of the Plano de Contas report exports (same text as the screen). */
const NOTA_RECEITAS_ITENS_CLASSIFICADOS =
	'Receitas classificadas só por centro de custos (sem plano de contas) não aparecem aqui: veja o Relatório de Centro de Custos.';

export class MovimentoBancarioRepository {
	private db: D1Database;
	private resultadoRepo: ResultadoRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;
	private movimentoCentroCustosRepo: MovimentoCentroCustosRepository;

	constructor(db: D1Database) {
		this.db = db;
		this.resultadoRepo = new ResultadoRepository(db);
		this.parcelaRepo = new ParcelaFinanciamentoRepository(db);
		this.movimentoCentroCustosRepo = new MovimentoCentroCustosRepository(db);
	}

	private normalizeIncomingMovimento(movimento: MovimentoBancario): MovimentoBancario {
		const valor = coerceMonetaryValue(movimento.valor);
		return {
			...movimento,
			valor,
			saldo: movimento.saldo ?? 0,
			tipoMovimento: movimento.tipoMovimento ?? (valor >= 0 ? 'C' : 'D'),
		};
	}

	private mapRowToMovimento(result: Record<string, unknown>, extras?: Partial<MovimentoBancario>): MovimentoBancario {
		return {
			id: result.id as number,
			dtMovimento: result.dtMovimento as string,
			historico: result.historico as string,
			idPlanoContas: result.idPlanoContas as number,
			idContaCorrente: result.idContaCorrente as number,
			valor: Number(result.valor),
			saldo: Number(result.saldo ?? 0),
			ideagro: Boolean(result.ideagro),
			numeroDocumento: (result.numero_documento ?? result.numeroDocumento) as string,
			descricao: result.descricao as string,
			transfOrigem: result.transf_origem as number | null,
			transfDestino: result.transf_destino as number | null,
			identificadorOfx: (result.identificador_ofx ?? result.identificadorOfx) as string,
			criadoEm: (result.criado_em ?? result.criadoEm) as string,
			atualizadoEm: (result.atualizado_em ?? result.atualizadoEm) as string,
			idUsuario: result.idUsuario as number,
			tipoMovimento: result.tipoMovimento as 'C' | 'D' | undefined,
			modalidadeMovimento: result.modalidadeMovimento as
				| 'padrao'
				| 'financiamento'
				| 'transferencia'
				| undefined,
			idBanco: result.idBanco as number,
			idPessoa: result.idPessoa as number,
			parcelado: result.parcelado === 1 || result.parcelado === true,
			idFinanciamento: result.idFinanciamento as number | undefined,
			idCentroCustos: result.idCentroCustos as number | undefined,
			...extras,
		};
	}

	/**
	 * Re-import OFX: the SAME bank line (same FITID + day + account + historico + checkNum)
	 * whose valor/identificador changed after a parser fix. Never used for generic FITIDs,
	 * `|#N` repeated lines, FITID+day repeated in the batch, or rows already matched by
	 * another line of the batch; any ambiguity returns null (imported as new).
	 */
	async findByOfxFitidDayConta(
		identificadorOfx: string,
		idContaCorrente: number,
		opts: {
			historico?: string | null;
			valor?: number;
			idsJaUsados?: Set<number>;
			identificadoresDoLote?: Set<string>;
			fitidDiaRepetidoNoLote?: boolean;
		} = {},
	): Promise<MovimentoBancario | null> {
		const parsed = parseOfxIdentificadorParts(identificadorOfx);
		if (!parsed) return null;

		const incoming = {
			identificadorOfx,
			historico: opts.historico,
			valor: Number(opts.valor ?? parsed.valor),
		};
		// Cheap pre-check (generic FITID, |#N, repeated in batch) before hitting the DB
		if (
			!selecionarCandidatoFallbackOfx({
				incoming,
				candidatos: [{ id: -1, identificadorOfx, historico: opts.historico, valor: incoming.valor }],
				fitidDiaRepetidoNoLote: opts.fitidDiaRepetidoNoLote,
			})
		) {
			return null;
		}

		const day = parsed.dtIso.substring(0, 10);
		const { results } = await this.db
			.prepare(
				`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
				FROM MovimentoBancario
				WHERE idContaCorrente = ?
				AND substr(identificador_ofx, 1, instr(identificador_ofx, '|') - 1) = ?
				AND substr(identificador_ofx, instr(identificador_ofx, '|') + 1, 10) = ?
				ORDER BY id ASC
			`,
			)
			.bind(idContaCorrente, parsed.fitid, day)
			.all();

		const candidatos = (results as Record<string, unknown>[]).map((row) => this.mapRowToMovimento(row));
		return selecionarCandidatoFallbackOfx({
			incoming,
			candidatos: candidatos.map((c) => ({ ...c, id: c.id, identificadorOfx: c.identificadorOfx ?? '' })),
			idsJaUsados: opts.idsJaUsados,
			identificadoresDoLote: opts.identificadoresDoLote,
			fitidDiaRepetidoNoLote: opts.fitidDiaRepetidoNoLote,
		});
	}

	/**
	 * Excel currency number format (SheetJS). Prefer raw numbers over locale strings.
	 */
	private applyExcelCurrencyFormat(ws: XLSX.WorkSheet, colIndexes: number[], startRow: number): void {
		if (!ws['!ref']) return;
		const range = XLSX.utils.decode_range(ws['!ref']);
		for (let R = startRow; R <= range.e.r; R++) {
			for (const C of colIndexes) {
				const addr = XLSX.utils.encode_cell({ r: R, c: C });
				const cell = ws[addr];
				if (cell && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
					cell.t = 'n';
					cell.z = '#,##0.00';
				}
			}
		}
	}

	private excelNumero(valor: number): number {
		return Math.round(Number(valor) * 100) / 100;
	}

	/**
	 * Fluxo exclusions for R/D: financing chart-of-accounts from Parametros + children of plan 170.
	 */
	private async getIdsPlanosExclusaoFluxo(): Promise<number[]> {
		const row = await this.db
			.prepare(
				`SELECT idPlanoEntradaFinanciamentos, idPlanoPagamentoFinanciamentos FROM parametros WHERE id = 1`,
			)
			.first();
		const ids: number[] = [];
		if (row) {
			for (const k of ['idPlanoEntradaFinanciamentos', 'idPlanoPagamentoFinanciamentos'] as const) {
				const v = (row as Record<string, unknown>)[k];
				if (v != null && v !== '' && Number.isFinite(Number(v))) ids.push(Number(v));
			}
		}
		const filhos170 = await this.db.prepare(`SELECT id FROM planoContas WHERE idReferente = 170`).all();
		for (const r of filhos170.results as Array<{ id: number }>) {
			if (r?.id != null && Number.isFinite(Number(r.id))) ids.push(Number(r.id));
		}
		return [...new Set(ids)];
	}

	/** Exclude MB whose own plan is blocked, or that has any Resultado line on a blocked plan. */
	private sqlExcludeMbPlanoContas(alias: string, ids: number[]): { sql: string; bind: number[] } {
		if (!ids.length) return { sql: '', bind: [] };
		const ph = ids.map(() => '?').join(', ');
		return {
			sql: ` AND (${alias}.idPlanoContas IS NULL OR ${alias}.idPlanoContas NOT IN (${ph}))
        AND NOT EXISTS (
          SELECT 1 FROM Resultado r_ex
          WHERE r_ex.idMovimentoBancario = ${alias}.id
            AND r_ex.idPlanoContas IN (${ph})
        )`,
			bind: [...ids, ...ids],
		};
	}

	async getMovimentosPorDetalhamento(
		planoId: number,
		mes: number,
		tipo: string,
		ano?: number,
		contas: number[] = [],
	): Promise<MovimentoDetalhado[]> {
		let sql = '';
		let params: any[] = [];

		const anoUsar = ano || new Date().getFullYear();
		const mesNumero = mes + 1; // API mes is 0-indexed (JS getMonth)

		const contasSql =
			contas.length > 0 ? ` AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})` : '';
		const dateSql = ` AND CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?
      AND CAST(strftime('%m', mb.dtMovimento) AS INTEGER) = ?`;

		if (tipo === 'receitas' || tipo === 'despesas' || tipo === 'investimentos') {
			// Same rules as the Fluxo cell (POST /api/fluxoCaixa, planos mode): no transfers, no financing
			// (idFinanciamento / modalidade / Parametros financing plans), nothing touching children of plan 170,
			// and only modalidade 'padrao' not parcelado (the others go to "Pendentes" there).
			const mbExcl = this.sqlExcludeMbPlanoContas('mb', await this.getIdsPlanosExclusaoFluxo());
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
				${dateSql}
				${contasSql}
				AND (mb.idFinanciamento IS NULL OR mb.idFinanciamento <= 0)
				AND mb.modalidadeMovimento = 'padrao'
				AND COALESCE(mb.parcelado, 0) != 1
				${mbExcl.sql}
				ORDER BY mb.dtMovimento ASC
			`;
			params = [planoId, anoUsar, mesNumero, ...contas, ...mbExcl.bind];
		} else if (tipo === 'pendentesSelecao') {
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
				${dateSql}
				ORDER BY mb.dtMovimento ASC
			`;
			params = [planoId, anoUsar, mesNumero];
		} else if (tipo === 'financiamentos') {
			const primeiroDiaMes = `${anoUsar}-${String(mesNumero).padStart(2, '0')}-01`;
			// Exclusive upper bound so ISO timestamps on the last day are included
			const proximoMes = mesNumero === 12 ? 1 : mesNumero + 1;
			const proximoAno = mesNumero === 12 ? anoUsar + 1 : anoUsar;
			const inicioProximoMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;
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
				AND pf.dt_vencimento >= ? AND pf.dt_vencimento < ?
				ORDER BY pf.dt_vencimento ASC
			`;
			params = [planoId, primeiroDiaMes, inicioProximoMes];
		}

		const { results } = await this.db
			.prepare(sql)
			.bind(...params)
			.all();

		return results.map((row: any) => {
			// Fluxo detail tabs show only the account name (e.g. "BB GFS"); bank + number as fallback
			const contaFormatada = row.responsavel || `${row.bancoNome || 'Banco'} - ${row.numConta || row.numCartao || '???'}`;
			return {
				id: row.id,
				data: row.dt_vencimento || row.dtMovimento,
				descricao: row.historico || (row.numParcela ? `Parcela ${row.numParcela}` : ''),
				valor: Number(row.valor),
				conta: contaFormatada,
			};
		});
	}

	async getMovimentosPorCentroCustosDetalhamento(
		centroCustosId: number,
		mes: number,
		tipo: string,
		ano?: number,
		contas: number[] = [],
	): Promise<MovimentoDetalhado[]> {
		if (tipo !== 'receitas' && tipo !== 'despesas') {
			return [];
		}

		const anoUsar = ano || new Date().getFullYear();
		const mesNumero = mes + 1; // API mes is 0-indexed
		const fluxoExclIds = await this.getIdsPlanosExclusaoFluxo();
		const mbExcl = this.sqlExcludeMbPlanoContas('mb', fluxoExclIds);

		const tipoSql =
			tipo === 'receitas'
				? ` AND (mb.tipoMovimento = 'C' OR (mb.tipoMovimento IS NULL AND mb.valor > 0))`
				: ` AND (mb.tipoMovimento = 'D' OR (mb.tipoMovimento IS NULL AND mb.valor < 0))`;

		const contasSql =
			contas.length > 0 ? ` AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})` : '';

		// MCC rateio for this centro, OR mb.idCentroCustos when movement has no MCC rows (Fluxo list rule)
		const sql = `
			SELECT
				mb.id,
				mb.dtMovimento,
				mb.historico,
				ABS(COALESCE(mcc.valor, mb.valor)) as valor,
				b.nome AS bancoNome,
				cc.numConta,
				cc.numCartao,
				cc.responsavel
			FROM MovimentoBancario mb
			LEFT JOIN MovimentoCentroCustos mcc
				ON mb.id = mcc.idMovimentoBancario AND mcc.idCentroCustos = ?
			LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
			LEFT JOIN Banco b ON cc.idBanco = b.id
			WHERE (
				mcc.idCentroCustos = ?
				OR (
					mb.idCentroCustos = ?
					AND NOT EXISTS (
						SELECT 1 FROM MovimentoCentroCustos mcc0 WHERE mcc0.idMovimentoBancario = mb.id
					)
				)
			)
			AND CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?
			AND CAST(strftime('%m', mb.dtMovimento) AS INTEGER) = ?
			${tipoSql}
			AND mb.idFinanciamento IS NULL
			AND (mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento NOT IN ('transferencia', 'financiamento'))
			${contasSql}
			${mbExcl.sql}
			ORDER BY mb.dtMovimento ASC
		`;

		const params: unknown[] = [
			centroCustosId,
			centroCustosId,
			centroCustosId,
			anoUsar,
			mesNumero,
			...contas,
			...mbExcl.bind,
		];

		const { results } = await this.db.prepare(sql).bind(...params).all();

		return results.map((row: any) => {
			// Fluxo detail tabs show only the account name (e.g. "BB GFS"); bank + number as fallback
			const contaFormatada = row.responsavel || `${row.bancoNome || 'Banco'} - ${row.numConta || row.numCartao || '???'}`;
			return {
				id: row.id,
				data: row.dtMovimento,
				descricao: row.historico,
				valor: Number(row.valor),
				conta: contaFormatada,
			};
		});
	}

	async getAll(): Promise<MovimentoBancario[]> {
		const { results } = await this.db
			.prepare(
				`
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
				numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
				criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
				idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
			FROM MovimentoBancario
		`,
			)
			.all();

		const resultadosMap = await this.resultadoRepo.getByMovimentos(results.map((r) => r.id as number));
		return (results as Record<string, unknown>[]).map((result) =>
			this.mapRowToMovimento(result, { resultadoList: resultadosMap.get(result.id as number) ?? [] }),
		);
	}

	async getAllFiltrado(ano: string, contas: number[]): Promise<MovimentoBancario[]> {
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
					idFinanciamento,
					idCentroCustos
				FROM MovimentoBancario
				WHERE CAST(strftime('%Y', dtMovimento) AS INTEGER) = ?
				AND idContaCorrente IN (${contas.map(() => '?').join(',')})
				`,
			)
			.bind(Number(ano), ...contas)
			.all();

		// Buscar todos os resultados e centros de custos em lote
		const idsMovimentos = results.map((r: any) => r.id as number);
		const [resultadosMap, centrosCustosMap] = await Promise.all([
			this.resultadoRepo.getByMovimentos(idsMovimentos),
			this.movimentoCentroCustosRepo.buscarPorMovimentos(idsMovimentos),
		]);

		// Mapear os resultados para os movimentos
		const movimentos = results.map((result) => {
			const id = result.id as number;
			const resultadoList = resultadosMap.get(id) || [];
			const centroCustosList = centrosCustosMap.get(id) || [];

			return {
				id,
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
				centroCustosList,
				idCentroCustos: result.idCentroCustos as number | undefined,
			};
		});

		return movimentos;
	}

	async createBatch(movimentos: MovimentoBancario[]): Promise<{
		movimentos: MovimentoBancario[];
		novos: number;
		existentes: number;
		erros: number;
		detalhesErros: string[];
	}> {
		const movimentosProcessados: MovimentoBancario[] = [];
		let novos = 0;
		let existentes = 0;
		let erros = 0;
		const detalhesErros: string[] = [];

		console.log(`🔄 Processando lote de ${movimentos.length} movimentos`);

		// Batch context for the OFX fallback (per conta): bare identificadores of every line,
		// FITID+day keys repeated in the batch, and rows already matched by a previous line.
		const identificadoresPorConta = new Map<number, Set<string>>();
		const contagemFitidDia = new Map<string, number>();
		for (const m of movimentos) {
			const conta = Number(m?.idContaCorrente);
			if (!m?.identificadorOfx || !conta) continue;
			if (!identificadoresPorConta.has(conta)) identificadoresPorConta.set(conta, new Set());
			identificadoresPorConta.get(conta)!.add(stripContaSuffix(m.identificadorOfx));
			const chave = chaveFitidDia(m.identificadorOfx, conta);
			if (chave) contagemFitidDia.set(chave, (contagemFitidDia.get(chave) ?? 0) + 1);
		}
		const idsJaUsados = new Set<number>();

		for (const movimento of movimentos) {
			try {
				const mov = this.normalizeIncomingMovimento(movimento);

				let movimentoExistente: MovimentoBancario | null = null;

				if (mov.identificadorOfx && mov.idContaCorrente) {
					// Always scope FITID lookup by account — never reuse another conta's row
					const byIdentificador = await this.getByIdentificadorOfxAndConta(
						mov.identificadorOfx,
						mov.idContaCorrente,
					);
					if (
						byIdentificador &&
						shouldReuseOfxMovimento({
							existingIdContaCorrente: byIdentificador.idContaCorrente,
							incomingIdContaCorrente: mov.idContaCorrente,
						})
					) {
						movimentoExistente = byIdentificador;
					}
					if (!movimentoExistente) {
						const chave = chaveFitidDia(mov.identificadorOfx, Number(mov.idContaCorrente));
						movimentoExistente = await this.findByOfxFitidDayConta(
							mov.identificadorOfx,
							mov.idContaCorrente,
							{
								historico: mov.historico,
								valor: mov.valor,
								idsJaUsados,
								identificadoresDoLote: identificadoresPorConta.get(Number(mov.idContaCorrente)),
								fitidDiaRepetidoNoLote: chave ? (contagemFitidDia.get(chave) ?? 0) > 1 : false,
							},
						);
					}
				}

				if (movimentoExistente) {
					idsJaUsados.add(movimentoExistente.id!);
					// Lookups above return the bare row; load the rateio lists (Resultado + centros)
					// so the screen keeps showing multi-centro classifications and update() preserves them.
					movimentoExistente = (await this.getById(movimentoExistente.id!)) ?? movimentoExistente;

					const valorDiverge =
						Math.abs(Number(movimentoExistente.valor) - mov.valor) > 0.001;
					// A row stored with a conta suffix (`|@c<id>`) is the same identificador
					const identificadorDiverge =
						mov.identificadorOfx &&
						stripContaSuffix(movimentoExistente.identificadorOfx ?? '') !== stripContaSuffix(mov.identificadorOfx);

					if (valorDiverge || identificadorDiverge) {
						console.log(
							`🔧 Corrigindo movimento OFX existente ID ${movimentoExistente.id}:`,
							{ de: movimentoExistente.valor, para: mov.valor }
						);
						const novoValorAbs = Math.abs(mov.valor);
						await this.update(movimentoExistente.id!, {
							...movimentoExistente,
							valor: mov.valor,
							identificadorOfx: mov.identificadorOfx,
							numeroDocumento: mov.numeroDocumento ?? mov.identificadorOfx,
							tipoMovimento: mov.tipoMovimento,
							resultadoList: reescalarRateio(movimentoExistente.resultadoList, novoValorAbs),
							centroCustosList: reescalarRateio(movimentoExistente.centroCustosList, novoValorAbs),
						});
						movimentoExistente =
							(await this.getById(movimentoExistente.id!)) ?? movimentoExistente;
					}

					console.log(`📋 Movimento existente: ${mov.identificadorOfx}`);
					movimentosProcessados.push(movimentoExistente);
					existentes++;
					continue;
				}

				// Criar novo movimento
				const idMov = await this.create(mov);
				idsJaUsados.add(idMov);
				console.log(`✅ Novo movimento criado: ID ${idMov}`);

				// Buscar o movimento completo criado
				const movimentoCompleto = await this.getById(idMov);
				if (movimentoCompleto) {
					movimentosProcessados.push(movimentoCompleto);
					novos++;
				}
			} catch (error) {
				erros++;
				const msg = `${movimento.historico ?? '?'} (${movimento.identificadorOfx}): ${
					error instanceof Error ? error.message : String(error)
				}`;
				detalhesErros.push(msg);
				console.error(`❌ Erro ao processar movimento ${movimento.identificadorOfx}:`, error);
				continue;
			}
		}

		console.log(`🎉 Lote processado: ${novos} novos, ${existentes} existentes, ${erros} erros`);
		return { movimentos: movimentosProcessados, novos, existentes, erros, detalhesErros };
	}

	/** Drops rateio lines without a valid centro (MovimentoCentroCustos.idCentroCustos is NOT NULL). */
	private sanitizeCentroCustosList(
		list: MovimentoBancario['centroCustosList'],
	): NonNullable<MovimentoBancario['centroCustosList']> {
		return (list ?? []).filter((c) => {
			const id = Number(c?.idCentroCustos);
			return Number.isInteger(id) && id > 0;
		});
	}

	/**
	 * identificador_ofx is UNIQUE globally but OFX dedupe is per conta: when the same
	 * identificador already exists in ANOTHER conta, store it with a `|@c<idConta>` suffix.
	 */
	private async resolveIdentificadorOfxParaConta(
		identificadorOfx: string,
		idContaCorrente: number | null | undefined,
		excludeId?: number,
	): Promise<string> {
		const conta = Number(idContaCorrente);
		if (!identificadorOfx || !Number.isInteger(conta) || conta <= 0) return identificadorOfx;
		const base = stripContaSuffix(identificadorOfx);
		const range = contaSuffixRange(base);
		const { results } = await this.db
			.prepare(
				`SELECT id, identificador_ofx, idContaCorrente FROM MovimentoBancario
				 WHERE identificador_ofx = ? OR (identificador_ofx >= ? AND identificador_ofx < ?)`,
			)
			.bind(base, range.from, range.to)
			.all<{ id: number; identificador_ofx: string; idContaCorrente: number }>();
		const ocupados = results
			.filter((r) => excludeId === undefined || Number(r.id) !== Number(excludeId))
			.map((r) => ({ identificadorOfx: r.identificador_ofx, idContaCorrente: Number(r.idContaCorrente) }));
		return escolherIdentificadorParaConta(base, conta, ocupados);
	}

	private resolveIdCentroCustosForInsert(movimento: MovimentoBancario): number | null {
		const list = this.sanitizeCentroCustosList(movimento.centroCustosList);
		if (list.length > 1) {
			return null;
		}
		if (list.length === 1) {
			return list[0].idCentroCustos ?? null;
		}
		return movimento.idCentroCustos ?? null;
	}

	private async persistCentroCustosOnCreate(idMov: number, movimento: MovimentoBancario, valorAbs: number): Promise<void> {
		let centroCustosList = this.sanitizeCentroCustosList(movimento.centroCustosList);

		if ((!centroCustosList || centroCustosList.length === 0) && movimento.idCentroCustos) {
			centroCustosList = [
				{
					idMovimentoBancario: idMov,
					idCentroCustos: movimento.idCentroCustos,
					valor: valorAbs,
				},
			];
		}

		if (!centroCustosList?.length) {
			return;
		}

		if (centroCustosList.length > 1) {
			await this.db
				.prepare(`UPDATE MovimentoBancario SET idCentroCustos = NULL, atualizado_em = datetime('now') WHERE id = ?`)
				.bind(idMov)
				.run();
		} else {
			await this.db
				.prepare(`UPDATE MovimentoBancario SET idCentroCustos = ?, atualizado_em = datetime('now') WHERE id = ?`)
				.bind(centroCustosList[0].idCentroCustos, idMov)
				.run();
		}

		for (const centro of centroCustosList) {
			await this.movimentoCentroCustosRepo.criar({
				...centro,
				idMovimentoBancario: idMov,
				valor: centro.valor ?? valorAbs,
			});
		}
	}

	async create(movimento: MovimentoBancario): Promise<number> {
		const normalized = this.normalizeIncomingMovimento(movimento);
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
		} = normalized;

		const idCentroCustosInsert = this.resolveIdCentroCustosForInsert(normalized);
		const identificadorOfxFinal = identificadorOfx
			? await this.resolveIdentificadorOfxParaConta(identificadorOfx, idContaCorrente)
			: identificadorOfx;

		// Tratar valores undefined antes de fazer o bind
		const bindValues = [
			dtMovimento || null,
			historico || null,
			idPlanoContas || null,
			idContaCorrente || null,
			valor,
			saldo ?? 0,
			ideagro ? 1 : 0,
			numeroDocumento || null,
			descricao || null,
			transfOrigem || null,
			transfDestino || null,
			identificadorOfxFinal || null,
			idUsuario || null,
			tipoMovimento || null,
			modalidadeMovimento || null,
			new Date().toISOString(),
			new Date().toISOString(),
			idBanco || null,
			idPessoa || null,
			parcelado ? 1 : 0,
			idFinanciamento || null,
			idCentroCustosInsert,
		];

		// Verificar se há valores undefined no array
		const hasUndefined = bindValues.some((value) => value === undefined);
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
				criado_em, atualizado_em, idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
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

		await this.persistCentroCustosOnCreate(idMov, normalized, Math.abs(valor));

		return idMov;
	}

	async update(id: number, movimento: MovimentoBancario): Promise<void> {
		console.log('🔧 Atualizando movimento:', id);
		console.log('📄 Dados recebidos:', JSON.stringify(movimento, null, 2));

		// Buscar o movimento atual para comparar
		const movimentoAtual = await this.getById(id);
		if (!movimentoAtual) {
			throw new Error(`Movimento com ID ${id} não encontrado`);
		}

		// Criar objeto com apenas os campos que foram alterados
		const camposAlterados: Partial<MovimentoBancario> = {};

		// Comparar e adicionar apenas campos alterados
		if (movimento.dtMovimento !== undefined && movimento.dtMovimento !== movimentoAtual.dtMovimento) {
			camposAlterados.dtMovimento = movimento.dtMovimento;
		}
		if (movimento.historico !== undefined && movimento.historico !== movimentoAtual.historico) {
			camposAlterados.historico = movimento.historico;
		}
		if (movimento.idPlanoContas !== undefined && movimento.idPlanoContas !== movimentoAtual.idPlanoContas) {
			camposAlterados.idPlanoContas = movimento.idPlanoContas;
		}
		if (movimento.idContaCorrente !== undefined && movimento.idContaCorrente !== movimentoAtual.idContaCorrente) {
			camposAlterados.idContaCorrente = movimento.idContaCorrente;
		}
		if (movimento.valor !== undefined && movimento.valor !== movimentoAtual.valor) {
			camposAlterados.valor = movimento.valor;
		}
		if (movimento.saldo !== undefined && movimento.saldo !== movimentoAtual.saldo) {
			camposAlterados.saldo = movimento.saldo;
		}
		if (movimento.ideagro !== undefined && movimento.ideagro !== movimentoAtual.ideagro) {
			camposAlterados.ideagro = movimento.ideagro;
		}
		if (movimento.numeroDocumento !== undefined && movimento.numeroDocumento !== movimentoAtual.numeroDocumento) {
			camposAlterados.numeroDocumento = movimento.numeroDocumento;
		}
		if (movimento.descricao !== undefined && movimento.descricao !== movimentoAtual.descricao) {
			camposAlterados.descricao = movimento.descricao;
		}
		if (movimento.transfOrigem !== undefined && movimento.transfOrigem !== movimentoAtual.transfOrigem) {
			camposAlterados.transfOrigem = movimento.transfOrigem;
		}
		if (movimento.transfDestino !== undefined && movimento.transfDestino !== movimentoAtual.transfDestino) {
			camposAlterados.transfDestino = movimento.transfDestino;
		}
		// A conta-suffixed identificador (`|@c<id>`) is the same identificador as its bare form
		if (
			typeof movimento.identificadorOfx === 'string' &&
			movimento.identificadorOfx !== '' &&
			stripContaSuffix(movimento.identificadorOfx) !== stripContaSuffix(movimentoAtual.identificadorOfx ?? '')
		) {
			camposAlterados.identificadorOfx = movimento.identificadorOfx;
		}
		if (movimento.tipoMovimento !== undefined && movimento.tipoMovimento !== movimentoAtual.tipoMovimento) {
			camposAlterados.tipoMovimento = movimento.tipoMovimento;
		}
		if (movimento.modalidadeMovimento !== undefined && movimento.modalidadeMovimento !== movimentoAtual.modalidadeMovimento) {
			camposAlterados.modalidadeMovimento = movimento.modalidadeMovimento;
		}
		if (movimento.idBanco !== undefined && movimento.idBanco !== movimentoAtual.idBanco) {
			camposAlterados.idBanco = movimento.idBanco;
		}
		if (movimento.idPessoa !== undefined && movimento.idPessoa !== movimentoAtual.idPessoa) {
			camposAlterados.idPessoa = movimento.idPessoa;
		}
		if (movimento.parcelado !== undefined && movimento.parcelado !== movimentoAtual.parcelado) {
			camposAlterados.parcelado = movimento.parcelado;
		}
		if (movimento.idFinanciamento !== undefined && movimento.idFinanciamento !== movimentoAtual.idFinanciamento) {
			camposAlterados.idFinanciamento = movimento.idFinanciamento;
		}
		if (movimento.idCentroCustos !== undefined && movimento.idCentroCustos !== movimentoAtual.idCentroCustos) {
			camposAlterados.idCentroCustos = movimento.idCentroCustos;
		}

		console.log('🔧 Campos que serão alterados:', camposAlterados);

		// Verificar se há resultadoList para processar
		const temResultadoList = movimento.resultadoList && movimento.resultadoList.length > 0;
		console.log('🔍 Tem resultadoList para processar?', temResultadoList);

		// Verificar se há centroCustosList para processar
		const temCentroCustosList = movimento.centroCustosList && movimento.centroCustosList.length > 0;
		console.log('🔍 Tem centroCustosList para processar?', temCentroCustosList);

		// Se não há campos para alterar E não há resultadoList E não há centroCustosList, retornar
		if (Object.keys(camposAlterados).length === 0 && !temResultadoList && !temCentroCustosList && !movimento.limparConciliacao) {
			console.log('ℹ️ Nenhum campo foi alterado e não há resultadoList nem centroCustosList para processar');
			return;
		}

		// Construir query dinamicamente baseada nos campos alterados
		const setClauses: string[] = [];
		const bindValues: any[] = [];

		if (camposAlterados.dtMovimento !== undefined) {
			setClauses.push('dtMovimento = ?');
			bindValues.push(camposAlterados.dtMovimento);
		}
		if (camposAlterados.historico !== undefined) {
			setClauses.push('historico = ?');
			bindValues.push(camposAlterados.historico);
		}
		if (camposAlterados.idPlanoContas !== undefined) {
			setClauses.push('idPlanoContas = ?');
			bindValues.push(camposAlterados.idPlanoContas);
		}
		if (camposAlterados.idContaCorrente !== undefined) {
			setClauses.push('idContaCorrente = ?');
			bindValues.push(camposAlterados.idContaCorrente);
		}
		if (camposAlterados.valor !== undefined) {
			setClauses.push('valor = ?');
			bindValues.push(camposAlterados.valor);
		}
		if (camposAlterados.saldo !== undefined) {
			setClauses.push('saldo = ?');
			bindValues.push(camposAlterados.saldo);
		}
		if (camposAlterados.ideagro !== undefined) {
			setClauses.push('ideagro = ?');
			bindValues.push(camposAlterados.ideagro ? 1 : 0);
		}
		if (camposAlterados.numeroDocumento !== undefined) {
			setClauses.push('numero_documento = ?');
			bindValues.push(camposAlterados.numeroDocumento);
		}
		if (camposAlterados.descricao !== undefined) {
			setClauses.push('descricao = ?');
			bindValues.push(camposAlterados.descricao);
		}
		if (camposAlterados.transfOrigem !== undefined) {
			setClauses.push('transf_origem = ?');
			bindValues.push(camposAlterados.transfOrigem);
		}
		if (camposAlterados.transfDestino !== undefined) {
			setClauses.push('transf_destino = ?');
			bindValues.push(camposAlterados.transfDestino);
		}
		if (camposAlterados.identificadorOfx !== undefined) {
			setClauses.push('identificador_ofx = ?');
			// Same identificador already stored in another conta → `|@c<idConta>` suffix (UNIQUE is global)
			bindValues.push(
				await this.resolveIdentificadorOfxParaConta(
					camposAlterados.identificadorOfx,
					camposAlterados.idContaCorrente ?? movimentoAtual.idContaCorrente,
					id,
				),
			);
		}
		if (camposAlterados.tipoMovimento !== undefined) {
			setClauses.push('tipoMovimento = ?');
			bindValues.push(camposAlterados.tipoMovimento);
		}
		if (camposAlterados.modalidadeMovimento !== undefined) {
			setClauses.push('modalidadeMovimento = ?');
			bindValues.push(camposAlterados.modalidadeMovimento);
		}
		if (camposAlterados.idBanco !== undefined) {
			setClauses.push('idBanco = ?');
			bindValues.push(camposAlterados.idBanco);
		}
		if (camposAlterados.idPessoa !== undefined) {
			setClauses.push('idPessoa = ?');
			bindValues.push(camposAlterados.idPessoa);
		}
		if (camposAlterados.parcelado !== undefined) {
			setClauses.push('parcelado = ?');
			bindValues.push(camposAlterados.parcelado ? 1 : 0);
		}
		if (camposAlterados.idFinanciamento !== undefined) {
			setClauses.push('idFinanciamento = ?');
			bindValues.push(camposAlterados.idFinanciamento);
		}
		if (camposAlterados.idCentroCustos !== undefined) {
			setClauses.push('idCentroCustos = ?');
			bindValues.push(camposAlterados.idCentroCustos);
		}

		// Se há campos para atualizar, executar query
		if (setClauses.length > 0) {
			// Adicionar campo de atualização e ID
			setClauses.push("atualizado_em = datetime('now')");
			bindValues.push(id);

			// Construir e executar query
			const query = `
				UPDATE MovimentoBancario
				SET ${setClauses.join(', ')}
				WHERE id = ?;
			`;

			console.log('🔧 Query de atualização:', query);
			console.log('🔧 Valores para bind:', bindValues);

			await this.db
				.prepare(query)
				.bind(...bindValues)
				.run();
		} else {
			console.log('ℹ️ Nenhum campo da tabela para atualizar, apenas processando resultadoList');
		}

		// Default Resultado/MCC rows follow the values persisted by THIS update (new valor/date/conta).
		const valorFinal =
			camposAlterados.valor !== undefined ? coerceMonetaryValue(camposAlterados.valor) : Number(movimentoAtual.valor);
		const valorAbsFinal = Math.abs(valorFinal);
		const tipoFinal =
			camposAlterados.tipoMovimento ||
			(camposAlterados.valor !== undefined ? undefined : movimentoAtual.tipoMovimento) ||
			(valorFinal >= 0 ? 'C' : 'D');
		const dtMovimentoFinal = camposAlterados.dtMovimento ?? movimentoAtual.dtMovimento;
		const idContaCorrenteFinal = camposAlterados.idContaCorrente ?? movimentoAtual.idContaCorrente;

		// "Limpar conciliação": drop every plan/centre split. An empty resultadoList can't express this
		// (ConciliarPlano sends [] for "single plan via idPlanoContas"), and when the movement had a
		// rateio its idPlanoContas/idCentroCustos are already NULL, so "changed to null" never fires.
		if (movimento.limparConciliacao) {
			await this.db.batch([
				// The installment this movement paid goes back to open (same rule as deleting the movement)
				...this.parcelaRepo.statementsDesvincularMovimentos([id]),
				this.db.prepare(`DELETE FROM Resultado WHERE idMovimentoBancario = ?`).bind(id),
				this.db.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`).bind(id),
				this.db
					.prepare(`UPDATE MovimentoBancario SET idPlanoContas = NULL, idCentroCustos = NULL, atualizado_em = datetime('now') WHERE id = ?`)
					.bind(id),
			]);
			console.log('🧹 Conciliação limpa (planos e centros removidos)');
			return;
		}

		// Only rebuild Resultado when the classification was sent or the plano changed;
		// a partial PUT (e.g. only historico) must not wipe the existing Resultado rows.
		const reprocessarResultados = !!temResultadoList || camposAlterados.idPlanoContas !== undefined;
		if (reprocessarResultados) {
			console.log('🧹 Limpando resultados antigos...');
			await this.resultadoRepo.deleteByMovimento(id);
		}

		// Processar resultados se necessário
		let resultadoList = reprocessarResultados ? movimento.resultadoList : undefined;

		console.log('🔍 Processando resultadoList:', JSON.stringify(resultadoList, null, 2));
		console.log('🔍 resultadoList existe?', !!resultadoList);
		console.log('🔍 resultadoList.length:', resultadoList?.length);

		if (!resultadoList || resultadoList.length === 0) {
			console.log('⚠️ Nenhum resultadoList fornecido, verificando se precisa criar resultado padrão...');
			if (camposAlterados.idPlanoContas) {
				const tipo = tipoFinal;
				const valorAbs = valorAbsFinal;

				console.log('⚠️ Nenhum resultado informado. Criando resultado padrão com:');
				console.log(`📌 Plano: ${camposAlterados.idPlanoContas}, Valor: ${valorAbs}, Tipo: ${tipo}`);

				resultadoList = [
					{
						dtMovimento: dtMovimentoFinal,
						idPlanoContas: camposAlterados.idPlanoContas,
						idContaCorrente: idContaCorrenteFinal,
						idMovimentoBancario: id,
						valor: valorAbs,
						tipo,
					},
				];
			}
		} else {
			console.log('✅ resultadoList fornecido, processando múltiplos planos...');
		}

		if (resultadoList?.length) {
			console.log(`📝 Criando ${resultadoList.length} resultados:`);
			resultadoList.forEach((r, index) => {
				console.log(`  ${index + 1}. Plano: ${r.idPlanoContas}, Valor: ${r.valor}, Tipo: ${r.tipo}`);
			});
			await this.resultadoRepo.createMany(resultadoList.map((r) => ({ ...r, idMovimentoBancario: id })));
			console.log('✅ Resultados criados com sucesso');

			// Sync mb.idPlanoContas with the Resultado to keep them consistent.
			// Single Resultado: set mb.idPlanoContas to that plan. Multiple (rateio): clear mb.idPlanoContas.
			const syncedPlanoContas = resultadoList.length === 1 ? resultadoList[0].idPlanoContas : null;
			// Compare with the value persisted by the UPDATE above, not the pre-update one
			const planoGravado =
				camposAlterados.idPlanoContas !== undefined ? camposAlterados.idPlanoContas : movimentoAtual.idPlanoContas;
			const syncedPlanoChanged = syncedPlanoContas !== (planoGravado ?? null);
			if (syncedPlanoChanged) {
				console.log(`🔄 Sincronizando mb.idPlanoContas: ${planoGravado} → ${syncedPlanoContas}`);
				await this.db
					.prepare(`UPDATE MovimentoBancario SET idPlanoContas = ?, atualizado_em = datetime('now') WHERE id = ?`)
					.bind(syncedPlanoContas, id)
					.run();
			}
		} else {
			console.log('⚠️ Nenhum resultado para processar');
		}

		// Processar centroCustosList se necessário.
		// Same rule as Resultado: keep existing MCC rows (incl. multi-centro rateio) on a partial PUT.
		if (!temCentroCustosList && camposAlterados.idCentroCustos === undefined) {
			console.log('ℹ️ Centros de custos não informados nem alterados: mantendo rateio atual');
			console.log('✅ Movimento atualizado com sucesso');
			return;
		}
		// Rules: a sent non-empty centroCustosList always wins; otherwise idCentroCustos changed to a
		// centre → one line with it; changed to null (no list) → no centre. Never insert a null centre.
		let centroCustosList: { idCentroCustos: number; valor: number }[];
		if (temCentroCustosList) {
			console.log('✅ centroCustosList fornecido, ele prevalece sobre idCentroCustos');
			centroCustosList = this.sanitizeCentroCustosList(movimento.centroCustosList).map((c) => ({
				idCentroCustos: Number(c.idCentroCustos),
				valor: c.valor ?? valorAbsFinal,
			}));
		} else if (camposAlterados.idCentroCustos) {
			console.log('📌 idCentroCustos alterado sem lista: um único item com o novo centro');
			centroCustosList = [{ idCentroCustos: Number(camposAlterados.idCentroCustos), valor: valorAbsFinal }];
		} else {
			console.log('🧹 idCentroCustos removido sem lista: limpando centros de custos');
			centroCustosList = [];
		}

		// MB.idCentroCustos mirrors MCC: one line → that centre; none or rateio (>1) → NULL
		const centroSincronizado = centroCustosList.length === 1 ? centroCustosList[0].idCentroCustos : null;
		const statements: D1PreparedStatement[] = [
			this.db.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario = ?`).bind(id),
			...centroCustosList.map((c) =>
				this.db
					.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (?, ?, ?)`)
					.bind(id, c.idCentroCustos, c.valor),
			),
		];
		const centroGravado =
			camposAlterados.idCentroCustos !== undefined ? camposAlterados.idCentroCustos : movimentoAtual.idCentroCustos;
		if ((centroGravado ?? null) !== centroSincronizado) {
			console.log(`🔄 Sincronizando mb.idCentroCustos: ${centroGravado} → ${centroSincronizado}`);
			statements.push(
				this.db
					.prepare(`UPDATE MovimentoBancario SET idCentroCustos = ?, atualizado_em = datetime('now') WHERE id = ?`)
					.bind(centroSincronizado, id),
			);
		}
		// D1 batch runs as one transaction: the rateio is never left half-written
		await this.db.batch(statements);
		console.log(`✅ ${centroCustosList.length} centro(s) de custos gravado(s)`);

		console.log('✅ Movimento atualizado com sucesso');
	}

	/**
	 * Statements that delete movements (max 98 ids) with their Resultado/centre rows. Financing
	 * installments are never deleted: the ones paid by these movements are reopened, the ones only
	 * generated by them are unlinked (ParcelaFinanciamentoRepository.statementsDesvincularMovimentos).
	 * Run as ONE db.batch (a transaction).
	 */
	private statementsExcluirMovimentos(ids: number[]): D1PreparedStatement[] {
		const placeholders = ids.map(() => '?').join(',');
		return [
			...this.parcelaRepo.statementsDesvincularMovimentos(ids),
			this.db.prepare(`DELETE FROM Resultado WHERE idMovimentoBancario IN (${placeholders})`).bind(...ids),
			this.db.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario IN (${placeholders})`).bind(...ids),
			this.db.prepare(`DELETE FROM MovimentoBancario WHERE id IN (${placeholders})`).bind(...ids),
		];
	}

	async deleteById(id: number): Promise<void> {
		if (isNaN(id) || id <= 0) {
			throw new Error(`ID inválido: ${id}`);
		}
		try {
			// One transaction: a failure never leaves the parcelas reopened with the movement still there
			await this.db.batch(this.statementsExcluirMovimentos([id]));
			console.log(`✅ Movimento ${id} excluído (parcelas pagas por ele reabertas, geradas desvinculadas)`);
		} catch (error) {
			console.error(`❌ Erro ao excluir o movimento ${id}:`, error);
			throw error;
		}
	}

	async deleteAllByContaCorrente(
		idContaCorrente: number,
	): Promise<{ excluidos: number; falhas: number; detalhesFalhas: string[] }> {
		console.log(`🚀🚀🚀 INICIANDO deleteAllByContaCorrente - ID: ${idContaCorrente} 🚀🚀🚀`);

		try {
			// SOLUÇÃO ULTRA SIMPLES - Excluir diretamente sem usar deleteById
			console.log(`🔍 Buscando movimentos para conta corrente ID: ${idContaCorrente}`);

			// Buscar todos os movimentos
			const movimentos = await this.db
				.prepare(
					`
				SELECT id FROM MovimentoBancario WHERE idContaCorrente = ?
			`,
				)
				.bind(idContaCorrente)
				.all();

			console.log(`📊 Resultado da query:`, movimentos);
			console.log(`📊 Tipo:`, typeof movimentos);
			console.log(`📊 Results:`, movimentos.results);
			console.log(`📊 Quantidade:`, movimentos.results?.length || 0);

			if (!movimentos.results || movimentos.results.length === 0) {
				console.log(`ℹ️ Nenhum movimento encontrado`);
				return { excluidos: 0, falhas: 0, detalhesFalhas: [] };
			}

			let excluidos = 0;
			let falhas = 0;
			const detalhesFalhas: string[] = [];

			// Excluir cada movimento diretamente sem usar deleteById
			for (let i = 0; i < movimentos.results.length; i++) {
				const movimento = movimentos.results[i];
				console.log(`🔄 Processando movimento ${i + 1}:`, movimento);

				// Extrair ID de forma ultra simples
				const movimentoId = movimento.id;
				console.log(`🔍 ID extraído: ${movimentoId} (tipo: ${typeof movimentoId})`);

				// Validar ID
				if (!movimentoId || isNaN(Number(movimentoId)) || Number(movimentoId) <= 0) {
					console.error(`❌ ID inválido: ${movimentoId}`);
					falhas++;
					detalhesFalhas.push(`ID inválido: ${movimentoId}`);
					continue;
				}

				const idNumerico = Number(movimentoId);
				console.log(`✅ ID numérico: ${idNumerico}`);

				try {
					// Resultado, centros, parcelas (reabertas/desvinculadas, nunca excluídas) e o movimento
					// numa única transação (D1 batch): uma falha não deixa nada pela metade.
					await this.db.batch(this.statementsExcluirMovimentos([idNumerico]));

					excluidos++;
					console.log(`✅ Movimento ${idNumerico} excluído com sucesso`);
				} catch (error) {
					console.error(`❌ Erro ao excluir movimento ${idNumerico}:`, error);
					falhas++;
					detalhesFalhas.push(`Movimento ${idNumerico}: ${error instanceof Error ? error.message : String(error)}`);
					continue;
				}
			}

			console.log(`🎉 Exclusão concluída: ${excluidos} movimentos excluídos, ${falhas} falha(s)`);
			return { excluidos, falhas, detalhesFalhas };
		} catch (error) {
			console.error(`❌ Erro geral:`, error);
			throw error;
		}
	}

	/** Tamanho do lote para bulk delete: D1 aceita no máximo 100 parâmetros por query (IN (...)). */
	private static readonly RESET_TESTE_BATCH_SIZE = 90;

	/**
	 * Remove movimentos para testes (por contas e opcionalmente ano).
	 * Usado pela opção "Zerar dados para testes".
	 * Faz exclusão em lote (poucas queries) para não estourar limite do worker.
	 */
	async deleteForResetTeste(contasIds: number[], ano?: number): Promise<{ excluidos: number }> {
		if (!contasIds || contasIds.length === 0) {
			return { excluidos: 0 };
		}
		const placeholders = contasIds.map(() => '?').join(',');
		let sql = `SELECT id FROM MovimentoBancario WHERE idContaCorrente IN (${placeholders})`;
		const params: any[] = [...contasIds];
		if (ano != null && !isNaN(ano)) {
			sql += ` AND CAST(strftime('%Y', dtMovimento) AS INTEGER) = ?`;
			params.push(ano);
		}
		const { results } = await this.db
			.prepare(sql)
			.bind(...params)
			.all();
		if (!results || results.length === 0) {
			return { excluidos: 0 };
		}
		const ids = (results as { id: number }[]).map((row) => Number(row.id)).filter((id) => !isNaN(id) && id > 0);
		if (ids.length === 0) {
			return { excluidos: 0 };
		}
		const batchSize = MovimentoBancarioRepository.RESET_TESTE_BATCH_SIZE;
		let excluidos = 0;
		for (let i = 0; i < ids.length; i += batchSize) {
			const chunk = ids.slice(i, i + batchSize);
			try {
				// One transaction per chunk (dependents + movements together; parcelas reopened/unlinked, never deleted)
				await this.db.batch(this.statementsExcluirMovimentos(chunk));
				excluidos += chunk.length;
			} catch (err) {
				console.error(`Erro ao excluir lote de movimentos (reset teste):`, err);
				throw err;
			}
		}
		return { excluidos };
	}

	async updateIdeagro(id: number, ideagro: boolean): Promise<void> {
		await this.db
			.prepare(
				`
		  UPDATE MovimentoBancario
		  SET ideagro = ?, atualizado_em = datetime('now')
		  WHERE id = ?
		`,
			)
			.bind(ideagro ? 1 : 0, id)
			.run();
	}

	/** Movements per lookup in updateContaMovimentosOFX: the identificador lookup binds 3 values each (D1 max 100). */
	private static readonly MUDAR_CONTA_LOTE = 30;

	/**
	 * "Editar conta" of an OFX import: moves the movements to `novaContaId`.
	 * - Resultado.idContaCorrente moves with each movement in the same transaction (never left behind);
	 * - a line the destination account already has (same identificador, bare or `|@c<conta>`) is NOT
	 *   moved (that would bypass the per-account dedupe and duplicate it): it is reported in
	 *   `movimentosDuplicados` with the id of the row that already exists there;
	 * - identificador_ofx stays globally unique: the `|@c<conta>` suffix is recomputed for the destination;
	 * - failures are reported per movement (`falhas`/`detalhesFalhas`), never swallowed;
	 * - when everything moved, HistoricoImportacaoOFX `idHistorico` follows the new account and its
	 *   skipped ids are replaced by the destination rows (so reopening it shows the right account).
	 */
	async updateContaMovimentosOFX(
		idMovimentos: number[],
		novaContaId: number,
		idHistorico?: number | null,
	): Promise<ResultadoMudancaContaOFX> {
		if (!idMovimentos || idMovimentos.length === 0) {
			throw new Error('Lista de IDs de movimentos não pode estar vazia');
		}
		const conta = Number(novaContaId);
		if (!Number.isInteger(conta) || conta <= 0) {
			throw new Error('ID da nova conta deve ser válido');
		}
		const ids = [...new Set(idMovimentos.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

		const resultado: ResultadoMudancaContaOFX = {
			atualizados: 0,
			jaNaConta: 0,
			naoEncontrados: 0,
			duplicados: 0,
			movimentosDuplicados: [],
			falhas: 0,
			detalhesFalhas: [],
			historicoAtualizado: false,
		};
		// Rows holding each identificador base (any conta), kept in sync with the moves planned in this run
		const ocupadosPorBase = new Map<string, Array<{ id: number; identificadorOfx: string; idContaCorrente: number }>>();

		const lote = MovimentoBancarioRepository.MUDAR_CONTA_LOTE;
		for (let i = 0; i < ids.length; i += lote) {
			const chunk = ids.slice(i, i + lote);
			const { results: movs } = await this.db
				.prepare(
					`SELECT id, idContaCorrente, identificador_ofx, dtMovimento, historico, valor
					 FROM MovimentoBancario WHERE id IN (${chunk.map(() => '?').join(',')})`,
				)
				.bind(...chunk)
				.all<{ id: number; idContaCorrente: number; identificador_ofx: string; dtMovimento: string; historico: string; valor: number }>();
			resultado.naoEncontrados += chunk.length - movs.length;

			const aMover = movs.filter((m) => {
				if (Number(m.idContaCorrente) !== conta) return true;
				resultado.jaNaConta++;
				return false;
			});
			const basesNovas = [...new Set(aMover.map((m) => stripContaSuffix(m.identificador_ofx)))].filter((b) => !ocupadosPorBase.has(b));
			if (basesNovas.length > 0) {
				const where = basesNovas.map(() => '(identificador_ofx = ? OR (identificador_ofx >= ? AND identificador_ofx < ?))').join(' OR ');
				const binds = basesNovas.flatMap((b) => {
					const range = contaSuffixRange(b);
					return [b, range.from, range.to];
				});
				const { results: ocupados } = await this.db
					.prepare(`SELECT id, identificador_ofx, idContaCorrente FROM MovimentoBancario WHERE ${where}`)
					.bind(...binds)
					.all<{ id: number; identificador_ofx: string; idContaCorrente: number }>();
				for (const b of basesNovas) ocupadosPorBase.set(b, []);
				for (const o of ocupados) {
					ocupadosPorBase.get(stripContaSuffix(o.identificador_ofx))?.push({
						id: Number(o.id),
						identificadorOfx: o.identificador_ofx,
						idContaCorrente: Number(o.idContaCorrente),
					});
				}
			}

			const planejados: Array<{
				id: number;
				base: string;
				antes: { identificadorOfx: string; idContaCorrente: number };
				statements: D1PreparedStatement[];
			}> = [];
			for (const m of aMover) {
				const id = Number(m.id);
				const base = stripContaSuffix(m.identificador_ofx);
				const ocupados = ocupadosPorBase.get(base) ?? [];
				const existente = ocupados.find((o) => o.id !== id && o.idContaCorrente === conta);
				if (existente) {
					resultado.duplicados++;
					resultado.movimentosDuplicados.push({
						id,
						idExistente: existente.id,
						dtMovimento: m.dtMovimento,
						historico: m.historico,
						valor: Number(m.valor),
					});
					continue;
				}
				const identificador = escolherIdentificadorParaConta(
					base,
					conta,
					ocupados.filter((o) => o.id !== id),
				);
				let proprio = ocupados.find((o) => o.id === id);
				if (!proprio) {
					proprio = { id, identificadorOfx: m.identificador_ofx, idContaCorrente: Number(m.idContaCorrente) };
					ocupados.push(proprio);
					ocupadosPorBase.set(base, ocupados);
				}
				const antes = { identificadorOfx: proprio.identificadorOfx, idContaCorrente: proprio.idContaCorrente };
				proprio.identificadorOfx = identificador;
				proprio.idContaCorrente = conta;
				planejados.push({
					id,
					base,
					antes,
					statements: [
						this.db
							.prepare(`UPDATE MovimentoBancario SET idContaCorrente = ?, identificador_ofx = ?, atualizado_em = datetime('now') WHERE id = ?`)
							.bind(conta, identificador, id),
						this.db.prepare(`UPDATE Resultado SET idContaCorrente = ? WHERE idMovimentoBancario = ?`).bind(conta, id),
					],
				});
			}
			if (planejados.length === 0) continue;

			try {
				// Whole chunk in one transaction; on failure retry movement by movement to isolate the bad one(s)
				await this.db.batch(planejados.flatMap((p) => p.statements));
				resultado.atualizados += planejados.length;
			} catch (erroLote) {
				console.warn('⚠️ Lote de mudança de conta falhou; repetindo movimento a movimento:', erroLote);
				for (const p of planejados) {
					try {
						await this.db.batch(p.statements);
						resultado.atualizados++;
					} catch (error) {
						resultado.falhas++;
						resultado.detalhesFalhas.push(`Movimento ${p.id}: ${error instanceof Error ? error.message : String(error)}`);
						const proprio = ocupadosPorBase.get(p.base)?.find((o) => o.id === p.id);
						if (proprio) Object.assign(proprio, p.antes);
					}
				}
			}
		}

		if (idHistorico && resultado.falhas === 0) {
			try {
				const row = await this.db
					.prepare(`SELECT idMovimentos FROM HistoricoImportacaoOFX WHERE id = ?`)
					.bind(idHistorico)
					.first<{ idMovimentos: string }>();
				if (row) {
					const substituto = new Map(resultado.movimentosDuplicados.map((d) => [d.id, d.idExistente]));
					const lista = (JSON.parse(row.idMovimentos || '[]') as unknown[]).map((v) => substituto.get(Number(v)) ?? Number(v));
					await this.db
						.prepare(`UPDATE HistoricoImportacaoOFX SET idContaCorrente = ?, idMovimentos = ?, atualizadoEm = ? WHERE id = ?`)
						.bind(conta, JSON.stringify(lista), new Date().toISOString(), idHistorico)
						.run();
					resultado.historicoAtualizado = true;
					resultado.idMovimentosHistorico = lista;
				}
			} catch (error) {
				resultado.falhas++;
				resultado.detalhesFalhas.push(`Histórico de importação ${idHistorico}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		console.log(
			`🔄 Mudança de conta para ${conta}: ${resultado.atualizados} movido(s), ${resultado.duplicados} já existente(s) na conta, ${resultado.falhas} falha(s)`,
		);
		return resultado;
	}

	/** Plano de contas das transferências (Parametros), ou null quando não configurado. */
	async getPlanoTransferencia(): Promise<number | null> {
		const { results } = await this.db.prepare(`SELECT idPlanoTransferenciaEntreContas FROM Parametros WHERE id = 1`).all();
		return parsePlanoTransferencia(results[0]?.idPlanoTransferenciaEntreContas);
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
	}): Promise<{ idSaida: number; idEntrada: number }> {
		try {
			const erroValidacao = validarTransferencia(data);
			if (erroValidacao) throw new TransferenciaInvalidaError(erroValidacao);

			const planoTransferencia = await this.getPlanoTransferencia();
			if (planoTransferencia === null) {
				throw new TransferenciaInvalidaError(
					'Plano de contas de transferência entre contas não configurado. Defina-o em Parâmetros antes de transferir.',
				);
			}

			const valorAbs = Math.abs(Number(data.valor));
			const ids = identificadoresTransferencia(crypto.randomUUID());
			const historicoSaida = `Transferência para a conta corrente ${data.contaDestinoDescricao} com descrição: ${data.descricao}`;
			const historicoEntrada = `Transferência da conta corrente ${data.contaOrigemDescricao} com descrição: ${data.descricao}`;
			const idPorIdentificador = `(SELECT id FROM MovimentoBancario WHERE identificador_ofx = ?)`;
			const insertMovimento = `
				INSERT INTO MovimentoBancario (
					dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo,
					ideagro, numero_documento, descricao, transf_origem, transf_destino,
					identificador_ofx, idUsuario, tipoMovimento, modalidadeMovimento,
					criado_em, atualizado_em
				)`;
			const insertResultado = `
				INSERT INTO Resultado (dtMovimento, idPlanoContas, idContaCorrente, idMovimentoBancario, idParcelaFinanciamento, valor, tipo)
				VALUES (?, ?, ?, ${idPorIdentificador}, NULL, ?, ?)`;

			// Both legs + their Resultado in ONE D1 batch (a transaction): all or nothing.
			// The exit id is resolved by its (unique) identificador inside the batch.
			await this.db.batch([
				this.db
					.prepare(
						`${insertMovimento}
						VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, null, ?, ?, ?, 'D', 'transferencia', datetime('now'), datetime('now'))`,
					)
					.bind(
						data.data,
						historicoSaida,
						planoTransferencia,
						data.contaOrigemId,
						-valorAbs,
						data.descricao,
						data.contaDestinoId,
						ids.saida,
						data.idUsuario ?? null,
					),
				this.db.prepare(insertResultado).bind(data.data, planoTransferencia, data.contaOrigemId, ids.saida, valorAbs, 'D'),
				this.db
					.prepare(
						`${insertMovimento}
						VALUES (?, ?, ?, ?, ?, 0, 0, null, ?, ${idPorIdentificador}, null, ?, ?, 'C', 'transferencia', datetime('now'), datetime('now'))`,
					)
					.bind(
						data.data,
						historicoEntrada,
						planoTransferencia,
						data.contaDestinoId,
						valorAbs,
						data.descricao,
						ids.saida,
						ids.entrada,
						data.idUsuario ?? null,
					),
				this.db.prepare(insertResultado).bind(data.data, planoTransferencia, data.contaDestinoId, ids.entrada, valorAbs, 'C'),
			]);

			const { results } = await this.db
				.prepare(`SELECT id, identificador_ofx FROM MovimentoBancario WHERE identificador_ofx IN (?, ?)`)
				.bind(ids.saida, ids.entrada)
				.all<{ id: number; identificador_ofx: string }>();
			const idDe = (ident: string) => Number(results.find((r) => r.identificador_ofx === ident)?.id);
			return { idSaida: idDe(ids.saida), idEntrada: idDe(ids.entrada) };
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
					idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
				FROM MovimentoBancario
				WHERE identificador_ofx = ?
			`,
			)
			.bind(identificadorOfx)
			.all();

		const result = results[0];
		if (!result) return null;

		const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);

		return {
			...this.mapRowToMovimento(result as Record<string, unknown>),
			resultadoList,
		};
	}

	/**
	 * OFX duplicate lookup scoped to ContaCorrente (never cross-account).
	 * Matches the bare identificador or its conta-suffixed form (`|@c<id>`, used when the
	 * same identificador already exists in another conta); the bare form wins.
	 */
	async getByIdentificadorOfxAndConta(
		identificadorOfx: string,
		idContaCorrente: number,
	): Promise<MovimentoBancario | null> {
		const base = stripContaSuffix(identificadorOfx);
		const range = contaSuffixRange(base);
		const { results } = await this.db
			.prepare(
				`
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
				FROM MovimentoBancario
				WHERE idContaCorrente = ?
				AND (identificador_ofx = ? OR (identificador_ofx >= ? AND identificador_ofx < ?))
				ORDER BY CASE WHEN identificador_ofx = ? THEN 0 ELSE 1 END, id ASC
				LIMIT 1
			`,
			)
			.bind(idContaCorrente, base, range.from, range.to, base)
			.all();

		const result = results[0];
		if (!result) return null;

		const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);

		return {
			...this.mapRowToMovimento(result as Record<string, unknown>),
			resultadoList,
		};
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
					   idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
				FROM MovimentoBancario
				WHERE id = ?
			`,
			)
			.bind(id)
			.all();

		const result = results[0];

		if (!result) return null;

		const resultadoList = await this.resultadoRepo.getByMovimento(id);
		const centroCustosList = await this.movimentoCentroCustosRepo.buscarPorMovimento(id);

		return {
			...this.mapRowToMovimento(result as Record<string, unknown>),
			resultadoList,
			centroCustosList,
		};
	}

	async getDetalhesFinanciamento(credorKey: string, mes: number, ano: number): Promise<FinanciamentoDetalhadoDTO[]> {
		const [credorType, credorIdStr] = credorKey.split('_');
		const credorId = parseInt(credorIdStr, 10);

		if (isNaN(credorId)) {
			return [];
		}

		// UTC on both ends: local-time Date + toISOString() shifts the day outside UTC
		const primeiroDiaMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
		const ultimoDiaMes = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);

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
			  AND pf.status = 'Liquidado'
			  AND DATE(COALESCE(pf.dt_liquidacao, pf.dt_vencimento)) BETWEEN ? AND ?
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

	/**
	 * Fluxo (centros) detail for the month across all lenders:
	 * - pagos: parcelas liquidated in the month (same rule as "Quitados")
	 * - contratados: contracts with dataContrato in the month and all their parcelas ("Créditos novos")
	 */
	async getDetalhesFinanciamentoMes(mes: number, ano: number, subtipo: 'pagos' | 'contratados'): Promise<FinanciamentoDetalhadoDTO[]> {
		const pad = (n: number) => String(n).padStart(2, '0');
		const inicio = `${ano}-${pad(mes + 1)}-01`;
		const fim = mes === 11 ? `${ano + 1}-01-01` : `${ano}-${pad(mes + 2)}-01`;
		const filtro =
			subtipo === 'pagos'
				? `pf.status = 'Liquidado' AND COALESCE(pf.dt_liquidacao, pf.dt_vencimento) >= ? AND COALESCE(pf.dt_liquidacao, pf.dt_vencimento) < ?`
				: `f.dataContrato >= ? AND f.dataContrato < ?`;

		const { results } = await this.db
			.prepare(
				`
				SELECT
					f.id as idFinanciamento, f.numeroContrato, f.valor as valorFinanciamento, f.responsavel,
					p.nome as nomePessoa, b.nome as nomeBanco,
					pf.id as idParcela, pf.numParcela, pf.valor as valorParcela, pf.dt_vencimento, pf.dt_liquidacao, pf.status
				FROM parcelaFinanciamento pf
				JOIN Financiamento f ON pf.idFinanciamento = f.id
				LEFT JOIN Pessoa p ON f.idPessoa = p.id
				LEFT JOIN Banco b ON f.idBanco = b.id
				WHERE ${filtro}
				ORDER BY b.nome, f.numeroContrato, pf.numParcela
			`,
			)
			.bind(inicio, fim)
			.all();

		const porContrato = new Map<number, FinanciamentoDetalhadoDTO>();
		for (const row of results as any[]) {
			if (!porContrato.has(row.idFinanciamento)) {
				porContrato.set(row.idFinanciamento, {
					id: row.idFinanciamento,
					numeroContrato: row.numeroContrato,
					valorTotal: row.valorFinanciamento,
					credor: row.nomeBanco || row.nomePessoa || 'Não identificado',
					tomador: row.responsavel || undefined,
					parcelas: [],
				});
			}
			porContrato.get(row.idFinanciamento)!.parcelas.push({
				id: row.idParcela,
				numParcela: row.numParcela,
				valor: row.valorParcela,
				dt_vencimento: row.dt_vencimento,
				dt_liquidacao: row.dt_liquidacao,
				status: row.status,
			});
		}
		return Array.from(porContrato.values());
	}

	/** Retorna financiamentos contratados no mês/ano (dataContrato no período) para o credor, para detalhamento da linha "Contratados". */
	async getDetalhesFinanciamentoContratados(credorKey: string, mes: number, ano: number): Promise<FinanciamentoDetalhadoDTO[]> {
		const [credorType, credorIdStr] = credorKey.split('_');
		const credorId = parseInt(credorIdStr, 10);

		if (isNaN(credorId)) {
			return [];
		}

		// UTC on both ends: local-time Date + toISOString() shifts the day outside UTC
		const primeiroDiaMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
		const ultimoDiaMes = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);

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
				f.id,
				f.numeroContrato,
				f.valor,
				f.totalJuros,
				p.nome as nomePessoa,
				b.nome as nomeBanco
			FROM Financiamento f
			LEFT JOIN Pessoa p ON f.idPessoa = p.id
			LEFT JOIN Banco b ON f.idBanco = b.id
			WHERE ${credorField} = ?
			  AND DATE(f.dataContrato) BETWEEN ? AND ?
			ORDER BY f.dataContrato, f.id
		`;

		const { results } = await this.db.prepare(sql).bind(credorId, primeiroDiaMes, ultimoDiaMes).all();

		return (results as any[]).map((row) => ({
			id: row.id,
			numeroContrato: row.numeroContrato,
			valorTotal: (row.valor || 0) + (row.totalJuros || 0),
			credor: row.nomePessoa || row.nomeBanco || 'Não identificado',
			parcelas: [],
		}));
	}

	async getByIds(ids: number[]): Promise<MovimentoBancario[]> {
		if (ids.length === 0) return [];

		console.log(`🔍 Repository: Buscando ${ids.length} movimentos por IDs`);

		// Validar se não há muitos IDs (limite de segurança)
		if (ids.length > 100) {
			throw new Error(`Limite de IDs excedido: ${ids.length} > 100`);
		}

		// Validação adicional para SQLite (limite conservador)
		if (ids.length > 50) {
			console.warn(`⚠️ Repository: Muitos IDs (${ids.length}), pode causar problemas com SQLite`);
		}

		const placeholders = ids.map(() => '?').join(',');
		const query = `
				SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro,
					   numero_documento, descricao, transf_origem, transf_destino, identificador_ofx,
					   criado_em, atualizado_em, idUsuario, tipoMovimento, modalidadeMovimento,
					   idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
				FROM MovimentoBancario
				WHERE id IN (${placeholders})
				ORDER BY dtMovimento ASC
		`;

		console.log(`🔍 Repository: Executando query com ${ids.length} placeholders`);

		// Alertar se estiver próximo do limite do SQLite
		if (ids.length > 50) {
			console.warn(`⚠️ Repository: ${ids.length} placeholders pode estar próximo do limite do SQLite`);
		}

		try {
			const { results } = await this.db
				.prepare(query)
				.bind(...ids)
				.all();

			console.log(`🔍 Repository: Query executada, ${results.length} resultados encontrados`);

			const idsMovimento = (results as Record<string, unknown>[]).map((r) => r.id as number);
			const [resultadosMap, centrosCustosMap] = await Promise.all([
				this.resultadoRepo.getByMovimentos(idsMovimento),
				this.movimentoCentroCustosRepo.buscarPorMovimentos(idsMovimento),
			]);

			const movimentos = (results as Record<string, unknown>[]).map((result) => {
				const id = result.id as number;
				return {
					id,
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
					idCentroCustos: result.idCentroCustos as number | undefined,
					resultadoList: resultadosMap.get(id) || [],
					centroCustosList: centrosCustosMap.get(id) || [],
				};
			});

			console.log(`✅ Repository: Processamento concluído, retornando ${movimentos.length} movimentos`);
			return movimentos;
		} catch (error) {
			console.error('🔥 Repository: Erro ao executar query getByIds:', {
				message: error instanceof Error ? error.message : 'Erro desconhecido',
				stack: error instanceof Error ? error.stack : undefined,
				idsCount: ids.length,
				query: query.substring(0, 100) + '...',
			});
			throw error;
		}
	}

	/**
	 * Status filter shared by the Conciliação list/exports and the reports: the single "pendente"
	 * rule (utils/isMovimentoPendenteConcilacao). 'pendentes' / 'conciliados'; anything else = todos.
	 */
	private sqlFiltroStatus(status: string | undefined, alias = 'mb'): string | null {
		if (status === 'pendentes') return sqlMovimentoPendente(alias);
		if (status === 'conciliados') return sqlMovimentoClassificado(alias);
		return null;
	}

	private statusFiltroNome(status: string | undefined): 'Pendentes' | 'Conciliados' | 'Todos' {
		return status === 'pendentes' ? 'Pendentes' : status === 'conciliados' ? 'Conciliados' : 'Todos';
	}

	/** Plan descriptions of the movement: own plan, else the Resultado plans (split) joined by ' / '. */
	private sqlPlanoDescricao(alias: string): string {
		return `COALESCE(
			(SELECT pc_d.descricao FROM PlanoContas pc_d WHERE pc_d.id = ${alias}.idPlanoContas),
			(SELECT GROUP_CONCAT(pc_r.descricao, ' / ') FROM Resultado r_d
				INNER JOIN PlanoContas pc_r ON pc_r.id = r_d.idPlanoContas
				WHERE r_d.idMovimentoBancario = ${alias}.id)
		)`;
	}

	/** Normalized 'C'/'D' (legacy rows may have tipoMovimento NULL → sign of valor). */
	private tipoMovimentoNormalizado(mov: { tipoMovimento?: string | null; valor?: number | string | null }): 'C' | 'D' {
		if (mov.tipoMovimento === 'C' || mov.tipoMovimento === 'D') return mov.tipoMovimento;
		return Number(mov.valor) >= 0 ? 'C' : 'D';
	}

	/** dd/mm/aaaa read from the 'YYYY-MM-DD…' text (no Date/timezone conversion). */
	private dataBR(data: unknown): string {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ''));
		if (m) return `${m[3]}/${m[2]}/${m[1]}`;
		const d = new Date(String(data ?? ''));
		return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
	}

	private statusExportacaoConciliacao(status: string | undefined): string {
		return status === 'pendentes' ? 'Apenas Pendentes' : status === 'conciliados' ? 'Apenas Conciliados' : 'Todos os Movimentos';
	}

	async getPaginado(filters: {
		page: number;
		limit: number;
		contaId?: number;
		dataInicio?: string;
		dataFim?: string;
		status?: string;
		planosIds?: number[];
		centrosIds?: number[];
		/** Substring em histórico (case-insensitive), alinhado ao filtro do OFX */
		historicoContem?: string;
		/** Busca textual no valor (ex.: trecho do valor formatado), alinhado ao filtro do OFX */
		valorBusca?: string;
	}): Promise<{
		movimentos: MovimentoBancario[];
		total: number;
		totalPages: number;
		currentPage: number;
		hasNext: boolean;
		hasPrev: boolean;
	}> {
		try {
			console.log('🔍 Repository: Iniciando busca paginada com filtros:', filters);

			// Construir query base
			let whereConditions: string[] = [];
			let params: any[] = [];

			if (filters.contaId) {
				whereConditions.push('mb.idContaCorrente = ?');
				params.push(filters.contaId);
			}

			if (filters.dataInicio) {
				// Usar DATE() para comparar apenas a parte da data, garantindo inclusão do dia inteiro
				// Isso resolve problemas de timezone e formato (ex: '2025-11-06T00:00:00.000Z' vs '2025-11-06 23:59:59')
				whereConditions.push('DATE(mb.dtMovimento) >= DATE(?)');
				params.push(filters.dataInicio);
			}

			if (filters.dataFim) {
				// Usar DATE() para comparar apenas a parte da data, garantindo inclusão do dia inteiro
				// Isso resolve problemas de timezone e formato (ex: '2025-11-06T00:00:00.000Z' vs '2025-11-06 23:59:59')
				whereConditions.push('DATE(mb.dtMovimento) <= DATE(?)');
				params.push(filters.dataFim);
			}

			// Regra única de pendente (isMovimentoPendenteConcilacao): o mesmo WHERE vale para a lista e o COUNT
			const filtroStatusPaginado = this.sqlFiltroStatus(filters.status, 'mb');
			if (filtroStatusPaginado) {
				whereConditions.push(filtroStatusPaginado);
			}

			if (filters.planosIds && filters.planosIds.length > 0) {
				// Plano próprio ou qualquer linha de Resultado (movimentos rateados têm idPlanoContas NULL)
				const placeholders = filters.planosIds.map(() => '?').join(',');
				whereConditions.push(`(mb.idPlanoContas IN (${placeholders})
					OR EXISTS (SELECT 1 FROM Resultado r_f WHERE r_f.idMovimentoBancario = mb.id AND r_f.idPlanoContas IN (${placeholders})))`);
				params.push(...filters.planosIds, ...filters.planosIds);
			}

			if (filters.centrosIds && filters.centrosIds.length > 0) {
				// Centro próprio ou qualquer linha de rateio em MovimentoCentroCustos
				const placeholders = filters.centrosIds.map(() => '?').join(',');
				whereConditions.push(`(mb.idCentroCustos IN (${placeholders})
					OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc_f WHERE mcc_f.idMovimentoBancario = mb.id AND mcc_f.idCentroCustos IN (${placeholders})))`);
				params.push(...filters.centrosIds, ...filters.centrosIds);
			}

			const historicoTrim = filters.historicoContem?.trim();
			if (historicoTrim) {
				whereConditions.push('instr(LOWER(IFNULL(mb.historico, "")), LOWER(?)) > 0');
				params.push(historicoTrim);
			}

			const valorTrim = filters.valorBusca?.trim();
			if (valorTrim) {
				// Substring no valor bruto e na forma com vírgula decimal (similar a formatarMoeda + includes)
				whereConditions.push(`(
					instr(LOWER(CAST(mb.valor AS TEXT)), LOWER(?)) > 0
					OR instr(LOWER(REPLACE(CAST(ABS(CAST(mb.valor AS REAL)) AS TEXT), '.', ',')), LOWER(?)) > 0
				)`);
				params.push(valorTrim, valorTrim);
			}

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query para contar total
			const countQuery = `
				SELECT COUNT(*) as total
				FROM MovimentoBancario mb
				${whereClause}
			`;

			const countResult = await this.db
				.prepare(countQuery)
				.bind(...params)
				.first();

			const total = (countResult?.total as number) || 0;
			const totalPages = Math.ceil(total / filters.limit);
			const offset = (filters.page - 1) * filters.limit;

			console.log(`📊 Repository: Total de registros encontrados: ${total}, páginas: ${totalPages}`);

			// Query principal com paginação
			const mainQuery = `
				SELECT 
					mb.*
				FROM MovimentoBancario mb
				${whereClause}
				ORDER BY mb.dtMovimento DESC
				LIMIT ? OFFSET ?
			`;

			const { results } = await this.db
				.prepare(mainQuery)
				.bind(...params, filters.limit, offset)
				.all();

			// Processar resultados e carregar resultadoList e centroCustosList
			const movimentos = await Promise.all(
				results.map(async (result: any) => {
					// Carregar resultadoList e centroCustosList usando os repositórios
					const resultadoList = await this.resultadoRepo.getByMovimento(result.id as number);
					const centroCustosList = await this.movimentoCentroCustosRepo.buscarPorMovimento(result.id as number);

					return {
						id: result.id as number,
						dtMovimento: result.dtMovimento as string,
						historico: result.historico as string,
						valor: result.valor as number,
						idPlanoContas: result.idPlanoContas as number | undefined,
						saldo: result.saldo as number,
						ideagro: result.ideagro === 1,
						idContaCorrente: result.idContaCorrente as number,
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
						idCentroCustos: result.idCentroCustos as number | undefined,
						resultadoList: resultadoList,
						centroCustosList: centroCustosList,
					};
				}),
			);

			console.log(`✅ Repository: Retornando ${movimentos.length} movimentos da página ${filters.page}`);

			return {
				movimentos,
				total,
				totalPages,
				currentPage: filters.page,
				hasNext: filters.page < totalPages,
				hasPrev: filters.page > 1,
			};
		} catch (error) {
			console.error('🔥 Repository: Erro na busca paginada:', error);
			throw error;
		}
	}

	/**
	 * WHERE of the Conciliação exports: the same filters and semantics as getPaginado (conta, período, status,
	 * planos and centros including split movements, "histórico contém", valor), so the file matches the screen.
	 */
	private whereExportacaoConciliacao(filters: FiltrosExportacaoConciliacao): { whereClause: string; params: Array<string | number> } {
		const whereConditions: string[] = [];
		const params: Array<string | number> = [];

		if (filters.contaId) {
			whereConditions.push('mb.idContaCorrente = ?');
			params.push(filters.contaId);
		}

		if (filters.dataInicio) {
			whereConditions.push('DATE(mb.dtMovimento) >= DATE(?)');
			params.push(filters.dataInicio);
		}

		if (filters.dataFim) {
			whereConditions.push('DATE(mb.dtMovimento) <= DATE(?)');
			params.push(filters.dataFim);
		}

		const filtroStatus = this.sqlFiltroStatus(filters.status, 'mb');
		if (filtroStatus) {
			whereConditions.push(filtroStatus);
		}

		if (filters.planosIds && filters.planosIds.length > 0) {
			// Plano próprio ou qualquer linha de Resultado (movimentos rateados têm idPlanoContas NULL)
			const placeholders = filters.planosIds.map(() => '?').join(',');
			whereConditions.push(`(mb.idPlanoContas IN (${placeholders})
				OR EXISTS (SELECT 1 FROM Resultado r_f WHERE r_f.idMovimentoBancario = mb.id AND r_f.idPlanoContas IN (${placeholders})))`);
			params.push(...filters.planosIds, ...filters.planosIds);
		}

		if (filters.centrosIds && filters.centrosIds.length > 0) {
			// Centro próprio ou qualquer linha de rateio em MovimentoCentroCustos
			const placeholders = filters.centrosIds.map(() => '?').join(',');
			whereConditions.push(`(mb.idCentroCustos IN (${placeholders})
				OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc_f WHERE mcc_f.idMovimentoBancario = mb.id AND mcc_f.idCentroCustos IN (${placeholders})))`);
			params.push(...filters.centrosIds, ...filters.centrosIds);
		}

		const historicoTrim = filters.historicoContem?.trim();
		if (historicoTrim) {
			whereConditions.push('instr(LOWER(IFNULL(mb.historico, "")), LOWER(?)) > 0');
			params.push(historicoTrim);
		}

		const valorTrim = filters.valorBusca?.trim();
		if (valorTrim) {
			whereConditions.push(`(
				instr(LOWER(CAST(mb.valor AS TEXT)), LOWER(?)) > 0
				OR instr(LOWER(REPLACE(CAST(ABS(CAST(mb.valor AS REAL)) AS TEXT), '.', ',')), LOWER(?)) > 0
			)`);
			params.push(valorTrim, valorTrim);
		}

		return { whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '', params };
	}

	/** Header lines of the exports for the filters beyond período/status (plan/centre names, histórico, valor). */
	private async linhasFiltrosExtrasExportacao(filters: FiltrosExportacaoConciliacao): Promise<string[]> {
		const nomes = async (tabela: 'PlanoContas' | 'CentroCustos', ids: number[]) => {
			const { results } = await this.db
				.prepare(`SELECT descricao FROM ${tabela} WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY descricao`)
				.bind(...ids)
				.all<{ descricao: string }>();
			return results.map((r) => r.descricao).join(', ') || ids.join(', ');
		};
		const linhas: string[] = [];
		if (filters.planosIds && filters.planosIds.length > 0) linhas.push(`Planos de contas: ${await nomes('PlanoContas', filters.planosIds)}`);
		if (filters.centrosIds && filters.centrosIds.length > 0) linhas.push(`Centros de custos: ${await nomes('CentroCustos', filters.centrosIds)}`);
		if (filters.historicoContem?.trim()) linhas.push(`Histórico contém: "${filters.historicoContem.trim()}"`);
		if (filters.valorBusca?.trim()) linhas.push(`Valor contém: ${filters.valorBusca.trim()}`);
		return linhas;
	}

	async exportToExcel(filters: FiltrosExportacaoConciliacao): Promise<Buffer> {
		try {
			console.log('📊 Repository: Iniciando exportação Excel com filtros:', filters);

			const { whereClause, params } = this.whereExportacaoConciliacao(filters);

			// Query para buscar todos os movimentos que atendem aos filtros
			const query = `
				SELECT
					mb.*,
					${this.sqlPlanoDescricao('mb')} as planoDescricao,
					CASE WHEN ${sqlMovimentoPendente('mb')} THEN 'Pendente' ELSE 'Conciliado' END as statusConciliacao,
					b.nome as bancoNome,
					p.nome as pessoaNome,
					cc.numConta,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN Banco b ON mb.idBanco = b.id
				LEFT JOIN Pessoa p ON mb.idPessoa = p.id
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				${whereClause}
				ORDER BY mb.dtMovimento DESC
			`;

			const { results } = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			console.log(`📊 Repository: Encontrados ${results.length} movimentos para exportação`);

			// Preparar dados para Excel
			const dadosParaExportar = results.map((mov: any) => ({
				'Data do Movimento': this.dataBR(mov.dtMovimento),
				Histórico: mov.historico,
				Tipo: this.tipoMovimentoNormalizado(mov) === 'C' ? 'Crédito' : 'Débito',
				Modalidade: mov.modalidadeMovimento || 'Padrão',
				'Plano de Contas': mov.planoDescricao || 'Não definido',
				'Valor R$': mov.valor,
				IdeAgri: mov.ideagro ? 'Sim' : 'Não',
				Pessoa: mov.pessoaNome || '',
				Banco: mov.bancoNome || '',
				Parcelado: mov.parcelado ? 'Sim' : 'Não',
				'Nº Documento': mov.modalidadeMovimento === 'financiamento' ? mov.numero_documento || '' : '',
				Conta: `${mov.numConta || ''} - ${mov.responsavel || ''}`,
				Status: mov.statusConciliacao,
			}));

			// Criar workbook
			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.json_to_sheet(dadosParaExportar);

			// Adicionar cabeçalho com informações da exportação
			const filtrosExtras = (await this.linhasFiltrosExtrasExportacao(filters)).map((linha) => {
				const i = linha.indexOf(': ');
				return [linha.slice(0, i + 1), linha.slice(i + 2)];
			});
			const header = [
				['Exportado em:', new Date().toLocaleString('pt-BR')],
				['Período:', `${this.dataBR(filters.dataInicio) || 'Início'} até ${this.dataBR(filters.dataFim) || 'Fim'}`],
				['Status:', this.statusExportacaoConciliacao(filters.status)],
				...filtrosExtras,
				['Total de registros:', results.length],
				[],
			];

			const headerWs = XLSX.utils.aoa_to_sheet(header);
			// The table starts right after the header (its size depends on the filters used)
			XLSX.utils.sheet_add_json(headerWs, dadosParaExportar, { origin: `A${header.length + 1}`, skipHeader: false });

			XLSX.utils.book_append_sheet(wb, headerWs, 'Movimentos');

			// Converter para buffer
			const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

			console.log(`✅ Repository: Excel gerado com sucesso, ${excelBuffer.length} bytes`);

			return excelBuffer;
		} catch (error) {
			console.error('🔥 Repository: Erro na exportação Excel:', error);
			throw error;
		}
	}

	async exportToPDF(filters: FiltrosExportacaoConciliacao): Promise<Uint8Array> {
		try {
			console.log('🔍 Repository: Iniciando exportação PDF com filtros:', filters);

			const { whereClause, params } = this.whereExportacaoConciliacao(filters);

			// Query para buscar dados com informações da conta
			const query = `
				SELECT
					mb.*,
					cc.numConta,
					b.nome as bancoNome,
					${this.sqlPlanoDescricao('mb')} as planoDescricao,
					CASE WHEN ${sqlMovimentoPendente('mb')} THEN 'Pendente' ELSE 'Conciliado' END as statusConciliacao,
					p.nome as pessoaNome,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				LEFT JOIN Pessoa p ON mb.idPessoa = p.id
				${whereClause}
				ORDER BY mb.dtMovimento DESC
			`;

			const { results } = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			console.log(`📊 Repository: ${results.length} movimentos encontrados para PDF`);

			// Importar bibliotecas PDF
			const jsPDF = (await import('jspdf')).default;
			const autoTable = (await import('jspdf-autotable')).default;

			// Criar documento PDF
			const doc = new jsPDF('l', 'mm', 'a4'); // Landscape para mais espaço

			// Configurar fonte
			doc.setFont('helvetica');

			// Cabeçalho do documento
			doc.setFontSize(20);
			doc.setTextColor(40, 40, 40);
			doc.text('RELATÓRIO DE MOVIMENTOS BANCÁRIOS', 20, 20);

			// Informações da conta e período
			doc.setFontSize(12);
			doc.setTextColor(60, 60, 60);

			let yPos = 35;
			if (results.length > 0) {
				const primeiroMovimento = results[0] as any;
				doc.text(`Conta: ${primeiroMovimento.numConta} - ${primeiroMovimento.bancoNome}`, 20, yPos);
				yPos += 8;
				doc.text(`Responsável: ${primeiroMovimento.responsavel || 'N/A'}`, 20, yPos);
				yPos += 8;
			}

			doc.text(`Período: ${this.dataBR(filters.dataInicio) || 'Início'} até ${this.dataBR(filters.dataFim) || 'Fim'}`, 20, yPos);
			yPos += 8;
			doc.text(`Status: ${this.statusExportacaoConciliacao(filters.status)}`, 20, yPos);
			yPos += 8;
			// Plan/centre/histórico/valor filters of the screen (long lists wrap inside the page width)
			for (const linha of await this.linhasFiltrosExtrasExportacao(filters)) {
				const partes = doc.splitTextToSize(linha, 255) as string[];
				doc.text(partes, 20, yPos);
				yPos += 6 * partes.length + 2;
			}
			doc.text(`Total de movimentos: ${results.length}`, 20, yPos);
			yPos += 8;
			doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, yPos);
			yPos += 8;
			doc.text(`Gerado por: Sistema Financeiro Fazenda Lageado`, 20, yPos);

			// Preparar dados para a tabela
			const dadosTabela = results.map((result: any) => [
				this.dataBR(result.dtMovimento),
				result.historico || '',
				this.tipoMovimentoNormalizado(result) === 'C' ? 'Crédito' : 'Débito',
				`R$ ${Math.abs(result.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
				result.planoDescricao || 'Não conciliado',
				result.pessoaNome || '',
				result.statusConciliacao || 'Pendente',
			]);

			// Configurar tabela
			autoTable(doc, {
				startY: yPos + 10,
				head: [['Data', 'Histórico', 'Tipo', 'Valor', 'Plano de Contas', 'Pessoa', 'Status']],
				body: dadosTabela,
				theme: 'grid',
				headStyles: {
					fillColor: [41, 128, 185],
					textColor: 255,
					fontSize: 10,
					fontStyle: 'bold',
				},
				bodyStyles: {
					fontSize: 9,
					textColor: [50, 50, 50],
				},
				alternateRowStyles: {
					fillColor: [245, 245, 245],
				},
				margin: { left: 20, right: 20 },
				tableWidth: 'auto',
				columnStyles: {
					0: { cellWidth: 20 }, // Data
					1: { cellWidth: 50 }, // Histórico
					2: { cellWidth: 15 }, // Tipo
					3: { cellWidth: 20 }, // Valor
					4: { cellWidth: 35 }, // Plano de Contas
					5: { cellWidth: 25 }, // Pessoa
					6: { cellWidth: 20 }, // Status
				},
				didDrawPage: (data) => {
					// Rodapé em cada página
					doc.setFontSize(8);
					doc.setTextColor(100, 100, 100);
					doc.text(
						`Página ${data.pageNumber} - Sistema Financeiro Fazenda Lageado`,
						data.settings.margin.left,
						doc.internal.pageSize.height - 10,
					);
				},
			});

			// Converter para buffer (compatível com Cloudflare Workers)
			const pdfArrayBuffer = doc.output('arraybuffer');
			const pdfBuffer = new Uint8Array(pdfArrayBuffer);

			console.log(`✅ Repository: PDF gerado com sucesso, ${pdfBuffer.length} bytes`);

			return pdfBuffer as any; // Cast para compatibilidade com tipo Buffer
		} catch (error) {
			console.error('🔥 Repository: Erro na exportação PDF:', error);
			throw error;
		}
	}

	/**
	 * Movements of the period with their cost-centre allocations, for the centre reports.
	 * Base = Dashboard/Fluxo (utils/sqlBaseResultado): transfers and children of plano 170 never enter;
	 * financing enters only when `incluirFinanciamento` (flagged `ehFinanciamento`, reported apart).
	 * Allocation: MovimentoCentroCustos rows (rateio) or, without them, mb.idCentroCustos with the
	 * movement value — values are absolute, like the Dashboard. Unknown centres are ignored (Dashboard
	 * INNER JOINs them). `pendente` follows the single rule (isMovimentoPendenteConcilacao).
	 */
	private async carregarMovimentosComCentros(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		incluirFinanciamento: boolean;
	}): Promise<
		Array<{
			mov: any;
			tipoMov: 'C' | 'D';
			ehFinanciamento: boolean;
			pendente: boolean;
			centros: Array<{ id: number; descricao: string; tipo: string | null; tipoReceitaDespesa: string | null; valor: number }>;
		}>
	> {
		const planos = await carregarPlanosExclusaoResultado(this.db);
		const fora = sqlMovimentoForaDosResultados('mb', planos);
		const fin = sqlMovimentoFinanciamento('mb', planos);

		const where: string[] = [`NOT ${fora.sql}`];
		const whereBind: Array<string | number> = [...fora.bind];
		if (!filters.incluirFinanciamento) {
			where.push(`NOT ${fin.sql}`);
			whereBind.push(...fin.bind);
		}
		const filtroStatus = this.sqlFiltroStatus(filters.status, 'mb');
		if (filtroStatus) where.push(filtroStatus);
		if (filters.contaId) {
			where.push('mb.idContaCorrente = ?');
			whereBind.push(filters.contaId);
		}
		const periodo = sqlPeriodo('mb.dtMovimento', filters.dataInicio, filters.dataFim);
		where.push(...periodo.sql);
		whereBind.push(...periodo.bind);

		const query = `
			SELECT
				mb.id,
				mb.dtMovimento,
				mb.historico,
				mb.valor,
				mb.tipoMovimento,
				mb.idPlanoContas,
				mb.idCentroCustos,
				mb.idFinanciamento,
				mb.modalidadeMovimento,
				mb.idPessoa,
				mb.idBanco,
				mb.idContaCorrente,
				${this.sqlPlanoDescricao('mb')} as planoDescricao,
				CASE WHEN ${fin.sql} THEN 1 ELSE 0 END as ehFinanciamento,
				CASE WHEN ${sqlMovimentoPendente('mb')} THEN 1 ELSE 0 END as pendente,
				p.nome as pessoaNome,
				b.nome as bancoNome,
				b.codigo as bancoCodigo,
				cc.numConta,
				cc.numCartao,
				cc.agencia,
				cc.responsavel
			FROM MovimentoBancario mb
			LEFT JOIN Pessoa p ON mb.idPessoa = p.id
			LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
			LEFT JOIN Banco b ON cc.idBanco = b.id
			WHERE ${where.join(' AND ')}
			ORDER BY mb.dtMovimento DESC, mb.id DESC
		`;

		const { results } = await this.db
			.prepare(query)
			.bind(...fin.bind, ...whereBind)
			.all();
		const rows = results as any[];

		const [rateios, centrosRes] = await Promise.all([
			this.movimentoCentroCustosRepo.buscarPorMovimentos(rows.map((r) => r.id as number)),
			this.db.prepare(`SELECT id, descricao, tipo, tipoReceitaDespesa FROM CentroCustos`).all(),
		]);
		const centrosInfo = new Map<number, { id: number; descricao: string; tipo: string | null; tipoReceitaDespesa: string | null }>();
		for (const c of centrosRes.results as any[]) {
			centrosInfo.set(Number(c.id), {
				id: Number(c.id),
				descricao: c.descricao as string,
				tipo: (c.tipo as string | null) ?? null,
				tipoReceitaDespesa: (c.tipoReceitaDespesa as string | null) ?? null,
			});
		}

		return rows.map((mov) => {
			const lista = rateios.get(mov.id) || [];
			const alocacoes =
				lista.length > 0
					? lista.map((r) => ({ idCentro: Number(r.idCentroCustos), valor: Math.abs(Number(r.valor) || 0) }))
					: mov.idCentroCustos != null
						? [{ idCentro: Number(mov.idCentroCustos), valor: Math.abs(Number(mov.valor) || 0) }]
						: [];
			const centros = alocacoes.flatMap((a) => {
				const info = centrosInfo.get(a.idCentro);
				return info ? [{ ...info, valor: a.valor }] : [];
			});
			return {
				mov,
				tipoMov: this.tipoMovimentoNormalizado(mov),
				ehFinanciamento: Number(mov.ehFinanciamento) === 1,
				pendente: Number(mov.pendente) === 1,
				centros,
			};
		});
	}

	/**
	 * Cadastro › Centro de Custos › "Movimentos por centro de custos": same base and allocation as the
	 * Relatório de Centro de Custos / Dashboard (credits → receitas, debits → despesas, rateio split by
	 * centre, credits classified only by centre included). Date-only period keeps the whole last day.
	 */
	async getMovimentosPorCentroCustos(filters?: { dataInicio?: string; dataFim?: string }) {
		try {
			const linhas = await this.carregarMovimentosComCentros({
				dataInicio: filters?.dataInicio,
				dataFim: filters?.dataFim,
				incluirFinanciamento: false,
			});

			const agrupados = new Map<
				number,
				{
					idCentroCustos: number;
					descricao: string;
					totalReceitas: number;
					totalDespesas: number;
					saldoLiquido: number;
					movimentos: any[];
				}
			>();
			const arred = (v: number) => Math.round(v * 100) / 100;

			// Oldest first (as before)
			for (const { mov, tipoMov, pendente, centros } of [...linhas].reverse()) {
				for (const centro of centros) {
					if (!agrupados.has(centro.id)) {
						agrupados.set(centro.id, {
							idCentroCustos: centro.id,
							descricao: centro.descricao,
							totalReceitas: 0,
							totalDespesas: 0,
							saldoLiquido: 0,
							movimentos: [],
						});
					}
					const grupo = agrupados.get(centro.id)!;
					const contaFormatada = `${mov.bancoNome || 'Banco'} - ${mov.numConta || mov.numCartao || '???'}${mov.responsavel ? ` - ${mov.responsavel}` : ''}`;
					grupo.movimentos.push({
						id: mov.id,
						data: mov.dtMovimento,
						historico: mov.historico,
						// signed share of this centre (credit +, debit −), like the movement value
						valor: tipoMov === 'C' ? centro.valor : -centro.valor,
						tipo: tipoMov,
						idPlanoContas: mov.idPlanoContas,
						planoDescricao: mov.planoDescricao ?? undefined,
						pendente,
						contaBancaria: contaFormatada,
					});
					// Totals are absolute values: saldo = receitas − despesas. Summed unrounded (percentage
					// rateios store fractions of a cent) and rounded once at the end, like the Dashboard.
					if (tipoMov === 'C') grupo.totalReceitas += centro.valor;
					else grupo.totalDespesas += centro.valor;
				}
			}

			return Array.from(agrupados.values())
				.map((grupo) => ({
					...grupo,
					totalReceitas: arred(grupo.totalReceitas),
					totalDespesas: arred(grupo.totalDespesas),
					saldoLiquido: arred(grupo.totalReceitas - grupo.totalDespesas),
				}))
				.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
		} catch (error) {
			console.error('Erro ao buscar movimentos por centro de custos:', error);
			throw error;
		}
	}

	/**
	 * Relatório de Centro de Custos. Totals must equal the Dashboard and the Fluxo de Caixa (centros):
	 * - group by the movement direction: credit → Receitas (any centre), debit → Despesas, split in
	 *   custeio (centre tipo CUSTEIO) / investimento (any other tipo) — see `centro.subtipoDespesa`;
	 * - transfers and children of plano 170 are left out; financing is kept in its own block
	 *   (tipoReceitaDespesa 'FINANCIAMENTO'), outside receitas/despesas;
	 * - status: single pendente rule. Pending movements without centre are grouped in
	 *   "Sem centro de custos" (`centro.semCentro`), which is NOT part of the receitas/despesas totals
	 *   (the Dashboard reports them apart as "sem centro de custos").
	 * `centro.tipoReceitaDespesa` is the block (RECEITA/DESPESA by direction, or FINANCIAMENTO);
	 * the centre's own registration is in `centro.tipoReceitaDespesaCentro`.
	 */
	async getRelatorioCentroCustos(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}): Promise<
		Array<{
			centro: {
				id: number;
				descricao: string;
				tipo?: string;
				tipoReceitaDespesa?: 'RECEITA' | 'DESPESA' | 'FINANCIAMENTO';
				tipoReceitaDespesaCentro?: string;
				subtipoDespesa?: 'custeio' | 'investimento';
				semCentro?: boolean;
			};
			total: number;
			movimentos: Array<{
				id: number;
				dtMovimento: string;
				historico: string;
				valor: number;
				tipoMovimento: string;
				planoDescricao?: string;
				pessoaNome?: string;
				bancoNome?: string;
				contaDescricao?: string;
				pendente?: boolean;
			}>;
		}>
	> {
		try {
			console.log('🔍 Repository: Buscando relatório de centro de custos com filtros:', filters);

			const linhas = await this.carregarMovimentosComCentros({
				dataInicio: filters.dataInicio,
				dataFim: filters.dataFim,
				contaId: filters.contaId,
				status: filters.status,
				incluirFinanciamento: true,
			});

			type Grupo = {
				centro: {
					id: number;
					descricao: string;
					tipo?: string;
					tipoReceitaDespesa?: 'RECEITA' | 'DESPESA' | 'FINANCIAMENTO';
					tipoReceitaDespesaCentro?: string;
					subtipoDespesa?: 'custeio' | 'investimento';
					semCentro?: boolean;
				};
				total: number;
				movimentos: any[];
			};
			const agrupados = new Map<string, Grupo>();

			for (const { mov, tipoMov, ehFinanciamento, pendente, centros } of linhas) {
				const bloco: 'RECEITA' | 'DESPESA' | 'FINANCIAMENTO' = ehFinanciamento ? 'FINANCIAMENTO' : tipoMov === 'C' ? 'RECEITA' : 'DESPESA';

				const centrosDoMovimento: Array<{
					id: number;
					descricao: string;
					tipo?: string;
					tipoReceitaDespesaCentro?: string;
					semCentro?: boolean;
					valor: number;
				}> = centros.map((c) => ({
					id: c.id,
					descricao: c.descricao,
					tipo: c.tipo ?? undefined,
					tipoReceitaDespesaCentro: c.tipoReceitaDespesa ?? undefined,
					valor: c.valor,
				}));

				// Pending without centre: "Sem centro de custos" (shown, outside the totals)
				if (centrosDoMovimento.length === 0) {
					if (!pendente) continue; // e.g. financing linked to a contract without centre
					centrosDoMovimento.push({
						id: 0,
						descricao: 'Sem centro de custos',
						semCentro: true,
						valor: Math.abs(Number(mov.valor) || 0),
					});
				}

				// Filtering by centre: only the share (rateio) of that centre
				const centrosRelatorio = filters.centroCustosId
					? centrosDoMovimento.filter((cc) => cc.id === filters.centroCustosId)
					: centrosDoMovimento;

				for (const centroMov of centrosRelatorio) {
					const grupoKey = `${centroMov.id}|${bloco}`;
					if (!agrupados.has(grupoKey)) {
						agrupados.set(grupoKey, {
							centro: {
								id: centroMov.id,
								descricao: centroMov.descricao,
								tipo: centroMov.tipo,
								tipoReceitaDespesa: bloco,
								tipoReceitaDespesaCentro: centroMov.tipoReceitaDespesaCentro,
								...(bloco === 'DESPESA' && !centroMov.semCentro ? { subtipoDespesa: subtipoDespesaPorCentro(centroMov.tipo) } : {}),
								...(centroMov.semCentro ? { semCentro: true } : {}),
							},
							total: 0,
							movimentos: [],
						});
					}

					const grupo = agrupados.get(grupoKey)!;
					// Unrounded: percentage rateios store fractions of a cent; totals round once (totaisRelatorioCentroCustos)
					grupo.total += centroMov.valor;
					grupo.movimentos.push({
						id: mov.id,
						dtMovimento: mov.dtMovimento,
						historico: mov.historico,
						valor: centroMov.valor,
						tipoMovimento: tipoMov,
						planoDescricao: mov.planoDescricao ?? undefined,
						pessoaNome: mov.pessoaNome,
						bancoNome: mov.bancoNome,
						bancoCodigo: mov.bancoCodigo,
						agencia: mov.agencia,
						numConta: mov.numConta,
						pendente,
						contaDescricao:
							`${mov.bancoNome || ''}${mov.agencia ? ` - ${mov.agencia}` : ''}${mov.numConta ? ` - ${mov.numConta}` : ''}${mov.responsavel ? ` (${mov.responsavel})` : ''}`.trim(),
					});
				}
			}

			const resultado = Array.from(agrupados.values());
			// RECEITA → DESPESA → FINANCIAMENTO; "Sem centro de custos" last in its block; then by description
			const tipoOrdem = (t?: string) => (t === 'RECEITA' ? 0 : t === 'DESPESA' ? 1 : t === 'FINANCIAMENTO' ? 2 : 3);
			resultado.sort((a, b) => {
				const tipoA = tipoOrdem(a.centro.tipoReceitaDespesa);
				const tipoB = tipoOrdem(b.centro.tipoReceitaDespesa);
				if (tipoA !== tipoB) return tipoA - tipoB;
				const semA = a.centro.semCentro ? 1 : 0;
				const semB = b.centro.semCentro ? 1 : 0;
				if (semA !== semB) return semA - semB;
				return (a.centro.descricao || '').localeCompare(b.centro.descricao || '');
			});
			console.log(`✅ Repository: Relatório agrupado em ${resultado.length} centros de custos`);
			return resultado;
		} catch (error) {
			console.error('❌ Erro ao buscar relatório de centro de custos:', error);
			throw error;
		}
	}

	/** Totals of the Relatório de Centro de Custos (screen, Excel and PDF use the same numbers). */
	private totaisRelatorioCentroCustos(dados: Awaited<ReturnType<MovimentoBancarioRepository['getRelatorioCentroCustos']>>) {
		const arred = (v: number) => Math.round(v * 100) / 100;
		const somar = (xs: typeof dados) => arred(xs.reduce((s, item) => s + item.total, 0));
		const comCentro = dados.filter((item) => !item.centro.semCentro);
		const despesas = comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA');
		const receitas = somar(comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA'));
		const custeio = somar(despesas.filter((item) => item.centro.subtipoDespesa === 'custeio'));
		const investimento = somar(despesas.filter((item) => item.centro.subtipoDespesa === 'investimento'));
		// Financing is outside the results (informational block)
		const financiamentos = somar(comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'FINANCIAMENTO'));
		const semCentro = dados.filter((item) => item.centro.semCentro);
		return {
			receitas,
			custeio,
			investimento,
			despesas: arred(custeio + investimento),
			financiamentos,
			/** A = Receitas − Despesas operacionais (custeio) */
			saldoOperacional: arred(receitas - custeio),
			/** C = Receitas − todas as despesas (custeio + investimento) */
			saldoAposInvestimentos: arred(receitas - custeio - investimento),
			semCentroReceitas: somar(semCentro.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA')),
			semCentroDespesas: somar(semCentro.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA')),
			semCentroFinanciamentos: somar(semCentro.filter((item) => item.centro.tipoReceitaDespesa === 'FINANCIAMENTO')),
			/** Every pending movement without cost centre (outside all totals) */
			semCentroTotal: somar(semCentro),
		};
	}

	/**
	 * Relatório de Itens Classificados (screen "Relatório de Plano de Contas"): one row per plan × centre.
	 * - Base = Dashboard/Fluxo: no transfers, no financing, nothing on children of plano 170.
	 * - Plan-based report: credits WITHOUT plan (receitas classified only by cost centre, or still pending)
	 *   are left out — they belong to the Relatório de Centro de Custos. Debits without plan stay, with
	 *   `semPlano: true` ("Sem plano": pending classification).
	 * - planoContasId: only that plan's rows (split movements: the plan's share, via Resultado).
	 * - Movement without cost centre: `semCentro: true`, centre "Sem centro"; never counted as custeio or
	 *   investimento (outside the totals). Debits with centre: `subtipoDespesa` by the centre tipo.
	 * - status: single pendente rule ('pendentes' / 'conciliados'; else todos).
	 */
	async getRelatorioItensClassificados(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		planoContasId?: number;
	}): Promise<
		Array<{
			id: number;
			dtMovimento: string;
			historico: string;
			valor: number;
			tipoMovimento: string;
			idPlanoContas?: number;
			planoDescricao?: string;
			centroCustosDescricao?: string;
			centroCustosTipo?: string;
			idCentroCustos?: number;
			subtipoDespesa?: 'custeio' | 'investimento';
			semCentro?: boolean;
			semPlano?: boolean;
			pendente?: boolean;
			pessoaNome?: string;
			bancoNome?: string;
			responsavel?: string;
			contaDescricao?: string;
		}>
	> {
		try {
			console.log('🔍 Repository: Buscando relatório de itens classificados com filtros:', filters);

			const planosExclusao = await carregarPlanosExclusaoResultado(this.db);
			const base = sqlBaseResultado('mb', planosExclusao);

			const whereConditions: string[] = [base.sql];
			const params: Array<string | number> = [...base.bind];

			const filtroStatus = this.sqlFiltroStatus(filters.status, 'mb');
			if (filtroStatus) whereConditions.push(filtroStatus);

			if (filters.contaId) {
				whereConditions.push('mb.idContaCorrente = ?');
				params.push(filters.contaId);
			}

			// Plan filter: single-plan movements by idPlanoContas; split ones (idPlanoContas NULL) by Resultado
			if (filters.planoContasId) {
				whereConditions.push(
					`(mb.idPlanoContas = ? OR (mb.idPlanoContas IS NULL AND EXISTS (
						SELECT 1 FROM Resultado rf WHERE rf.idMovimentoBancario = mb.id AND rf.idPlanoContas = ?)))`,
				);
				params.push(filters.planoContasId, filters.planoContasId);
			}

			const periodo = sqlPeriodo('mb.dtMovimento', filters.dataInicio, filters.dataFim);
			whereConditions.push(...periodo.sql);
			params.push(...periodo.bind);

			const query = `
				SELECT
					mb.id,
					mb.dtMovimento,
					mb.historico,
					mb.valor,
					mb.tipoMovimento,
					mb.modalidadeMovimento,
					mb.idPlanoContas,
					mb.idCentroCustos,
					mb.idPessoa,
					mb.idBanco,
					mb.idContaCorrente,
					CASE WHEN ${sqlMovimentoPendente('mb')} THEN 1 ELSE 0 END as pendente,
					pc.descricao as planoDescricao,
					p.nome as pessoaNome,
					b.nome as bancoNome,
					b.codigo as bancoCodigo,
					cc.numConta,
					cc.agencia,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN PlanoContas pc ON mb.idPlanoContas = pc.id
				LEFT JOIN Pessoa p ON mb.idPessoa = p.id
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				WHERE ${whereConditions.join(' AND ')}
				ORDER BY mb.dtMovimento DESC, mb.id DESC
			`;

			const { results } = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			console.log(`📊 Repository: ${results.length} movimentos encontrados (itens classificados)`);

			// Batch-load cost centre rateios and the centre registry (small table)
			const idsMovimentos = (results as any[]).map((r: any) => r.id as number);
			const [centroCustosMapBatch, centrosRes] = await Promise.all([
				this.movimentoCentroCustosRepo.buscarPorMovimentos(idsMovimentos),
				this.db.prepare(`SELECT id, descricao, tipo FROM CentroCustos`).all(),
			]);
			const centrosCustosInfoMap = new Map<number, { descricao: string; tipo: string | null }>();
			(centrosRes.results as any[]).forEach((cc: any) => {
				centrosCustosInfoMap.set(Number(cc.id), { descricao: cc.descricao as string, tipo: (cc.tipo as string | null) ?? null });
			});

			// Plans of split movements (idPlanoContas NULL) live only in Resultado: batch-load them with descriptions
			const planosPorMovimento = new Map<number, Array<{ idPlanoContas: number; valor: number; descricao: string | null }>>();
			const idsRateioPlano = (results as any[]).filter((r: any) => !r.idPlanoContas).map((r: any) => r.id as number);
			for (let i = 0; i < idsRateioPlano.length; i += 100) {
				const lote = idsRateioPlano.slice(i, i + 100);
				const { results: resRows } = await this.db
					.prepare(
						`SELECT r.idMovimentoBancario, r.idPlanoContas, r.valor, pc.descricao
						 FROM Resultado r LEFT JOIN PlanoContas pc ON pc.id = r.idPlanoContas
						 WHERE r.idMovimentoBancario IN (${lote.map(() => '?').join(',')})
						 ORDER BY r.id`,
					)
					.bind(...lote)
					.all();
				for (const r of resRows as any[]) {
					const lista = planosPorMovimento.get(r.idMovimentoBancario) ?? [];
					lista.push({ idPlanoContas: r.idPlanoContas, valor: Math.abs(Number(r.valor)), descricao: r.descricao ?? null });
					planosPorMovimento.set(r.idMovimentoBancario, lista);
				}
			}

			const arred = (v: number) => Math.round(v * 100) / 100;

			// One row per plan × centre.
			// Single plan (or none) → one row per centre with the centre value.
			// Several plans (rateio) → each centre value split proportionally to the plan share
			// (no centre rateio → the plan value itself), so totals per plan and per centre are kept.
			const movimentosProcessados: any[] = [];

			for (const mov of results as any[]) {
				const tipoMov = this.tipoMovimentoNormalizado(mov);
				const pendente = Number(mov.pendente) === 1;
				const centroCustosList = centroCustosMapBatch.get(mov.id) || [];
				const planosMov = mov.idPlanoContas
					? [{ idPlanoContas: mov.idPlanoContas as number, valor: Math.abs(Number(mov.valor)), descricao: mov.planoDescricao ?? null }]
					: planosPorMovimento.get(mov.id) || [];
				const semPlano = planosMov.length === 0;
				// Credit without plan = receita classified by cost centre (or pending): not part of this plan-based
				// report — it is in the Relatório de Centro de Custos
				if (semPlano && tipoMov === 'C') continue;
				// Debit without plan: one "Sem plano" row (pending classification)
				const planos: Array<{ idPlanoContas: number | undefined; valor: number; descricao: string | null }> = semPlano
					? [{ idPlanoContas: undefined, valor: Math.abs(Number(mov.valor)), descricao: null }]
					: planosMov;
				const somaPlanos = planos.reduce((s, p) => s + p.valor, 0);

				type CentroLinha = { id?: number; descricao: string; tipo: string | null; valor: number; semCentro: boolean };
				const centros: CentroLinha[] =
					centroCustosList.length > 0
						? centroCustosList.map((cc) => {
								const centroInfo = centrosCustosInfoMap.get(cc.idCentroCustos);
								return centroInfo
									? { id: cc.idCentroCustos, descricao: centroInfo.descricao, tipo: centroInfo.tipo, valor: Math.abs(cc.valor), semCentro: false }
									: { id: cc.idCentroCustos, descricao: 'Não definido', tipo: null, valor: Math.abs(cc.valor), semCentro: true };
							})
						: mov.idCentroCustos != null
							? [
									(() => {
										const centroInfo = centrosCustosInfoMap.get(Number(mov.idCentroCustos));
										return centroInfo
											? { id: Number(mov.idCentroCustos), descricao: centroInfo.descricao, tipo: centroInfo.tipo, valor: Math.abs(Number(mov.valor)), semCentro: false }
											: { id: Number(mov.idCentroCustos), descricao: 'Não definido', tipo: null, valor: Math.abs(Number(mov.valor)), semCentro: true };
									})(),
								]
							: [{ descricao: 'Sem centro', tipo: null, valor: Math.abs(Number(mov.valor)), semCentro: true }];

				for (const plano of planos) {
					// Split across plans: with the plan filter only that plan's share is listed
					if (filters.planoContasId && plano.idPlanoContas !== filters.planoContasId) continue;
					const proporcao = planos.length === 1 || somaPlanos === 0 ? 1 : plano.valor / somaPlanos;
					const valoresCentros =
						planos.length === 1
							? centros.map((c) => c.valor)
							: centroCustosList.length > 0
								? centros.map((c) => arred(c.valor * proporcao))
								: [plano.valor];
					// Rounding residue goes to the last centre so the plan total stays exact
					if (planos.length > 1 && centroCustosList.length > 0) {
						const somaCentros = centros.reduce((s, c) => s + c.valor, 0);
						const alvo = arred(somaCentros * proporcao);
						const parcial = valoresCentros.reduce((s, v) => s + v, 0);
						valoresCentros[valoresCentros.length - 1] = arred(valoresCentros[valoresCentros.length - 1] + alvo - parcial);
					}

					centros.forEach((centro, idx) => {
						movimentosProcessados.push({
							id: mov.id,
							dtMovimento: mov.dtMovimento,
							historico: mov.historico,
							valor: valoresCentros[idx],
							tipoMovimento: tipoMov,
							modalidadeMovimento: mov.modalidadeMovimento || 'padrao',
							idPlanoContas: plano.idPlanoContas,
							planoDescricao: plano.descricao ?? undefined,
							semPlano,
							centroCustosDescricao: centro.descricao,
							centroCustosTipo: centro.tipo,
							idCentroCustos: centro.id,
							semCentro: centro.semCentro,
							...(tipoMov === 'D' && !centro.semCentro ? { subtipoDespesa: subtipoDespesaPorCentro(centro.tipo) } : {}),
							pendente,
							pessoaNome: mov.pessoaNome,
							bancoNome: mov.bancoNome,
							bancoCodigo: mov.bancoCodigo,
							agencia: mov.agencia,
							numConta: mov.numConta,
							responsavel: mov.responsavel || '',
							contaDescricao:
								`${mov.bancoNome || ''}${mov.agencia ? ` - ${mov.agencia}` : ''}${mov.numConta ? ` - ${mov.numConta}` : ''}${mov.responsavel ? ` (${mov.responsavel})` : ''}`.trim(),
						});
					});
				}
			}

			return movimentosProcessados;
		} catch (error) {
			console.error('❌ Erro ao buscar relatório de itens classificados:', error);
			throw error;
		}
	}

	/**
	 * Totals of the Itens Classificados report (screen, Excel and PDF). "Sem centro" stays out of R/D.
	 * `receitas` = only credits WITH plan (receitas by centre are not in this report), so there is no
	 * saldo here — the real result is in the Relatório de Centro de Custos / Dashboard.
	 */
	private totaisItensClassificados(dados: Awaited<ReturnType<MovimentoBancarioRepository['getRelatorioItensClassificados']>>) {
		const arred = (v: number) => Math.round(v * 100) / 100;
		const somar = (xs: typeof dados) => arred(xs.reduce((s, i) => s + i.valor, 0));
		const comCentro = dados.filter((i) => !i.semCentro);
		const semCentro = dados.filter((i) => i.semCentro);
		const receitas = somar(comCentro.filter((i) => i.tipoMovimento === 'C'));
		const custeio = somar(comCentro.filter((i) => i.tipoMovimento === 'D' && i.subtipoDespesa === 'custeio'));
		const investimento = somar(comCentro.filter((i) => i.tipoMovimento === 'D' && i.subtipoDespesa === 'investimento'));
		return {
			receitas,
			custeio,
			investimento,
			despesas: arred(custeio + investimento),
			semCentroReceitas: somar(semCentro.filter((i) => i.tipoMovimento === 'C')),
			semCentroDespesas: somar(semCentro.filter((i) => i.tipoMovimento === 'D')),
			movimentos: new Set(dados.map((i) => i.id)).size,
		};
	}

	async exportRelatorioCentroCustosExcel(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}): Promise<Buffer> {
		try {
			console.log('📊 Repository: Iniciando exportação Excel - Relatório Centro de Custos');

			const dados = await this.getRelatorioCentroCustos(filters);

			// Buscar informações dos filtros para exibir no header
			let contaNome = 'Todas';
			if (filters.contaId) {
				const contaResult = await this.db
					.prepare(
						'SELECT cc.numConta, cc.responsavel, b.nome as bancoNome FROM ContaCorrente cc LEFT JOIN Banco b ON cc.idBanco = b.id WHERE cc.id = ?',
					)
					.bind(filters.contaId)
					.first();
				if (contaResult) {
					contaNome =
						`${contaResult.bancoNome || ''} - ${contaResult.numConta || ''}${contaResult.responsavel ? ` (${contaResult.responsavel})` : ''}`.trim();
				}
			}

			let centroCustosNome = 'Todos';
			if (filters.centroCustosId) {
				const centroResult = await this.db.prepare('SELECT descricao FROM CentroCustos WHERE id = ?').bind(filters.centroCustosId).first();
				if (centroResult) {
					centroCustosNome = centroResult.descricao as string;
				}
			}

			const statusNome = this.statusFiltroNome(filters.status);

			// Criar workbook
			const wb = XLSX.utils.book_new();

			// Planilha 1: Resumo por Centro de Custos
			const headerData = [
				['RELATÓRIO DE CENTRO DE CUSTOS'],
				[''],
				['Filtros Aplicados:'],
				[`Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`],
				[`Conta Corrente: ${contaNome}`],
				[`Status: ${statusNome}`],
				[`Centro de Custos: ${centroCustosNome}`],
				[''],
				['Resumo por Centro de Custos'],
				['Centro de Custos', 'Receitas', 'Despesas de custeio', 'Despesas de investimento', 'Financiamentos', 'Sem centro de custos (pendente)'],
			];

			const comCentro = dados.filter((item) => !item.centro.semCentro);
			const dadosReceitas = comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA');
			const dadosDespesas = comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA');
			const dadosFinanciamentos = comCentro.filter((item) => item.centro.tipoReceitaDespesa === 'FINANCIAMENTO');
			const dadosSemCentro = dados.filter((item) => item.centro.semCentro);

			// Same numbers as the screen and the Dashboard/Fluxo (custeio = centre tipo CUSTEIO; else investimento)
			const totais = this.totaisRelatorioCentroCustos(dados);
			const ehCusteio = (item: (typeof dados)[0]) => item.centro.subtipoDespesa === 'custeio';

			const resumoRows: (string | number)[][] = [];
			const valorOuVazio = (v: number) => (v ? this.excelNumero(v) : '');
			const pushCentroRow = (item: (typeof dados)[0]) => {
				const tipoRD = item.centro.tipoReceitaDespesa;
				const semCentro = !!item.centro.semCentro;
				const rotuloSemCentro = tipoRD === 'RECEITA' ? 'créditos' : tipoRD === 'DESPESA' ? 'débitos' : 'financiamentos';
				resumoRows.push([
					semCentro ? `${item.centro.descricao} (${rotuloSemCentro})` : item.centro.descricao,
					valorOuVazio(!semCentro && tipoRD === 'RECEITA' ? item.total : 0),
					valorOuVazio(!semCentro && tipoRD === 'DESPESA' && ehCusteio(item) ? item.total : 0),
					valorOuVazio(!semCentro && tipoRD === 'DESPESA' && !ehCusteio(item) ? item.total : 0),
					valorOuVazio(!semCentro && tipoRD === 'FINANCIAMENTO' ? item.total : 0),
					valorOuVazio(semCentro ? item.total : 0),
				]);
			};

			if (dadosReceitas.length > 0) {
				resumoRows.push(['Total Receitas', this.excelNumero(totais.receitas), '', '', '', '']);
				for (const item of dadosReceitas) pushCentroRow(item);
			}
			if (dadosDespesas.length > 0) {
				resumoRows.push(['Total Despesas', '', this.excelNumero(totais.custeio), this.excelNumero(totais.investimento), '', '']);
				for (const item of dadosDespesas) pushCentroRow(item);
			}
			if (dadosFinanciamentos.length > 0) {
				// Financing is outside the result (not in receitas/despesas nor in the saldos)
				resumoRows.push(['Total Financiamentos', '', '', '', this.excelNumero(totais.financiamentos), '']);
				for (const item of dadosFinanciamentos) pushCentroRow(item);
			}
			if (dadosSemCentro.length > 0) {
				resumoRows.push([
					'Pendentes sem centro de custos (fora dos totais)',
					'',
					'',
					'',
					'',
					this.excelNumero(totais.semCentroTotal),
				]);
				for (const item of dadosSemCentro) pushCentroRow(item);
			}
			// A = Receitas − Despesas operacionais (custeio); C = Receitas − todas as despesas. Financing stays apart.
			resumoRows.push(['Saldo operacional (A = Receitas - Despesas de custeio)', this.excelNumero(totais.saldoOperacional), '', '', '', '']);
			resumoRows.push([
				'Saldo após investimentos (C = Receitas - Custeio - Investimento)',
				this.excelNumero(totais.saldoAposInvestimentos),
				'',
				'',
				'',
				'',
			]);

			const wsResumo = XLSX.utils.aoa_to_sheet([...headerData, ...resumoRows]);
			this.applyExcelCurrencyFormat(wsResumo, [1, 2, 3, 4, 5], headerData.length);
			XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por Centro');

			// Planilha 2: Detalhamento
			const detalhamentoHeader = [
				['RELATÓRIO DE CENTRO DE CUSTOS - DETALHAMENTO'],
				[''],
				['Filtros Aplicados:'],
				[`Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`],
				[`Conta Corrente: ${contaNome}`],
				[`Status: ${statusNome}`],
				[`Centro de Custos: ${centroCustosNome}`],
				[''],
				['Detalhamento de Movimentos'],
				['Centro de Custos', 'Data', 'Histórico', 'Valor', 'Tipo', 'Plano de Contas', 'Pessoa', 'Conta corrente', 'Status'],
			];

			const detalhamentoData: any[] = [];
			for (const item of dados) {
				for (const mov of item.movimentos) {
					detalhamentoData.push([
						item.centro.descricao,
						this.dataBR(mov.dtMovimento),
						mov.historico,
						this.excelNumero(mov.valor),
						mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						mov.planoDescricao || '',
						mov.pessoaNome || '',
						mov.contaDescricao || '',
						mov.pendente ? 'Pendente' : 'Conciliado',
					]);
				}
			}

			const wsDetalhamento = XLSX.utils.aoa_to_sheet([...detalhamentoHeader, ...detalhamentoData]);
			this.applyExcelCurrencyFormat(wsDetalhamento, [3], detalhamentoHeader.length);
			XLSX.utils.book_append_sheet(wb, wsDetalhamento, 'Detalhamento');

			const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
			console.log(`✅ Repository: Excel gerado com sucesso, ${excelBuffer.length} bytes`);
			return excelBuffer;
		} catch (error) {
			console.error('❌ Erro ao exportar relatório de centro de custos para Excel:', error);
			throw error;
		}
	}

	async exportRelatorioCentroCustosPDF(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}): Promise<Uint8Array> {
		try {
			console.log('📊 Repository: Iniciando exportação PDF - Relatório Centro de Custos');

			const dados = await this.getRelatorioCentroCustos(filters);

			// Buscar informações dos filtros para exibir no cabeçalho
			let contaNome = 'Todas';
			if (filters.contaId) {
				const contaResult = await this.db
					.prepare(
						'SELECT cc.numConta, cc.responsavel, b.nome as bancoNome FROM ContaCorrente cc LEFT JOIN Banco b ON cc.idBanco = b.id WHERE cc.id = ?',
					)
					.bind(filters.contaId)
					.first();
				if (contaResult) {
					contaNome =
						`${contaResult.bancoNome || ''} - ${contaResult.numConta || ''}${contaResult.responsavel ? ` (${contaResult.responsavel})` : ''}`.trim();
				}
			}

			let centroCustosNome = 'Todos';
			if (filters.centroCustosId) {
				const centroResult = await this.db.prepare('SELECT descricao FROM CentroCustos WHERE id = ?').bind(filters.centroCustosId).first();
				if (centroResult) {
					centroCustosNome = centroResult.descricao as string;
				}
			}

			const statusNome = this.statusFiltroNome(filters.status);

			const comCentroPdf = dados.filter((item) => !item.centro.semCentro);
			const dadosReceitasPdf = comCentroPdf.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA');
			const dadosDespesasPdf = comCentroPdf.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA');
			const dadosFinanciamentosPdf = comCentroPdf.filter((item) => item.centro.tipoReceitaDespesa === 'FINANCIAMENTO');
			const dadosSemCentroPdf = dados.filter((item) => item.centro.semCentro);

			// Same numbers as the screen/Excel and the Dashboard/Fluxo
			const totais = this.totaisRelatorioCentroCustos(dados);
			const totalReceitas = totais.receitas;
			const totalDespesas = totais.despesas;
			const totalDespesasCusteio = totais.custeio;
			const totalDespesasInvestimento = totais.investimento;
			const totalFinanciamentos = totais.financiamentos;
			const totalSemCentro = totais.semCentroTotal;
			const ehInvestimento = (item: (typeof dados)[0]) => item.centro.subtipoDespesa === 'investimento';

			const jsPDF = (await import('jspdf')).default;
			const autoTable = (await import('jspdf-autotable')).default;

			const doc = new jsPDF('l', 'mm', 'a4');

			// Função para desenhar cabeçalho
			const drawHeader = (pageNumber: number = 1) => {
				// Linha superior
				doc.setDrawColor(0, 0, 0);
				doc.setLineWidth(0.5);
				doc.line(20, 15, 277, 15);

				// Título principal
				doc.setTextColor(0, 0, 0);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('RELATÓRIO DE CENTRO DE CUSTOS', 20, 22);

				// Data de geração
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				const dataGeracao = new Date().toLocaleDateString('pt-BR', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
				doc.text(dataGeracao, 277, 22, { align: 'right' });

				// Linha inferior do cabeçalho
				doc.line(20, 26, 277, 26);
			};

			// Função para desenhar informações dos filtros
			const drawFilters = (yStart: number) => {
				doc.setFontSize(9);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);

				// Primeira coluna
				let yPos = yStart;
				doc.text('Período:', 20, yPos);
				doc.setFont('helvetica', 'normal');
				const periodoTexto = `${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`;
				doc.text(periodoTexto, 55, yPos);

				doc.setFont('helvetica', 'bold');
				doc.text('Conta Corrente:', 20, yPos + 5);
				doc.setFont('helvetica', 'normal');
				doc.text(contaNome, 55, yPos + 5);

				// Segunda coluna
				doc.setFont('helvetica', 'bold');
				doc.text('Status:', 150, yPos);
				doc.setFont('helvetica', 'normal');
				doc.text(statusNome, 185, yPos);

				doc.setFont('helvetica', 'bold');
				doc.text('Centro de Custos:', 150, yPos + 5);
				doc.setFont('helvetica', 'normal');
				// Truncar se muito longo
				const centroTexto = centroCustosNome.length > 30 ? centroCustosNome.substring(0, 27) + '...' : centroCustosNome;
				doc.text(centroTexto, 185, yPos + 5);

				// Linha separadora
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yPos + 10, 277, yPos + 10);

				return yPos + 15;
			};

			// Função para desenhar resumo executivo
			const drawSummary = (yStart: number) => {
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);

				const boxHeight = 20;
				doc.setFillColor(245, 245, 245);
				doc.rect(20, yStart - 5, 257, boxHeight, 'F');
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.rect(20, yStart - 5, 257, boxHeight);

				doc.text('Total Receitas:', 25, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(0, 128, 0);
				doc.text(
					new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas),
					55,
					yStart + 2,
				);

				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.text('Total Despesas:', 125, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(220, 20, 60);
				doc.text(
					new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas),
					155,
					yStart + 2,
				);

				doc.setFont('helvetica', 'normal');
				doc.setFontSize(8);
				doc.setTextColor(80, 80, 80);
				doc.text(
					`(Custeio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesasCusteio)} | Investimento: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesasInvestimento)})`,
					125,
					yStart + 6,
				);

				const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(10);
				doc.setTextColor(0, 0, 0);
				// A = Receitas - Despesas de custeio; C = Receitas - todas as despesas
				doc.text('Saldo operacional (A):', 25, yStart + 12);
				doc.setFont('helvetica', 'normal');
				doc.text(brl(totais.saldoOperacional), 70, yStart + 12);
				doc.setFont('helvetica', 'bold');
				doc.text('Saldo após investimentos (C):', 125, yStart + 12);
				doc.setFont('helvetica', 'normal');
				doc.text(brl(totais.saldoAposInvestimentos), 180, yStart + 12);

				const extras = [
					totalFinanciamentos > 0 ? `Financiamentos (fora do resultado): ${brl(totalFinanciamentos)}` : '',
					totalSemCentro > 0 ? `Pendentes sem centro de custos (fora dos totais): ${brl(totalSemCentro)}` : '',
				].filter(Boolean);
				if (extras.length > 0) {
					doc.setFontSize(8);
					doc.setTextColor(80, 80, 80);
					doc.text(extras.join('   |   '), 25, yStart + 17);
					doc.setFontSize(10);
					doc.setTextColor(0, 0, 0);
				}

				return yStart + boxHeight + 5;
			};

			// Primeira página
			drawHeader(1);
			let yPos = drawFilters(32);
			yPos = drawSummary(yPos);

			// Função para desenhar linha de totalizador (Total Receitas ou Total Despesas)
			const drawTotalizador = (label: string, receitaVal: number, custeioVal: number, investVal: number, yStart: number) => {
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.setFillColor(245, 245, 245);
				doc.rect(20, yStart - 3, 257, 8, 'F');
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yStart - 3, 277, yStart - 3);
				doc.line(20, yStart + 5, 277, yStart + 5);
				doc.text(label + ':', 22, yStart + 2);
				if (receitaVal > 0) {
					doc.setTextColor(0, 128, 0);
					doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaVal), 80, yStart + 2);
				}
				if (custeioVal > 0 || investVal > 0) {
					doc.setTextColor(220, 20, 60);
					const txt = [
						custeioVal > 0 ? `Custeio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custeioVal)}` : '',
						investVal > 0 ? `Invest.: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(investVal)}` : '',
					]
						.filter(Boolean)
						.join(' | ');
					doc.text(txt, 150, yStart + 2);
				}
				doc.setTextColor(0, 0, 0);
				return yStart + 12;
			};

			// Totalizador primeiro, depois desdobramentos por bloco
			let isFirstPage = true;
			let pageNumber = 1;

			if (dadosReceitasPdf.length > 0) {
				if (yPos > 180) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				yPos = drawTotalizador('Total Receitas', totalReceitas, 0, 0, yPos);
			}

			for (const item of dadosReceitasPdf) {
				// Verificar se precisa de nova página
				if (yPos > 175 && !isFirstPage) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				isFirstPage = false;

				// Cabeçalho do centro de custos (estilo similar ao exemplo)
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);

				// Determinar cor do fundo baseado em tipoReceitaDespesa e tipo
				let fillColor = [240, 240, 240]; // Cinza padrão
				if (item.centro.tipoReceitaDespesa === 'RECEITA') {
					fillColor = [220, 252, 231]; // Verde claro para receitas
				} else if (item.centro.tipoReceitaDespesa === 'DESPESA') {
					if (ehInvestimento(item)) {
						fillColor = [219, 234, 254]; // Azul claro para investimento
					} else {
						fillColor = [254, 226, 226]; // Vermelho claro para custeio
					}
				}

				// Fundo colorido para o cabeçalho do grupo
				doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
				doc.rect(20, yPos - 4, 257, 10, 'F');

				// Borda superior
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yPos - 4, 277, yPos - 4);

				// Borda inferior para fechar o retângulo
				doc.line(20, yPos + 6, 277, yPos + 6);

				// Nome do centro
				doc.text(item.centro.descricao, 22, yPos);

				// Tipo e classificação com cores
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');

				// Cor baseada no tipo
				if (item.centro.tipoReceitaDespesa === 'RECEITA') {
					doc.setTextColor(0, 128, 0); // Verde
				} else if (item.centro.tipoReceitaDespesa === 'DESPESA') {
					if (ehInvestimento(item)) {
						doc.setTextColor(30, 64, 175); // Azul
					} else {
						doc.setTextColor(220, 20, 60); // Vermelho
					}
				} else {
					doc.setTextColor(100, 100, 100); // Cinza padrão
				}

				const tipoInfo = `${item.centro.tipoReceitaDespesa || ''}${item.centro.tipo ? ` - ${item.centro.tipo}` : ''}`;
				doc.text(tipoInfo, 22, yPos + 4);

				// Total formatado à direita - ajustar posição para não sobrepor
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				const totalFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(item.total);
				doc.text(`Total: ${totalFormatado}`, 270, yPos + 2, { align: 'right' });

				yPos += 7;

				// Tabela de movimentos deste centro
				const detalhamentoData = item.movimentos.map((mov) => {
					const valorFormatado = new Intl.NumberFormat('pt-BR', {
						style: 'currency',
						currency: 'BRL',
					}).format(mov.valor);

					// Limpar e sanitizar histórico para evitar problemas de encoding
					let historicoLimpo = String(mov.historico || '');

					// Decodificar se necessário e remover caracteres problemáticos
					try {
						// Tentar decodificar como UTF-8 se vier como buffer ou com encoding incorreto
						if (typeof historicoLimpo === 'string') {
							// Remover caracteres de controle problemáticos, mas preservar acentos UTF-8
							// Remover apenas caracteres de controle (0x00-0x1F exceto tab/newline, 0x7F-0x9F)
							historicoLimpo = historicoLimpo
								.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove caracteres de controle exceto \t, \n, \r
								.replace(/\x00/g, '') // Remove nulls
								.replace(/[\uFFFD]/g, '') // Remove replacement characters ()
								.trim();
						}
					} catch (e) {
						// Se houver erro, usar string vazia
						historicoLimpo = '';
					}

					// Normalizar espaços múltiplos
					historicoLimpo = historicoLimpo.replace(/\s+/g, ' ');

					// Truncar se muito longo (usar método seguro para UTF-8)
					if (historicoLimpo.length > 60) {
						// Usar slice em vez de substring para melhor suporte UTF-8
						historicoLimpo = historicoLimpo.slice(0, 57) + '...';
					}

					// Sanitizar plano de contas também
					let planoLimpo = String(mov.planoDescricao || '-');
					try {
						planoLimpo = planoLimpo
							.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
							.replace(/\x00/g, '')
							.replace(/[\uFFFD]/g, '')
							.trim();
					} catch (e) {
						planoLimpo = '-';
					}

					if (planoLimpo.length > 35) {
						planoLimpo = planoLimpo.slice(0, 32) + '...';
					}

					// Sanitizar pessoa também
					let pessoaLimpo = String(mov.pessoaNome || '-');
					try {
						pessoaLimpo = pessoaLimpo
							.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
							.replace(/\x00/g, '')
							.replace(/[\uFFFD]/g, '')
							.trim();
					} catch (e) {
						pessoaLimpo = '-';
					}

					return [
						this.dataBR(mov.dtMovimento),
						historicoLimpo || '-',
						valorFormatado,
						mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						planoLimpo,
						pessoaLimpo,
					];
				});

				autoTable(doc, {
					startY: yPos,
					head: [['Data', 'Histórico', 'Valor', 'Tipo', 'Plano de Contas', 'Pessoa']],
					body: detalhamentoData,
					theme: 'striped',
					headStyles: {
						fillColor: [240, 240, 240],
						textColor: [0, 0, 0],
						fontStyle: 'bold',
						fontSize: 9,
						lineColor: [200, 200, 200],
						lineWidth: 0.3,
					},
					bodyStyles: {
						fontSize: 8,
						textColor: [0, 0, 0],
						lineColor: [220, 220, 220],
						lineWidth: 0.2,
					},
					alternateRowStyles: {
						fillColor: [250, 250, 250],
					},
					columnStyles: {
						0: { cellWidth: 22, halign: 'left' }, // Data
						1: { cellWidth: 95, halign: 'left' }, // Histórico
						2: { cellWidth: 28, halign: 'right' }, // Valor
						3: { cellWidth: 20, halign: 'center' }, // Tipo
						4: { cellWidth: 65, halign: 'left' }, // Plano de Contas
						5: { cellWidth: 27, halign: 'left' }, // Pessoa
					},
					margin: { left: 20, right: 20, top: 32 },
					styles: {
						overflow: 'linebreak',
						cellPadding: 2,
						lineColor: [220, 220, 220],
						lineWidth: 0.2,
					},
					willDrawPage: (data: any) => {
						if (data.pageNumber > 1) {
							doc.setPage(data.pageNumber);
							drawHeader(data.pageNumber);
							data.settings.startY = 32;
						}
					},
				});

				// Obter posição final da tabela
				const finalY = (doc as any).lastAutoTable?.finalY;
				if (finalY) {
					yPos = finalY + 8; // Espaço entre centros
				} else {
					yPos += 30; // Fallback
				}
			}

			if (dadosDespesasPdf.length > 0) {
				if (yPos > 180) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				yPos = drawTotalizador('Total Despesas', 0, totalDespesasCusteio, totalDespesasInvestimento, yPos);
			}

			for (const item of dadosDespesasPdf) {
				// Verificar se precisa de nova página
				if (yPos > 175 && !isFirstPage) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				isFirstPage = false;

				// Cabeçalho do centro de custos
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				let fillColor = [240, 240, 240];
				if (item.centro.tipoReceitaDespesa === 'DESPESA') {
					if (ehInvestimento(item)) {
						fillColor = [219, 234, 254];
					} else {
						fillColor = [254, 226, 226];
					}
				}
				doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
				doc.rect(20, yPos - 4, 257, 10, 'F');
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yPos - 4, 277, yPos - 4);
				doc.line(20, yPos + 6, 277, yPos + 6);
				doc.text(item.centro.descricao, 22, yPos);
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				if (ehInvestimento(item)) {
					doc.setTextColor(30, 64, 175);
				} else {
					doc.setTextColor(220, 20, 60);
				}
				const tipoInfo = `DESPESA - ${ehInvestimento(item) ? 'INVESTIMENTO' : 'CUSTEIO'}`;
				doc.text(tipoInfo, 22, yPos + 4);
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total);
				doc.text(`Total: ${totalFormatado}`, 270, yPos + 2, { align: 'right' });
				yPos += 7;

				const detalhamentoData = item.movimentos.map((mov) => {
					const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor);
					let historicoLimpo = String(mov.historico || '');
					try {
						if (typeof historicoLimpo === 'string') {
							historicoLimpo = historicoLimpo
								.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
								.replace(/\x00/g, '')
								.replace(/[\uFFFD]/g, '')
								.trim();
						}
					} catch (e) {
						historicoLimpo = '';
					}
					historicoLimpo = historicoLimpo.replace(/\s+/g, ' ');
					if (historicoLimpo.length > 60) historicoLimpo = historicoLimpo.slice(0, 57) + '...';
					let planoLimpo = String(mov.planoDescricao || '-');
					try {
						planoLimpo = planoLimpo
							.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
							.replace(/\x00/g, '')
							.replace(/[\uFFFD]/g, '')
							.trim();
					} catch (e) {
						planoLimpo = '-';
					}
					if (planoLimpo.length > 35) planoLimpo = planoLimpo.slice(0, 32) + '...';
					let pessoaLimpo = String(mov.pessoaNome || '-');
					try {
						pessoaLimpo = pessoaLimpo
							.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
							.replace(/\x00/g, '')
							.replace(/[\uFFFD]/g, '')
							.trim();
					} catch (e) {
						pessoaLimpo = '-';
					}
					return [
						this.dataBR(mov.dtMovimento),
						historicoLimpo || '-',
						valorFormatado,
						mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						planoLimpo,
						pessoaLimpo,
					];
				});

				autoTable(doc, {
					startY: yPos,
					head: [['Data', 'Histórico', 'Valor', 'Tipo', 'Plano de Contas', 'Pessoa']],
					body: detalhamentoData,
					theme: 'striped',
					headStyles: {
						fillColor: [240, 240, 240],
						textColor: [0, 0, 0],
						fontStyle: 'bold',
						fontSize: 9,
						lineColor: [200, 200, 200],
						lineWidth: 0.3,
					},
					bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineColor: [220, 220, 220], lineWidth: 0.2 },
					alternateRowStyles: { fillColor: [250, 250, 250] },
					columnStyles: {
						0: { cellWidth: 22, halign: 'left' },
						1: { cellWidth: 95, halign: 'left' },
						2: { cellWidth: 28, halign: 'right' },
						3: { cellWidth: 20, halign: 'center' },
						4: { cellWidth: 65, halign: 'left' },
						5: { cellWidth: 27, halign: 'left' },
					},
					margin: { left: 20, right: 20, top: 32 },
					styles: { overflow: 'linebreak', cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
					willDrawPage: (data: any) => {
						if (data.pageNumber > 1) {
							doc.setPage(data.pageNumber);
							drawHeader(data.pageNumber);
							data.settings.startY = 32;
						}
					},
				});

				const finalY2 = (doc as any).lastAutoTable?.finalY;
				if (finalY2) {
					yPos = finalY2 + 8;
				} else {
					yPos += 30;
				}
			}

			if (dadosFinanciamentosPdf.length > 0) {
				if (yPos > 180) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				yPos = drawTotalizador('Total Financiamentos', totalFinanciamentos, 0, 0, yPos);
			}

			for (const item of dadosFinanciamentosPdf) {
				if (yPos > 175 && !isFirstPage) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				isFirstPage = false;

				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.setFillColor(219, 234, 254);
				doc.rect(20, yPos - 4, 257, 10, 'F');
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yPos - 4, 277, yPos - 4);
				doc.line(20, yPos + 6, 277, yPos + 6);
				doc.text(item.centro.descricao, 22, yPos);
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(30, 64, 175);
				doc.text('FINANCIAMENTO (fora do resultado)', 22, yPos + 4);
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total);
				doc.text(`Total: ${totalFormatado}`, 270, yPos + 2, { align: 'right' });
				yPos += 7;

				const detalhamentoData = item.movimentos.map((mov) => {
					const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor);
					let historicoLimpo = String(mov.historico || '').replace(/\s+/g, ' ').trim();
					if (historicoLimpo.length > 60) historicoLimpo = historicoLimpo.slice(0, 57) + '...';
					return [
						this.dataBR(mov.dtMovimento),
						historicoLimpo || '-',
						valorFormatado,
						mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						String(mov.planoDescricao || '-').slice(0, 32),
						String(mov.pessoaNome || '-'),
					];
				});

				autoTable(doc, {
					startY: yPos,
					head: [['Data', 'Histórico', 'Valor', 'Tipo', 'Plano de Contas', 'Pessoa']],
					body: detalhamentoData,
					theme: 'striped',
					headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
					bodyStyles: { fontSize: 8 },
					margin: { left: 20, right: 20, top: 32 },
					willDrawPage: (data: any) => {
						if (data.pageNumber > 1) {
							doc.setPage(data.pageNumber);
							drawHeader(data.pageNumber);
							data.settings.startY = 32;
						}
					},
				});

				const finalYFin = (doc as any).lastAutoTable?.finalY;
				yPos = finalYFin ? finalYFin + 8 : yPos + 30;
			}

			// Pending movements without cost centre: listed for completion, outside the totals
			if (dadosSemCentroPdf.length > 0) {
				if (yPos > 175) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.setFillColor(254, 243, 199);
				doc.rect(20, yPos - 4, 257, 10, 'F');
				doc.text('Pendentes sem centro de custos (fora dos totais)', 22, yPos + 2);
				doc.text(
					`Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSemCentro)}`,
					270,
					yPos + 2,
					{ align: 'right' },
				);
				yPos += 7;
				const linhasSemCentro = dadosSemCentroPdf.flatMap((item) =>
					item.movimentos.map((mov) => {
						let historicoLimpo = String(mov.historico || '').replace(/\s+/g, ' ').trim();
						if (historicoLimpo.length > 60) historicoLimpo = historicoLimpo.slice(0, 57) + '...';
						return [
							this.dataBR(mov.dtMovimento),
							historicoLimpo || '-',
							new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor),
							mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
							String(mov.planoDescricao || '-').slice(0, 32),
							String(mov.pessoaNome || '-'),
						];
					}),
				);
				autoTable(doc, {
					startY: yPos,
					head: [['Data', 'Histórico', 'Valor', 'Tipo', 'Plano de Contas', 'Pessoa']],
					body: linhasSemCentro,
					theme: 'striped',
					headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
					bodyStyles: { fontSize: 8 },
					margin: { left: 20, right: 20, top: 32 },
					willDrawPage: (data: any) => {
						if (data.pageNumber > 1) {
							doc.setPage(data.pageNumber);
							drawHeader(data.pageNumber);
							data.settings.startY = 32;
						}
					},
				});
				const finalYSem = (doc as any).lastAutoTable?.finalY;
				yPos = finalYSem ? finalYSem + 8 : yPos + 30;
			}

			// Rodapé em todas as páginas
			const totalPages = doc.getNumberOfPages();
			for (let i = 1; i <= totalPages; i++) {
				doc.setPage(i);

				// Linha separadora do rodapé
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, 195, 277, 195);

				// Numeração de páginas
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(100, 100, 100);
				doc.text(`Página ${i} de ${totalPages}`, 277, 200, { align: 'right' });
			}

			const pdfBuffer = new Uint8Array(doc.output('arraybuffer'));
			console.log(`✅ Repository: PDF gerado com sucesso, ${pdfBuffer.length} bytes`);
			return pdfBuffer;
		} catch (error) {
			console.error('❌ Erro ao exportar relatório de centro de custos para PDF:', error);
			throw error;
		}
	}

	/** Name of the plan chosen in the Plano de Contas report filter (Excel/PDF header). */
	private async nomePlanoFiltro(planoContasId?: number): Promise<string> {
		if (!planoContasId) return 'Todos';
		const plano = await this.db.prepare('SELECT hierarquia, descricao FROM PlanoContas WHERE id = ?').bind(planoContasId).first();
		return plano ? `${plano.hierarquia ? `${plano.hierarquia} - ` : ''}${plano.descricao}` : String(planoContasId);
	}

	async exportRelatorioItensClassificadosExcel(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		planoContasId?: number;
	}): Promise<Buffer> {
		try {
			console.log('📊 Repository: Iniciando exportação Excel - Relatório Itens Classificados');

			const dados = await this.getRelatorioItensClassificados(filters);

			// Buscar informações dos filtros para exibir no header
			let contaNome = 'Todas';
			if (filters.contaId) {
				const contaResult = await this.db
					.prepare(
						'SELECT cc.numConta, cc.responsavel, b.nome as bancoNome FROM ContaCorrente cc LEFT JOIN Banco b ON cc.idBanco = b.id WHERE cc.id = ?',
					)
					.bind(filters.contaId)
					.first();
				if (contaResult) {
					contaNome =
						`${contaResult.bancoNome || ''} - ${contaResult.numConta || ''}${contaResult.responsavel ? ` (${contaResult.responsavel})` : ''}`.trim();
				}
			}

			const statusNome = this.statusFiltroNome(filters.status);
			const planoNome = await this.nomePlanoFiltro(filters.planoContasId);
			const totais = this.totaisItensClassificados(dados);

			// Criar header igual ao de Centro de Custos
			const headerData = [
				['RELATÓRIO DE PLANO DE CONTAS'],
				[NOTA_RECEITAS_ITENS_CLASSIFICADOS],
				['Filtros Aplicados:'],
				[`Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`],
				[`Conta Corrente: ${contaNome}`],
				[`Status: ${statusNome}`],
				[`Plano de Contas: ${planoNome}`],
				[''],
				['Plano de Contas'],
				[
					'Data',
					'Histórico',
					'Receitas (com plano de contas)',
					'Despesas de custeio',
					'Despesas de investimento',
					'Plano de Contas',
					'Centro de Custos',
					'Conta corrente',
					'Receita sem centro (pendente)',
					'Despesa sem centro (pendente)',
				],
			];

			// Same rule as UI/Dashboard/Fluxo: debit with centre → custeio (centre tipo CUSTEIO) or investimento;
			// movements without centre are pending and stay in their own columns (outside the totals)
			const dadosParaExportar = dados.map((mov) => {
				const semCentro = !!mov.semCentro;
				const receita = !semCentro && mov.tipoMovimento === 'C' ? mov.valor : 0;
				const despesaCusteio = !semCentro && mov.tipoMovimento === 'D' && mov.subtipoDespesa === 'custeio' ? mov.valor : 0;
				const despesaInvestimento = !semCentro && mov.tipoMovimento === 'D' && mov.subtipoDespesa === 'investimento' ? mov.valor : 0;
				const receitaSemCentro = semCentro && mov.tipoMovimento === 'C' ? mov.valor : 0;
				const despesaSemCentro = semCentro && mov.tipoMovimento === 'D' ? mov.valor : 0;
				return [
					this.dataBR(mov.dtMovimento),
					mov.historico || '',
					receita ? this.excelNumero(receita) : '',
					despesaCusteio ? this.excelNumero(despesaCusteio) : '',
					despesaInvestimento ? this.excelNumero(despesaInvestimento) : '',
					mov.planoDescricao || 'Sem plano',
					mov.centroCustosDescricao || '',
					(mov as any).responsavel || '',
					receitaSemCentro ? this.excelNumero(receitaSemCentro) : '',
					despesaSemCentro ? this.excelNumero(despesaSemCentro) : '',
				];
			});

			// Adicionar linha de total
			const linhaTotal = [
				'TOTAL',
				`${totais.movimentos} movimento(s)`,
				this.excelNumero(totais.receitas),
				this.excelNumero(totais.custeio),
				this.excelNumero(totais.investimento),
				'',
				'',
				'',
				this.excelNumero(totais.semCentroReceitas),
				this.excelNumero(totais.semCentroDespesas),
			];
			// No "Receitas − Despesas" line: receitas classified only by centre are not listed here
			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet([...headerData, ...dadosParaExportar, linhaTotal]);
			this.applyExcelCurrencyFormat(ws, [2, 3, 4, 8, 9], headerData.length);
			XLSX.utils.book_append_sheet(wb, ws, 'Itens Classificados');

			const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
			console.log(`✅ Repository: Excel gerado com sucesso, ${excelBuffer.length} bytes`);
			return excelBuffer;
		} catch (error) {
			console.error('❌ Erro ao exportar relatório de itens classificados para Excel:', error);
			throw error;
		}
	}

	async exportRelatorioItensClassificadosPDF(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		planoContasId?: number;
	}): Promise<Uint8Array> {
		try {
			console.log('📊 Repository: Iniciando exportação PDF - Relatório Itens Classificados');

			const dados = await this.getRelatorioItensClassificados(filters);

			// Buscar informações dos filtros para exibir no cabeçalho
			let contaNome = 'Todas';
			if (filters.contaId) {
				const contaResult = await this.db
					.prepare(
						'SELECT cc.numConta, cc.responsavel, b.nome as bancoNome FROM ContaCorrente cc LEFT JOIN Banco b ON cc.idBanco = b.id WHERE cc.id = ?',
					)
					.bind(filters.contaId)
					.first();
				if (contaResult) {
					contaNome =
						`${contaResult.bancoNome || ''} - ${contaResult.numConta || ''}${contaResult.responsavel ? ` (${contaResult.responsavel})` : ''}`.trim();
				}
			}

			const statusNome = this.statusFiltroNome(filters.status);
			const planoNome = await this.nomePlanoFiltro(filters.planoContasId);

			// Same totals as the screen/Excel: "sem centro" (pending) stays out of receitas/despesas
			const totais = this.totaisItensClassificados(dados);
			const totalReceitas = totais.receitas;
			const totalDespesas = totais.despesas;
			const totalSemCentro = totais.semCentroReceitas + totais.semCentroDespesas;

			const jsPDF = (await import('jspdf')).default;
			const autoTable = (await import('jspdf-autotable')).default;

			const doc = new jsPDF('l', 'mm', 'a4');

			// Função para desenhar cabeçalho
			const drawHeader = (pageNumber: number = 1) => {
				// Linha superior
				doc.setDrawColor(0, 0, 0);
				doc.setLineWidth(0.5);
				doc.line(20, 15, 277, 15);

				// Título principal
				doc.setTextColor(0, 0, 0);
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				doc.text('RELATÓRIO DE PLANO DE CONTAS', 20, 22);

				// Data de geração
				doc.setFontSize(9);
				doc.setFont('helvetica', 'normal');
				const dataGeracao = new Date().toLocaleDateString('pt-BR', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
				doc.text(dataGeracao, 277, 22, { align: 'right' });

				// Linha inferior do cabeçalho
				doc.line(20, 26, 277, 26);
			};

			// Função para desenhar informações dos filtros
			const drawFilters = (yStart: number) => {
				doc.setFontSize(9);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);

				// Primeira coluna
				let yPos = yStart;
				doc.text('Período:', 20, yPos);
				doc.setFont('helvetica', 'normal');
				const periodoTexto = `${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`;
				doc.text(periodoTexto, 55, yPos);

				doc.setFont('helvetica', 'bold');
				doc.text('Conta Corrente:', 20, yPos + 5);
				doc.setFont('helvetica', 'normal');
				doc.text(contaNome, 55, yPos + 5);

				// Segunda coluna
				doc.setFont('helvetica', 'bold');
				doc.text('Status:', 150, yPos);
				doc.setFont('helvetica', 'normal');
				doc.text(statusNome, 185, yPos);

				doc.setFont('helvetica', 'bold');
				doc.text('Plano de Contas:', 150, yPos + 5);
				doc.setFont('helvetica', 'normal');
				doc.text(planoNome.length > 50 ? `${planoNome.slice(0, 47)}...` : planoNome, 185, yPos + 5);

				// Nota: receitas classificadas só por centro de custos ficam no outro relatório
				doc.setFontSize(8);
				doc.setTextColor(90, 90, 90);
				doc.text(NOTA_RECEITAS_ITENS_CLASSIFICADOS, 20, yPos + 10);
				doc.setTextColor(0, 0, 0);

				// Linha separadora
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, yPos + 13, 277, yPos + 13);

				return yPos + 18;
			};

			// Função para desenhar resumo executivo
			const drawSummary = (yStart: number) => {
				doc.setFontSize(10);
				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);

				const alturaResumo = totalSemCentro > 0 ? 17 : 12;
				// Fundo cinza claro
				doc.setFillColor(245, 245, 245);
				doc.rect(20, yStart - 5, 257, alturaResumo, 'F');

				// Bordas
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.rect(20, yStart - 5, 257, alturaResumo);

				// Totais - ajustar posicionamento para evitar sobreposição.
				// Only receitas WITH plan are listed here: no "Total Geral" (R − D) to avoid a misleading saldo.
				doc.text('Receitas c/ plano:', 25, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(0, 128, 0);
				const receitasFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalReceitas);
				doc.text(receitasFormatado, 60, yStart + 2);

				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.text('Total Despesas:', 125, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(220, 20, 60);
				const despesasFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalDespesas);
				doc.text(despesasFormatado, 155, yStart + 2);

				doc.setFont('helvetica', 'normal');
				doc.setFontSize(8);
				doc.setTextColor(80, 80, 80);
				doc.text(
					`Movimentos: ${totais.movimentos} | Custeio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.custeio)} | Investimento: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.investimento)}`,
					125,
					yStart + 6,
				);
				if (totalSemCentro > 0) {
					doc.text(
						`Pendentes sem centro de custos (fora dos totais): ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSemCentro)}`,
						25,
						yStart + 10,
					);
				}
				doc.setFontSize(10);
				doc.setTextColor(0, 0, 0);

				return yStart + alturaResumo;
			};

			// Primeira página
			drawHeader(1);
			let yPos = drawFilters(32);
			yPos = drawSummary(yPos);

			// Preparar dados para tabela com sanitização
			const tableData = dados.map((mov) => {
				// Sanitizar histórico
				let historicoLimpo = String(mov.historico || '');
				try {
					historicoLimpo = historicoLimpo
						.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
						.replace(/\x00/g, '')
						.replace(/[\uFFFD]/g, '')
						.trim()
						.replace(/\s+/g, ' ');
					if (historicoLimpo.length > 60) {
						historicoLimpo = historicoLimpo.slice(0, 57) + '...';
					}
				} catch (e) {
					historicoLimpo = '-';
				}

				// Sanitizar plano de contas (débito sem plano: pendente de classificação)
				let planoLimpo = String(mov.planoDescricao || 'Sem plano');
				try {
					planoLimpo = planoLimpo
						.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
						.replace(/\x00/g, '')
						.replace(/[\uFFFD]/g, '')
						.trim();
					if (planoLimpo.length > 35) {
						planoLimpo = planoLimpo.slice(0, 32) + '...';
					}
				} catch (e) {
					planoLimpo = '-';
				}

				// Sanitizar centro de custos
				let centroLimpo = String(mov.centroCustosDescricao || '-');
				try {
					centroLimpo = centroLimpo
						.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
						.replace(/\x00/g, '')
						.replace(/[\uFFFD]/g, '')
						.trim();
					if (centroLimpo.length > 35) {
						centroLimpo = centroLimpo.slice(0, 32) + '...';
					}
				} catch (e) {
					centroLimpo = '-';
				}

				// Sanitizar pessoa
				let pessoaLimpo = String(mov.pessoaNome || '-');
				try {
					pessoaLimpo = pessoaLimpo
						.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
						.replace(/\x00/g, '')
						.replace(/[\uFFFD]/g, '')
						.trim();
				} catch (e) {
					pessoaLimpo = '-';
				}

				const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
				const semCentro = !!mov.semCentro;
				const receita = mov.tipoMovimento === 'C' ? `${brl(mov.valor)}${semCentro ? ' *' : ''}` : '-';
				// Same rule as UI/Dashboard/Fluxo: centre tipo CUSTEIO → custeio, any other tipo → investimento.
				// Debit without centre (pending) is never investimento: shown across both columns.
				const despesaCusteio = mov.tipoMovimento === 'D' && !semCentro && mov.subtipoDespesa === 'custeio' ? brl(mov.valor) : '-';
				const despesaInvestimento =
					mov.tipoMovimento === 'D' && !semCentro && mov.subtipoDespesa === 'investimento' ? brl(mov.valor) : '-';
				const despesas: any[] =
					mov.tipoMovimento === 'D' && semCentro
						? [{ content: `${brl(mov.valor)} * (sem centro)`, colSpan: 2, styles: { halign: 'center', textColor: [180, 83, 9] } }]
						: [despesaCusteio, despesaInvestimento];

				return [
					this.dataBR(mov.dtMovimento),
					historicoLimpo || '-',
					receita,
					...despesas,
					planoLimpo,
					centroLimpo,
					String((mov as any).contaDescricao || '-'),
				];
			});

			let pageNumber = 1;

			autoTable(doc, {
				startY: yPos,
				head: [
					[
						'Data',
						'Histórico',
						'Receita R$',
						'Despesa Custeio R$',
						'Despesa Investimento R$',
						'Plano de Contas',
						'Centro de Custos',
						'Conta Corrente',
					],
				],
				body: tableData,
				theme: 'striped',
				headStyles: {
					fillColor: [240, 240, 240],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
					fontSize: 9,
					lineColor: [200, 200, 200],
					lineWidth: 0.3,
				},
				bodyStyles: {
					fontSize: 8,
					textColor: [0, 0, 0],
					lineColor: [220, 220, 220],
					lineWidth: 0.2,
				},
				alternateRowStyles: {
					fillColor: [250, 250, 250],
				},
				columnStyles: {
					0: { cellWidth: 20, halign: 'left' }, // Data
					1: { cellWidth: 70, halign: 'left' }, // Histórico
					2: { cellWidth: 25, halign: 'right' }, // Valor
					3: { cellWidth: 18, halign: 'center' }, // Tipo
					4: { cellWidth: 28, halign: 'center' }, // Modalidade
					5: { cellWidth: 40, halign: 'left' }, // Plano de Contas
					6: { cellWidth: 40, halign: 'left' }, // Centro de Custos
					7: { cellWidth: 16, halign: 'left' }, // Pessoa
				},
				margin: { left: 20, right: 20, top: 2 },
				styles: {
					overflow: 'linebreak',
					cellPadding: 2,
					lineColor: [220, 220, 220],
					lineWidth: 0.2,
				},
				willDrawPage: (data: any) => {
					// Desenhar header ANTES da tabela começar em novas páginas
					if (data.pageNumber > 1) {
						doc.setPage(data.pageNumber);
						drawHeader(data.pageNumber);
						// Ajustar startY para começar após o header (26mm é onde termina o header)
						data.settings.startY = 32;
					}
				},
			});

			if (totalSemCentro > 0) {
				const finalYItens = (doc as any).lastAutoTable?.finalY;
				if (finalYItens && finalYItens < 188) {
					doc.setFontSize(8);
					doc.setFont('helvetica', 'normal');
					doc.setTextColor(120, 53, 15);
					doc.text('* Pendente sem centro de custos: fora dos totais de receitas e despesas.', 20, finalYItens + 5);
				}
			}

			// Rodapé em todas as páginas
			const totalPages = doc.getNumberOfPages();
			for (let i = 1; i <= totalPages; i++) {
				doc.setPage(i);

				// Linha separadora do rodapé
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.line(20, 195, 277, 195);

				// Numeração de páginas
				doc.setFontSize(8);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(100, 100, 100);
				doc.text(`Página ${i} de ${totalPages}`, 277, 200, { align: 'right' });
			}

			const pdfBuffer = new Uint8Array(doc.output('arraybuffer'));
			console.log(`✅ Repository: PDF gerado com sucesso, ${pdfBuffer.length} bytes`);
			return pdfBuffer;
		} catch (error) {
			console.error('❌ Erro ao exportar relatório de itens classificados para PDF:', error);
			throw error;
		}
	}
}
