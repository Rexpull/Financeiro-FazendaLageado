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
	ano: number;
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

/** Every month (ano, mes 1..12) from `inicio` (inclusive) to `fim` (exclusive), both AAAA-MM-DD. */
export function mesesDoIntervalo(inicio: string, fim: string): Array<{ ano: number; mes: number }> {
	const out: Array<{ ano: number; mes: number }> = [];
	let ano = Number(inicio.slice(0, 4));
	let mes = Number(inicio.slice(5, 7));
	if (!ano || !mes) return out;
	while (inicioMes(ano, mes) < fim) {
		out.push({ ano, mes });
		if (++mes > 12) {
			mes = 1;
			ano++;
		}
	}
	return out;
}

export function resumoSaldoDevedor(
	ano: number,
	financiamentos: FinanciamentoRow[],
	parcelas: ParcelaRow[],
): ResumoSaldoDevedorMes[] {
	return resumoSaldoDevedorMeses(
		Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 })),
		financiamentos,
		parcelas,
	);
}

/** Same as resumoSaldoDevedor for any list of months (e.g. "últimos 12 meses", crossing years). */
export function resumoSaldoDevedorMeses(
	meses: Array<{ ano: number; mes: number }>,
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
	for (const { ano, mes: m } of meses) {
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
			ano,
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

export type ContratoDetalheRow = FinanciamentoRow & { numeroContrato: string; credor?: string | null; tomador?: string | null };
export type ParcelaDetalheRow = ParcelaRow & { id: number; numParcela: number };

export type ContratoDoPeriodo = {
	id: number;
	numeroContrato: string;
	credor: string;
	tomador: string;
	dataContrato: string;
	valorContratado: number;
	/** Sum of the parcelas listed below: what this contract adds to the card (créditos novos or quitados) */
	valorNoPeriodo: number;
	parcelas: Array<{ id: number; numParcela: number; valor: number; status: string; dt_vencimento: string; dt_liquidacao: string | null }>;
};

/**
 * Contracts behind the "Créditos novos" and "Quitados" cards of a period [inicio, fim):
 * - novos: contracts signed in the period, with ALL their parcelas (sum = créditos novos)
 * - quitados: contracts with parcelas liquidated in the period, only those parcelas (sum = quitados)
 * Same rules as resumoSaldoDevedorMeses, so the lists add up to the cards to the cent.
 */
export function contratosDoPeriodo(
	inicio: string,
	fim: string,
	financiamentos: ContratoDetalheRow[],
	parcelas: ParcelaDetalheRow[],
): { novos: ContratoDoPeriodo[]; quitados: ContratoDoPeriodo[] } {
	const noPeriodo = (d: string | null) => !!d && d >= inicio && d < fim;
	const porContrato = new Map<number, ParcelaDetalheRow[]>();
	for (const p of parcelas) {
		const lista = porContrato.get(p.idFinanciamento) ?? [];
		lista.push(p);
		porContrato.set(p.idFinanciamento, lista);
	}
	const montar = (f: ContratoDetalheRow, lista: ParcelaDetalheRow[]): ContratoDoPeriodo => {
		const ordenadas = [...lista].sort((a, b) => (a.numParcela - b.numParcela) || dia(a.dt_vencimento).localeCompare(dia(b.dt_vencimento)));
		return {
			id: f.id,
			numeroContrato: f.numeroContrato,
			credor: f.credor || '—',
			tomador: f.tomador || '',
			dataContrato: dia(f.dataContrato),
			valorContratado: Number(f.valor) || 0,
			valorNoPeriodo: ordenadas.reduce((s, p) => s + centavos(p.valor), 0) / 100,
			parcelas: ordenadas.map((p) => ({
				id: p.id,
				numParcela: p.numParcela,
				valor: Number(p.valor) || 0,
				status: p.status,
				dt_vencimento: dia(p.dt_vencimento),
				dt_liquidacao: dia(p.dt_liquidacao) || null,
			})),
		};
	};

	const novos: ContratoDoPeriodo[] = [];
	const quitados: ContratoDoPeriodo[] = [];
	for (const f of financiamentos) {
		const lista = porContrato.get(f.id) ?? [];
		// A contract without parcelas still shows (valor 0): it counts in "N contrato(s) novo(s)"
		if (noPeriodo(dia(f.dataContrato))) novos.push(montar(f, lista));
		const pagas = lista.filter((p) => noPeriodo(liquidacaoEfetiva(p)));
		if (pagas.length) quitados.push(montar(f, pagas));
	}
	const ordem = (a: ContratoDoPeriodo, b: ContratoDoPeriodo) => b.valorNoPeriodo - a.valorNoPeriodo || a.numeroContrato.localeCompare(b.numeroContrato);
	return { novos: novos.sort(ordem), quitados: quitados.sort(ordem) };
}
