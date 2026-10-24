/**
 * Saldo devedor de financiamentos, mês a mês (definição confirmada pelo cliente):
 * saldo devedor = soma das parcelas ainda não liquidadas (o valor de cada parcela já inclui os juros).
 *
 * Para cada mês do ano:
 * - saldoInicial: parcelas de contratos já existentes no início do mês e não liquidadas antes dele
 * - quitados: parcelas liquidadas (dt_liquidacao) dentro do mês
 * - creditosNovos: parcelas dos contratos com dataContrato no mês (dívida assumida)
 * - valorContratadoNovos: valor de contrato desses contratos novos (informativo)
 * - saldoFinal: saldo no início do mês seguinte (= inicial − quitados + novos)
 * Datas comparadas como texto AAAA-MM-DD.
 */
export type FinanciamentoRow = { id: number; dataContrato: string; valor: number };
export type ParcelaRow = {
	idFinanciamento: number;
	valor: number;
	status: string;
	dt_vencimento: string;
	dt_liquidacao: string | null;
};

export type ResumoSaldoDevedorMes = {
	mes: number; // 1..12
	saldoInicial: number;
	quitados: number;
	creditosNovos: number;
	valorContratadoNovos: number;
	contratosNovos: number;
	saldoFinal: number;
};

const dia = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '');
const centavos = (v: number) => Math.round((Number(v) || 0) * 100);
const pad = (n: number) => String(n).padStart(2, '0');

/** First day of month m (1..13) of `ano`, as AAAA-MM-DD; m = 13 → Jan 1 of next year. */
function inicioMes(ano: number, m: number): string {
	return m > 12 ? `${ano + 1}-01-01` : `${ano}-${pad(m)}-01`;
}

/**
 * Date (AAAA-MM-DD) a parcela counts as paid ("Quitados"), or null when it is not paid.
 * Shared with the Fluxo de Caixa (utils/fluxoCaixaAno) so both screens use the same rule.
 */
export function liquidacaoEfetiva(p: Pick<ParcelaRow, 'status' | 'dt_vencimento'> & { dt_liquidacao?: string | null }): string | null {
	if (p.status !== 'Liquidado') return null;
	// Data liquidada sem data registrada: assume o vencimento
	return dia(p.dt_liquidacao) || dia(p.dt_vencimento);
}

export function resumoSaldoDevedor(
	ano: number,
	financiamentos: FinanciamentoRow[],
	parcelas: ParcelaRow[],
): ResumoSaldoDevedorMes[] {
	const dataContrato = new Map(financiamentos.map((f) => [f.id, dia(f.dataContrato)]));

	const saldoEm = (limite: string) => {
		let total = 0;
		for (const p of parcelas) {
			const dc = dataContrato.get(p.idFinanciamento);
			if (!dc || dc >= limite) continue;
			const liq = liquidacaoEfetiva(p);
			if (liq && liq < limite) continue;
			total += centavos(p.valor);
		}
		return total;
	};

	const out: ResumoSaldoDevedorMes[] = [];
	for (let m = 1; m <= 12; m++) {
		const ini = inicioMes(ano, m);
		const fim = inicioMes(ano, m + 1);
		const noMes = (d: string | null) => !!d && d >= ini && d < fim;

		let quitados = 0;
		let creditosNovos = 0;
		for (const p of parcelas) {
			if (noMes(liquidacaoEfetiva(p))) quitados += centavos(p.valor);
			if (noMes(dataContrato.get(p.idFinanciamento) ?? null)) creditosNovos += centavos(p.valor);
		}
		const novos = financiamentos.filter((f) => noMes(dia(f.dataContrato)));

		out.push({
			mes: m,
			saldoInicial: saldoEm(ini) / 100,
			quitados: quitados / 100,
			creditosNovos: creditosNovos / 100,
			valorContratadoNovos: novos.reduce((s, f) => s + centavos(f.valor), 0) / 100,
			contratosNovos: novos.length,
			saldoFinal: saldoEm(fim) / 100,
		});
	}
	return out;
}
