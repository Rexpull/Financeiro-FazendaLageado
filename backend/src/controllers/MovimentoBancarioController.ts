import { MovimentoBancarioRepository } from '../repositories/MovimentoBancarioRepository';
import { MovimentoBancario } from '../models/MovimentoBancario';
import { PlanoContaRepository } from '../repositories/PlanoContaRepository';
import { ParcelaFinanciamentoRepository } from '../repositories/ParcelaFinanciamentoRepository';

export class MovimentoBancarioController {
	private movBancarioRepository: MovimentoBancarioRepository;
	private planoContaRepository: PlanoContaRepository;
	private parcelaRepo: ParcelaFinanciamentoRepository;

	constructor(
		movBancarioRepository: MovimentoBancarioRepository,
		planoContaRepository: PlanoContaRepository,
		parcelaRepo: ParcelaFinanciamentoRepository
	) {
		this.movBancarioRepository = movBancarioRepository;
		this.planoContaRepository = planoContaRepository;
		this.parcelaRepo = parcelaRepo;
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

							return new Response(
								JSON.stringify(existente),
								{
									status: 200,
									headers: corsHeaders,
								}
							);
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

			if (method === 'POST' && pathname === '/api/fluxoCaixa') {
				const { ano, contas } = await req.json();
				console.log('📊 Gerando fluxo de caixa para ano:', ano, 'contas:', contas);

				const todosMovimentos = await this.movBancarioRepository.getAllFiltrado(ano, contas);
				const parcelas = await this.parcelaRepo.getByAno(ano);
				const planos = await this.planoContaRepository.getAll();
				const pendentesPorConta: { [idConta: number]: number } = {};
	
				const movimentosFiltrados = todosMovimentos.filter((mov) => {
					const data = new Date(mov.dtMovimento);
					return data.getFullYear().toString() === ano && contas.includes(mov.idContaCorrente);
				});
				console.log("🎯 Movimentos filtrados para o Fluxo:", movimentosFiltrados.map(m => ({ id: m.id, dt: m.dtMovimento, conta: m.idContaCorrente, resultado: m.resultadoList?.length})));

				const dadosMensais = Array(12)
					.fill(null)
					.map(() => ({
						receitas: {},
						despesas: {},
						investimentos: {},
						financiamentos: {},
						pendentesSelecao: {},
						saldoInicial: 0,
						saldoFinal: 0,
						lucro: 0,
					}));

				for (const movimento of movimentosFiltrados) {
					const mes = new Date(movimento.dtMovimento).getMonth();

					if (movimento.modalidadeMovimento === 'financiamento' && movimento.parcelado) {
						const parcelasMov = parcelas.filter((p) => p.idMovimentoBancario === movimento.id);
						for (const p of parcelasMov) {
							const m = new Date(p.dt_vencimento).getMonth();
							const contaId = movimento.idContaCorrente;
							dadosMensais[m].financiamentos[contaId] = (dadosMensais[m].financiamentos[contaId] || 0) + Number(p.valor);
						}
						continue;
					}

					if (!movimento.resultadoList || movimento.resultadoList.length === 0) {
						const mes = new Date(movimento.dtMovimento).getMonth();
						const conta = movimento.idContaCorrente;
						pendentesPorConta[conta] = (pendentesPorConta[conta] || 0) + Math.abs(movimento.valor);
				
						if (!dadosMensais[mes].pendentesSelecao) {
							dadosMensais[mes].pendentesSelecao = {};
						}
						dadosMensais[mes].pendentesSelecao[conta] = (dadosMensais[mes].pendentesSelecao[conta] || 0) + Math.abs(movimento.valor);
					}

					for (const resultado of movimento.resultadoList) {
						const plano = planos.find((p) => p.id === resultado.idPlanoContas);
						if (!plano) continue;

						const tipoMov = plano.tipo;
						const hierarquia = plano.hierarquia;

						if (tipoMov === 'investimento' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
							dadosMensais[mes].investimentos[resultado.idPlanoContas] =
								(dadosMensais[mes].investimentos[resultado.idPlanoContas] || 0) + resultado.valor;
							continue;
						}

						if (tipoMov === 'custeio' && movimento.modalidadeMovimento === 'padrao' && !movimento.parcelado) {
							const grupo = hierarquia.startsWith('001.') ? 'receitas' : hierarquia.startsWith('002.') ? 'despesas' : null;
							if (!grupo) continue;

							const idPai = plano.idReferente;
							if (!dadosMensais[mes][grupo][idPai]) {
								dadosMensais[mes][grupo][idPai] = {
									descricao: planos.find((p) => p.id === idPai)?.descricao || 'Outro',
									filhos: {},
								};
							}

							dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] =
								(dadosMensais[mes][grupo][idPai].filhos[resultado.idPlanoContas] || 0) + resultado.valor;
						}
					}
				}

				return new Response(JSON.stringify(dadosMensais), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				});
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
