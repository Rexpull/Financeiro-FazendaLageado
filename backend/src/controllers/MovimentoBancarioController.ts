import { MovimentoBancarioRepository } from '../repositories/MovimentoBancarioRepository';
import { MovimentoBancario } from '../models/MovimentoBancario';
import { PlanoContaRepository } from '../repositories/PlanoContaRepository';
import { ParcelaFinanciamentoRepository } from '../repositories/ParcelaFinanciamentoRepository';
import { ContaCorrenteRepository } from '../repositories/ContaCorrenteRepository';
import { FinanciamentoRepository } from '../repositories/FinanciamentoRepository';
import { PessoaRepository } from '../repositories/PessoaRepository';
import { BancoRepository } from '../repositories/BancoRepository';
import { CentroCustosRepository } from '../repositories/CentroCustosRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';

export class MovimentoBancarioController {
	private movBancarioRepository: MovimentoBancarioRepository;
	private planoContaRepository: PlanoContaRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;
	private contaCorrenteRepository: ContaCorrenteRepository;
	private financiamentoRepo: FinanciamentoRepository;
	private pessoaRepo: PessoaRepository;
	private bancoRepo: BancoRepository;
	private centroCustosRepository: CentroCustosRepository;

	constructor(
		movBancarioRepository: MovimentoBancarioRepository,
		planoContaRepository: PlanoContaRepository,
		parcelaRepo: ParcelaFinanciamentoRepository,
		contaCorrenteRepo: ContaCorrenteRepository,
		financiamentoRepo: FinanciamentoRepository,
		pessoaRepo: PessoaRepository,
		bancoRepo: BancoRepository,
		centroCustosRepository: CentroCustosRepository
	) {
		this.movBancarioRepository = movBancarioRepository;
		this.planoContaRepository = planoContaRepository;
		this.parcelaRepo = parcelaRepo;
		this.contaCorrenteRepository = contaCorrenteRepo;
		this.financiamentoRepo = financiamentoRepo;
		this.pessoaRepo = pessoaRepo;
		this.bancoRepo = bancoRepo;
		this.centroCustosRepository = centroCustosRepository;
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
					dataFim
				});

				console.log('📤 Retornando', result.length, 'grupos de movimentos');

				return new Response(JSON.stringify(result), { 
					headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
				const planosIds = planosIdsParam ? planosIdsParam.split(',').map(id => parseInt(id)) : undefined;
				
				const centrosIdsParam = searchParams.get('centrosIds');
				const centrosIds = centrosIdsParam ? centrosIdsParam.split(',').map(id => parseInt(id)) : undefined;

				console.log('🔍 Parâmetros de paginação:', { page, limit, contaId, dataInicio, dataFim, status, planosIds, centrosIds });

				const result = await this.movBancarioRepository.getPaginado({
					page,
					limit,
					contaId,
					dataInicio,
					dataFim,
					status,
					planosIds,
					centrosIds
				});

				console.log('📤 Retornando', result.movimentos.length, 'movimentos de', result.total, 'total');

				return new Response(JSON.stringify(result), { 
					headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
				});
			}

			if (method === 'GET' && pathname === '/api/movBancario/export') {
				console.log('📥 Requisição GET /api/movBancario/export recebida');
				
				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				console.log('🔍 Parâmetros de exportação:', { contaId, dataInicio, dataFim, status });

				const excelBuffer = await this.movBancarioRepository.exportToExcel({
					contaId,
					dataInicio,
					dataFim,
					status
				});

				console.log('📤 Retornando arquivo Excel de', excelBuffer.length, 'bytes');

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="movimentos_bancarios.xlsx"'
					}
				});
			}

			if (method === 'GET' && pathname === '/api/movBancario/export-pdf') {
				console.log('📥 Requisição GET /api/movBancario/export-pdf recebida');
				
				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				console.log('🔍 Parâmetros de exportação PDF:', { contaId, dataInicio, dataFim, status });

				const pdfBuffer = await this.movBancarioRepository.exportToPDF({
					contaId,
					dataInicio,
					dataFim,
					status
				});

				console.log('📤 Retornando arquivo PDF de', pdfBuffer.length, 'bytes');

				return new Response(pdfBuffer as any, { // Cast para compatibilidade com Response
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="movimentos_bancarios.pdf"'
					}
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
					centroCustosId
				});

				return new Response(JSON.stringify(dados), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados recebida');
				
				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				const dados = await this.movBancarioRepository.getRelatorioItensClassificados({
					contaId,
					dataInicio,
					dataFim,
					status
				});

				return new Response(JSON.stringify(dados), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
					centroCustosId
				});

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="relatorio_centro_custos.xlsx"'
					}
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
					centroCustosId
				});

				return new Response(pdfBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="relatorio_centro_custos.pdf"'
					}
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados/excel') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados/excel recebida');
				
				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				const excelBuffer = await this.movBancarioRepository.exportRelatorioItensClassificadosExcel({
					contaId,
					dataInicio,
					dataFim,
					status
				});

				return new Response(excelBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						'Content-Disposition': 'attachment; filename="relatorio_itens_classificados.xlsx"'
					}
				});
			}

			if (method === 'GET' && pathname === '/api/relatorio/itens-classificados/pdf') {
				console.log('📥 Requisição GET /api/relatorio/itens-classificados/pdf recebida');
				
				const searchParams = url.searchParams;
				const contaId = searchParams.get('contaId') ? parseInt(searchParams.get('contaId')!) : undefined;
				const dataInicio = searchParams.get('dataInicio') || undefined;
				const dataFim = searchParams.get('dataFim') || undefined;
				const status = searchParams.get('status') || undefined;

				const pdfBuffer = await this.movBancarioRepository.exportRelatorioItensClassificadosPDF({
					contaId,
					dataInicio,
					dataFim,
					status
				});

				return new Response(pdfBuffer as any, {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/pdf',
						'Content-Disposition': 'attachment; filename="relatorio_itens_classificados.pdf"'
					}
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
						const existente = await this.movBancarioRepository.getByIdentificadorOfx(body.identificadorOfx);
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
					const body: { idMovimentos: number[], novaContaId: number } = await req.json();
					console.log(`📥 Atualizando conta de ${body.idMovimentos.length} movimentos para conta ${body.novaContaId}`);

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

					const resultado = await this.movBancarioRepository.updateContaMovimentosOFX(body.idMovimentos, body.novaContaId);
					console.log(`✅ Conta atualizada para ${resultado.atualizados} movimentos`);

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
				const mes = parseInt(urlObj.searchParams.get('mes') || '');
				const ano = parseInt(urlObj.searchParams.get('ano') || new Date().getFullYear().toString());
				const tipoAgrupamento = urlObj.searchParams.get('tipoAgrupamento') || 'planos';

				let movimentos: MovimentoDetalhado[] = [];

				if (tipo === 'financiamentos') {
					const credorKey = urlObj.searchParams.get('planoId') || '';
					movimentos = await this.movBancarioRepository.getDetalhesFinanciamento(credorKey, mes, ano);
				} else if (tipoAgrupamento === 'centros') {
					// Detalhamento por centro de custos
					const centroCustosId = parseInt(urlObj.searchParams.get('planoId') || '');
					movimentos = await this.movBancarioRepository.getMovimentosPorCentroCustosDetalhamento(centroCustosId, mes, tipo, ano);
				} else {
					// Detalhamento por plano de contas (lógica original)
					const planoId = parseInt(urlObj.searchParams.get('planoId') || '');
					movimentos = await this.movBancarioRepository.getMovimentosPorDetalhamento(planoId, mes, tipo, ano);
				}

				return new Response(JSON.stringify(movimentos), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			}

			if (method === 'POST' && pathname === '/api/fluxoCaixa') {
				try {
					const body = await req.json();
					const { ano, contas, tipoAgrupamento: tipoAgrupamentoRaw = 'planos' } = body as { ano: string; contas: string[]; tipoAgrupamento?: 'planos' | 'centros' };
					// Garantir que tipoAgrupamento seja string e normalize para 'centros' ou 'planos'
					const tipoAgrupamento = (tipoAgrupamentoRaw === 'centros' || tipoAgrupamentoRaw === 'Centro de Custos') ? 'centros' : 'planos';
					const contasNumber = contas.map(Number);
					console.log('📊 Gerando fluxo de caixa para ano:', ano, 'contas:', contas, 'tipoAgrupamento (raw):', tipoAgrupamentoRaw, 'tipoAgrupamento (normalizado):', tipoAgrupamento);

					const todosMovimentos = await this.movBancarioRepository.getAllFiltrado(ano, contasNumber);
					console.log('📥 Total movimentos carregados:', todosMovimentos.length);

					const parcelas = await this.parcelaRepo.getParcelasDoAno(ano);
					console.log('📥 Total parcelas de financiamento carregadas:', parcelas.length);

					const planos = await this.planoContaRepository.getAll();
					console.log('📥 Total planos carregados:', planos.length);

					const contasCorrentes = await this.contaCorrenteRepository.getAll();
					console.log('📥 Total contas correntes carregadas:', contasCorrentes.length);

					const financiamentos = await this.financiamentoRepo.getAll();
					const pessoas = await this.pessoaRepo.getAll();
					const bancos = await this.bancoRepo.getAll();

					// Buscar centros de custos se for agrupamento por centros
					const centrosCustos = tipoAgrupamento === 'centros' ? await this.centroCustosRepository.getAll() : [];

					const pendentesPorConta: { [idConta: number]: number } = {};

					const planosComPai170 = planos.filter((p) => p.idReferente === 170).map((p) => p.id);

					const movimentosFiltrados = todosMovimentos.filter((mov) => {
						const planoContasIds = mov.resultadoList?.map((r) => r.idPlanoContas) || [];

						const contemPlanoIgnorado = planoContasIds.some((id) => planosComPai170.includes(id));
						if (contemPlanoIgnorado) {
							console.log('⛔️ Removendo movimento com plano bloqueado:', mov.id);
							return false;
						}

						return typeof mov.dtMovimento === 'string' && mov.dtMovimento.startsWith(ano) && contasNumber.includes(mov.idContaCorrente);
					});

					console.log('🎯 Movimentos filtrados:', movimentosFiltrados.length);
					console.log('🔍 Tipo de agrupamento recebido:', tipoAgrupamento, 'Tipo:', typeof tipoAgrupamento, 'É igual a "centros"?', tipoAgrupamento === 'centros');

					// Estrutura de dados diferente baseada no tipo de agrupamento
					const dadosMensais: any[] = Array(12)
						.fill(null)
						.map(() => ({
							// Quando agrupado por centros, receitas são valores diretos (números)
							// Quando agrupado por planos, receitas têm estrutura com descricao e filhos
							receitas: tipoAgrupamento === 'centros' 
								? {} as { [key: number]: number }
								: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							despesas: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							investimentos: {} as { [key: number]: number },
							// Quando agrupado por centros, financiamentos têm estrutura separada (pagos/contratados)
							// Quando agrupado por planos, financiamentos têm estrutura simples
							financiamentos: tipoAgrupamento === 'centros'
								? { pagos: {} as { [key: string]: { valor: number; descricao: string } }, contratados: {} as { [key: string]: { valor: number; descricao: string } } }
								: {} as { [key: string]: { valor: number; descricao: string } },
							pendentesSelecao: {} as { [key: number]: number },
							saldoInicial: 0,
							saldoFinal: 0,
							lucro: 0,
						}));

					// Processar movimentos baseado no tipo de agrupamento
					if (tipoAgrupamento === 'centros') {
						console.log('✅ Processando com agrupamento por CENTROS DE CUSTOS');
						// Agrupamento por Centro de Custos
						for (const movimento of movimentosFiltrados) {
							const mes = new Date(movimento.dtMovimento).getMonth();
							
							if (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado) {
								continue;
							}

							// Obter centros de custos do movimento (pode ser lista ou único)
							const centrosDoMovimento: { id: number; valor: number }[] = [];
							
							if (movimento.centroCustosList && movimento.centroCustosList.length > 0) {
								// Múltiplos centros (rateio)
								centrosDoMovimento.push(...movimento.centroCustosList.map(cc => ({
									id: cc.idCentroCustos,
									valor: Math.abs(cc.valor)
								})));
							} else if (movimento.idCentroCustos) {
								// Centro único
								centrosDoMovimento.push({
									id: movimento.idCentroCustos,
									valor: Math.abs(movimento.valor)
								});
							}

							if (centrosDoMovimento.length === 0) {
								// Sem centro de custos, enviar como pendente
								if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
									dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
								}
								dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += Math.abs(movimento.valor);
								continue;
							}

							// Processar cada centro de custos do movimento
							for (const centroMov of centrosDoMovimento) {
								const centro = centrosCustos.find(c => c.id === centroMov.id);
								if (!centro) {
									console.warn('⚠️ Centro de custos não encontrado:', centroMov.id);
									continue;
								}

								// Determinar se é receita ou despesa baseado no tipoMovimento
								const grupo = movimento.tipoMovimento === 'C' ? 'receitas' : 'despesas';
								
								if (grupo === 'receitas') {
									// Receitas: agrupar diretamente por centro de custos (sem hierarquia)
									// Armazenar como valor direto, não em estrutura de filhos
									if (!dadosMensais[mes].receitas[centro.id]) {
										dadosMensais[mes].receitas[centro.id] = 0;
									}
									dadosMensais[mes].receitas[centro.id] += centroMov.valor;
								} else {
									// Despesas: separar por tipo (CUSTEIO/INVESTIMENTO)
									// Usar IDs especiais para categorias: 1000 = Custeio, 2000 = Investimentos
									const categoriaId = centro.tipo === 'CUSTEIO' ? 1000 : 2000;
									const categoriaDesc = centro.tipo === 'CUSTEIO' ? 'Custeio' : 'Investimentos';
									
									if (!dadosMensais[mes].despesas[categoriaId]) {
										dadosMensais[mes].despesas[categoriaId] = {
											descricao: categoriaDesc,
											filhos: {}
										};
									}
									if (!dadosMensais[mes].despesas[categoriaId].filhos[centro.id]) {
										dadosMensais[mes].despesas[categoriaId].filhos[centro.id] = 0;
									}
									dadosMensais[mes].despesas[categoriaId].filhos[centro.id] += centroMov.valor;
								}
							}
						}
					} else {
						// Agrupamento por Planos de Contas (lógica original)
						for (const movimento of movimentosFiltrados) {
							const mes = new Date(movimento.dtMovimento).getMonth();
							console.log('🔎 Processando movimento:', {
								id: movimento.id,
								data: movimento.dtMovimento,
								conta: movimento.idContaCorrente,
								valor: movimento.valor,
								modalidade: movimento.modalidadeMovimento,
								parcelado: movimento.parcelado,
								resultados: movimento.resultadoList?.length,
							});

							if (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado) {
								continue;
							}

							if (!movimento.resultadoList || movimento.resultadoList.length === 0) {
								console.warn('⚠️ Movimento sem resultadoList. Enviando como pendente!');
								const mes = new Date(movimento.dtMovimento).getMonth();
								const conta = movimento.idContaCorrente;
								pendentesPorConta[conta] = (pendentesPorConta[conta] || 0) + Math.abs(movimento.valor);

								// Corrigindo para usar apenas o valor numérico conforme o modelo
								if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
									dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
								}
								dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += Math.abs(movimento.valor);
							}

							if (movimento.resultadoList) {
								for (const resultado of movimento.resultadoList) {
									console.log('🔍 Processando resultado:', {
										idMovimentoBancario: resultado.idMovimentoBancario,
										idPlanoContas: resultado.idPlanoContas,
										valor: resultado.valor,
										tipo: resultado.tipo,
									});

									const plano = planos.find((p) => p.id === resultado.idPlanoContas);
									const contaId = movimento.idContaCorrente;

									if (!plano) {
										console.error('🚨 Plano de contas não encontrado!', resultado.idPlanoContas, 'Movimento:', movimento.id);

										// Se o plano de contas não existir, considera como pendente
										if (!dadosMensais[mes].pendentesSelecao[contaId]) {
											dadosMensais[mes].pendentesSelecao[contaId] = 0;
										}
										dadosMensais[mes].pendentesSelecao[contaId] += resultado.valor;

										continue;
									}

									console.log('📘 Plano encontrado:', {
										id: plano.id,
										descricao: plano.descricao,
										tipo: plano.tipo,
										hierarquia: plano.hierarquia,
									});

									const tipoMov = plano.tipo;
									const hierarquia = plano.hierarquia;

									console.warn(
										'Tipo Movimento: ' +
											tipoMov +
											', Modalidade do Movimento: ' +
											movimento.modalidadeMovimento +
											', Parcelado?: ' +
											movimento.parcelado
									);
									if (tipoMov === 'investimento' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
										console.log('➕ Adicionando investimento:', resultado.valor);

										// Corrigindo para usar apenas o valor numérico conforme o modelo
										if (!dadosMensais[mes].investimentos[resultado.idPlanoContas]) {
											dadosMensais[mes].investimentos[resultado.idPlanoContas] = 0;
										}
										dadosMensais[mes].investimentos[resultado.idPlanoContas] += resultado.valor;

										continue;
									} else if (tipoMov === 'custeio' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
										const grupo = hierarquia.startsWith('001.') ? 'receitas' : hierarquia.startsWith('002.') ? 'despesas' : null;

										if (!grupo) {
											console.warn('⚠️ Hierarquia inválida no plano. Jogando para pendentes:', hierarquia);
											if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
												dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
											}
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
											continue;
										}

										const idPai = plano.idReferente;
										if (!idPai) {
											console.warn('⚠️ Plano de contas sem idPai. Jogando para pendentes:', plano);
											if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
												dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
											}
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
											continue;
										}

										// Se chegou até aqui, tudo está OK
										if (!dadosMensais[mes][grupo][idPai]) {
											dadosMensais[mes][grupo][idPai] = {
												descricao: planos.find((p) => p.id === idPai)?.descricao || 'Outro',
												filhos: {},
											};
										}

										console.log(`➕ Adicionando ${grupo} (Pai: ${idPai}) com valor:`, resultado.valor);
										if (!dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas]) {
											dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] = resultado.valor;
										} else {
											// Se já existe, soma o valor
											dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] += resultado.valor;
										}
									} else {
										console.warn('⚠️ Tipo não reconhecido, jogando para pendentes!', tipoMov);

										// Se não for investimento nem custeio, também lança como pendente
										if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
										}
										dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
									}
								}
							}
						}
					}

					for (const parcela of parcelas) {
						const financiamento = financiamentos.find((f) => f.id === parcela.idFinanciamento);
						if (!financiamento) continue;

						let credorKey = '';
						let credorDescricao = 'Não identificado';

						if (financiamento.idPessoa) {
							const pessoa = pessoas.find((p) => p.id === financiamento.idPessoa);
							credorKey = `p_${financiamento.idPessoa}`;
							credorDescricao = pessoa ? pessoa.nome : `Pessoa ${financiamento.idPessoa}`;
						} else if (financiamento.idBanco) {
							const banco = bancos.find((b) => b.id === financiamento.idBanco);
							credorKey = `b_${financiamento.idBanco}`;
							credorDescricao = banco ? banco.nome : `Banco ${financiamento.idBanco}`;
						}

						if (!credorKey) continue;

						if (tipoAgrupamento === 'centros') {
							// Separar em pagos e contratados
							// Pagos: parcelas com dt_liquidacao no mês
							// Contratados: parcelas com dt_vencimento no mês e sem dt_liquidacao
							if (parcela.dt_liquidacao) {
								// Parcela paga
								const mesLiquidacao = new Date(parcela.dt_liquidacao).getMonth();
								if (!dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey]) {
									dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey] = { valor: 0, descricao: credorDescricao };
								}
								dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey].valor += parcela.valor;
							}
							
							// Contratados: sempre considerar pelo vencimento (mesmo que já tenha sido pago)
							const mesVencimento = new Date(parcela.dt_vencimento).getMonth();
							if (!dadosMensais[mesVencimento].financiamentos.contratados[credorKey]) {
								dadosMensais[mesVencimento].financiamentos.contratados[credorKey] = { valor: 0, descricao: credorDescricao };
							}
							dadosMensais[mesVencimento].financiamentos.contratados[credorKey].valor += parcela.valor;
						} else {
							// Estrutura original para planos de contas
							const dataEfetiva = new Date(parcela.dt_liquidacao || parcela.dt_vencimento);
							const mes = dataEfetiva.getMonth();
							if (!dadosMensais[mes].financiamentos[credorKey]) {
								dadosMensais[mes].financiamentos[credorKey] = { valor: 0, descricao: credorDescricao };
							}
							dadosMensais[mes].financiamentos[credorKey].valor += parcela.valor;
						}
					}

					for (let i = 0; i < dadosMensais.length; i++) {
						let receitas = 0;
						if (tipoAgrupamento === 'centros') {
							// Quando agrupado por centros, receitas são valores diretos (números)
							receitas = Object.values(dadosMensais[i].receitas ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						} else {
							receitas = Object.values(dadosMensais[i].receitas ?? {})
								.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
								.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						}
						const despesas = Object.values(dadosMensais[i].despesas ?? {})
							.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
							.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						const investimentos = Object.values(dadosMensais[i].investimentos ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						let financiamentos = 0;
						if (tipoAgrupamento === 'centros') {
							// Quando agrupado por centros, financiamentos têm estrutura separada
							const pagos = Object.values(dadosMensais[i].financiamentos?.pagos ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
							const contratados = Object.values(dadosMensais[i].financiamentos?.contratados ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
							financiamentos = contratados - pagos; // Resultado do mês
						} else {
							financiamentos = Object.values(dadosMensais[i].financiamentos ?? {}).reduce((a: number, b: any) => a + b.valor, 0);
						}
						const pendentes = Object.values(dadosMensais[i].pendentesSelecao ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);

						if (i > 0) {
							dadosMensais[i].saldoInicial = dadosMensais[i - 1].saldoFinal;
						}

						dadosMensais[i].saldoFinal = dadosMensais[i].saldoInicial + (receitas - despesas) + investimentos + financiamentos + pendentes;

						if (dadosMensais[i].saldoInicial === 0) {
							if (dadosMensais[i].saldoFinal > 0) {
								dadosMensais[i].lucro = 100;
							} else if (dadosMensais[i].saldoFinal < 0) {
								dadosMensais[i].lucro = -100;
							} else {
								dadosMensais[i].lucro = 0;
							}
						} else {
							const variacao = ((dadosMensais[i].saldoFinal - dadosMensais[i].saldoInicial) / Math.abs(dadosMensais[i].saldoInicial)) * 100;
							dadosMensais[i].lucro = Number(variacao.toFixed(1));
						}
					}

					return new Response(JSON.stringify(dadosMensais), {
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					});
				} catch (error) {
					console.error('🚨 Erro ao gerar fluxo de caixa:', error);
					return new Response(JSON.stringify({ 
						error: 'Erro ao gerar fluxo de caixa', 
						details: error instanceof Error ? error.message : 'Erro desconhecido',
						stack: error instanceof Error ? error.stack : undefined
					}), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'POST' && pathname === '/api/fluxoCaixa/anoAnterior') {
				try {
					const body = await req.json();
					const { ano, contas, tipoAgrupamento = 'planos' } = body as { ano: string; contas: string[]; tipoAgrupamento?: 'planos' | 'centros' };
					const anoAnterior = (parseInt(ano) - 1).toString();
					const contasNumber = contas.map(Number);
					console.log('📊 Gerando fluxo de caixa do ano anterior:', anoAnterior, 'contas:', contas, 'tipoAgrupamento:', tipoAgrupamento);

					const todosMovimentos = await this.movBancarioRepository.getAllFiltrado(anoAnterior, contasNumber);
					console.log('📥 Total movimentos carregados (ano anterior):', todosMovimentos.length);

					const parcelas = await this.parcelaRepo.getParcelasDoAno(anoAnterior);
					console.log('📥 Total parcelas de financiamento carregadas (ano anterior):', parcelas.length);

					const planos = await this.planoContaRepository.getAll();
					console.log('📥 Total planos carregados (ano anterior):', planos.length);

					const contasCorrentes = await this.contaCorrenteRepository.getAll();
					console.log('📥 Total contas correntes carregadas (ano anterior):', contasCorrentes.length);

					const financiamentos = await this.financiamentoRepo.getAll();
					const pessoas = await this.pessoaRepo.getAll();
					const bancos = await this.bancoRepo.getAll();

					// Buscar centros de custos se for agrupamento por centros
					const centrosCustos = tipoAgrupamento === 'centros' ? await this.centroCustosRepository.getAll() : [];

					const pendentesPorConta: { [idConta: number]: number } = {};

					const planosComPai170 = planos.filter((p) => p.idReferente === 170).map((p) => p.id);

					const movimentosFiltrados = todosMovimentos.filter((mov) => {
						const planoContasIds = mov.resultadoList?.map((r) => r.idPlanoContas) || [];
						const contemPlanoIgnorado = planoContasIds.some((id) => planosComPai170.includes(id));
						if (contemPlanoIgnorado) {
							return false;
						}
						return typeof mov.dtMovimento === 'string' && mov.dtMovimento.startsWith(anoAnterior) && contasNumber.includes(mov.idContaCorrente);
					});

					// Estrutura de dados diferente baseada no tipo de agrupamento
					const dadosMensais: any[] = Array(12)
						.fill(null)
						.map(() => ({
							// Quando agrupado por centros, receitas são valores diretos (números)
							// Quando agrupado por planos, receitas têm estrutura com descricao e filhos
							receitas: tipoAgrupamento === 'centros' 
								? {} as { [key: number]: number }
								: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							despesas: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							investimentos: {} as { [key: number]: number },
							// Quando agrupado por centros, financiamentos têm estrutura separada (pagos/contratados)
							// Quando agrupado por planos, financiamentos têm estrutura simples
							financiamentos: tipoAgrupamento === 'centros'
								? { pagos: {} as { [key: string]: { valor: number; descricao: string } }, contratados: {} as { [key: string]: { valor: number; descricao: string } } }
								: {} as { [key: string]: { valor: number; descricao: string } },
							pendentesSelecao: {} as { [key: number]: number },
							saldoInicial: 0,
							saldoFinal: 0,
							lucro: 0,
						}));

					// Processar movimentos baseado no tipo de agrupamento
					if (tipoAgrupamento === 'centros') {
						// Agrupamento por Centro de Custos
						for (const movimento of movimentosFiltrados) {
							const mes = new Date(movimento.dtMovimento).getMonth();
							
							if (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado) {
								continue;
							}

							// Obter centros de custos do movimento (pode ser lista ou único)
							const centrosDoMovimento: { id: number; valor: number }[] = [];
							
							if (movimento.centroCustosList && movimento.centroCustosList.length > 0) {
								// Múltiplos centros (rateio)
								centrosDoMovimento.push(...movimento.centroCustosList.map(cc => ({
									id: cc.idCentroCustos,
									valor: Math.abs(cc.valor)
								})));
							} else if (movimento.idCentroCustos) {
								// Centro único
								centrosDoMovimento.push({
									id: movimento.idCentroCustos,
									valor: Math.abs(movimento.valor)
								});
							}

							if (centrosDoMovimento.length === 0) {
								// Sem centro de custos, enviar como pendente
								if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
									dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
								}
								dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += Math.abs(movimento.valor);
								continue;
							}

							// Processar cada centro de custos do movimento
							for (const centroMov of centrosDoMovimento) {
								const centro = centrosCustos.find(c => c.id === centroMov.id);
								if (!centro) {
									console.warn('⚠️ Centro de custos não encontrado:', centroMov.id);
									continue;
								}

								// Determinar se é receita ou despesa baseado no tipoMovimento
								const grupo = movimento.tipoMovimento === 'C' ? 'receitas' : 'despesas';
								
								if (grupo === 'receitas') {
									// Receitas: agrupar diretamente por centro de custos (sem hierarquia)
									// Armazenar como valor direto, não em estrutura de filhos
									if (!dadosMensais[mes].receitas[centro.id]) {
										dadosMensais[mes].receitas[centro.id] = 0;
									}
									dadosMensais[mes].receitas[centro.id] += centroMov.valor;
								} else {
									// Despesas: separar por tipo (CUSTEIO/INVESTIMENTO)
									// Usar IDs especiais para categorias: 1000 = Custeio, 2000 = Investimentos
									const categoriaId = centro.tipo === 'CUSTEIO' ? 1000 : 2000;
									const categoriaDesc = centro.tipo === 'CUSTEIO' ? 'Custeio' : 'Investimentos';
									
									if (!dadosMensais[mes].despesas[categoriaId]) {
										dadosMensais[mes].despesas[categoriaId] = {
											descricao: categoriaDesc,
											filhos: {}
										};
									}
									if (!dadosMensais[mes].despesas[categoriaId].filhos[centro.id]) {
										dadosMensais[mes].despesas[categoriaId].filhos[centro.id] = 0;
									}
									dadosMensais[mes].despesas[categoriaId].filhos[centro.id] += centroMov.valor;
								}
							}
						}
					} else {
						// Agrupamento por Planos de Contas (lógica original)
						for (const movimento of movimentosFiltrados) {
							const mes = new Date(movimento.dtMovimento).getMonth();
							if (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado) {
								continue;
							}
							if (!movimento.resultadoList || movimento.resultadoList.length === 0) {
								const conta = movimento.idContaCorrente;
								pendentesPorConta[conta] = (pendentesPorConta[conta] || 0) + Math.abs(movimento.valor);
								if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
									dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
								}
								dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += Math.abs(movimento.valor);
							}
							if (movimento.resultadoList) {
								for (const resultado of movimento.resultadoList) {
									const plano = planos.find((p) => p.id === resultado.idPlanoContas);
									const contaId = movimento.idContaCorrente;
									if (!plano) {
										if (!dadosMensais[mes].pendentesSelecao[contaId]) {
											dadosMensais[mes].pendentesSelecao[contaId] = 0;
										}
										dadosMensais[mes].pendentesSelecao[contaId] += resultado.valor;
										continue;
									}
									const tipoMov = plano.tipo;
									const hierarquia = plano.hierarquia;
									if (tipoMov === 'investimento' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
										if (!dadosMensais[mes].investimentos[resultado.idPlanoContas]) {
											dadosMensais[mes].investimentos[resultado.idPlanoContas] = 0;
										}
										dadosMensais[mes].investimentos[resultado.idPlanoContas] += resultado.valor;
										continue;
									} else if (tipoMov === 'custeio' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
										const grupo = hierarquia.startsWith('001.') ? 'receitas' : hierarquia.startsWith('002.') ? 'despesas' : null;
										if (!grupo) {
											if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
												dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
											}
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
											continue;
										}
										const idPai = plano.idReferente;
										if (!idPai) {
											if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
												dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
											}
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
											continue;
										}
										if (!dadosMensais[mes][grupo][idPai]) {
											dadosMensais[mes][grupo][idPai] = {
												descricao: planos.find((p) => p.id === idPai)?.descricao || 'Outro',
												filhos: {},
											};
										}
										if (!dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas]) {
											dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] = resultado.valor;
										} else {
											dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] += resultado.valor;
										}
									} else {
										if (!dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente]) {
											dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] = 0;
										}
										dadosMensais[mes].pendentesSelecao[movimento.idContaCorrente] += resultado.valor;
									}
								}
							}
						}
					}

					for (const parcela of parcelas) {
						const financiamento = financiamentos.find((f) => f.id === parcela.idFinanciamento);
						if (!financiamento) continue;
						let credorKey = '';
						let credorDescricao = 'Não identificado';
						if (financiamento.idPessoa) {
							const pessoa = pessoas.find((p) => p.id === financiamento.idPessoa);
							credorKey = `p_${financiamento.idPessoa}`;
							credorDescricao = pessoa ? pessoa.nome : `Pessoa ${financiamento.idPessoa}`;
						} else if (financiamento.idBanco) {
							const banco = bancos.find((b) => b.id === financiamento.idBanco);
							credorKey = `b_${financiamento.idBanco}`;
							credorDescricao = banco ? banco.nome : `Banco ${financiamento.idBanco}`;
						}
						if (!credorKey) continue;

						if (tipoAgrupamento === 'centros') {
							// Separar em pagos e contratados
							// Pagos: parcelas com dt_liquidacao no mês
							// Contratados: parcelas com dt_vencimento no mês e sem dt_liquidacao
							if (parcela.dt_liquidacao) {
								// Parcela paga
								const mesLiquidacao = new Date(parcela.dt_liquidacao).getMonth();
								if (!dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey]) {
									dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey] = { valor: 0, descricao: credorDescricao };
								}
								dadosMensais[mesLiquidacao].financiamentos.pagos[credorKey].valor += parcela.valor;
							}
							
							// Contratados: sempre considerar pelo vencimento (mesmo que já tenha sido pago)
							const mesVencimento = new Date(parcela.dt_vencimento).getMonth();
							if (!dadosMensais[mesVencimento].financiamentos.contratados[credorKey]) {
								dadosMensais[mesVencimento].financiamentos.contratados[credorKey] = { valor: 0, descricao: credorDescricao };
							}
							dadosMensais[mesVencimento].financiamentos.contratados[credorKey].valor += parcela.valor;
						} else {
							// Estrutura original para planos de contas
							const dataEfetiva = new Date(parcela.dt_liquidacao || parcela.dt_vencimento);
							const mes = dataEfetiva.getMonth();
							if (!dadosMensais[mes].financiamentos[credorKey]) {
								dadosMensais[mes].financiamentos[credorKey] = { valor: 0, descricao: credorDescricao };
							}
							dadosMensais[mes].financiamentos[credorKey].valor += parcela.valor;
						}
					}

					for (let i = 0; i < dadosMensais.length; i++) {
						let receitas = 0;
						if (tipoAgrupamento === 'centros') {
							// Quando agrupado por centros, receitas são valores diretos (números)
							receitas = Object.values(dadosMensais[i].receitas ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						} else {
							receitas = Object.values(dadosMensais[i].receitas ?? {})
								.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
								.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						}
						const despesas = Object.values(dadosMensais[i].despesas ?? {})
							.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
							.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						const investimentos = Object.values(dadosMensais[i].investimentos ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						let financiamentos = 0;
						if (tipoAgrupamento === 'centros') {
							// Quando agrupado por centros, financiamentos têm estrutura separada
							const pagos = Object.values(dadosMensais[i].financiamentos?.pagos ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
							const contratados = Object.values(dadosMensais[i].financiamentos?.contratados ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
							financiamentos = contratados - pagos; // Resultado do mês
						} else {
							financiamentos = Object.values(dadosMensais[i].financiamentos ?? {}).reduce((a: number, b: any) => a + b.valor, 0);
						}
						const pendentes = Object.values(dadosMensais[i].pendentesSelecao ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						if (i > 0) {
							dadosMensais[i].saldoInicial = dadosMensais[i - 1].saldoFinal;
						}
						dadosMensais[i].saldoFinal = dadosMensais[i].saldoInicial + (receitas - despesas) + investimentos + financiamentos + pendentes;
						if (dadosMensais[i].saldoInicial === 0) {
							if (dadosMensais[i].saldoFinal > 0) {
								dadosMensais[i].lucro = 100;
							} else if (dadosMensais[i].saldoFinal < 0) {
								dadosMensais[i].lucro = -100;
							} else {
								dadosMensais[i].lucro = 0;
							}
						} else {
							const variacao = ((dadosMensais[i].saldoFinal - dadosMensais[i].saldoInicial) / Math.abs(dadosMensais[i].saldoInicial)) * 100;
							dadosMensais[i].lucro = Number(variacao.toFixed(1));
						}
					}

					return new Response(JSON.stringify(dadosMensais), {
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					});
				} catch (error) {
					console.error('🚨 Erro ao gerar fluxo de caixa do ano anterior:', error);
					return new Response(JSON.stringify({ 
						error: 'Erro ao gerar fluxo de caixa do ano anterior', 
						details: error instanceof Error ? error.message : 'Erro desconhecido',
						stack: error instanceof Error ? error.stack : undefined
					}), {
						status: 500,
						headers: corsHeaders,
					});
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
					console.log(`🔍 Todas as partes:`, pathParts.map((part, index) => `${index}: "${part}"`));
					
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
							isPositive: idContaCorrenteNumero > 0
						});
						return new Response(JSON.stringify({ 
							error: 'Erro no servidor', 
							details: `ID inválido: ${idContaCorrenteNumero}` 
						}), {
							status: 500,
							headers: corsHeaders,
						});
					}
					
					console.log(`✅ ID da conta corrente válido: ${idContaCorrenteNumero}`);

					console.log(`🗑 Iniciando exclusão em massa de todos os movimentos da conta corrente ${idContaCorrenteNumero}`);
					console.log(`🔍 Chamando repository.deleteAllByContaCorrente com ID:`, idContaCorrenteNumero, `tipo:`, typeof idContaCorrenteNumero);
					
					const resultado = await this.movBancarioRepository.deleteAllByContaCorrente(idContaCorrenteNumero);
					console.log(`✅ Exclusão em massa concluída: ${resultado.excluidos} movimentos excluídos`);

					return new Response(JSON.stringify({ 
						message: `Exclusão em massa concluída! ${resultado.excluidos} movimentos foram excluídos.`,
						excluidos: resultado.excluidos
					}), {
						status: 200,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('❌ Erro na exclusão em massa:', error);
					console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
					console.error('❌ Error type:', typeof error);
					console.error('❌ Error constructor:', error?.constructor?.name);
					return new Response(JSON.stringify({ 
						error: 'Erro ao excluir movimentos em massa',
						details: error instanceof Error ? error.message : 'Erro desconhecido'
					}), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			if (method === 'DELETE' && pathname.startsWith('/api/movBancario/')) {
				const id = parseInt(pathname.split('/')[3]);
				console.log(`🗑 Excluindo movimento ID ${id}`);
				await this.movBancarioRepository.deleteById(id);
				console.log('✅ Exclusão realizada com sucesso');

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
				const idConta = parseInt(pathname.split('/')[3]);
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
					!body.valor ||
					!body.data ||
					!body.descricao ||
					!body.idUsuario ||
					!body.contaOrigemDescricao ||
					!body.contaDestinoDescricao
				) {
					console.warn('⚠️ Dados incompletos para transferência', body);

					return new Response(JSON.stringify({ error: 'Dados incompletos para transferência.' }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				try {
					await this.movBancarioRepository.transfer({
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

					return new Response(JSON.stringify({ message: 'Transferência realizada com sucesso!' }), {
						status: 201,
						headers: corsHeaders,
					});
				} catch (error) {
					const message = (error as Error).message;
					const stack = (error as Error).stack;

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
						primeirosIds: body.ids?.slice(0, 5) || []
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
						return new Response(JSON.stringify({ 
							error: 'Limite de IDs excedido. Máximo permitido: 100',
							received: body.ids.length
						}), {
							status: 400,
							headers: corsHeaders,
						});
					}

					// Validação adicional para garantir que nenhum lote exceda o limite
					if (body.ids.length > 100) {
						console.error('🚨 CRÍTICO: Lote com mais de 100 IDs recebido:', body.ids.length);
						return new Response(JSON.stringify({ 
							error: 'Lote muito grande recebido. Máximo permitido: 100',
							received: body.ids.length,
							suggestion: 'Reduza o tamanho do lote no frontend'
						}), {
							status: 400,
							headers: corsHeaders,
						});
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
						error: error
					});
					return new Response(JSON.stringify({ 
						error: 'Erro ao buscar movimentos por IDs',
						details: error instanceof Error ? error.message : 'Erro desconhecido'
					}), {
						status: 500,
						headers: corsHeaders,
					});
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
