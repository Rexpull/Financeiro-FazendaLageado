import type { ResumoSaldoDevedorMes } from '../../services/dashboardService';

export type SaldoDevedorPeriodo = {
	saldoInicial: number;
	quitados: number;
	creditosNovos: number;
	valorContratadoNovos: number;
	contratosNovos: number;
	saldoFinal: number;
};

/** Month index 0..11 → that month; -1 → whole year (Jan start → Dec end, flows summed). */
export function saldoDevedorPeriodo(resumo: ResumoSaldoDevedorMes[], mesIdx: number): SaldoDevedorPeriodo | null {
	if (!resumo.length) return null;
	const meses = mesIdx >= 0 ? resumo.filter((r) => r.mes === mesIdx + 1) : resumo;
	if (!meses.length) return null;
	const soma = (k: 'quitados' | 'creditosNovos' | 'valorContratadoNovos' | 'contratosNovos') =>
		Math.round(meses.reduce((s, r) => s + (Number(r[k]) || 0), 0) * 100) / 100;
	return {
		saldoInicial: meses[0].saldoInicial,
		quitados: soma('quitados'),
		creditosNovos: soma('creditosNovos'),
		valorContratadoNovos: soma('valorContratadoNovos'),
		contratosNovos: soma('contratosNovos'),
		saldoFinal: meses[meses.length - 1].saldoFinal,
	};
}
