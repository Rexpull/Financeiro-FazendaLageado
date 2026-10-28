import type { ResumoSaldoDevedorMes } from '../../services/dashboardService';
import { mesAnterior, type MesAno } from './periodoDashboard';

/**
 * Saldo devedor of a period, always in positions at the END of a month (month closed):
 * saldoInicial = end of the month before the period, saldoFinal = end of the last month of the period,
 * and saldoFinal = saldoInicial − quitados + creditosNovos.
 */
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

/** One point of the "Evolução do saldo devedor" chart: the position at the END of a month (month closed). */
export type PontoSaldoDevedor = { ano: number; mes: number; saldo: number };

/**
 * Points of the evolution chart for the months of `resumo` (the months of the range, in order):
 * the end of the month BEFORE the range (= saldo inicial of the cards) followed by the end of each month
 * (the last one = saldo final of the cards). The backend's saldoInicial of a month is the position before
 * anything of that month happens, i.e. the end of the previous month.
 */
export function pontosEvolucaoSaldoDevedor(resumo: ResumoSaldoDevedorMes[], meses: MesAno[]): PontoSaldoDevedor[] {
	if (!resumo.length) return [];
	const mesDe = (i: number): MesAno => ({ ano: resumo[i].ano ?? meses[i]?.ano ?? 0, mes: resumo[i].mes });
	return [
		{ ...mesAnterior(mesDe(0)), saldo: resumo[0].saldoInicial },
		...resumo.map((r, i) => ({ ...mesDe(i), saldo: r.saldoFinal })),
	];
}
