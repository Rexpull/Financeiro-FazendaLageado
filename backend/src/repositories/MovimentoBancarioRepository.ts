import { MovimentoBancario } from '../models/MovimentoBancario';
import { ResultadoRepository } from './ResultadoRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';
import { FinanciamentoDetalhadoDTO } from '../models/FinanciamentoDetalhadoDTO';
import { ParcelaFinanciamentoRepository } from './ParcelaFinanciamentoRepository';
import { MovimentoCentroCustosRepository } from './MovimentoCentroCustosRepository';
import * as XLSX from 'xlsx';

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

	/**
	 * Formata um valor numérico no padrão brasileiro para Excel (0.111,22)
	 */
	private formatarMoedaExcel(valor: number): string {
		return valor.toLocaleString('pt-BR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	async getMovimentosPorDetalhamento(planoId: number, mes: number, tipo: string, ano?: number): Promise<MovimentoDetalhado[]> {
		let sql = '';
		let params: any[] = [];

		const anoUsar = ano || new Date().getFullYear();
		const primeiroDiaMes = `${anoUsar}-${String(mes + 1).padStart(2, '0')}-01`;
		const ultimoDiaMes = `${anoUsar}-${String(mes + 1).padStart(2, '0')}-31`;

		if (tipo === 'receitas' || tipo === 'despesas' || tipo === 'investimentos') {
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

	async getMovimentosPorCentroCustosDetalhamento(
		centroCustosId: number,
		mes: number,
		tipo: string,
		ano?: number,
	): Promise<MovimentoDetalhado[]> {
		let sql = '';
		let params: any[] = [];

		const anoUsar = ano || new Date().getFullYear();
		const primeiroDiaMes = `${anoUsar}-${String(mes + 1).padStart(2, '0')}-01`;
		const ultimoDiaMes = `${anoUsar}-${String(mes + 1).padStart(2, '0')}-31`;

		if (tipo === 'receitas' || tipo === 'despesas') {
			// Buscar movimentos que têm o centro de custos na tabela MovimentoCentroCustos (rateio)
			// OU que têm idCentroCustos diretamente no MovimentoBancario
			sql = `
				SELECT
					mb.id,
					mb.dtMovimento,
					mb.historico,
					COALESCE(mcc.valor, ABS(mb.valor)) as valor,
					b.nome AS bancoNome,
					cc.numConta,
					cc.numCartao,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN MovimentoCentroCustos mcc ON mb.id = mcc.idMovimentoBancario AND mcc.idCentroCustos = ?
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				WHERE (mcc.idCentroCustos = ? OR mb.idCentroCustos = ?)
				AND mb.dtMovimento BETWEEN ? AND ?
				AND mb.tipoMovimento = ?
				ORDER BY mb.dtMovimento ASC
			`;
			const tipoMovimento = tipo === 'receitas' ? 'C' : 'D';
			params = [centroCustosId, centroCustosId, centroCustosId, primeiroDiaMes, ultimoDiaMes, tipoMovimento];
		} else {
			// Para outros tipos, retornar vazio ou tratar conforme necessário
			return [];
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
			SELECT id, dtMovimento, historico, idPlanoContas, idContaCorrente, valor, saldo, ideagro, numero_Documento, descricao, transf_origem, transf_destino, identificador_ofx, criado_em, atualizado_em, idBanco, idPessoa, parcelado, idFinanciamento, idCentroCustos
			FROM MovimentoBancario
		`,
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
					idCentroCustos: result.idCentroCustos as number | undefined,
					resultadoList: resultadoList,
				};
			}),
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
					idFinanciamento,
					idCentroCustos
				FROM MovimentoBancario
				WHERE dtMovimento BETWEEN ? AND ?
				AND idContaCorrente IN (${contas.map(() => '?').join(',')})
				`,
			)
			.bind(inicioAno, fimAno, ...contas)
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

	async createBatch(movimentos: MovimentoBancario[]): Promise<{ movimentos: MovimentoBancario[]; novos: number; existentes: number }> {
		const movimentosProcessados: MovimentoBancario[] = [];
		let novos = 0;
		let existentes = 0;

		console.log(`🔄 Processando lote de ${movimentos.length} movimentos`);

		for (const movimento of movimentos) {
			try {
				// Verificar se o movimento já existe pelo identificador OFX
				const movimentoExistente = await this.getByIdentificadorOfx(movimento.identificadorOfx);

				if (movimentoExistente) {
					console.log(`📋 Movimento existente encontrado: ${movimento.identificadorOfx}`);
					movimentosProcessados.push(movimentoExistente);
					existentes++;
					continue;
				}

				// Criar novo movimento
				const idMov = await this.create(movimento);
				console.log(`✅ Novo movimento criado: ID ${idMov}`);

				// Buscar o movimento completo criado
				const movimentoCompleto = await this.getById(idMov);
				if (movimentoCompleto) {
					movimentosProcessados.push(movimentoCompleto);
					novos++;
				}
			} catch (error) {
				console.error(`❌ Erro ao processar movimento ${movimento.identificadorOfx}:`, error);
				// Continuar processando outros movimentos mesmo se houver erro
				continue;
			}
		}

		console.log(`🎉 Lote processado: ${novos} novos, ${existentes} existentes`);
		return { movimentos: movimentosProcessados, novos, existentes };
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
			idFinanciamento || null,
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
				criado_em, atualizado_em, idBanco, idPessoa, parcelado, idFinanciamento
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		if (movimento.identificadorOfx !== undefined && movimento.identificadorOfx !== movimentoAtual.identificadorOfx) {
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
		if (Object.keys(camposAlterados).length === 0 && !temResultadoList && !temCentroCustosList) {
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
			bindValues.push(camposAlterados.identificadorOfx);
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

		console.log('🧹 Limpando resultados antigos...');
		await this.resultadoRepo.deleteByMovimento(id);

		// Processar resultados se necessário
		let resultadoList = movimento.resultadoList;

		console.log('🔍 Processando resultadoList:', JSON.stringify(resultadoList, null, 2));
		console.log('🔍 resultadoList existe?', !!resultadoList);
		console.log('🔍 resultadoList.length:', resultadoList?.length);

		if (!resultadoList || resultadoList.length === 0) {
			console.log('⚠️ Nenhum resultadoList fornecido, verificando se precisa criar resultado padrão...');
			if (camposAlterados.idPlanoContas) {
				const tipo = camposAlterados.tipoMovimento || movimentoAtual.tipoMovimento || (movimentoAtual.valor >= 0 ? 'C' : 'D');
				const valorAbs = Math.abs(movimentoAtual.valor);

				console.log('⚠️ Nenhum resultado informado. Criando resultado padrão com:');
				console.log(`📌 Plano: ${camposAlterados.idPlanoContas}, Valor: ${valorAbs}, Tipo: ${tipo}`);

				resultadoList = [
					{
						dtMovimento: movimentoAtual.dtMovimento,
						idPlanoContas: camposAlterados.idPlanoContas,
						idContaCorrente: movimentoAtual.idContaCorrente,
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
		} else {
			console.log('⚠️ Nenhum resultado para processar');
		}

		// Processar centroCustosList se necessário
		console.log('🧹 Limpando centros de custos antigos...');
		await this.movimentoCentroCustosRepo.deleteByMovimento(id);

		let centroCustosList: { idMovimentoBancario: number; idCentroCustos: number; valor: number }[] | undefined =
			movimento.centroCustosList as any;
		console.log('🔍 Processando centroCustosList:', JSON.stringify(centroCustosList, null, 2));

		// Quando idCentroCustos é atualizado, a lista deve acompanhar (um único item com esse centro).
		// Assim evitamos que centroCustosList fique desatualizado quando o usuário só altera o centro único.
		if (camposAlterados.idCentroCustos !== undefined) {
			console.log('📌 idCentroCustos alterado: alinhando centroCustosList com um único item');
			centroCustosList = [
				{
					idMovimentoBancario: id,
					idCentroCustos: camposAlterados.idCentroCustos,
					valor: Math.abs(movimentoAtual.valor),
				},
			];
		} else if (!centroCustosList || centroCustosList.length === 0) {
			console.log('⚠️ Nenhum centroCustosList fornecido, verificando se precisa criar centro padrão...');
			if (movimentoAtual.idCentroCustos) {
				console.log('⚠️ Mantendo centro atual na lista (um único item)...');
				centroCustosList = [
					{
						idMovimentoBancario: id,
						idCentroCustos: movimentoAtual.idCentroCustos,
						valor: Math.abs(movimentoAtual.valor),
					},
				];
			}
		} else {
			console.log('✅ centroCustosList fornecido (rateio), processando múltiplos centros...');
		}

		if (centroCustosList?.length) {
			console.log(`📝 Criando ${centroCustosList.length} centros de custos:`);
			centroCustosList.forEach((c: any, index: number) => {
				console.log(`  ${index + 1}. Centro: ${c.idCentroCustos}, Valor: ${c.valor}`);
			});
			for (const centro of centroCustosList) {
				await this.movimentoCentroCustosRepo.criar({ ...centro, idMovimentoBancario: id });
			}
			console.log('✅ Centros de custos criados com sucesso');
		} else {
			console.log('⚠️ Nenhum centro de custos para processar');
		}

		console.log('✅ Movimento atualizado com sucesso');
	}

	async deleteById(id: number): Promise<void> {
		console.log(`🚀 ENTRANDO NO deleteById - ID: ${id} (tipo: ${typeof id})`);
		console.log(`🔍 Stack trace do deleteById:`, new Error().stack);

		// Validar se o ID é válido
		if (isNaN(id) || id <= 0) {
			console.error(`❌ ID inválido no deleteById: ${id} (tipo: ${typeof id})`);
			console.error(`❌ Stack trace do erro:`, new Error().stack);
			throw new Error(`ID inválido: ${id}`);
		}

		console.log(`🗑 Iniciando exclusão em cascata do movimento ID ${id}`);

		try {
			// 1. Primeiro, remover registros da tabela Resultado que referenciam este movimento
			console.log(`🧹 Removendo resultados relacionados ao movimento ${id}`);
			await this.resultadoRepo.deleteByMovimento(id);

			// 2. Remover registros da tabela parcelaFinanciamento que referenciam este movimento
			console.log(`🧹 Removendo parcelas de financiamento relacionadas ao movimento ${id}`);
			await this.parcelaRepo.deleteByMovimentoBancario(id);

			// 3. Remover registros da tabela MovimentoCentroCustos que referenciam este movimento
			console.log(`🧹 Removendo centros de custos relacionados ao movimento ${id}`);
			await this.movimentoCentroCustosRepo.deleteByMovimento(id);

			// 4. Por último, remover o movimento bancário principal
			console.log(`🗑 Removendo movimento bancário principal ID ${id}`);
			await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(id).run();

			console.log(`✅ Exclusão em cascata concluída com sucesso para movimento ID ${id}`);
		} catch (error) {
			console.error(`❌ Erro durante exclusão em cascata do movimento ${id}:`, error);
			throw error;
		}
	}

	async deleteAllByContaCorrente(idContaCorrente: number): Promise<{ excluidos: number }> {
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
				return { excluidos: 0 };
			}

			let excluidos = 0;

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
					continue;
				}

				const idNumerico = Number(movimentoId);
				console.log(`✅ ID numérico: ${idNumerico}`);

				try {
					// Excluir resultados relacionados
					console.log(`🧹 Excluindo resultados para movimento ${idNumerico}`);
					await this.resultadoRepo.deleteByMovimento(idNumerico);

					// Excluir parcelas relacionadas
					console.log(`🧹 Excluindo parcelas para movimento ${idNumerico}`);
					await this.parcelaRepo.deleteByMovimentoBancario(idNumerico);

					// Excluir centros de custos relacionados
					console.log(`🧹 Excluindo centros de custos para movimento ${idNumerico}`);
					await this.movimentoCentroCustosRepo.deleteByMovimento(idNumerico);

					// Excluir movimento principal
					console.log(`🗑 Excluindo movimento principal ${idNumerico}`);
					await this.db.prepare(`DELETE FROM MovimentoBancario WHERE id = ?`).bind(idNumerico).run();

					excluidos++;
					console.log(`✅ Movimento ${idNumerico} excluído com sucesso`);
				} catch (error) {
					console.error(`❌ Erro ao excluir movimento ${idNumerico}:`, error);
					continue;
				}
			}

			console.log(`🎉 Exclusão concluída: ${excluidos} movimentos excluídos`);
			return { excluidos };
		} catch (error) {
			console.error(`❌ Erro geral:`, error);
			throw error;
		}
	}

	/** Tamanho do lote para bulk delete (evita "Too many API requests" no worker). */
	private static readonly RESET_TESTE_BATCH_SIZE = 150;

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
			const placeholdersChunk = chunk.map(() => '?').join(',');
			try {
				await this.db
					.prepare(`DELETE FROM Resultado WHERE idMovimentoBancario IN (${placeholdersChunk})`)
					.bind(...chunk)
					.run();
				await this.db
					.prepare(`DELETE FROM parcelaFinanciamento WHERE idMovimentoBancario IN (${placeholdersChunk})`)
					.bind(...chunk)
					.run();
				await this.db
					.prepare(`DELETE FROM MovimentoCentroCustos WHERE idMovimentoBancario IN (${placeholdersChunk})`)
					.bind(...chunk)
					.run();
				await this.db
					.prepare(`DELETE FROM MovimentoBancario WHERE id IN (${placeholdersChunk})`)
					.bind(...chunk)
					.run();
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

	async updateContaMovimentosOFX(idMovimentos: number[], novaContaId: number): Promise<{ atualizados: number }> {
		console.log(`🔄 Atualizando conta de ${idMovimentos.length} movimentos para conta ${novaContaId}`);

		if (!idMovimentos || idMovimentos.length === 0) {
			throw new Error('Lista de IDs de movimentos não pode estar vazia');
		}

		if (!novaContaId || novaContaId <= 0) {
			throw new Error('ID da nova conta deve ser válido');
		}

		// Processar em lotes para evitar erro "too many SQL variables"
		const BATCH_SIZE = 10; // Reduzido para 10 para máxima segurança com SQLite
		let totalAtualizados = 0;
		const totalLotes = Math.ceil(idMovimentos.length / BATCH_SIZE);

		console.log(`📦 Processando ${idMovimentos.length} movimentos em ${totalLotes} lotes de ${BATCH_SIZE}`);

		for (let i = 0; i < idMovimentos.length; i += BATCH_SIZE) {
			const batch = idMovimentos.slice(i, i + BATCH_SIZE);
			const numeroLote = Math.floor(i / BATCH_SIZE) + 1;

			console.log(`🔍 Processando lote ${numeroLote}/${totalLotes}: ${batch.length} movimentos`);

			try {
				// Criar placeholders para a query IN
				const placeholders = batch.map(() => '?').join(',');

				const sql = `
						UPDATE MovimentoBancario
						SET idContaCorrente = ?, atualizado_em = datetime('now')
						WHERE id IN (${placeholders})
					`;

				const params = [novaContaId, ...batch];

				console.log(`📝 Executando lote ${numeroLote}/${totalLotes}:`, sql);
				console.log(`📝 Parâmetros do lote ${numeroLote} (${params.length} parâmetros):`, params);
				console.log(`📝 IDs no lote ${numeroLote}:`, batch);

				const result = await this.db
					.prepare(sql)
					.bind(...params)
					.run();

				const atualizadosNoLote = (result as any).changes || 0;
				totalAtualizados += atualizadosNoLote;

				console.log(`✅ Lote ${numeroLote}/${totalLotes} processado: ${atualizadosNoLote} movimentos atualizados`);

				// Pequena pausa entre lotes para evitar sobrecarga
				if (numeroLote < totalLotes) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			} catch (error) {
				console.error(`❌ Erro no lote ${numeroLote}/${totalLotes}:`, error);
				console.error(`❌ Batch que falhou:`, batch);
				console.error(`❌ Parâmetros que falharam:`, [novaContaId, ...batch]);
				throw new Error(`Falha no lote ${numeroLote}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
			}
		}

		console.log(`🎉 Processamento concluído: ${totalAtualizados} movimentos atualizados em ${totalLotes} lotes`);

		return { atualizados: totalAtualizados };
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
			`,
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
					data.idUsuario,
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
			`,
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
					data.idUsuario,
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
			idCentroCustos: result.idCentroCustos as number | undefined,
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
			idCentroCustos: result.idCentroCustos as number | undefined,
			resultadoList: resultadoList,
			centroCustosList: centroCustosList,
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

	/** Retorna financiamentos contratados no mês/ano (dataContrato no período) para o credor, para detalhamento da linha "Contratados". */
	async getDetalhesFinanciamentoContratados(credorKey: string, mes: number, ano: number): Promise<FinanciamentoDetalhadoDTO[]> {
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
			  AND f.dataContrato BETWEEN ? AND ?
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
						idCentroCustos: result.idCentroCustos as number | undefined,
						resultadoList: resultadoList,
					};
				}),
			);

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

			if (filters.status === 'pendentes') {
				// Pendente = sem plano E não conciliado como financiamento (quem tem modalidade financiamento + idFinanciamento já está conciliado)
				whereConditions.push('(mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0)');
				whereConditions.push("(mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento != 'financiamento' OR mb.idFinanciamento IS NULL)");
			}

			if (filters.planosIds && filters.planosIds.length > 0) {
				const placeholders = filters.planosIds.map(() => '?').join(',');
				whereConditions.push(`mb.idPlanoContas IN (${placeholders})`);
				params.push(...filters.planosIds);
			}

			if (filters.centrosIds && filters.centrosIds.length > 0) {
				const placeholders = filters.centrosIds.map(() => '?').join(',');
				whereConditions.push(`mb.idCentroCustos IN (${placeholders})`);
				params.push(...filters.centrosIds);
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

	async exportToExcel(filters: { contaId?: number; dataInicio?: string; dataFim?: string; status?: string }): Promise<Buffer> {
		try {
			console.log('📊 Repository: Iniciando exportação Excel com filtros:', filters);

			// Construir query base
			let whereConditions: string[] = [];
			let params: any[] = [];

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

			if (filters.status === 'pendentes') {
				whereConditions.push('(mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0)');
				whereConditions.push("(mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento != 'financiamento' OR mb.idFinanciamento IS NULL)");
			}

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query para buscar todos os movimentos que atendem aos filtros
			const query = `
				SELECT 
					mb.*,
					pc.descricao as planoDescricao,
					b.nome as bancoNome,
					p.nome as pessoaNome,
					cc.numConta,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN PlanoContas pc ON mb.idPlanoContas = pc.id
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
				'Data do Movimento': new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
				Histórico: mov.historico,
				Tipo: mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
				Modalidade: mov.modalidadeMovimento || 'Padrão',
				'Plano de Contas': mov.planoDescricao || 'Não definido',
				'Valor R$': mov.valor,
				IdeAgri: mov.ideagro ? 'Sim' : 'Não',
				Pessoa: mov.pessoaNome || '',
				Banco: mov.bancoNome || '',
				Parcelado: mov.parcelado ? 'Sim' : 'Não',
				'Nº Documento': mov.modalidadeMovimento === 'financiamento' ? mov.numeroDocumento : '',
				Conta: `${mov.numConta || ''} - ${mov.responsavel || ''}`,
			}));

			// Criar workbook
			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.json_to_sheet(dadosParaExportar);

			// Adicionar cabeçalho com informações da exportação
			const header = [
				['Exportado em:', new Date().toLocaleString('pt-BR')],
				['Período:', `${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`],
				['Status:', filters.status === 'pendentes' ? 'Apenas Pendentes' : 'Todos os Movimentos'],
				['Total de registros:', results.length],
				[],
			];

			const headerWs = XLSX.utils.aoa_to_sheet(header);
			XLSX.utils.sheet_add_json(headerWs, dadosParaExportar, { origin: 'A6', skipHeader: false });

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

	async exportToPDF(filters: { contaId?: number; dataInicio?: string; dataFim?: string; status?: string }): Promise<Uint8Array> {
		try {
			console.log('🔍 Repository: Iniciando exportação PDF com filtros:', filters);

			// Construir query base
			let whereConditions: string[] = [];
			let params: any[] = [];

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

			if (filters.status === 'pendentes') {
				whereConditions.push('(mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0)');
				whereConditions.push("(mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento != 'financiamento' OR mb.idFinanciamento IS NULL)");
			}

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query para buscar dados com informações da conta
			const query = `
				SELECT 
					mb.*,
					cc.numConta,
					b.nome as bancoNome,
					pc.descricao as planoDescricao,
					p.nome as pessoaNome,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				LEFT JOIN PlanoContas pc ON mb.idPlanoContas = pc.id
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

			doc.text(`Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`, 20, yPos);
			yPos += 8;
			doc.text(`Status: ${filters.status === 'pendentes' ? 'Apenas Pendentes' : 'Todos os Movimentos'}`, 20, yPos);
			yPos += 8;
			doc.text(`Total de movimentos: ${results.length}`, 20, yPos);
			yPos += 8;
			doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, yPos);
			yPos += 8;
			doc.text(`Gerado por: Sistema Financeiro Fazenda Lageado`, 20, yPos);

			// Preparar dados para a tabela
			const dadosTabela = results.map((result: any) => [
				new Date(result.dtMovimento).toLocaleDateString('pt-BR'),
				result.historico || '',
				result.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
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

	async getMovimentosPorCentroCustos(filters?: { dataInicio?: string; dataFim?: string }) {
		try {
			let sql = `
				SELECT 
					mb.id as idMovimento,
					mb.dtMovimento,
					mb.historico,
					mb.valor,
					mb.tipoMovimento,
					mb.idCentroCustos,
					mb.idPlanoContas,
					cc.descricao as descricaoCentroCustos,
					cco.numConta,
					cco.numCartao,
					cco.responsavel,
					b.nome as bancoNome
				FROM MovimentoBancario mb
				INNER JOIN CentroCustos cc ON mb.idCentroCustos = cc.id
				LEFT JOIN ContaCorrente cco ON mb.idContaCorrente = cco.id
				LEFT JOIN Banco b ON cco.idBanco = b.id
				WHERE mb.idPlanoContas IS NOT NULL
				AND mb.idCentroCustos IS NOT NULL
			`;

			const params: any[] = [];

			if (filters?.dataInicio && filters?.dataFim) {
				sql += ` AND mb.dtMovimento BETWEEN ? AND ?`;
				params.push(filters.dataInicio, filters.dataFim);
			}

			sql += ` ORDER BY mb.dtMovimento ASC`;

			const { results } = await this.db
				.prepare(sql)
				.bind(...params)
				.all();

			// Agrupar por centro de custos
			const agrupados: { [key: string]: any } = {};

			for (const row of results as any[]) {
				const key = row.idCentroCustos;
				const descricao = row.descricaoCentroCustos;

				if (!agrupados[key]) {
					agrupados[key] = {
						idCentroCustos: row.idCentroCustos,
						descricao: descricao,
						totalReceitas: 0,
						totalDespesas: 0,
						saldoLiquido: 0,
						movimentos: [],
					};
				}

				const valor = Number(row.valor);

				// Formatar nome da conta bancária
				const contaFormatada = `${row.bancoNome || 'Banco'} - ${row.numConta || row.numCartao || '???'}${row.responsavel ? ` - ${row.responsavel}` : ''}`;

				agrupados[key].movimentos.push({
					id: row.idMovimento,
					data: row.dtMovimento,
					historico: row.historico,
					valor: valor,
					tipo: row.tipoMovimento,
					idPlanoContas: row.idPlanoContas,
					contaBancaria: contaFormatada,
				});

				if (row.tipoMovimento === 'C') {
					agrupados[key].totalReceitas += valor;
				} else if (row.tipoMovimento === 'D') {
					agrupados[key].totalDespesas += valor;
				}
			}

			// Calcular saldo líquido para cada grupo
			const result = Object.values(agrupados).map((grupo: any) => {
				grupo.saldoLiquido = grupo.totalReceitas - grupo.totalDespesas;
				return grupo;
			});

			return result;
		} catch (error) {
			console.error('Erro ao buscar movimentos por centro de custos:', error);
			throw error;
		}
	}

	async getRelatorioCentroCustos(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}): Promise<
		Array<{
			centro: { id: number; descricao: string; tipo?: string; tipoReceitaDespesa?: string };
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
			}>;
		}>
	> {
		try {
			console.log('🔍 Repository: Buscando relatório de centro de custos com filtros:', filters);

			// Construir query base
			let whereConditions: string[] = [];
			let params: any[] = [];

			// Buscar movimentos conciliados:
			// - Despesas: devem ter plano de contas
			// - Receitas: devem ter centro de custos (mesmo sem plano de contas)
			whereConditions.push(`(
				(mb.idPlanoContas IS NOT NULL AND mb.idPlanoContas != 0) 
				OR 
				(
					mb.tipoMovimento = 'C' 
					AND (
						mb.idCentroCustos IS NOT NULL 
						OR EXISTS (
							SELECT 1 
							FROM MovimentoCentroCustos mcc 
							WHERE mcc.idMovimentoBancario = mb.id
						)
					)
				)
			)`);

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

			if (filters.status === 'pendentes') {
				// Pendentes: despesas sem plano OU receitas sem centro; excluir conciliados como financiamento
				whereConditions.push(`(
					(mb.tipoMovimento = 'D' AND (mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0))
					OR
					(
						mb.tipoMovimento = 'C' 
						AND mb.idCentroCustos IS NULL 
						AND NOT EXISTS (
							SELECT 1 
							FROM MovimentoCentroCustos mcc 
							WHERE mcc.idMovimentoBancario = mb.id
						)
					)
				)`);
				whereConditions.push("(mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento != 'financiamento' OR mb.idFinanciamento IS NULL)");
			}

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query para buscar movimentos com informações relacionadas
			const query = `
				SELECT 
					mb.id,
					mb.dtMovimento,
					mb.historico,
					mb.valor,
					mb.tipoMovimento,
					mb.idPlanoContas,
					mb.idCentroCustos,
					mb.idPessoa,
					mb.idBanco,
					mb.idContaCorrente,
					pc.descricao as planoDescricao,
					p.nome as pessoaNome,
					b.nome as bancoNome,
					b.codigo as bancoCodigo,
					cc.numConta,
					cc.agencia,
					cc.responsavel,
					cco.id as centroCustosId,
					cco.descricao as centroCustosDescricao,
					cco.tipo as centroCustosTipo,
					cco.tipoReceitaDespesa as centroCustosTipoReceitaDespesa
				FROM MovimentoBancario mb
				LEFT JOIN PlanoContas pc ON mb.idPlanoContas = pc.id
				LEFT JOIN Pessoa p ON mb.idPessoa = p.id
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				LEFT JOIN CentroCustos cco ON mb.idCentroCustos = cco.id
				${whereClause}
				ORDER BY mb.dtMovimento DESC
			`;

			const { results } = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			console.log(`📊 Repository: ${results.length} movimentos encontrados`);

			// Buscar também movimentos com rateio (centroCustosList)
			const movimentosComRateio = await Promise.all(
				results.map(async (mov: any) => {
					const centroCustosList = await this.movimentoCentroCustosRepo.buscarPorMovimento(mov.id);
					return { ...mov, centroCustosList };
				}),
			);

			// Agrupar por centro de custos
			const agrupados: Map<
				number,
				{
					centro: { id: number; descricao: string; tipo?: string; tipoReceitaDespesa?: string };
					total: number;
					movimentos: any[];
				}
			> = new Map();

			for (const mov of movimentosComRateio as any[]) {
				const centrosDoMovimento: Array<{ id: number; descricao: string; tipo?: string; tipoReceitaDespesa?: string; valor: number }> = [];

				// Se tem rateio (centroCustosList), usar ele
				if (mov.centroCustosList && mov.centroCustosList.length > 0) {
					for (const cc of mov.centroCustosList) {
						// Buscar informações do centro de custos
						const centroInfo = await this.db
							.prepare('SELECT id, descricao, tipo, tipoReceitaDespesa FROM CentroCustos WHERE id = ?')
							.bind(cc.idCentroCustos)
							.first();

						if (centroInfo) {
							centrosDoMovimento.push({
								id: centroInfo.id as number,
								descricao: centroInfo.descricao as string,
								tipo: centroInfo.tipo as string,
								tipoReceitaDespesa: centroInfo.tipoReceitaDespesa as string,
								valor: Math.abs(cc.valor),
							});
						}
					}
				} else if (mov.idCentroCustos) {
					// Centro único
					centrosDoMovimento.push({
						id: mov.centroCustosId || mov.idCentroCustos,
						descricao: mov.centroCustosDescricao || 'Não definido',
						tipo: mov.centroCustosTipo,
						tipoReceitaDespesa: mov.centroCustosTipoReceitaDespesa,
						valor: Math.abs(mov.valor),
					});
				}

				// Filtrar por centroCustosId se especificado
				if (filters.centroCustosId) {
					const temCentro = centrosDoMovimento.some((cc) => cc.id === filters.centroCustosId);
					if (!temCentro) continue;
				}

				// Adicionar movimento a cada centro
				for (const centroMov of centrosDoMovimento) {
					if (!agrupados.has(centroMov.id)) {
						agrupados.set(centroMov.id, {
							centro: {
								id: centroMov.id,
								descricao: centroMov.descricao,
								tipo: centroMov.tipo,
								tipoReceitaDespesa: centroMov.tipoReceitaDespesa,
							},
							total: 0,
							movimentos: [],
						});
					}

					const grupo = agrupados.get(centroMov.id)!;
					grupo.total += centroMov.valor;
					grupo.movimentos.push({
						id: mov.id,
						dtMovimento: mov.dtMovimento,
						historico: mov.historico,
						valor: centroMov.valor,
						tipoMovimento: mov.tipoMovimento,
						planoDescricao: mov.planoDescricao,
						pessoaNome: mov.pessoaNome,
						bancoNome: mov.bancoNome,
						bancoCodigo: mov.bancoCodigo,
						agencia: mov.agencia,
						numConta: mov.numConta,
						contaDescricao:
							`${mov.bancoNome || ''}${mov.agencia ? ` - ${mov.agencia}` : ''}${mov.numConta ? ` - ${mov.numConta}` : ''}${mov.responsavel ? ` (${mov.responsavel})` : ''}`.trim(),
					});
				}
			}

			const resultado = Array.from(agrupados.values());
			// Ordenar: RECEITA antes de DESPESA; dentro de cada tipo, por centro.descricao (alfabético)
			resultado.sort((a, b) => {
				const tipoA = a.centro.tipoReceitaDespesa === 'RECEITA' ? 0 : 1;
				const tipoB = b.centro.tipoReceitaDespesa === 'RECEITA' ? 0 : 1;
				if (tipoA !== tipoB) return tipoA - tipoB;
				return (a.centro.descricao || '').localeCompare(b.centro.descricao || '');
			});
			console.log(`✅ Repository: Relatório agrupado em ${resultado.length} centros de custos`);
			return resultado;
		} catch (error) {
			console.error('❌ Erro ao buscar relatório de centro de custos:', error);
			throw error;
		}
	}

	async getRelatorioItensClassificados(filters: { dataInicio?: string; dataFim?: string; contaId?: number; status?: string }): Promise<
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
			pessoaNome?: string;
			bancoNome?: string;
			responsavel?: string;
			contaDescricao?: string;
		}>
	> {
		try {
			console.log('🔍 Repository: Buscando relatório de itens classificados com filtros:', filters);

			// Construir query base - apenas movimentos conciliados
			let whereConditions: string[] = [];
			let params: any[] = [];

			// Apenas movimentos com plano de contas (classificados)
			whereConditions.push('mb.idPlanoContas IS NOT NULL AND mb.idPlanoContas != 0');
			whereConditions.push("(mb.modalidadeMovimento IS NULL OR mb.modalidadeMovimento != 'transferencia')");

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

			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

			// Query para buscar movimentos classificados
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
					pc.descricao as planoDescricao,
					cco.descricao as centroCustosDescricao,
					cco.tipo as centroCustosTipo,
					p.nome as pessoaNome,
					b.nome as bancoNome,
					b.codigo as bancoCodigo,
					cc.numConta,
					cc.agencia,
					cc.responsavel
				FROM MovimentoBancario mb
				LEFT JOIN PlanoContas pc ON mb.idPlanoContas = pc.id
				LEFT JOIN CentroCustos cco ON mb.idCentroCustos = cco.id
				LEFT JOIN Pessoa p ON mb.idPessoa = p.id
				LEFT JOIN ContaCorrente cc ON mb.idContaCorrente = cc.id
				LEFT JOIN Banco b ON cc.idBanco = b.id
				${whereClause}
				ORDER BY mb.dtMovimento DESC
			`;

			const { results } = await this.db
				.prepare(query)
				.bind(...params)
				.all();

			console.log(`📊 Repository: ${results.length} movimentos classificados encontrados`);

			// Processar resultados incluindo rateios
			const movimentosProcessados: any[] = [];

			for (const mov of results as any[]) {
				// Verificar se tem rateio de centros de custos
				const centroCustosList = await this.movimentoCentroCustosRepo.buscarPorMovimento(mov.id);

				if (centroCustosList && centroCustosList.length > 0) {
					// Múltiplos centros (rateio) - criar uma linha para cada
					for (const cc of centroCustosList) {
						const centroInfo = await this.db
							.prepare('SELECT descricao, tipo FROM CentroCustos WHERE id = ?')
							.bind(cc.idCentroCustos)
							.first();

						movimentosProcessados.push({
							id: mov.id,
							dtMovimento: mov.dtMovimento,
							historico: mov.historico,
							valor: Math.abs(cc.valor),
							tipoMovimento: mov.tipoMovimento,
							modalidadeMovimento: mov.modalidadeMovimento || 'padrao',
							idPlanoContas: mov.idPlanoContas,
							planoDescricao: mov.planoDescricao,
							centroCustosDescricao: (centroInfo?.descricao as string) || 'Não definido',
							centroCustosTipo: (centroInfo?.tipo as string) || null,
							pessoaNome: mov.pessoaNome,
							bancoNome: mov.bancoNome,
							bancoCodigo: mov.bancoCodigo,
							agencia: mov.agencia,
							numConta: mov.numConta,
							responsavel: mov.responsavel || '',
							contaDescricao:
								`${mov.bancoNome || ''}${mov.agencia ? ` - ${mov.agencia}` : ''}${mov.numConta ? ` - ${mov.numConta}` : ''}${mov.responsavel ? ` (${mov.responsavel})` : ''}`.trim(),
						});
					}
				} else {
					// Centro único ou sem centro
					movimentosProcessados.push({
						id: mov.id,
						dtMovimento: mov.dtMovimento,
						historico: mov.historico,
						valor: Math.abs(mov.valor),
						tipoMovimento: mov.tipoMovimento,
						modalidadeMovimento: mov.modalidadeMovimento || 'padrao',
						idPlanoContas: mov.idPlanoContas,
						planoDescricao: mov.planoDescricao,
						centroCustosDescricao: mov.centroCustosDescricao || 'Não definido',
						centroCustosTipo: mov.centroCustosTipo || null,
						pessoaNome: mov.pessoaNome,
						bancoNome: mov.bancoNome,
						bancoCodigo: mov.bancoCodigo,
						agencia: mov.agencia,
						numConta: mov.numConta,
						responsavel: mov.responsavel || '',
						contaDescricao:
							`${mov.bancoNome || ''}${mov.agencia ? ` - ${mov.agencia}` : ''}${mov.numConta ? ` - ${mov.numConta}` : ''}${mov.responsavel ? ` (${mov.responsavel})` : ''}`.trim(),
					});
				}
			}

			return movimentosProcessados;
		} catch (error) {
			console.error('❌ Erro ao buscar relatório de itens classificados:', error);
			throw error;
		}
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

			const statusNome = filters.status === 'conciliados' ? 'Conciliados' : filters.status === 'pendentes' ? 'Pendentes' : 'Todos';

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
				['Centro de Custos', 'Receita R$', 'Despesa Custeio R$', 'Despesa Investimento R$'],
			];

			// Calcular totais
			const totalReceitas = dados.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA').reduce((sum, item) => sum + item.total, 0);
			const totalDespesasCusteio = dados
				.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA' && item.centro.tipo === 'CUSTEIO')
				.reduce((sum, item) => sum + item.total, 0);
			const totalDespesasInvestimento = dados
				.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA' && item.centro.tipo === 'INVESTIMENTO')
				.reduce((sum, item) => sum + item.total, 0);

			// Montar linhas do resumo: centros na ordem (receitas depois despesas) + Total Receitas após receitas + Total Despesas após despesas + TOTAL
			const resumoRows: (string | number)[][] = [];
			let ultimoEraReceita: boolean | null = null;
			for (const item of dados) {
				const ehReceita = item.centro.tipoReceitaDespesa === 'RECEITA';
				if (ultimoEraReceita === true && !ehReceita) {
					resumoRows.push(['Total Receitas', this.formatarMoedaExcel(totalReceitas), '', '']);
				}
				ultimoEraReceita = ehReceita;
				const receita = ehReceita ? item.total : 0;
				const despesaCusteio = !ehReceita && item.centro.tipo === 'CUSTEIO' ? item.total : 0;
				const despesaInvestimento = !ehReceita && item.centro.tipo === 'INVESTIMENTO' ? item.total : 0;
				resumoRows.push([
					item.centro.descricao,
					this.formatarMoedaExcel(receita),
					this.formatarMoedaExcel(despesaCusteio),
					this.formatarMoedaExcel(despesaInvestimento),
				]);
			}
			if (ultimoEraReceita === true) {
				resumoRows.push(['Total Receitas', this.formatarMoedaExcel(totalReceitas), '', '']);
			}
			resumoRows.push([
				'Total Despesas',
				'',
				this.formatarMoedaExcel(totalDespesasCusteio),
				this.formatarMoedaExcel(totalDespesasInvestimento),
			]);
			resumoRows.push([
				'TOTAL',
				this.formatarMoedaExcel(totalReceitas),
				this.formatarMoedaExcel(totalDespesasCusteio),
				this.formatarMoedaExcel(totalDespesasInvestimento),
			]);

			const wsResumo = XLSX.utils.aoa_to_sheet([...headerData, ...resumoRows]);
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
				['Centro de Custos', 'Data', 'Histórico', 'Valor R$', 'Tipo', 'Plano de Contas', 'Pessoa', 'Conta'],
			];

			const detalhamentoData: any[] = [];
			for (const item of dados) {
				for (const mov of item.movimentos) {
					detalhamentoData.push([
						item.centro.descricao,
						new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
						mov.historico,
						this.formatarMoedaExcel(mov.valor),
						mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						mov.planoDescricao || '',
						mov.pessoaNome || '',
						mov.contaDescricao || '',
					]);
				}
			}

			const wsDetalhamento = XLSX.utils.aoa_to_sheet([...detalhamentoHeader, ...detalhamentoData]);
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

			const statusNome = filters.status === 'conciliados' ? 'Conciliados' : filters.status === 'pendentes' ? 'Pendentes' : 'Todos';

			// Calcular totais
			const totalReceitas = dados.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA').reduce((sum, item) => sum + item.total, 0);

			const totalDespesas = dados.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA').reduce((sum, item) => sum + item.total, 0);

			const totalDespesasCusteio = dados
				.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA' && item.centro.tipo === 'CUSTEIO')
				.reduce((sum, item) => sum + item.total, 0);

			const totalDespesasInvestimento = dados
				.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA' && item.centro.tipo === 'INVESTIMENTO')
				.reduce((sum, item) => sum + item.total, 0);

			const totalGeral = totalReceitas - totalDespesas;

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

				// Fundo cinza claro
				doc.setFillColor(245, 245, 245);
				doc.rect(20, yStart - 5, 257, 15, 'F');

				// Bordas
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.rect(20, yStart - 5, 257, 15);

				// Totais - ajustar posicionamento para evitar sobreposição
				doc.text('Total Receitas:', 25, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(0, 128, 0);
				const receitasFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalReceitas);
				doc.text(receitasFormatado, 55, yStart + 2);

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

				// Adicionar detalhamento de despesas
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(8);
				doc.text(
					`(Custeio: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesasCusteio)} | Investimento: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesasInvestimento)})`,
					125,
					yStart + 5,
				);

				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.text('Total Geral:', 225, yStart + 2);
				const geralFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalGeral);
				doc.text(geralFormatado, 248, yStart + 2);

				doc.setTextColor(0, 0, 0);

				return yStart + 15;
			};

			// Primeira página
			drawHeader(1);
			let yPos = drawFilters(32);
			yPos = drawSummary(yPos);

			const dadosReceitas = dados.filter((item) => item.centro.tipoReceitaDespesa === 'RECEITA');
			const dadosDespesas = dados.filter((item) => item.centro.tipoReceitaDespesa === 'DESPESA');

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

			// Lista todos os movimentos expandidos: receitas -> Total Receitas -> despesas -> Total Despesas
			let isFirstPage = true;
			let pageNumber = 1;

			for (const item of dadosReceitas) {
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
					if (item.centro.tipo === 'INVESTIMENTO') {
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
					if (item.centro.tipo === 'INVESTIMENTO') {
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
						new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
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
					margin: { left: 20, right: 20, top: 2 },
					styles: {
						overflow: 'linebreak',
						cellPadding: 2,
						lineColor: [220, 220, 220],
						lineWidth: 0.2,
					},
					didDrawPage: (data: any) => {
						// Se precisar de nova página, adicionar cabeçalho novamente
						if (data.pageNumber > pageNumber) {
							pageNumber = data.pageNumber;
							drawHeader(pageNumber);
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

			if (dadosReceitas.length > 0) {
				if (yPos > 180) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				yPos = drawTotalizador('Total Receitas', totalReceitas, 0, 0, yPos);
			}

			for (const item of dadosDespesas) {
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
					if (item.centro.tipo === 'INVESTIMENTO') {
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
				if (item.centro.tipo === 'INVESTIMENTO') {
					doc.setTextColor(30, 64, 175);
				} else {
					doc.setTextColor(220, 20, 60);
				}
				const tipoInfo = `${item.centro.tipoReceitaDespesa || ''}${item.centro.tipo ? ` - ${item.centro.tipo}` : ''}`;
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
						new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
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
					margin: { left: 20, right: 20, top: 2 },
					styles: { overflow: 'linebreak', cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.2 },
					didDrawPage: (data: any) => {
						if (data.pageNumber > pageNumber) {
							pageNumber = data.pageNumber;
							drawHeader(pageNumber);
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

			if (dadosDespesas.length > 0) {
				if (yPos > 180) {
					pageNumber++;
					doc.addPage();
					drawHeader(pageNumber);
					yPos = 32;
				}
				yPos = drawTotalizador('Total Despesas', 0, totalDespesasCusteio, totalDespesasInvestimento, yPos);
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

	async exportRelatorioItensClassificadosExcel(filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
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

			const statusNome = filters.status === 'conciliados' ? 'Conciliados' : filters.status === 'pendentes' ? 'Pendentes' : 'Todos';

			// Criar header igual ao de Centro de Custos
			const headerData = [
				['RELATÓRIO DE PLANO DE CONTAS'],
				[''],
				['Filtros Aplicados:'],
				[`Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Fim'}`],
				[`Conta Corrente: ${contaNome}`],
				[`Status: ${statusNome}`],
				[''],
				['Plano de Contas'],
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
			];

			// Preparar dados para Excel
			const dadosParaExportar = dados.map((mov) => {
				const receita = mov.tipoMovimento === 'C' ? mov.valor : 0;
				const despesaCusteio = mov.tipoMovimento === 'D' && (mov as any).centroCustosTipo === 'CUSTEIO' ? mov.valor : 0;
				const despesaInvestimento = mov.tipoMovimento === 'D' && (mov as any).centroCustosTipo === 'INVESTIMENTO' ? mov.valor : 0;
				// Se despesa sem tipo definido, colocar em custeio
				const despesaSemTipo = mov.tipoMovimento === 'D' && !(mov as any).centroCustosTipo ? mov.valor : 0;
				return [
					new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
					mov.historico || '',
					this.formatarMoedaExcel(receita),
					this.formatarMoedaExcel(despesaCusteio || despesaSemTipo),
					this.formatarMoedaExcel(despesaInvestimento),
					mov.planoDescricao || '',
					mov.centroCustosDescricao || '',
					(mov as any).responsavel || '',
				];
			});

			// Calcular totais
			const totalReceitas = dados.filter((mov) => mov.tipoMovimento === 'C').reduce((sum, mov) => sum + mov.valor, 0);
			const totalDespesasCusteio = dados
				.filter((mov) => mov.tipoMovimento === 'D' && ((mov as any).centroCustosTipo === 'CUSTEIO' || !(mov as any).centroCustosTipo))
				.reduce((sum, mov) => sum + mov.valor, 0);
			const totalDespesasInvestimento = dados
				.filter((mov) => mov.tipoMovimento === 'D' && (mov as any).centroCustosTipo === 'INVESTIMENTO')
				.reduce((sum, mov) => sum + mov.valor, 0);

			// Adicionar linha de total
			const linhaTotal = [
				'TOTAL',
				'',
				this.formatarMoedaExcel(totalReceitas),
				this.formatarMoedaExcel(totalDespesasCusteio),
				this.formatarMoedaExcel(totalDespesasInvestimento),
				'',
				'',
				'',
			];

			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet([...headerData, ...dadosParaExportar, linhaTotal]);
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

			const statusNome = filters.status === 'conciliados' ? 'Conciliados' : filters.status === 'pendentes' ? 'Pendentes' : 'Todos';

			// Calcular totais
			const totalReceitas = dados.filter((item) => item.tipoMovimento === 'C').reduce((sum, item) => sum + item.valor, 0);

			const totalDespesas = dados.filter((item) => item.tipoMovimento === 'D').reduce((sum, item) => sum + item.valor, 0);

			const totalDespesasCusteio = dados
				.filter((item) => item.tipoMovimento === 'D' && (item as any).centroCustosTipo === 'CUSTEIO')
				.reduce((sum, item) => sum + item.valor, 0);

			const totalDespesasInvestimento = dados
				.filter((item) => item.tipoMovimento === 'D' && (item as any).centroCustosTipo === 'INVESTIMENTO')
				.reduce((sum, item) => sum + item.valor, 0);

			const totalGeral = totalReceitas - totalDespesas;

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

				// Fundo cinza claro
				doc.setFillColor(245, 245, 245);
				doc.rect(20, yStart - 5, 257, 12, 'F');

				// Bordas
				doc.setDrawColor(200, 200, 200);
				doc.setLineWidth(0.3);
				doc.rect(20, yStart - 5, 257, 12);

				// Totais - ajustar posicionamento para evitar sobreposição
				doc.text('Total Receitas:', 25, yStart + 2);
				doc.setFont('helvetica', 'normal');
				doc.setTextColor(0, 128, 0);
				const receitasFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalReceitas);
				doc.text(receitasFormatado, 55, yStart + 2);

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

				doc.setFont('helvetica', 'bold');
				doc.setTextColor(0, 0, 0);
				doc.text('Total Geral:', 225, yStart + 2);
				const geralFormatado = new Intl.NumberFormat('pt-BR', {
					style: 'currency',
					currency: 'BRL',
				}).format(totalGeral);
				doc.text(geralFormatado, 248, yStart + 2);

				doc.setTextColor(0, 0, 0);

				return yStart + 12;
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

				// Sanitizar plano de contas
				let planoLimpo = String(mov.planoDescricao || '-');
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

				const receita =
					mov.tipoMovimento === 'C' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor) : '-';
				const despesaCusteio =
					mov.tipoMovimento === 'D' && (mov as any).centroCustosTipo === 'CUSTEIO'
						? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor)
						: '-';
				const despesaInvestimento =
					mov.tipoMovimento === 'D' && (mov as any).centroCustosTipo === 'INVESTIMENTO'
						? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor)
						: '-';
				const despesaSemTipo =
					mov.tipoMovimento === 'D' && !(mov as any).centroCustosTipo
						? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mov.valor)
						: '-';

				return [
					new Date(mov.dtMovimento).toLocaleDateString('pt-BR'),
					historicoLimpo || '-',
					receita,
					despesaCusteio || despesaSemTipo,
					despesaInvestimento,
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
