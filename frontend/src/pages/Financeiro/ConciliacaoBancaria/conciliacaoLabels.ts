import { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';
import { PlanoConta } from '../../../../../backend/src/models/PlanoConta';
import { CentroCustos } from '../../../../../backend/src/models/CentroCustos';

/** Mais de um plano no rateio */
export const isPlanoRateioMultiplo = (mov: MovimentoBancario): boolean =>
	(mov.resultadoList?.length ?? 0) > 1;

/** Mais de um centro no rateio */
export const isCentroRateioMultiplo = (mov: MovimentoBancario): boolean =>
	(mov.centroCustosList?.length ?? 0) > 1;

/** id do plano para estilo “pendente” / lookup quando há 1 linha em resultadoList */
export const idPlanoContasEfetivo = (mov: MovimentoBancario): number | undefined => {
	const rl = mov.resultadoList ?? [];
	if (rl.length === 1) return rl[0].idPlanoContas;
	return mov.idPlanoContas ?? undefined;
};

/** id do centro para estilo “pendente” quando há 1 linha em centroCustosList */
export const idCentroCustosEfetivo = (mov: MovimentoBancario): number | undefined => {
	const ccl = mov.centroCustosList ?? [];
	if (ccl.length === 1) return ccl[0].idCentroCustos;
	return mov.idCentroCustos ?? undefined;
};

/** Plan column — no financial effect (transferencia mode: intra-company transfers, applications, reversals) */
export function textoPlanoTransferencia(mov: MovimentoBancario, planos: PlanoConta[]): string {
	const rl = mov.resultadoList ?? [];
	if (rl.length > 1) return 'Múltiplos Planos';
	if (rl.length === 1) {
		return planos.find((p) => p.id === rl[0].idPlanoContas)?.descricao || 'Transferência entre contas';
	}
	return planos.find((p) => p.id === mov.idPlanoContas)?.descricao || 'Transferência entre contas';
}

/** Coluna plano — despesa (modo padrão) */
export function textoPlanoDespesa(mov: MovimentoBancario, planos: PlanoConta[]): string {
	const rl = mov.resultadoList ?? [];
	if (rl.length > 1) return 'Múltiplos Planos';
	if (rl.length === 1) {
		return planos.find((p) => p.id === rl[0].idPlanoContas)?.descricao || 'Selecione um Plano de Contas';
	}
	return planos.find((p) => p.id === mov.idPlanoContas)?.descricao || 'Selecione um Plano de Contas';
}

/** Coluna centro — exceto financiamento */
export function textoCentroPadrao(mov: MovimentoBancario, centros: CentroCustos[]): string {
	const ccl = mov.centroCustosList ?? [];
	if (ccl.length > 1) return 'Múltiplos Centros';
	if (ccl.length === 1) {
		const id = ccl[0].idCentroCustos;
		return centros.find((c) => c.id === id)?.descricao || `Centro ${id}`;
	}
	if (mov.idCentroCustos != null) {
		return centros.find((c) => c.id === mov.idCentroCustos)?.descricao || 'Selecione o Centro de Custos';
	}
	return 'Selecione o Centro de Custos';
}

/** Ordenação por coluna plano na OFX (receitas não participam) */
export function textoPlanoOrdenacaoOFX(mov: MovimentoBancario, planos: PlanoConta[]): string {
	if (mov.modalidadeMovimento === 'transferencia') {
		return textoPlanoTransferencia(mov, planos);
	}
	if (mov.tipoMovimento !== 'D') {
		return '\u0000';
	}
	return textoPlanoDespesa(mov, planos);
}

/** Ordenação por coluna centro na OFX */
export function textoCentroOrdenacaoOFX(mov: MovimentoBancario, centros: CentroCustos[]): string {
	if (mov.modalidadeMovimento === 'transferencia') {
		return '\u0000';
	}
	return textoCentroPadrao(mov, centros);
}
