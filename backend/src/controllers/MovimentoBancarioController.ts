import { MovimentoBancarioRepository, type FiltrosExportacaoConciliacao } from '../repositories/MovimentoBancarioRepository';
import { MovimentoBancario } from '../models/MovimentoBancario';
import { PlanoContaRepository } from '../repositories/PlanoContaRepository';
import { ParcelaFinanciamentoRepository } from '../repositories/ParcelaFinanciamentoRepository';
import { ContaCorrenteRepository } from '../repositories/ContaCorrenteRepository';
import { FinanciamentoRepository } from '../repositories/FinanciamentoRepository';
import { PessoaRepository } from '../repositories/PessoaRepository';
import { BancoRepository } from '../repositories/BancoRepository';
import { CentroCustosRepository } from '../repositories/CentroCustosRepository';
import { ParametroRepository } from '../repositories/ParametroRepository';
import { PlanosFinanciamentoParametros } from '../utils/isMovimentoFinanciamento';
import { montarFluxoCaixaAno, normalizarTipoAgrupamento, type FluxoCaixaAno, type TipoAgrupamentoFluxo } from '../utils/fluxoCaixaAno';
import { TransferenciaInvalidaError, validarTransferencia } from '../utils/transferencia';

export class MovimentoBancarioController {
	private movBancarioRepository: MovimentoBancarioRepository;
	private planoContaRepository: PlanoContaRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;
	private contaCorrenteRepository: ContaCorrenteRepository;
	private financiamentoRepo: FinanciamentoRepository;
	private pessoaRepo: PessoaRepository;
	private bancoRepo: BancoRepository;
	private centroCustosRepository: CentroCustosRepository;
	private parametroRepository: ParametroRepository;

	constructor(
		movBancarioRepository: MovimentoBancarioRepository,
		planoContaRepository: PlanoContaRepository,
		parcelaRepo: ParcelaFinanciamentoRepository,
		contaCorrenteRepo: ContaCorrenteRepository,
		financiamentoRepo: FinanciamentoRepository,
		pessoaRepo: PessoaRepository,
		bancoRepo: BancoRepository,
		centroCustosRepository: CentroCustosRepository,
		parametroRepository: ParametroRepository,
	) {
		this.movBancarioRepository = movBancarioRepository;
		this.planoContaRepository = planoContaRepository;
		this.parcelaRepo = parcelaRepo;
		this.contaCorrenteRepository = contaCorrenteRepo;
		this.financiamentoRepo = financiamentoRepo;
		this.pessoaRepo = pessoaRepo;
		this.bancoRepo = bancoRepo;
		this.centroCustosRepository = centroCustosRepository;
		this.parametroRepository = parametroRepository;
	}

	/** Query of /api/movBancario/export(-pdf): the same parameters as /paginado, so the file matches the list on screen. */
	private filtrosExportacaoConciliacao(searchParams: URLSearchParams): FiltrosExportacaoConciliacao {
		const ids = (nome: string) => {
			const lista = (searchParams.get(nome) || '')
				.split(',')
				.map((id) => parseInt(id, 10))
				.filter((id) => Number.isInteger(id) && id > 0);
			return lista.length > 0 ? lista : undefined;
		};
		const contaId = parseInt(searchParams.get('contaId') || '', 10);
		return {
			contaId: Number.isInteger(contaId) && contaId > 0 ? contaId : undefined,
			dataInicio: searchParams.get('dataInicio') || undefined,
			dataFim: searchParams.get('dataFim') || undefined,
			status: searchParams.get('status') || undefined,
			planosIds: ids('planosIds'),
			centrosIds: ids('centrosIds'),
			historicoContem: searchParams.get('historicoContem') || undefined,
			valorBusca: searchParams.get('valorBusca') || undefined,
		};
	}

	private async planosFinanciamentoFromParametros(): Promise<PlanosFinanciamentoParametros> {
		const parametros = await this.parametroRepository.getAll();
		const p0 = parametros[0];
		return {
			entrada: p0?.idPlanoEntradaFinanciamentos,
			pagamento: p0?.idPlanoPagamentoFinanciamentos,
		};
	}

	/** Loads one year and builds the Fluxo de Caixa (same engine for POST /api/fluxoCaixa and /anoAnterior). */
	private async gerarFluxoCaixaAno(ano: string, contas: number[], tipoAgrupamento: TipoAgrupamentoFluxo): Promise<FluxoCaixaAno> {
		const [movimentos, parcelasDoAno, planos, financiamentos, pessoas, bancos, centrosCustos, planosFinanciamento, renegociacoes] = await Promise.all([
			contas.length > 0 ? this.movBancarioRepository.getAllFiltrado(ano, contas) : Promise.resolve([]),
			this.parcelaRepo.getParcelasDoAno(ano),
			this.planoContaRepository.getAll(),
			this.financiamentoRepo.getAll(),
			this.pessoaRepo.getAll(),
			this.bancoRepo.getAll(),
			tipoAgrupamento === 'centros' ? this.centroCustosRepository.getAll() : Promise.resolve([]),
			this.planosFinanciamentoFromParametros(),
			tipoAgrupamento === 'centros' ? this.financiamentoRepo.listarRenegociacoesSaldo() : Promise.resolve([]),
		]);
		return montarFluxoCaixaAno({
			ano,
			contas,
			tipoAgrupamento,
			movimentos,
			parcelasDoAno,
			planos,
			financiamentos,
			pessoas,
			bancos,
			centrosCustos,
			planosFinanciamento,
			renegociacoes,
		});
	}

	async handleRequest(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const { pathname } = url;
		const { method } = req;

		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		try {
			if (method === 'GET' && pathname === '/api/movBancario/por-centro-custos') {
				console.log('📥 Requisição GET /api/movBancario/por-centro-custos recebida');

				const searchParams = url.searchParams;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;

				console.log('🔍 Parâmetros de busca:', { dataInicio, dataFim });

				const result = await this.movBancarioRepository.getMovimentosPorCentroCustos({
					dataInicio,
					dataFim,
				});

				console.log('📤 Retornando', result.length, 'grupos de movimentos');

				return new Response(JSON.stringify(result), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (method === 'GET' && pathname === '/api/movBancario') {
				console.log('📥 Requisição GET /api/movBancario recebida');
				const movBancario = await this.movBancarioRepository.getAll();
				console.log('📤 Retornando', movBancario.length, 'movimentos bancários');

				return new Response(JSON.stringify(movBancario), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
			}

			if (method === 'GET' && pathname === '/api/movBancario/paginado') {
				console.log('📥 Requisição GET /api/movBancario/paginado recebida');

				const searchParams = url.searchParams;
				const page = parseInt(searchParams.get('page') || '1');
				const limit = parseInt(searchParams.get('limit') || '50');
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				// Novos filtros: planos e centros
				const planosIdsParam = searchParams.get('planosIds');
				const planosIds = planosIdsParam ? planosIdsParam.split(',').map((id) => parseInt(id)) : undefined;

				const centrosIdsParam = searchParams.get('centrosIds');
				const centrosIds = centrosIdsParam ? centrosIdsParam.split(',').map((id) => parseInt(id)) : undefined;

				const historicoContem = searchParams.get('historicoContem') || undefined;
				const valorBusca = searchParams.get('valorBusca') || undefined;

				console.log('🔍 Parâmetros de paginação:', {
					page,
					limit,
					contaId,
					dataInicio,
					dataFim,
					status,
					planosIds,
					centrosIds,
					historicoContem,
					valorBusca,
				});

				const result = await this.movBancarioRepository.getPaginado({
					page,
					limit,
					contaId,
					dataInicio,
					dataFim,
					status,
					planosIds,
					centrosIds,
					historicoContem,
					valorBusca,
				});

				console.log('📤 Retornando', result.movimentos.length, 'movimentos de', result.total, 'total');

				return new Response(JSON.stringify(result), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (method === 'GET' && pathname === '/api/movBancario/export') {
				console.log('📥 Requisição GET /api/movBancario/export recebida');

				const filtros = this.filtrosExportacaoConciliacao(url.searchParams);

				console.log('🔍 Parâmetros de exportação:', filtros);

				const excelBuffer = await this.movBancarioRepository.exportToExcel(filtros);

				console.log('📤 Retornando arquivo Excel de', excelBuffer.length, 'bytes');

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="movimentos_bancarios.xlsx"',
					},
				});
			}

			if (method === 'GET' && pathname === '/api/movBancario/export-pdf') {
				console.log('📥 Requisição GET /api/movBancario/export-pdf recebida');

				const filtros = this.filtrosExportacaoConciliacao(url.searchParams);

				console.log('🔍 Parâmetros de exportação PDF:', filtros);

				const pdfBuffer = await this.movBancarioRepository.exportToPDF(filtros);

				console.log('📤 Retornando arquivo PDF de', pdfBuffer.length, 'bytes');

				return new Response(pdfBuffer as any, {
					// Cast para compatibilidade com Response
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="movimentos_bancarios.pdf"',
					},
				});
			}

			// Endpoints de Relatórios
			if (method === 'GET' && pathname === '/api/relatorio/centro-custos') {
				console.log('📥 Requisição GET /api/relatorio/centro-custos recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const centroCustosId = searchParams.get('centroCustosId') ? parseInt(searchParams.get('centroCustosId')!) : undefined;

				const dados = await this.movBancarioRepository.getRelatorioCentroCustos({
					contaId,
					dataInicio,
					dataFim,
					status,
					centroCustosId,
				});

				return new Response(JSON.stringify(dados), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const planoContasId = searchParams.get('planoContasId') ? parseInt(searchParams.get('planoContasId')!) : undefined;

				const dados = await this.movBancarioRepository.getRelatorioItensClassificados({
					contaId,
					dataInicio,
					dataFim,
					status,
					planoContasId,
				});

				return new Response(JSON.stringify(dados), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/centro-custos/excel') {
				console.log('📥 Requisição GET /api/relatorio/centro-custos/excel recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const centroCustosId = searchParams.get('centroCustosId') ? parseInt(searchParams.get('centroCustosId')!) : undefined;

				const excelBuffer = await this.movBancarioRepository.exportRelatorioCentroCustosExcel({
					contaId,
					dataInicio,
					dataFim,
					status,
					centroCustosId,
				});

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="relatorio_centro_custos.xlsx"',
					},
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/centro-custos/pdf') {
				console.log('📥 Requisição GET /api/relatorio/centro-custos/pdf recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const centroCustosId = searchParams.get('centroCustosId') ? parseInt(searchParams.get('centroCustosId')!) : undefined;

				const pdfBuffer = await this.movBancarioRepository.exportRelatorioCentroCustosPDF({
					contaId,
					dataInicio,
					dataFim,
					status,
					centroCustosId,
				});

				return new Response(pdfBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="relatorio_centro_custos.pdf"',
					},
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados/excel') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados/excel recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const planoContasId = searchParams.get('planoContasId') ? parseInt(searchParams.get('planoContasId')!) : undefined;

				const excelBuffer = await this.movBancarioRepository.exportRelatorioItensClassificadosExcel({
					contaId,
					dataInicio,
					dataFim,
					status,
					planoContasId,
				});

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="relatorio_itens_classificados.xlsx"',
					},
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados/pdf') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados/pdf recebida');

				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;
				const planoContasId = searchParams.get('planoContasId') ? parseInt(searchParams.get('planoContasId')!) : undefined;

				const pdfBuffer = await this.movBancarioRepository.exportRelatorioItensClassificadosPDF({
					contaId,
					dataInicio,
					dataFim,
					status,
					planoContasId,
				});

				return new Response(pdfBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="relatorio_itens_classificados.pdf"',
					},
				});
			}

			if (method === 'GET' && pathname.startsWith('/api/movBancario/')) {
				const pathParts = pathname.split('/');
				if (pathParts.length === 4 && !isNaN(Number(pathParts[3]))) {
					const id = parseInt(pathParts[3]);
					console.log(`🔍 Buscando movimento com ID ${id}`);
					const movimento = await this.movBancarioRepository.getById(id);
					if (!movimento) {
						console.warn('⚠️ Movimento não encontrado', id);
						return new Response(JSON.stringify({ message: 'Movimento não encontrado' }), {
							status: 404,
							headers: corsHeaders,
						});
					}
					console.log('✅ Movimento encontrado:', movimento);
					return new Response(JSON.stringify(movimento), {
						status: 200,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'POST' && pathname === '/api/movBancario') {
				try {
					const body: MovimentoBancario = await req.json();
					console.log('📥 Criando novo movimento:', JSON.stringify(body, null, 2));

					if (body.identificadorOfx) {
						// Duplicate check scoped by conta: the same identificador in another conta is another movement
						const idConta = Number(body.idContaCorrente);
						const existente =
							Number.isInteger(idConta) && idConta > 0
								? await this.movBancarioRepository.getByIdentificadorOfxAndConta(body.identificadorOfx, idConta)
								: await this.movBancarioRepository.getByIdentificadorOfx(body.identificadorOfx);
						if (existente) {
							console.warn('⚠️ Movimento duplicado detectado pelo identificador_ofx:', body.identificadorOfx);

							return new Response(JSON.stringify(existente), {
								status: 200,
								headers: corsHeaders,
							});
						}
					}

					const id = await this.movBancarioRepository.create(body);
					console.log('✅ Movimento criado com sucesso, ID:', id);

					const movimentoCriado = await this.movBancarioRepository.getById(id);
					return new Response(JSON.stringify(movimentoCriado), {
						status: 201,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('❌ Erro ao criar movimento:', error);
					return new Response(JSON.stringify({ error: 'Erro ao criar movimento bancário' }), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			// 📌 POST - Processar movimentos em batch
			if (method === 'POST' && pathname === '/api/movBancario/batch') {
				try {
					const body: { movimentos: MovimentoBancario[] } = await req.json();
					console.log(`📥 Processando lote de ${body.movimentos.length} movimentos`);

					if (!body.movimentos || !Array.isArray(body.movimentos) || body.movimentos.length === 0) {
						return new Response(JSON.stringify({ error: 'Lista de movimentos inválida' }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					const resultado = await this.movBancarioRepository.createBatch(body.movimentos);
					console.log(`✅ Lote processado: ${resultado.novos} novos, ${resultado.existentes} existentes`);

					return new Response(JSON.stringify(resultado), {
						status: 200,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('❌ Erro ao processar lote de movimentos:', error);
					return new Response(JSON.stringify({ error: 'Erro ao processar lote de movimentos' }), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			// 📌 PATCH - Atualizar conta de movimentos OFX
			if (method === 'PATCH' && pathname === '/api/movBancario/update-conta-ofx') {
				try {
					const body: { idMovimentos: number[]; novaContaId: number; idHistorico?: number | null } = await req.json();

					if (!body.idMovimentos || !Array.isArray(body.idMovimentos) || body.idMovimentos.length === 0) {
						return new Response(JSON.stringify({ error: 'Lista de IDs de movimentos inválida' }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					if (!body.novaContaId || body.novaContaId <= 0) {
						return new Response(JSON.stringify({ error: 'ID da nova conta inválido' }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					const idHistorico = Number(body.idHistorico);
					const resultado = await this.movBancarioRepository.updateContaMovimentosOFX(
						body.idMovimentos,
						body.novaContaId,
						Number.isInteger(idHistorico) && idHistorico > 0 ? idHistorico : null,
					);

					if (resultado.falhas > 0) {
						return new Response(
							JSON.stringify({
								...resultado,
								error: `Mudança de conta incompleta: ${resultado.falhas} falha(s), ${resultado.atualizados} movimento(s) movido(s). Repita a operação para concluir.`,
							}),
							{ status: 500, headers: corsHeaders },
						);
					}

					return new Response(JSON.stringify(resultado), {
						status: 200,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('❌ Erro ao atualizar conta dos movimentos OFX:', error);
					return new Response(JSON.stringify({ error: 'Erro ao atualizar conta dos movimentos OFX' }), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'GET' && pathname === '/api/fluxoCaixa/detalhar') {
				const urlObj = new URL(req.url);
				const tipo = urlObj.searchParams.get('tipo') || '';
				const subtipo = urlObj.searchParams.get('subtipo') || '';
				const mes = parseInt(urlObj.searchParams.get('mes') || '');
				const ano = parseInt(urlObj.searchParams.get('ano') || new Date().getFullYear().toString());
				const tipoAgrupamento = urlObj.searchParams.get('tipoAgrupamento') || 'planos';
				const contasParam = urlObj.searchParams.get('contas');
				const contas: number[] = contasParam
					? contasParam
							.split(',')
							.map((c) => parseInt(c.trim(), 10))
							.filter((c) => !isNaN(c))
					: [];

				// Movements (MovimentoDetalhado) or, for financiamentos, contracts with parcelas (FinanciamentoDetalhadoDTO)
				let movimentos: unknown[] = [];

				if (tipo === 'financiamentos') {
					const credorKey = urlObj.searchParams.get('planoId') || '';
					if (credorKey === 'todos') {
						// Fluxo (centros): Quitados / Créditos novos of the month, every contract — same rule as the
						// cell (utils/fluxoCaixaAno.financiamentosMensaisFluxo)
						movimentos = await this.movBancarioRepository.getDetalhesFinanciamentoMes(
							mes,
							ano,
							subtipo === 'contratados' ? 'contratados' : 'pagos',
						);
					} else if (subtipo === 'contratados') {
						movimentos = await this.movBancarioRepository.getDetalhesFinanciamentoContratados(credorKey, mes, ano);
					} else {
						movimentos = await this.movBancarioRepository.getDetalhesFinanciamento(credorKey, mes, ano);
					}
				} else if (tipoAgrupamento === 'centros') {
					// Detalhamento por centro de custos
					const centroCustosId = parseInt(urlObj.searchParams.get('planoId') || '');
					movimentos = await this.movBancarioRepository.getMovimentosPorCentroCustosDetalhamento(centroCustosId, mes, tipo, ano, contas);
				} else {
					// Detalhamento por plano de contas (lógica original)
					const planoId = parseInt(urlObj.searchParams.get('planoId') || '');
					movimentos = await this.movBancarioRepository.getMovimentosPorDetalhamento(planoId, mes, tipo, ano, contas);
				}

				return new Response(JSON.stringify(movimentos), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			}

			if (method === 'POST' && (pathname === '/api/fluxoCaixa' || pathname === '/api/fluxoCaixa/anoAnterior')) {
				const anoAnterior = pathname === '/api/fluxoCaixa/anoAnterior';
				try {
					const body = (await req.json()) as { ano: string | number; contas?: Array<string | number>; tipoAgrupamento?: string };
					// anoAnterior (Gráfico comparison): the very same engine, one year earlier
					const ano = anoAnterior ? String(parseInt(String(body.ano), 10) - 1) : String(body.ano);
					const resultado = await this.gerarFluxoCaixaAno(
						ano,
						(body.contas ?? []).map(Number),
						normalizarTipoAgrupamento(body.tipoAgrupamento),
					);
					return new Response(JSON.stringify(resultado), {
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					});
				} catch (error) {
					const mensagem = anoAnterior ? 'Erro ao gerar fluxo de caixa do ano anterior' : 'Erro ao gerar fluxo de caixa';
					console.error('🚨', mensagem, error);
					return new Response(
						JSON.stringify({
							error: mensagem,
							details: error instanceof Error ? error.message : 'Erro desconhecido',
						}),
						{
							status: 500,
							headers: corsHeaders,
						},
					);
				}
			}

			if (method === 'PUT' && pathname.startsWith('/api/movBancario/')) {
				const id = parseInt(pathname.split('/')[3]);
				const body: MovimentoBancario = await req.json();
				console.log(`✏️ Atualizando movimento ID ${id}`, JSON.stringify(body, null, 2));
				await this.movBancarioRepository.update(id, body);
				console.log('✅ Atualização realizada com sucesso');

				// Buscar o movimento atualizado com centroCustosList
				const movimentoAtualizado = await this.movBancarioRepository.getById(id);
				if (!movimentoAtualizado) {
					return new Response(JSON.stringify({ error: 'Movimento não encontrado após atualização' }), {
						status: 404,
						headers: corsHeaders,
					});
				}

				return new Response(JSON.stringify(movimentoAtualizado), {
					status: 200,
					headers: corsHeaders,
				});
			}

			// Zerar dados para testes: remove movimentos por contas e opcionalmente ano
			if (method === 'DELETE' && pathname === '/api/movBancario/reset-teste') {
				try {
					const contasParam = url.searchParams.get('contas');
					const anoParam = url.searchParams.get('ano');
					if (!contasParam || contasParam.trim() === '') {
						return new Response(JSON.stringify({ error: 'Parâmetro "contas" é obrigatório (IDs separados por vírgula)' }), {
							status: 400,
							headers: corsHeaders,
						});
					}
					const contasIds = contasParam
						.split(',')
						.map((s) => parseInt(s.trim(), 10))
						.filter((n) => !isNaN(n) && n > 0);
					if (contasIds.length === 0) {
						return new Response(JSON.stringify({ error: 'Nenhum ID de conta válido em "contas"' }), {
							status: 400,
							headers: corsHeaders,
						});
					}
					const ano = anoParam ? parseInt(anoParam, 10) : undefined;
					const resultado = await this.movBancarioRepository.deleteForResetTeste(contasIds, ano);
					return new Response(
						JSON.stringify({
							message: `Zeragem para testes concluída. ${resultado.excluidos} movimento(s) excluído(s).`,
							excluidos: resultado.excluidos,
						}),
						{
							status: 200,
							headers: corsHeaders,
						},
					);
				} catch (error) {
					console.error('Erro no reset-teste:', error);
					return new Response(
						JSON.stringify({
							error: 'Erro ao zerar dados para testes',
							details: error instanceof Error ? error.message : 'Erro desconhecido',
						}),
						{
							status: 500,
							headers: corsHeaders,
						},
					);
				}
			}

			// Exclusão em massa de todos os movimentos de uma conta corrente
			if (method === 'DELETE' && pathname.startsWith('/api/movBancario/deleteAll/')) {
				console.log(`🚀🚀🚀 ENTRANDO NO MÉTODO DELETE ALL - ${new Date().toISOString()} 🚀🚀🚀`);
				console.log(`🔍 URL completa:`, pathname);
				console.log(`🔍 Method:`, method);
				console.log(`🔍 Request URL:`, req.url);
				console.log(`🔍 Request headers:`, Object.fromEntries(req.headers.entries()));
				try {
					// Extrair ID da URL: /api/movBancario/deleteAll/38
					const pathParts = pathname.split('/');
					console.log(`🔍 Partes da URL:`, pathParts);
					console.log(`🔍 Quantidade de partes:`, pathParts.length);
					console.log(
						`🔍 Todas as partes:`,
						pathParts.map((part, index) => `${index}: "${part}"`),
					);

					// Tentar diferentes índices para encontrar o ID
					let idContaCorrenteStr = pathParts[4];
					console.log(`🔍 ID extraído da URL (índice 4):`, idContaCorrenteStr, `Tipo:`, typeof idContaCorrenteStr);

					// Se não encontrou no índice 4, tentar outros índices
					if (!idContaCorrenteStr || idContaCorrenteStr.trim() === '') {
						console.log(`🔍 Tentando outros índices...`);
						for (let i = 0; i < pathParts.length; i++) {
							const part = pathParts[i];
							console.log(`🔍 Índice ${i}: "${part}"`);
							if (part && !isNaN(Number(part)) && Number(part) > 0) {
								idContaCorrenteStr = part;
								console.log(`🔍 ID encontrado no índice ${i}: ${idContaCorrenteStr}`);
								break;
							}
						}
					}

					if (!idContaCorrenteStr || idContaCorrenteStr.trim() === '') {
						console.error(`❌ ID não encontrado na URL:`, pathname);
						return new Response(JSON.stringify({ error: 'ID da conta corrente é obrigatório na URL' }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					// Converter para número com validação mais robusta
					console.log(`🔍 Antes do parseInt - String: "${idContaCorrenteStr}"`);
					console.log(`🔍 Antes do parseInt - Trimmed: "${idContaCorrenteStr.trim()}"`);
					console.log(`🔍 Antes do parseInt - Length: ${idContaCorrenteStr.trim().length}`);

					const idContaCorrenteNumero = parseInt(idContaCorrenteStr.trim(), 10);
					console.log(`🔍 ID convertido:`, idContaCorrenteNumero, `Tipo:`, typeof idContaCorrenteNumero);
					console.log(`🔍 isNaN check:`, isNaN(idContaCorrenteNumero));
					console.log(`🔍 > 0 check:`, idContaCorrenteNumero > 0);
					console.log(`🔍 === 38 check:`, idContaCorrenteNumero === 38);

					if (isNaN(idContaCorrenteNumero) || idContaCorrenteNumero <= 0) {
						console.error(`❌ ID inválido 2:`, idContaCorrenteStr, `convertido para:`, idContaCorrenteNumero);
						console.error(`❌ Debug info:`, {
							originalString: idContaCorrenteStr,
							trimmedString: idContaCorrenteStr.trim(),
							parsedNumber: idContaCorrenteNumero,
							isNaN: isNaN(idContaCorrenteNumero),
							isPositive: idContaCorrenteNumero > 0,
						});
						return new Response(
							JSON.stringify({
								error: 'Erro no servidor',
								details: `ID inválido: ${idContaCorrenteNumero}`,
							}),
							{
								status: 500,
								headers: corsHeaders,
							},
						);
					}

					console.log(`✅ ID da conta corrente válido: ${idContaCorrenteNumero}`);

					console.log(`🗑 Iniciando exclusão em massa de todos os movimentos da conta corrente ${idContaCorrenteNumero}`);
					console.log(
						`🔍 Chamando repository.deleteAllByContaCorrente com ID:`,
						idContaCorrenteNumero,
						`tipo:`,
						typeof idContaCorrenteNumero,
					);

					const resultado = await this.movBancarioRepository.deleteAllByContaCorrente(idContaCorrenteNumero);
					console.log(`✅ Exclusão em massa concluída: ${resultado.excluidos} movimentos excluídos`);

					if (resultado.falhas > 0) {
						return new Response(
							JSON.stringify({
								error: `Exclusão em massa incompleta: ${resultado.falhas} movimento(s) não puderam ser excluídos (${resultado.excluidos} excluído(s)).`,
								message: `Exclusão em massa incompleta: ${resultado.excluidos} excluído(s), ${resultado.falhas} falha(s).`,
								excluidos: resultado.excluidos,
								falhas: resultado.falhas,
								detalhesFalhas: resultado.detalhesFalhas,
							}),
							{
								status: 500,
								headers: corsHeaders,
							},
						);
					}

					return new Response(
						JSON.stringify({
							message: `Exclusão em massa concluída! ${resultado.excluidos} movimentos foram excluídos.`,
							excluidos: resultado.excluidos,
							falhas: 0,
						}),
						{
							status: 200,
							headers: corsHeaders,
						},
					);
				} catch (error) {
					console.error('❌ Erro na exclusão em massa:', error);
					console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
					console.error('❌ Error type:', typeof error);
					console.error('❌ Error constructor:', error?.constructor?.name);
					return new Response(
						JSON.stringify({
							error: 'Erro ao excluir movimentos em massa',
							details: error instanceof Error ? error.message : 'Erro desconhecido',
						}),
						{
							status: 500,
							headers: corsHeaders,
						},
					);
				}
			}

			if (method === 'DELETE' && pathname.startsWith('/api/movBancario/')) {
				const id = parseInt(pathname.split('/')[3]);
				// Parcelas paid by it are reopened, generated ones unlinked — never deleted (same transaction)
				await this.movBancarioRepository.deleteById(id);

				return new Response(JSON.stringify({ message: 'Movimento bancário excluído com sucesso!' }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			if (method === 'PATCH' && pathname.startsWith('/api/movBancario/')) {
				const id = parseInt(pathname.split('/')[3]);
				const body: MovimentoBancario = await req.json();
				console.log(`🔄 Atualizando status ideagro do movimento ID ${id} para ${body.ideagro}`);

				if (typeof body.ideagro === 'boolean') {
					await this.movBancarioRepository.updateIdeagro(id, body.ideagro);
					return new Response(JSON.stringify({ message: 'Status ideagro atualizado!' }), {
						status: 200,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'GET' && pathname.startsWith('/api/movBancario/saldo/')) {
				// /api/movBancario/saldo/:idConta → ['', 'api', 'movBancario', 'saldo', ':idConta']
				const rawConta = pathname.split('/')[4] ?? '';
				if (!/^\d+$/.test(rawConta)) {
					return new Response(JSON.stringify({ error: 'ID da conta corrente inválido' }), {
						status: 400,
						headers: corsHeaders,
					});
				}
				const idConta = parseInt(rawConta, 10);
				const urlObj = new URL(req.url);
				const data = urlObj.searchParams.get('data');

				console.log(`📊 Buscando saldo da conta ${idConta} até a data ${data}`);
				const saldo = await this.movBancarioRepository.getSaldoContaCorrente(idConta, data ?? '');
				return new Response(JSON.stringify({ saldo }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			if (method === 'POST' && pathname === '/api/movBancario/transfer') {
				interface MovTransf {
					contaOrigemId?: number;
					contaDestinoId?: number;
					valor?: number;
					data?: string;
					descricao?: string;
					idUsuario?: number;
					contaOrigemDescricao?: string;
					contaDestinoDescricao?: string;
				}

				const body: MovTransf = await req.json();
				console.log('🔄 Iniciando transferência:', body);

				if (
					!body.contaOrigemId ||
					!body.contaDestinoId ||
					body.valor === undefined ||
					body.valor === null ||
					!body.data ||
					!body.descricao ||
					!body.idUsuario ||
					!body.contaOrigemDescricao ||
					!body.contaDestinoDescricao
				) {
					console.warn('⚠️ Dados incompletos para transferência', body);

					return new Response(
						JSON.stringify({ error: 'Dados incompletos para transferência.', message: 'Dados incompletos para transferência.' }),
						{
							status: 400,
							headers: corsHeaders,
						},
					);
				}

				// valor > 0 e origem ≠ destino
				const erroValidacao = validarTransferencia(body);
				if (erroValidacao) {
					return new Response(JSON.stringify({ error: erroValidacao, message: erroValidacao }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				try {
					const { idSaida, idEntrada } = await this.movBancarioRepository.transfer({
						contaOrigemId: body.contaOrigemId!,
						contaOrigemDescricao: body.contaOrigemDescricao!,
						contaDestinoId: body.contaDestinoId!,
						contaDestinoDescricao: body.contaDestinoDescricao!,
						valor: body.valor!,
						descricao: body.descricao!,
						data: body.data!,
						idUsuario: body.idUsuario!,
					});
					console.log('✅ Transferência realizada com sucesso');

					return new Response(JSON.stringify({ message: 'Transferência realizada com sucesso!', idSaida, idEntrada }), {
						status: 201,
						headers: corsHeaders,
					});
				} catch (error) {
					const message = (error as Error).message;
					const stack = (error as Error).stack;

					if (error instanceof TransferenciaInvalidaError) {
						return new Response(JSON.stringify({ error: message, message }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					console.error('🔥 Erro na transferência:', message, stack);

					const errorResponse = {
						error: 'Erro ao realizar transferência bancária',
						message,
						stack,
					};

					return new Response(JSON.stringify(errorResponse), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'POST' && pathname === '/api/movBancario/porIds') {
				try {
					const body: { ids: number[] } = await req.json();
					console.log('🔍 Buscando movimentos por IDs:', {
						totalIds: body.ids?.length || 0,
						primeirosIds: body.ids?.slice(0, 5) || [],
					});

					if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
						return new Response(JSON.stringify({ error: 'IDs de movimentos são obrigatórios' }), {
							status: 400,
							headers: corsHeaders,
						});
					}

					// Validar se não há muitos IDs (limite de segurança)
					if (body.ids.length > 100) {
						console.warn('⚠️ Tentativa de buscar muitos IDs:', body.ids.length);
						return new Response(
							JSON.stringify({
								error: 'Limite de IDs excedido. Máximo permitido: 100',
								received: body.ids.length,
							}),
							{
								status: 400,
								headers: corsHeaders,
							},
						);
					}

					// Validação adicional para garantir que nenhum lote exceda o limite
					if (body.ids.length > 100) {
						console.error('🚨 CRÍTICO: Lote com mais de 100 IDs recebido:', body.ids.length);
						return new Response(
							JSON.stringify({
								error: 'Lote muito grande recebido. Máximo permitido: 100',
								received: body.ids.length,
								suggestion: 'Reduza o tamanho do lote no frontend',
							}),
							{
								status: 400,
								headers: corsHeaders,
							},
						);
					}

					const movimentos = await this.movBancarioRepository.getByIds(body.ids);
					console.log(`✅ Encontrados ${movimentos.length} movimentos de ${body.ids.length} IDs solicitados`);

					return new Response(JSON.stringify(movimentos), {
						status: 200,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('🔥 Erro ao buscar movimentos por IDs:', {
						message: error instanceof Error ? error.message : 'Erro desconhecido',
						stack: error instanceof Error ? error.stack : undefined,
						error: error,
					});
					return new Response(
						JSON.stringify({
							error: 'Erro ao buscar movimentos por IDs',
							details: error instanceof Error ? error.message : 'Erro desconhecido',
						}),
						{
							status: 500,
							headers: corsHeaders,
						},
					);
				}
			}

			return new Response('Rota não encontrada', { status: 404, headers: corsHeaders });
		} catch (error) {
			console.error('🚨 Erro no servidor:', (error as Error).message);

			return new Response(JSON.stringify({ error: 'Erro no servidor', details: (error as Error).message }), {
				status: 500,
				headers: corsHeaders,
			});
		}
	}
}
