import { MovimentoBancarioRepository } from '../repositories/MovimentoBancarioRepository';
import { MovimentoBancario } from '../models/MovimentoBancario';
import { PlanoContaRepository } from '../repositories/PlanoContaRepository';
import { ParcelaFinanciamentoRepository } from '../repositories/ParcelaFinanciamentoRepository';
import { ContaCorrenteRepository } from '../repositories/ContaCorrenteRepository';
import { FinanciamentoRepository } from '../repositories/FinanciamentoRepository';
import { PessoaRepository } from '../repositories/PessoaRepository';
import { BancoRepository } from '../repositories/BancoRepository';
import { MovimentoDetalhado } from '../models/MovimentoDetalhado';

export class MovimentoBancarioController {
	private movBancarioRepository: MovimentoBancarioRepository;
	private planoContaRepository: PlanoContaRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;
	private contaCorrenteRepository: ContaCorrenteRepository;
	private financiamentoRepo: FinanciamentoRepository;
	private pessoaRepo: PessoaRepository;
	private bancoRepo: BancoRepository;

	constructor(
		movBancarioRepository: MovimentoBancarioRepository,
		planoContaRepository: PlanoContaRepository,
		parcelaRepo: ParcelaFinanciamentoRepository,
		contaCorrenteRepo: ContaCorrenteRepository,
		financiamentoRepo: FinanciamentoRepository,
		pessoaRepo: PessoaRepository,
		bancoRepo: BancoRepository
	) {
		this.movBancarioRepository = movBancarioRepository;
		this.planoContaRepository = planoContaRepository;
		this.parcelaRepo = parcelaRepo;
		this.contaCorrenteRepository = contaCorrenteRepo;
		this.financiamentoRepo = financiamentoRepo;
		this.pessoaRepo = pessoaRepo;
		this.bancoRepo = bancoRepo;
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
			if (method === 'GET' && pathname === '/api/movBancario') {
				console.log('📥 Requisição GET /api/movBancario recebida');
				const movBancario = await this.movBancarioRepository.getAll();
				console.log('📤 Retornando', movBancario.length, 'movimentos bancários');

				return new Response(JSON.stringify(movBancario), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
							console.warn('⚠️ Movimento duplicado detectado pelo identificador_ofx');

							return new Response(JSON.stringify(existente), {
								status: 200,
								headers: corsHeaders,
							});
						}
					}

					const id = await this.movBancarioRepository.create(body);
					console.log('✅ Movimento criado com ID:', id);
					return new Response(JSON.stringify({ id, message: 'Movimento bancário criado com sucesso!' }), {
						status: 201,
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('🔥 Erro interno:', (error as Error).message, (error as Error).stack);
					return new Response(
						JSON.stringify({
							error: 'Erro interno',
							message: (error as Error).message,
							stack: (error as Error).stack,
						}),
						{
							status: 500,
							headers: corsHeaders,
						}
					);
				}
			}

			if (method === 'GET' && pathname === '/api/fluxoCaixa/detalhar') {
				const urlObj = new URL(req.url);
				const tipo = urlObj.searchParams.get('tipo') || '';
				const mes = parseInt(urlObj.searchParams.get('mes') || '');
				const ano = parseInt(urlObj.searchParams.get('ano') || new Date().getFullYear().toString());

				let movimentos: MovimentoDetalhado[] = [];

				if (tipo === 'financiamentos') {
					const credorKey = urlObj.searchParams.get('planoId') || '';
					movimentos = await this.movBancarioRepository.getDetalhesFinanciamento(credorKey, mes, ano);
				} else {
					const planoId = parseInt(urlObj.searchParams.get('planoId') || '');
					movimentos = await this.movBancarioRepository.getMovimentosPorDetalhamento(planoId, mes, tipo);
				}

				return new Response(JSON.stringify(movimentos), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
			}

			if (method === 'POST' && pathname === '/api/fluxoCaixa') {
				try {
					const body = await req.json();
					const { ano, contas } = body as { ano: string; contas: string[] };
					const contasNumber = contas.map(Number);
					console.log('📊 Gerando fluxo de caixa para ano:', ano, 'contas:', contas);

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

					const dadosMensais: any[] = Array(12)
						.fill(null)
						.map(() => ({
							receitas: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							despesas: {} as { [key: number]: { descricao: string; filhos: { [key: number]: number } } },
							investimentos: {} as { [key: number]: number },
							financiamentos: {} as { [key: string]: { valor: number; descricao: string } },
							pendentesSelecao: {} as { [key: number]: number },
							saldoInicial: 0,
							saldoFinal: 0,
							lucro: 0,
						}));

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

					for (const parcela of parcelas) {
						const dataEfetiva = new Date(parcela.dt_liquidacao || parcela.dt_vencimento);
						const mes = dataEfetiva.getMonth();
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

						if (!dadosMensais[mes].financiamentos[credorKey]) {
							dadosMensais[mes].financiamentos[credorKey] = { valor: 0, descricao: credorDescricao };
						}

						dadosMensais[mes].financiamentos[credorKey].valor += parcela.valor;
					}

					for (let i = 0; i < dadosMensais.length; i++) {
						const receitas = Object.values(dadosMensais[i].receitas ?? {})
							.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
							.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						const despesas = Object.values(dadosMensais[i].despesas ?? {})
							.flatMap((subcat: any) => Object.values(subcat.filhos || {}))
							.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						const investimentos = Object.values(dadosMensais[i].investimentos ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						const financiamentos = Object.values(dadosMensais[i].financiamentos ?? {}).reduce((a: number, b: any) => a + b.valor, 0);
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

			if (method === 'PUT' && pathname.startsWith('/api/movBancario/')) {
				const id = parseInt(pathname.split('/')[3]);
				const body: MovimentoBancario = await req.json();
				console.log(`✏️ Atualizando movimento ID ${id}`, JSON.stringify(body, null, 2));
				await this.movBancarioRepository.update(id, body);
				console.log('✅ Atualização realizada com sucesso');

				return new Response(JSON.stringify({ message: 'Movimento bancário atualizado com sucesso!' }), {
					status: 200,
					headers: corsHeaders,
				});
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
