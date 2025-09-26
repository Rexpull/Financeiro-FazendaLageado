import { HistoricoImportacaoOFXRepository } from '../repositories/HistoricoImportacaoOFXRepository';
import { HistoricoImportacaoOFX } from '../models/HistoricoImportacaoOFX';

export class HistoricoImportacaoOFXController {
	private historicoRepository: HistoricoImportacaoOFXRepository;

	constructor(historicoRepository: HistoricoImportacaoOFXRepository) {
		this.historicoRepository = historicoRepository;
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
			// GET - Buscar histórico por usuário
			if (method === 'GET' && pathname === '/api/historico-importacao-ofx') {
				const urlObj = new URL(req.url);
				const idUsuario = urlObj.searchParams.get('idUsuario');

				if (!idUsuario || isNaN(Number(idUsuario))) {
					return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				console.log(`📥 Buscando histórico de importações para usuário ${idUsuario}`);
				
				try {
					const historico = await this.historicoRepository.getAllByUsuario(Number(idUsuario));
					console.log(`📤 Retornando ${historico.length} registros de histórico`);

					return new Response(JSON.stringify(historico), {
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				} catch (dbError) {
					console.error('❌ Erro ao buscar histórico:', dbError);
					
					// Se a tabela não existir, retorna array vazio
					if (dbError instanceof Error && dbError.message.includes('no such table')) {
						console.log('⚠️ Tabela HistoricoImportacaoOFX não existe, retornando array vazio');
						return new Response(JSON.stringify([]), {
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}
					
					return new Response(JSON.stringify({ error: 'Erro ao buscar histórico' }), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			// POST - Criar novo histórico
			if (method === 'POST' && pathname === '/api/historico-importacao-ofx') {
				const body: Omit<HistoricoImportacaoOFX, 'id' | 'criadoEm' | 'atualizadoEm'> = await req.json();
				
				console.log('📥 Criando novo histórico de importação:', JSON.stringify(body, null, 2));

				if (!body.idUsuario || !body.nomeArquivo || !body.dataImportacao) {
					return new Response(JSON.stringify({ error: 'Campos obrigatórios: idUsuario, nomeArquivo, dataImportacao' }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				const id = await this.historicoRepository.create(body);
				console.log('✅ Histórico de importação criado com sucesso, ID:', id);

				return new Response(JSON.stringify({ id }), {
					status: 201,
					headers: corsHeaders,
				});
			}

			// DELETE - Limpar histórico do usuário
			if (method === 'DELETE' && pathname === '/api/historico-importacao-ofx') {
				const urlObj = new URL(req.url);
				const idUsuario = urlObj.searchParams.get('idUsuario');

				if (!idUsuario || isNaN(Number(idUsuario))) {
					return new Response(JSON.stringify({ error: 'ID do usuário é obrigatório' }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				console.log(`🗑️ Limpando histórico de importações para usuário ${idUsuario}`);
				await this.historicoRepository.deleteByUsuario(Number(idUsuario));
				console.log('✅ Histórico de importações limpo com sucesso');

				return new Response(JSON.stringify({ message: 'Histórico limpo com sucesso' }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			// DELETE - Deletar histórico específico
			if (method === 'DELETE' && pathname.startsWith('/api/historico-importacao-ofx/')) {
				const pathParts = pathname.split('/');
				const id = parseInt(pathParts[3]);
				const urlObj = new URL(req.url);
				const idUsuario = urlObj.searchParams.get('idUsuario');

				if (!id || isNaN(id) || !idUsuario || isNaN(Number(idUsuario))) {
					return new Response(JSON.stringify({ error: 'ID do histórico e ID do usuário são obrigatórios' }), {
						status: 400,
						headers: corsHeaders,
					});
				}

				console.log(`🗑️ Deletando histórico ${id} do usuário ${idUsuario}`);
				await this.historicoRepository.deleteById(id, Number(idUsuario));
				console.log('✅ Histórico deletado com sucesso');

				return new Response(JSON.stringify({ message: 'Histórico deletado com sucesso' }), {
					status: 200,
					headers: corsHeaders,
				});
			}

			return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
				status: 404,
				headers: corsHeaders,
			});

		} catch (error) {
			console.error('❌ Erro no controller de histórico de importações:', error);
			return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
				status: 500,
				headers: corsHeaders,
			});
		}
	}
}
