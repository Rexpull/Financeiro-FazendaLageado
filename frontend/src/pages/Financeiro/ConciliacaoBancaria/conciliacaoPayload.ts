import { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';
import { Resultado } from '../../../../../backend/src/models/Resultado';
import { MovimentoCentroCustos } from '../../../../../backend/src/models/MovimentoCentroCustos';
import type { MovimentoBancarioEdicao } from '../../../services/movimentoBancarioService';
import { aplicarPercentuaisEmValoresMonetarios } from './Modals/rateioPercentuais';

/**
 * Montagem do movimento enviado no PUT parcial da conciliação.
 *
 * Contrato com o backend (PUT parcial — campo ausente/undefined = mantém o valor atual):
 * - `null` LIMPA o campo (idPlanoContas, idCentroCustos, idFinanciamento, idBanco…);
 * - idCentroCustos null + centroCustosList não vazia = rateio de centros;
 * - idCentroCustos null SEM centroCustosList = limpa os centros;
 * - idPlanoContas null + resultadoList não vazia = rateio de planos; resultadoList [] = plano único/nenhum.
 */

export type ModalidadeMovimento = NonNullable<MovimentoBancario['modalidadeMovimento']>;

export type CentroCustosRateio = Omit<MovimentoCentroCustos, 'idMovimentoBancario'> & { idMovimentoBancario?: number };

export interface DadosConciliacao {
	modalidadeMovimento: ModalidadeMovimento;
	idPlanoContas?: number | null;
	idCentroCustos?: number | null;
	idPessoa?: number | null;
	idBanco?: number | null;
	idFinanciamento?: number | null;
	numeroDocumento?: string | null;
	parcelado?: boolean;
	resultadoList?: Resultado[];
	centroCustosList?: CentroCustosRateio[];
}

type MovimentoConciliado = MovimentoBancarioEdicao;

/** Campos exclusivos de financiamento: limpos (null) ao voltar para padrão/transferência. */
function limparCamposFinanciamento(mov: MovimentoConciliado) {
	mov.idBanco = null;
	mov.parcelado = false;
	mov.idFinanciamento = null;
	// numeroDocumento NÃO é limpo: em linhas importadas do OFX ele guarda o identificador do
	// banco (exibido no detalhamento) e a conciliação nunca o edita — omitir = manter.
}

function aplicarTransferencia(mov: MovimentoConciliado) {
	limparCamposFinanciamento(mov);
	mov.idCentroCustos = null;
	mov.resultadoList = [];
	// Sem lista + idCentroCustos null = backend limpa os centros (inclusive rateio antigo)
	mov.centroCustosList = undefined;
}

/** Conciliação de UM movimento (modal aberto pela linha). */
export function montarMovimentoConciliacaoIndividual(base: MovimentoBancario, data: DadosConciliacao): MovimentoConciliado {
	const mov: MovimentoConciliado = {
		...base,
		idPlanoContas: data.idPlanoContas ?? null,
		modalidadeMovimento: data.modalidadeMovimento,
		idPessoa: data.idPessoa ?? null,
		idCentroCustos: data.idCentroCustos ?? null,
	};

	// Use the plan split chosen in the modal ([] = single plano via idPlanoContas);
	// never resend the movement's previous resultadoList, or the old plano is recreated.
	if (data.resultadoList !== undefined) {
		mov.resultadoList = data.resultadoList;
	}

	if (data.centroCustosList !== undefined) {
		mov.centroCustosList = data.centroCustosList as MovimentoCentroCustos[];
	} else {
		// Never resend the movement's previous centre rows: the backend gives a sent list priority over
		// idCentroCustos, so the old centre was written back (changing Estrutura e patrimônio → Agricultura
		// silently kept Estrutura e patrimônio). Without a list: new idCentroCustos = one row; null = clear.
		mov.centroCustosList = undefined;
	}

	if (data.modalidadeMovimento === 'padrao') {
		limparCamposFinanciamento(mov);
	}

	if (data.modalidadeMovimento === 'financiamento') {
		if (data.idBanco !== undefined) mov.idBanco = data.idBanco;
		if (data.numeroDocumento !== undefined) mov.numeroDocumento = data.numeroDocumento;
		mov.parcelado = data.parcelado ?? false;
		mov.idFinanciamento = data.idFinanciamento ?? null;
		// Marcar como conciliado quando há financiamento associado
		if (data.idFinanciamento) {
			mov.ideagro = true;
		}
	}

	if (data.modalidadeMovimento === 'transferencia') {
		aplicarTransferencia(mov);
	}

	return mov;
}

/**
 * Conciliação EM LOTE: os mesmos dados aplicados a cada movimento selecionado.
 * `resultadoList`/`centroCustosList` em `data` devem ser os já calculados PARA ESTE movimento.
 * No modo padrão, plano/centro não informados mantêm os do próprio movimento.
 */
export function montarMovimentoConciliacaoLote(base: MovimentoBancario, data: DadosConciliacao): MovimentoConciliado {
	const mov: MovimentoConciliado = {
		...base,
		modalidadeMovimento: data.modalidadeMovimento,
		idPessoa: data.idPessoa ?? null,
		parcelado: data.parcelado || false,
		idUsuario: base.idUsuario || undefined,
	};
	const padrao = data.modalidadeMovimento === 'padrao';

	// Plano
	const resultados = data.resultadoList ?? [];
	if (resultados.length > 1) {
		mov.idPlanoContas = null;
		mov.resultadoList = resultados;
	} else if (resultados.length === 1) {
		mov.idPlanoContas = resultados[0].idPlanoContas;
		mov.resultadoList = [];
	} else if (data.idPlanoContas || !padrao) {
		mov.idPlanoContas = data.idPlanoContas ?? null;
		mov.resultadoList = [];
	}
	// padrão sem plano escolhido: mantém o plano/rateio de cada movimento (não enviado)
	else {
		delete mov.resultadoList;
	}

	// Centro de custos
	const centros = data.centroCustosList ?? [];
	if (centros.length > 1) {
		mov.idCentroCustos = null;
		mov.centroCustosList = centros as MovimentoCentroCustos[];
	} else if (centros.length === 1) {
		mov.idCentroCustos = centros[0].idCentroCustos;
		mov.centroCustosList = undefined;
	} else if (data.idCentroCustos || !padrao) {
		mov.idCentroCustos = data.idCentroCustos ?? null;
		mov.centroCustosList = undefined;
	}
	// padrão sem centro escolhido: mantém idCentroCustos/rateio do movimento. Um null aqui
	// (movimento com rateio) apagaria os centros, então vira undefined = campo não enviado.
	else {
		mov.idCentroCustos = base.idCentroCustos ?? undefined;
		mov.centroCustosList = undefined;
	}

	if (padrao) {
		limparCamposFinanciamento(mov);
	} else if (data.modalidadeMovimento === 'financiamento') {
		if (data.idBanco !== undefined) mov.idBanco = data.idBanco;
		if (data.numeroDocumento !== undefined) mov.numeroDocumento = data.numeroDocumento;
		mov.idFinanciamento = data.idFinanciamento ?? null;
	} else {
		aplicarTransferencia(mov);
	}

	return mov;
}

/**
 * Converte percentuais em valores R$ para UM movimento: cada linha arredondada a centavos e
 * a diferença de arredondamento na última, de modo que a soma seja exatamente |valor|.
 */
/**
 * Payload por movimento para a conciliação em lote. Rateios por % são convertidos em R$ para
 * CADA movimento (centavos exatos, resíduo na última linha). Listas vindas em `dados` são
 * ignoradas: no lote elas pertencem ao primeiro movimento, não aos demais.
 */
export function montarMovimentosLote(
	movimentos: MovimentoBancario[],
	dados: DadosConciliacao,
	rateiosPlanosPct: { idPlano: number; porcentagem: number }[] = [],
	rateiosCentrosPct: { idCentro: number; porcentagem: number }[] = []
): MovimentoConciliado[] {
	const padrao = dados.modalidadeMovimento === 'padrao';
	return movimentos.map((mov) => {
		const dadosMov: DadosConciliacao = { ...dados, resultadoList: undefined, centroCustosList: undefined };

		if (padrao && rateiosPlanosPct.length > 0) {
			const valores = ratearPercentuaisNoValor(
				rateiosPlanosPct.map((r) => r.porcentagem),
				mov.valor
			);
			dadosMov.resultadoList = rateiosPlanosPct.map((r, i) => ({
				idPlanoContas: r.idPlano,
				valor: valores[i],
				tipo: mov.tipoMovimento ?? 'C',
				idContaCorrente: mov.idContaCorrente,
				dtMovimento: mov.dtMovimento,
			}));
			dadosMov.idPlanoContas = null;
		}

		if (padrao && rateiosCentrosPct.length > 0) {
			const valores = ratearPercentuaisNoValor(
				rateiosCentrosPct.map((r) => r.porcentagem),
				mov.valor
			);
			dadosMov.centroCustosList = rateiosCentrosPct.map((r, i) => ({
				idCentroCustos: r.idCentro,
				valor: valores[i],
			}));
			dadosMov.idCentroCustos = null;
		}

		return montarMovimentoConciliacaoLote(mov, dadosMov);
	});
}

export function ratearPercentuaisNoValor(porcentagens: number[], valorMovimento: number): number[] {
	if (porcentagens.length === 0) return [];
	const total = Math.round(Math.abs(valorMovimento) * 100) / 100;
	return aplicarPercentuaisEmValoresMonetarios(
		porcentagens.map(() => ({ valor: 0 })),
		porcentagens,
		total
	).map((l) => l.valor);
}
