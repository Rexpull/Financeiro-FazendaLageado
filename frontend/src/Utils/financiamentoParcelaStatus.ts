import type { ParcelaFinanciamento } from '../../../backend/src/models/ParcelaFinanciamento';

/**
 * Calendar-day comparison in local timezone (same idea as validarStatusParcela in services).
 */
export function isParcelaOverdueForDisplay(parcela: ParcelaFinanciamento): boolean {
	if (parcela.status === 'Liquidado') {
		return false;
	}
	if (parcela.status === 'Vencido') {
		return true;
	}
	const dataVencimento = new Date(parcela.dt_vencimento);
	const dataAtual = new Date();
	dataVencimento.setHours(0, 0, 0, 0);
	dataAtual.setHours(0, 0, 0, 0);
	return dataVencimento < dataAtual;
}

export function financiamentoTemParcelasVencidas(
	parcelasList: ParcelaFinanciamento[] | undefined | null
): boolean {
	return parcelasList?.some((p) => isParcelaOverdueForDisplay(p)) ?? false;
}
