/**
 * Saldo devedor de financiamentos, mês a mês (definição confirmada pelo cliente):
 * saldo devedor = soma das parcelas ainda não liquidadas (o valor de cada parcela já inclui os juros).
 *
 * Para cada mês do ano:
 * - saldoInicial: parcelas de contratos já existentes no início do mês e não liquidadas antes dele
 * - quitados: parcelas liquidadas (dt_liquidacao) dentro do mês, separadas em
 *   quitacoes (as do contrato que terminou de ser pago no mês: contratosQuitados) e amortizacoes (o resto)
 * - creditosNovos: parcelas dos contratos com dataContrato no mês (dívida assumida)
 * - valorContratadoNovos: valor de contrato desses contratos novos (informativo)
 * - renegociacoes: efeito líquido das renegociações do mês (parcelas novas − parcelas substituídas)
 * - saldoFinal: saldo no início do mês seguinte (= inicial − quitados + novos + renegociações)
 * Renegociação: as parcelas substituídas (guardadas no histórico) continuam no saldo até a data da
 * renegociação, e as do aditivo / contrato novo entram nessa data — assim os meses anteriores não mudam.
 * Datas comparadas como texto AAAA-MM-DD.
 */
export type FinanciamentoRow = { id: number; dataContrato: string; valor: number; idFinanciamentoOrigem?: number | null };
export type ParcelaRow = {
	idFinanciamento: number;
	valor: number;
	status: string;
	dt_vencimento: string;
	dt_liquidacao: string | null;
	/** Aditivo parcela: enters the saldo on the renegotiation date instead of the contract date */
	entrada?: string | null;
	/** Parcela replaced by a renegotiation (only in its history): leaves the saldo on that date */
	renegociadaEm?: string | null;
};

export type ResumoSaldoDevedorMes = {
	ano: number;
	mes: number; // 1..12
	saldoInicial: number;
	quitados: number;
	/** Part of quitados paid to contracts that were paid off in the month */
	quitacoes: number;
	/** quitados − quitacoes: parcelas of contracts that still owe something */
	amortizacoes: number;
	/** Contracts paid off in the month (last open parcela liquidated) */
	contratosQuitados: number;
	creditosNovos: number;
	valorContratadoNovos: number;
	contratosNovos: number;
	renegociacoes: number;
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

/** Row of financiamentoRenegociacao (JSON columns as stored). */
export type RenegociacaoSaldoRow = {
	id: number;
	idFinanciamento: number;
	tipo: string;
	dataRenegociacao: string;
	parcelasAnteriores: unknown;
	parcelasNovas?: unknown;
	condicoesAnteriores?: unknown;
};

const listaJson = <T,>(raw: unknown): T[] => {
	if (Array.isArray(raw)) return raw as T[];
	if (typeof raw !== 'string' || !raw) return [];
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? (v as T[]) : [];
	} catch {
		return [];
	}
};

/**
 * Contracts with the value they were signed with ("valor contratado" of the month they count as new): an aditivo
 * may change Financiamento.valor, and the first one keeps the original value in its history.
 */
export function comValorOriginal<F extends FinanciamentoRow>(financiamentos: F[], renegociacoes: RenegociacaoSaldoRow[]): F[] {
	const original = new Map<number, number>();
	for (const r of [...renegociacoes].sort((a, b) => a.id - b.id)) {
		if (r.tipo !== 'ADITIVO' || original.has(r.idFinanciamento)) continue;
		let cond: { valor?: unknown } | null = null;
		try {
			cond = typeof r.condicoesAnteriores === 'string' ? JSON.parse(r.condicoesAnteriores) : (r.condicoesAnteriores as typeof cond);
		} catch {
			cond = null;
		}
		const v = Number(cond?.valor);
		if (Number.isFinite(v) && v > 0) original.set(r.idFinanciamento, v);
	}
	return financiamentos.map((f) => (original.has(f.id) ? { ...f, valor: original.get(f.id)! } : f));
}

/**
 * Parcelas as the saldo devedor sees them across renegotiations: the current ones (aditivo parcelas with
 * `entrada` = renegotiation date) plus the replaced ones from each history (`renegociadaEm`), so months
 * before a renegotiation keep the debt they had. Replaced parcelas get negative ids.
 */
export function parcelasComRenegociacoes<P extends ParcelaRow & { id: number; numParcela: number }>(
	parcelas: P[],
	renegociacoes: RenegociacaoSaldoRow[],
): Array<P | (ParcelaRow & { id: number; numParcela: number })> {
	// (contract, numParcela) -> date that parcela entered with an aditivo
	const entrada = new Map<string, string>();
	const chave = (idFinanciamento: number, n: number) => `${idFinanciamento}:${n}`;
	const substituidas: Array<ParcelaRow & { id: number; numParcela: number }> = [];
	for (const r of [...renegociacoes].sort((a, b) => a.id - b.id)) {
		const data = dia(r.dataRenegociacao);
		for (const a of listaJson<{ numParcela: number; dt_vencimento: string; valor: number }>(r.parcelasAnteriores)) {
			substituidas.push({
				id: -(substituidas.length + 1),
				idFinanciamento: r.idFinanciamento,
				numParcela: Number(a.numParcela) || 0,
				valor: Number(a.valor) || 0,
				status: 'Renegociada',
				dt_vencimento: dia(a.dt_vencimento),
				dt_liquidacao: null,
				entrada: entrada.get(chave(r.idFinanciamento, Number(a.numParcela))) ?? null,
				renegociadaEm: data,
			});
		}
		if (r.tipo === 'ADITIVO') for (const n of listaJson<number>(r.parcelasNovas)) entrada.set(chave(r.idFinanciamento, Number(n)), data);
	}
	const atuais = parcelas.map((p) => {
		const e = entrada.get(chave(p.idFinanciamento, p.numParcela));
		return e ? { ...p, entrada: e } : p;
	});
	return [...atuais, ...substituidas];
}

/**
 * When the parcela is in the saldo: from `entrada` (contract date, or the aditivo date) until `saida` (paid, or
 * replaced by a renegotiation), exclusive. One paid or replaced BEFORE it entered (e.g. a renegotiation dated
 * before the contract) enters and leaves on the same day, so every month still adds up.
 * null = never in the saldo (contract without date).
 */
function janelaNoSaldo(p: ParcelaRow, dataContrato: string | undefined): { entrada: string; saida: string | null } | null {
	if (!dataContrato) return null;
	const entrada = dia(p.entrada) || dataContrato;
	const saida = liquidacaoEfetiva(p) ?? (dia(p.renegociadaEm) || null);
	return { entrada, saida: saida && saida < entrada ? entrada : saida };
}

/** Date the parcela counts in "Quitados" (liquidacaoEfetiva, never before it entered the saldo); null = not paid. */
export function quitacaoNoSaldo(p: ParcelaRow, dataContrato: string | undefined): string | null {
	const liq = liquidacaoEfetiva(p);
	return liq ? (janelaNoSaldo(p, dataContrato)?.saida ?? liq) : null;
}

/**
 * Date each contract was paid off (AAAA-MM-DD): no parcela left open and the last payment after its last
 * renegotiation (a contract renegotiated into a new one ends as renegotiated, not paid off). Contracts
 * without parcelas or with an open parcela are not in the map.
 */
export function datasQuitacaoContratos(parcelas: ParcelaRow[], dataContrato: Map<number, string>): Map<number, string> {
	const ultimaPaga = new Map<number, string>();
	const ultimaRenegociacao = new Map<number, string>();
	const emAberto = new Set<number>();
	for (const p of parcelas) {
		const id = p.idFinanciamento;
		if (p.renegociadaEm) {
			const d = dia(p.renegociadaEm);
			if (d > (ultimaRenegociacao.get(id) ?? '')) ultimaRenegociacao.set(id, d);
			continue;
		}
		const paga = quitacaoNoSaldo(p, dataContrato.get(id));
		if (!paga) emAberto.add(id);
		else if (paga > (ultimaPaga.get(id) ?? '')) ultimaPaga.set(id, paga);
	}
	const out = new Map<number, string>();
	for (const [id, d] of ultimaPaga) {
		if (!emAberto.has(id) && d > (ultimaRenegociacao.get(id) ?? '')) out.set(id, d);
	}
	return out;
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
	const deRenegociacao = new Set(financiamentos.filter((f) => f.idFinanciamentoOrigem != null).map((f) => f.id));
	const quitadoEm = datasQuitacaoContratos(parcelas, dataContrato);

	const saldoEm = (limite: string) => {
		let total = 0;
		for (const p of parcelas) {
			const j = janelaNoSaldo(p, dataContrato.get(p.idFinanciamento));
			if (!j || j.entrada >= limite || (j.saida && j.saida < limite)) continue;
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
		let quitacoes = 0;
		let creditosNovos = 0;
		let renegociacoes = 0;
		for (const p of parcelas) {
			const valor = centavos(p.valor);
			const dc = dataContrato.get(p.idFinanciamento);
			if (noMes(quitacaoNoSaldo(p, dc))) {
				quitados += valor;
				if (noMes(quitadoEm.get(p.idFinanciamento) ?? null)) quitacoes += valor;
			}
			const j = janelaNoSaldo(p, dc);
			if (!j) continue;
			if (p.renegociadaEm && noMes(j.saida)) renegociacoes -= valor;
			if (!noMes(j.entrada)) continue;
			// aditivo parcelas and contracts born from a renegotiation are not new credit
			if (p.entrada || deRenegociacao.has(p.idFinanciamento)) renegociacoes += valor;
			else creditosNovos += valor;
		}
		const novos = financiamentos.filter((f) => noMes(dia(f.dataContrato)) && f.idFinanciamentoOrigem == null);

		out.push({
			ano,
			mes: m,
			saldoInicial: saldoEm(ini) / 100,
			quitados: quitados / 100,
			quitacoes: quitacoes / 100,
			amortizacoes: (quitados - quitacoes) / 100,
			contratosQuitados: [...quitadoEm.values()].filter(noMes).length,
			creditosNovos: creditosNovos / 100,
			valorContratadoNovos: novos.reduce((s, f) => s + centavos(f.valor), 0) / 100,
			contratosNovos: novos.length,
			renegociacoes: renegociacoes / 100,
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
	/** In "quitados": date the contract was paid off, when it falls in the period (otherwise it was amortized) */
	quitadoEm?: string;
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

	const quitadoEm = datasQuitacaoContratos(parcelas, new Map(financiamentos.map((f) => [f.id, dia(f.dataContrato)])));
	const novos: ContratoDoPeriodo[] = [];
	const quitados: ContratoDoPeriodo[] = [];
	for (const f of financiamentos) {
		const lista = porContrato.get(f.id) ?? [];
		// A contract without parcelas still shows (valor 0): it counts in "N contrato(s) novo(s)".
		// Same rule as the card: contracts born from a renegotiation and aditivo parcelas are not new credit.
		if (noPeriodo(dia(f.dataContrato)) && f.idFinanciamentoOrigem == null) novos.push(montar(f, lista.filter((p) => !p.entrada)));
		const pagas = lista.filter((p) => noPeriodo(quitacaoNoSaldo(p, dia(f.dataContrato))));
		const dataQuitacao = quitadoEm.get(f.id) ?? null;
		if (pagas.length) quitados.push({ ...montar(f, pagas), ...(noPeriodo(dataQuitacao) ? { quitadoEm: dataQuitacao! } : {}) });
	}
	const ordem = (a: ContratoDoPeriodo, b: ContratoDoPeriodo) => b.valorNoPeriodo - a.valorNoPeriodo || a.numeroContrato.localeCompare(b.numeroContrato);
	return { novos: novos.sort(ordem), quitados: quitados.sort(ordem) };
}

export type RenegociacaoDoPeriodo = {
	/** Contract that was renegotiated */
	numeroContrato: string;
	/** Contract born from it (NOVO_CONTRATO); absent for an aditivo, which changes the same contract */
	numeroContratoNovo?: string;
	/** Parcelas that entered − parcelas replaced: positive, negative or zero */
	variacao: number;
};

export type IndicadoresFinanciamentoPeriodo = {
	/** Contracts with parcelas in the saldo at the start / end of the period */
	contratosAtivosInicio: number;
	contratosAtivosFim: number;
	contratosNovos: number;
	contratosQuitados: number;
	/** Contracts with parcelas paid in the period that still owe something at its end */
	contratosAmortizados: number;
	renegociacoes: RenegociacaoDoPeriodo[];
	/** Parcelas in the saldo at the end of the period, by year of dt_vencimento */
	vencimentosPorAno: Array<{ ano: number; valor: number }>;
};

/**
 * Counts and lists behind the Financiamentos cards of a period [inicio, fim), with the same rules as
 * resumoSaldoDevedorMeses (a contract is active while any of its parcelas is in the saldo). Counted once per
 * period, so a contract amortized in two months of a quarter counts one time.
 */
export function indicadoresFinanciamentoPeriodo(
	inicio: string,
	fim: string,
	financiamentos: ContratoDetalheRow[],
	parcelas: ParcelaRow[],
): IndicadoresFinanciamentoPeriodo {
	const noPeriodo = (d: string | null) => !!d && d >= inicio && d < fim;
	const dataContrato = new Map(financiamentos.map((f) => [f.id, dia(f.dataContrato)]));
	const porId = new Map(financiamentos.map((f) => [f.id, f]));
	const quitadoEm = datasQuitacaoContratos(parcelas, dataContrato);

	const ativosInicio = new Set<number>();
	const ativosFim = new Set<number>();
	const pagos = new Set<number>();
	const vencimentos = new Map<number, number>();
	// renegotiated contract -> { centavos, contrato novo }
	const reneg = new Map<number, { variacao: number; novo?: number }>();
	const variar = (id: number, v: number, novo?: number) => {
		const r = reneg.get(id) ?? { variacao: 0 };
		r.variacao += v;
		if (novo != null) r.novo = novo;
		reneg.set(id, r);
	};

	for (const p of parcelas) {
		const id = p.idFinanciamento;
		const dc = dataContrato.get(id);
		const j = janelaNoSaldo(p, dc);
		if (!j) continue;
		const noSaldoEm = (limite: string) => j.entrada < limite && !(j.saida && j.saida < limite);
		if (noSaldoEm(inicio)) ativosInicio.add(id);
		if (noSaldoEm(fim)) {
			ativosFim.add(id);
			const ano = Number(dia(p.dt_vencimento).slice(0, 4));
			if (ano) vencimentos.set(ano, (vencimentos.get(ano) ?? 0) + centavos(p.valor));
		}
		if (noPeriodo(quitacaoNoSaldo(p, dc))) pagos.add(id);
		// Same split as the "renegociacoes" of resumoSaldoDevedorMeses
		if (p.renegociadaEm && noPeriodo(j.saida)) variar(id, -centavos(p.valor));
		if (!noPeriodo(j.entrada)) continue;
		const origem = porId.get(id)?.idFinanciamentoOrigem;
		if (p.entrada) variar(id, centavos(p.valor));
		else if (origem != null) variar(origem, centavos(p.valor), id);
	}

	const quitadosNoPeriodo = [...quitadoEm].filter(([, d]) => noPeriodo(d)).map(([id]) => id);
	const numero = (id: number) => porId.get(id)?.numeroContrato || `Contrato ${id}`;
	return {
		contratosAtivosInicio: ativosInicio.size,
		contratosAtivosFim: ativosFim.size,
		contratosNovos: financiamentos.filter((f) => noPeriodo(dia(f.dataContrato)) && f.idFinanciamentoOrigem == null).length,
		contratosQuitados: quitadosNoPeriodo.length,
		contratosAmortizados: [...pagos].filter((id) => !quitadosNoPeriodo.includes(id)).length,
		renegociacoes: [...reneg]
			.map(([id, r]) => ({
				numeroContrato: numero(id),
				...(r.novo != null ? { numeroContratoNovo: numero(r.novo) } : {}),
				variacao: r.variacao / 100,
			}))
			.sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)),
		vencimentosPorAno: [...vencimentos].sort(([a], [b]) => a - b).map(([ano, v]) => ({ ano, valor: v / 100 })),
	};
}
