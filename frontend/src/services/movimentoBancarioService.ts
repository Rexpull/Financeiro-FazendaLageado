import { MovimentoBancario } from '../../../backend/src/models/MovimentoBancario';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL;

export const listarMovimentosBancarios = async (): Promise<MovimentoBancario[]> => {
	const res = await fetch(`${API_URL}/api/movBancario`);
	if (!res.ok) throw new Error(`Erro ao listar movimentos bancários`);
	return res.json();
};

export const listarMovimentosBancariosPaginado = async (
	page: number = 1,
	limit: number = 50,
	contaId?: number,
	dataInicio?: string,
	dataFim?: string,
	status?: string
): Promise<{
	movimentos: MovimentoBancario[];
	total: number;
	totalPages: number;
	currentPage: number;
	hasNext: boolean;
	hasPrev: boolean;
}> => {
	const params = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
		...(contaId && { contaId: contaId.toString() }),
		...(dataInicio && { dataInicio }),
		...(dataFim && { dataFim }),
		...(status && { status })
	});
	
	console.log('🌐 Service: Enviando requisição para:', `${API_URL}/api/movBancario/paginado?${params}`);
	console.log('🌐 Service: Parâmetros enviados:', { page, limit, contaId, dataInicio, dataFim, status });
	
	const res = await fetch(`${API_URL}/api/movBancario/paginado?${params}`);
	if (!res.ok) throw new Error(`Erro ao listar movimentos bancários paginados`);
	return res.json();
};

export const exportarMovimentosBancariosExcel = async (
	contaId?: number,
	dataInicio?: string,
	dataFim?: string,
	status?: string
): Promise<Blob> => {
	const params = new URLSearchParams({
		...(contaId && { contaId: contaId.toString() }),
		...(dataInicio && { dataInicio }),
		...(dataFim && { dataFim }),
		...(status && { status })
	});
	
	console.log('🌐 Service: Enviando requisição Excel para:', `${API_URL}/api/movBancario/export?${params}`);
	console.log('🌐 Service: Parâmetros Excel enviados:', { contaId, dataInicio, dataFim, status });
	
	const res = await fetch(`${API_URL}/api/movBancario/export?${params}`);
	if (!res.ok) throw new Error(`Erro ao exportar movimentos bancários para Excel`);
	return res.blob();
};

export const exportarMovimentosBancariosPDF = async (
	contaId?: number,
	dataInicio?: string,
	dataFim?: string,
	status?: string
): Promise<Blob> => {
	const params = new URLSearchParams({
		...(contaId && { contaId: contaId.toString() }),
		...(dataInicio && { dataInicio }),
		...(dataFim && { dataFim }),
		...(status && { status })
	});
	
	console.log('🌐 Service: Enviando requisição PDF para:', `${API_URL}/api/movBancario/export-pdf?${params}`);
	console.log('🌐 Service: Parâmetros PDF enviados:', { contaId, dataInicio, dataFim, status });
	
	const res = await fetch(`${API_URL}/api/movBancario/export-pdf?${params}`);
	if (!res.ok) throw new Error(`Erro ao exportar movimentos bancários para PDF`);
	return res.blob();
};

export const salvarMovimentoBancario = async (movimento: MovimentoBancario): Promise<MovimentoBancario> => {
	try {
		if (movimento.tipoMovimento === 'D' && movimento.valor > 0) {
			movimento.valor = -Math.abs(movimento.valor);
		}

		// Se for uma atualização (PUT), enviar apenas os campos que estão sendo alterados
		if (movimento.id) {
			// Buscar o movimento atual para comparar
			const movimentoAtual = await buscarMovimentoBancarioById(movimento.id);
			
			// Criar objeto apenas com os campos alterados
			const camposAlterados: Partial<MovimentoBancario> = {
				id: movimento.id,
				dtMovimento: movimento.dtMovimento,
				historico: movimento.historico,
				valor: movimento.valor,
				tipoMovimento: movimento.tipoMovimento,
				identificadorOfx: movimento.identificadorOfx,
				idContaCorrente: movimento.idContaCorrente,
				saldo: movimento.saldo,
				ideagro: movimento.ideagro,
				parcelado: movimento.parcelado,
				modalidadeMovimento: movimento.modalidadeMovimento,
			};

			// Adicionar apenas campos que foram alterados ou são diferentes do atual
			if (movimento.idPlanoContas !== movimentoAtual.idPlanoContas) {
				camposAlterados.idPlanoContas = movimento.idPlanoContas;
			}
			if (movimento.idPessoa !== movimentoAtual.idPessoa) {
				camposAlterados.idPessoa = movimento.idPessoa;
			}
			if (movimento.idBanco !== movimentoAtual.idBanco) {
				camposAlterados.idBanco = movimento.idBanco;
			}
			if (movimento.numeroDocumento !== movimentoAtual.numeroDocumento) {
				camposAlterados.numeroDocumento = movimento.numeroDocumento;
			}
			if (movimento.descricao !== movimentoAtual.descricao) {
				camposAlterados.descricao = movimento.descricao;
			}
			if (movimento.transfOrigem !== movimentoAtual.transfOrigem) {
				camposAlterados.transfOrigem = movimento.transfOrigem;
			}
			if (movimento.transfDestino !== movimentoAtual.transfDestino) {
				camposAlterados.transfDestino = movimento.transfDestino;
			}
			if (movimento.idUsuario !== movimentoAtual.idUsuario) {
				camposAlterados.idUsuario = movimento.idUsuario;
			}
			if (movimento.idFinanciamento !== movimentoAtual.idFinanciamento) {
				camposAlterados.idFinanciamento = movimento.idFinanciamento;
			}
			if (movimento.resultadoList !== movimentoAtual.resultadoList) {
				camposAlterados.resultadoList = movimento.resultadoList;
			}

			// Limpar valores undefined antes de enviar
			const movimentoLimpo = Object.fromEntries(
				Object.entries(camposAlterados).filter(([_, value]) => value !== undefined)
			) as MovimentoBancario;

			console.log('🔧 Campos alterados para atualização:', movimentoLimpo);

			const res = await fetch(`${API_URL}/api/movBancario/${movimento.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(movimentoLimpo),
			});

			if (!res.ok) throw new Error('Erro ao atualizar movimento bancário');
			
			// Buscar o movimento atualizado do backend
			const movimentoAtualizado = await buscarMovimentoBancarioById(movimento.id);
			toast.success(`Movimento atualizado com sucesso!`);
			return movimentoAtualizado;
		} else {
			// Se for uma criação (POST), enviar todos os campos necessários
			const movimentoLimpo = Object.fromEntries(
				Object.entries(movimento).filter(([_, value]) => value !== undefined)
			) as MovimentoBancario;

			// Garantir valores padrão para campos obrigatórios
			movimentoLimpo.dtMovimento = movimentoLimpo.dtMovimento || new Date().toISOString();
			movimentoLimpo.historico = movimentoLimpo.historico || 'Movimento sem descrição';
			movimentoLimpo.valor = movimentoLimpo.valor || 0;
			movimentoLimpo.saldo = movimentoLimpo.saldo || 0;
			movimentoLimpo.ideagro = movimentoLimpo.ideagro || false;
			movimentoLimpo.parcelado = movimentoLimpo.parcelado || false;
			movimentoLimpo.identificadorOfx = movimentoLimpo.identificadorOfx || crypto.randomUUID();

			const res = await fetch(`${API_URL}/api/movBancario`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(movimentoLimpo),
			});

			if (!res.ok) throw new Error('Erro ao criar movimento bancário');
			
			const resultado = await res.json();
			toast.success(`Movimento criado com sucesso!`);
			return resultado;
		}
	} catch (error) {
		console.error('Erro ao salvar movimento bancário:', error);
		throw error;
	}
};

export const salvarMovimentosOFX = async (
	movimentos: MovimentoBancario[],
	idContaCorrente: number,
	setCurrentIndex?: (i: number) => void,
	setNovosExistentes?: (novos: number, existentes: number) => void
): Promise<{ movimentos: MovimentoBancario[], novos: number, existentes: number }> => {
	const movimentosFinal: MovimentoBancario[] = [];
	let novos = 0;
	let encontrados = 0;
	const BATCH_SIZE = 10; // Processa 10 movimentos por vez

	console.log(`🔄 Processando ${movimentos.length} movimentos em lotes de ${BATCH_SIZE}`);

	// Processar movimentos em lotes
	for (let i = 0; i < movimentos.length; i += BATCH_SIZE) {
		const batch = movimentos.slice(i, i + BATCH_SIZE);
		console.log(`📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(movimentos.length / BATCH_SIZE)}`);

		try {
			// Preparar o lote atual
			const batchPreparado = batch.map(mov => {
				if (mov.tipoMovimento === 'D' && mov.valor > 0) {
					mov.valor = -Math.abs(mov.valor);
				}

				const movComConta: MovimentoBancario = {
					...mov,
					idContaCorrente,
					saldo: mov.saldo ?? 0,
					modalidadeMovimento: mov.modalidadeMovimento ?? 'padrao',
					ideagro: mov.ideagro ?? false,
					parcelado: mov.parcelado ?? false,
					numeroDocumento: mov.numeroDocumento ?? null,
					descricao: mov.descricao ?? null,
					transfOrigem: mov.transfOrigem ?? null,
					transfDestino: mov.transfDestino ?? null,
					idBanco: mov.idBanco ?? null,
					idPessoa: mov.idPessoa ?? null,
					idPlanoContas: mov.idPlanoContas ?? null,
					idUsuario: mov.idUsuario ?? null,
					idFinanciamento: mov.idFinanciamento ?? null,
					tipoMovimento: mov.tipoMovimento ?? (mov.valor >= 0 ? 'C' : 'D'),
					criadoEm: '',
					atualizadoEm: '',
				};

				// Remover campos undefined e garantir valores válidos
				const movLimpo = Object.fromEntries(
					Object.entries(movComConta).filter(([_, value]) => value !== undefined)
				) as MovimentoBancario;

				// Garantir que campos obrigatórios tenham valores válidos
				movLimpo.dtMovimento = movLimpo.dtMovimento || new Date().toISOString();
				movLimpo.historico = movLimpo.historico || 'Movimento sem descrição';
				movLimpo.valor = movLimpo.valor || 0;
				movLimpo.saldo = movLimpo.saldo || 0;
				movLimpo.ideagro = movLimpo.ideagro || false;
				movLimpo.parcelado = movLimpo.parcelado || false;
				movLimpo.identificadorOfx = movLimpo.identificadorOfx || crypto.randomUUID();

				return movLimpo;
			});

			// Enviar lote para o backend
			const response = await fetch(`${API_URL}/api/movBancario/batch`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movimentos: batchPreparado }),
			});

			if (!response.ok) {
				throw new Error(`Erro ao processar lote: ${response.status}`);
			}

			const batchResult = await response.json();
			console.log(`✅ Lote processado:`, batchResult);

			// Processar resultados do lote
			if (batchResult.movimentos) {
				movimentosFinal.push(...batchResult.movimentos);
				novos += batchResult.novos || 0;
				encontrados += batchResult.existentes || 0;
			}

			// Atualizar progresso
			setCurrentIndex?.(Math.min(i + BATCH_SIZE, movimentos.length));
			setNovosExistentes?.(novos, encontrados);

			// Pequena pausa entre lotes para não sobrecarregar o servidor
			if (i + BATCH_SIZE < movimentos.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}

		} catch (error) {
			console.error(`❌ Erro ao processar lote ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
			toast.error(`Erro ao processar lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error}`);
			
			// Continuar com o próximo lote mesmo se houver erro
			continue;
		}
	}

	console.log(`🎉 Processamento concluído: ${novos} novos, ${encontrados} existentes`);
	return { movimentos: movimentosFinal, novos, existentes: encontrados };
};

export const buscarMovimentoBancarioById = async (id: number): Promise<MovimentoBancario> => {
	const res = await fetch(`${API_URL}/api/movBancario/${id}`);
	if (!res.ok) throw new Error(`Erro ao buscar movimento bancário id ${id}`);
	return res.json();
};

export const excluirMovimentoBancario = async (id: number): Promise<void> => {
	try {
		const res = await fetch(`${API_URL}/api/movBancario/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Erro ao excluir movimento bancário');
		toast.success('Movimento excluido com sucesso!');
	} catch (error) {
		toast.error(`Falha na exclusão do movimento!`);
	}
};

export const excluirTodosMovimentosBancarios = async (idContaCorrente: number): Promise<{ excluidos: number }> => {
	try {
		console.log(`🚀 Enviando requisição de exclusão em massa para conta corrente ID: ${idContaCorrente}`);
		
		const res = await fetch(`${API_URL}/api/movBancario/deleteAll/${idContaCorrente}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
		});
		
		console.log(`📡 Resposta recebida:`, res.status, res.statusText);
		
		if (!res.ok) {
			const errorData = await res.json();
			console.error(`❌ Erro na resposta:`, errorData);
			throw new Error(errorData.error || 'Erro ao excluir movimentos em massa');
		}
		
		const result = await res.json();
		console.log(`✅ Resultado da exclusão:`, result);
		toast.success(result.message);
		return { excluidos: result.excluidos };
	} catch (error) {
		console.error(`❌ Erro na exclusão em massa:`, error);
		toast.error(`Falha na exclusão em massa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
		throw error;
	}
};

export const atualizarStatusIdeagro = async (id: number, ideagro: boolean): Promise<any> => {
	try {
		const res = await fetch(`${API_URL}/api/movBancario/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ideagro }),
		});

		if (!res.ok) throw new Error('Erro ao atualizar status IdeAgro');

		const data = await res.json();

		if (ideagro) {
			toast.success(`Movimento conciliado com sucesso!`);
		}

		return data;
	} catch (error) {
		toast.error('Erro ao atualizar status da conta!');
		throw error;
	}
};

export const transferirMovimentoBancario = async (payload: {
	contaOrigemId: number;
	contaOrigemDescricao: string;
	contaDestinoId: number;
	contaDestinoDescricao: string;
	valor: number;
	descricao: string;
	data: string;
	idUsuario: number;
}): Promise<{ message: string }> => {
	const res = await fetch(`${API_URL}/api/movBancario/transfer`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (res.ok) toast.success('Transferência realizada com sucesso!');

	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		console.error('Erro Backend Transfer:', errorData);
		toast.error(errorData.message || 'Erro ao realizar transferência!');
		throw new Error(errorData.message || 'Erro ao realizar transferência bancária');
	}

	return res.json();
};

export const buscarSaldoContaCorrente = async (idConta: number, data: string) => {
	const res = await fetch(`${API_URL}/api/movBancario/saldo/${idConta}?data=${encodeURIComponent(data)}`);
	if (!res.ok) throw new Error('Erro ao buscar saldo da conta');
	return res.json();
};

export const buscarMovimentosPorIds = async (ids: number[]): Promise<MovimentoBancario[]> => {
	try {
		// Processar em lotes para evitar erro "too many SQL variables"
		const BATCH_SIZE = 100; // SQLite suporta até 999 variáveis, usamos 100 para máxima segurança
		const movimentos: MovimentoBancario[] = [];
		const totalLotes = Math.ceil(ids.length / BATCH_SIZE);
		
		console.log(`🔄 Iniciando busca de ${ids.length} movimentos em ${totalLotes} lotes de ${BATCH_SIZE}`);
		
		for (let i = 0; i < ids.length; i += BATCH_SIZE) {
			const batch = ids.slice(i, i + BATCH_SIZE);
			const numeroLote = Math.floor(i / BATCH_SIZE) + 1;
			
			console.log(`🔍 Processando lote ${numeroLote}/${totalLotes}: ${batch.length} IDs`);
			
			try {
				const res = await fetch(`${API_URL}/api/movBancario/porIds`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ids: batch }),
				});
				
				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}));
					throw new Error(errorData.message || `Erro ao buscar lote ${numeroLote}`);
				}
				
				const batchResult = await res.json() as MovimentoBancario[];
				movimentos.push(...batchResult);
				
				console.log(`✅ Lote ${numeroLote} processado: ${batchResult.length} movimentos encontrados`);
				
				// Pequena pausa entre lotes para não sobrecarregar o servidor
				if (numeroLote < totalLotes) {
					await new Promise(resolve => setTimeout(resolve, 200));
				}
				
			} catch (error) {
				console.error(`❌ Erro no lote ${numeroLote}:`, error);
				throw new Error(`Falha no lote ${numeroLote}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
			}
		}
		
		console.log(`🎉 Busca concluída: ${movimentos.length} movimentos encontrados em ${totalLotes} lotes`);
		return movimentos;
	} catch (error) {
		console.error('🔥 Erro ao buscar movimentos por IDs:', error);
		throw error;
	}
};

export const atualizarContaMovimentosOFX = async (idMovimentos: number[], novaContaId: number): Promise<{ atualizados: number }> => {
	try {
		console.log(`🔄 Atualizando conta de ${idMovimentos.length} movimentos para conta ${novaContaId}`);
		
		const res = await fetch(`${API_URL}/api/movBancario/update-conta-ofx`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idMovimentos, novaContaId }),
		});
		
		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || 'Erro ao atualizar conta dos movimentos OFX');
		}
		
		const resultado = await res.json() as { atualizados: number };
		console.log(`✅ ${resultado.atualizados} movimentos atualizados com sucesso`);
		
		return resultado;
	} catch (error) {
		console.error('❌ Erro ao atualizar conta dos movimentos OFX:', error);
		throw error;
	}
};