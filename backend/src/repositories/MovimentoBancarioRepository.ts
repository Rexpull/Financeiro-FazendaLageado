import { MovimentoBancario } from '../models/MovimentoBancario';
import { ResultadoRepository } from './ResultadoRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';
import { FinanciamentoDetalhadoDTO } from '../models/FinanciamentoDetalhadoDTO';
import { ParcelaFinanciamentoRepository } from './ParcelaFinanciamentoRepository';
import * as XLSX from 'xlsx';

export class MovimentoBancarioRepository {
	private db: D1Database;
	private resultadoRepo: ResultadoRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;

	constructor(db: D1Database) {
		this.db = db;
		this.resultadoRepo = new ResultadoRepository(db);
		this.parcelaRepo = new ParcelaFinanciamentoRepository(db);
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

	async createBatch(movimentos: MovimentoBancario[]): Promise<{ movimentos: MovimentoBancario[], novos: number, existentes: number }> {
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

		console.log('🔧 Campos que serão alterados:', camposAlterados);

		// Verificar se há resultadoList para processar
		const temResultadoList = movimento.resultadoList && movimento.resultadoList.length > 0;
		console.log('🔍 Tem resultadoList para processar?', temResultadoList);

		// Se não há campos para alterar E não há resultadoList, retornar
		if (Object.keys(camposAlterados).length === 0 && !temResultadoList) {
			console.log('ℹ️ Nenhum campo foi alterado e não há resultadoList para processar');
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

			await this.db.prepare(query).bind(...bindValues).run();
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
			
			// 3. Por último, remover o movimento bancário principal
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
			const movimentos = await this.db.prepare(`
				SELECT id FROM MovimentoBancario WHERE idContaCorrente = ?
			`).bind(idContaCorrente).all();
			
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

					const result = await this.db.prepare(sql).bind(...params).run();

					const atualizadosNoLote = (result as any).changes || 0;
					totalAtualizados += atualizadosNoLote;

					console.log(`✅ Lote ${numeroLote}/${totalLotes} processado: ${atualizadosNoLote} movimentos atualizados`);

					// Pequena pausa entre lotes para evitar sobrecarga
					if (numeroLote < totalLotes) {
						await new Promise(resolve => setTimeout(resolve, 10));
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
					   idBanco, idPessoa, parcelado, idFinanciamento
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
					resultadoList: resultadoList,
				};
			})
		);

			console.log(`✅ Repository: Processamento concluído, retornando ${movimentos.length} movimentos`);
		return movimentos;
		} catch (error) {
			console.error('🔥 Repository: Erro ao executar query getByIds:', {
				message: error instanceof Error ? error.message : 'Erro desconhecido',
				stack: error instanceof Error ? error.stack : undefined,
				idsCount: ids.length,
				query: query.substring(0, 100) + '...'
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
				whereConditions.push('mb.dtMovimento >= ?');
				params.push(filters.dataInicio + ' 00:00:00');
			}

			if (filters.dataFim) {
				whereConditions.push('mb.dtMovimento <= ?');
				params.push(filters.dataFim + ' 23:59:59');
			}

			if (filters.status === 'pendentes') {
				whereConditions.push('(mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0)');
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

			const total = countResult?.total as number || 0;
			const totalPages = Math.ceil(total / filters.limit);
			const offset = (filters.page - 1) * filters.limit;

			console.log(`📊 Repository: Total de registros encontrados: ${total}, páginas: ${totalPages}`);

			// Query principal com paginação
			const mainQuery = `
				SELECT 
					mb.*,
					GROUP_CONCAT(
						CASE 
							WHEN r.idPlanoContas IS NOT NULL 
							THEN json_object('id', r.idPlanoContas, 'valor', r.valor, 'descricao', pc.descricao)
							ELSE NULL 
						END
					) as resultadoList
				FROM MovimentoBancario mb
				LEFT JOIN Resultado r ON mb.id = r.idMovimentoBancario
				LEFT JOIN PlanoContas pc ON r.idPlanoContas = pc.id
				${whereClause}
				GROUP BY mb.id
				ORDER BY mb.dtMovimento DESC
				LIMIT ? OFFSET ?
			`;

			const { results } = await this.db
				.prepare(mainQuery)
				.bind(...params, filters.limit, offset)
				.all();

			// Processar resultados
			const movimentos = await Promise.all(
				results.map(async (result: any) => {
					let resultadoList: any[] = [];
					if (result.resultadoList) {
						try {
							resultadoList = result.resultadoList
								.split(',')
								.map((item: string) => JSON.parse(item))
								.filter((item: any) => item !== null);
						} catch (error) {
							console.warn('⚠️ Erro ao processar resultadoList:', error);
							resultadoList = [];
						}
					}

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
						resultadoList: resultadoList,
					};
				})
			);

			console.log(`✅ Repository: Retornando ${movimentos.length} movimentos da página ${filters.page}`);

			return {
				movimentos,
				total,
				totalPages,
				currentPage: filters.page,
				hasNext: filters.page < totalPages,
				hasPrev: filters.page > 1
			};

		} catch (error) {
			console.error('🔥 Repository: Erro na busca paginada:', error);
			throw error;
		}
	}

	async exportToExcel(filters: {
		contaId?: number;
		dataInicio?: string;
		dataFim?: string;
		status?: string;
	}): Promise<Buffer> {
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
				whereConditions.push('mb.dtMovimento >= ?');
				params.push(filters.dataInicio + ' 00:00:00');
			}

			if (filters.dataFim) {
				whereConditions.push('mb.dtMovimento <= ?');
				params.push(filters.dataFim + ' 23:59:59');
			}

			if (filters.status === 'pendentes') {
				whereConditions.push('(mb.idPlanoContas IS NULL OR mb.idPlanoContas = 0)');
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
				'Histórico': mov.historico,
				'Tipo': mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
				'Modalidade': mov.modalidadeMovimento || 'Padrão',
				'Plano de Contas': mov.planoDescricao || 'Não definido',
				'Valor R$': mov.valor,
				'IdeAgri': mov.ideagro ? 'Sim' : 'Não',
				'Pessoa': mov.pessoaNome || '',
				'Banco': mov.bancoNome || '',
				'Parcelado': mov.parcelado ? 'Sim' : 'Não',
				'Nº Documento': mov.modalidadeMovimento === 'financiamento' ? mov.numeroDocumento : '',
				'Conta': `${mov.numConta || ''} - ${mov.responsavel || ''}`,
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
}
