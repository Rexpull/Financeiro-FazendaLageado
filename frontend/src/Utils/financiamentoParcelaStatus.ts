import type { ParcelaFinanciamento } from '../../../backend/src/models/ParcelaFinanciamento';
import { statusParcelaEmAberto } from '../pages/Financeiro/Financiamento/parcelaRegras';

/** Vencido/Aberto by local calendar day read from the text (same rule as the services). */
export function isParcelaOverdueForDisplay(parcela: ParcelaFinanciamento): boolean {
	if (parcela.status === 'Liquidado') {
		return false;
	}
	if (parcela.status === 'Vencido') {
		return true;
	}
	return statusParcelaEmAberto(parcela.dt_vencimento) === 'Vencido';
}

export function financiamentoTemParcelasVencidas(
	parcelasList: ParcelaFinanciamento[] | undefined | null
): boolean {
	return parcelasList?.some((p) => isParcelaOverdueForDisplay(p)) ?? false;
}
