/**
 * Relatório de Financiamentos (regras confirmadas pelo cliente).
 *
 * Período = mês/ano filtrado (sem mês = ano inteiro). Status de cada contrato no período:
 * - NOVO: dataContrato dentro do período (data do contrato, não criadoEm).
 * - QUITADO: todas as parcelas liquidadas e a última liquidação dentro do período.
 * - ATIVO: todo contrato não quitado no fim do período — inclui os NOVOS ainda em aberto
 *   ("todo contrato que não estiver quitado está ativo"), então a soma dos ativos = saldo devedor.
 * Um contrato pode ser NOVO e ATIVO ao mesmo tempo: o resumo e o filtro de status usam cada
 * definição; sem filtro, a tabela mostra cada contrato uma vez com o status principal
 * (precedência NOVO > QUITADO > ATIVO).
 * Ficam fora: contratos assinados depois do período e contratos quitados antes dele.
 *
 * Valor por status:
 * - NOVO: valor do contrato.
 * - ATIVO: soma das parcelas não liquidadas no fim do período (já incluem juros; o que foi pago é ignorado).
 * - QUITADO: soma das parcelas liquidadas (valor efetivamente pago).
 *
 * Gráficos (respeitam os filtros de contrato; o filtro de status só afeta a tabela):
 * - mensal (ano filtrado): novos = valor dos contratos assinados no mês; liquidados = parcelas liquidadas no mês;
 *   compromissos = parcelas não liquidadas com vencimento no mês.
 * - compromissosPorAno: parcelas não liquidadas por ano de vencimento, do ano atual até 2036.
 * - liquidadosPorAno: parcelas liquidadas por ano de liquidação.
 *
 * Datas comparadas como texto AAAA-MM-DD (sem new Date, evita erro de fuso).
 * Parcela "Liquidado" sem dt_liquidacao: assume o vencimento como data de liquidação.
 */

export type StatusContrato = 'NOVO' | 'ATIVO' | 'QUITADO';

export const MODALIDADES_FINANCIAMENTO = ['INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'] as const;
export type ModalidadeFinanciamento = (typeof MODALIDADES_FINANCIAMENTO)[number];

export const FAIXAS_JUROS = ['<=8', '>8<=10', '>10<=12', '>12<=15', '>15'] as const;

export const ANO_LIMITE_COMPROMISSOS = 2036;

export type ContratoRow = {
	id: number;
	numeroContrato: string;
	responsavel: string | null;
	idBanco?: number | null;
	banco?: string | null;
	pessoa?: string | null;
	dataContrato: string;
	valor: number;
	totalJuros?: number | null;
	taxaJurosAnual?: number | null;
	modalidade?: string | null;
	nomeModalidadeParticular?: string | null;
	numeroGarantia?: string | null;
};

export type ParcelaRow = {
	id: number;
	idFinanciamento: number;
	numParcela: number;
	valor: number;
	status: string;
	dt_vencimento: string;
	dt_liquidacao: string | null;
};

export type FiltrosRelatorio = {
	ano: number;
	mes?: number; // 1..12; ausente = ano inteiro
	idBanco?: number;
	tomador?: string; // Financiamento.responsavel
	modalidade?: string;
	numeroGarantia?: string;
	faixaJuros?: string;
	statusContrato?: StatusContrato;
};

export type ParcelaRelatorio = {
	idParcela: number;
	numParcela: number;
	valor: number;
	dt_vencimento: string;
	status: string;
	dt_liquidacao?: string;
};

export type ItemRelatorio = {
	idFinanciamento: number;
	numeroContrato: string;
	responsavel: string; // tomador
	banco?: string;
	pessoa?: string;
	dataContrato: string;
	valorContrato: number;
	totalJuros: number;
	valorTotal: number;
	modalidade?: string;
	nomeModalidadeParticular?: string;
	numeroGarantia?: string;
	taxaJurosAnual?: number;
	statusContrato: StatusContrato;
	valor: number; // conforme o status
	valorPago: number; // parcelas liquidadas até o fim do período
	valorVincendo: number; // parcelas não liquidadas no fim do período
	dataQuitacao?: string; // última liquidação, quando todas as parcelas estão liquidadas até o fim do período
	parcelas: ParcelaRelatorio[];
};

export type Totalizadores = {
	totalContratos: number;
	totalValorContratos: number;
	totalJuros: number;
	totalValor: number;
	totalValorParcelas: number;
	totalParcelas: number;
	totalParcelasLiquidadas: number;
	totalParcelasAberto: number;
	totalParcelasVencidas: number;
};

export type ResumoStatus = Record<StatusContrato, { quantidade: number; valor: number }>;

export type GraficosRelatorio = {
	mensal: Array<{ mes: number; novos: number; liquidados: number; compromissos: number }>;
	compromissosPorAno: Array<{ ano: number; valor: number }>;
	liquidadosPorAno: Array<{ ano: number; valor: number }>;
};

export type RelatorioFinanciamentos = {
	periodo: { ano: number; mes: number | null; inicio: string; fim: string };
	tomadores: string[];
	itens: ItemRelatorio[];
	totalizadores: Totalizadores;
	resumoStatus: ResumoStatus; // antes do filtro de status
	graficos: GraficosRelatorio;
};

const dia = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '');
const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);
const pad = (n: number) => String(n).padStart(2, '0');
const normalizarTomador = (s: string | null | undefined) => String(s ?? '').trim().toUpperCase();
/** Índice 0..11 do mês de uma data AAAA-MM-DD (ou -1 se inválida). */
const idxMes = (d: string) => {
	const m = Number(d.slice(5, 7));
	return m >= 1 && m <= 12 ? m - 1 : -1;
};

/** Data efetiva de liquidação (AAAA-MM-DD) ou null se a parcela não está liquidada. */
function liquidacaoEfetiva(p: ParcelaRow): string | null {
	if (p.status !== 'Liquidado') return null;
	return dia(p.dt_liquidacao) || dia(p.dt_vencimento);
}

export function periodoDoFiltro(ano: number, mes?: number): { inicio: string; fim: string } {
	if (mes && mes >= 1 && mes <= 12) {
		return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-31` };
	}
	return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function atendeFaixaJuros(taxa: number | null | undefined, faixa: string): boolean {
	const t = taxa == null ? null : Number(taxa);
	switch (faixa) {
		case '<=8':
			return t == null || t <= 8;
		case '>8<=10':
			return t != null && t > 8 && t <= 10;
		case '>10<=12':
			return t != null && t > 10 && t <= 12;
		case '>12<=15':
			return t != null && t > 12 && t <= 15;
		case '>15':
			return t != null && t > 15;
		default:
			return true;
	}
}

/** Filtros de contrato (valem para tabela e gráficos). */
function atendeFiltrosContrato(c: ContratoRow, f: FiltrosRelatorio): boolean {
	if (f.idBanco && Number(c.idBanco) !== Number(f.idBanco)) return false;
	if (f.tomador && normalizarTomador(c.responsavel) !== normalizarTomador(f.tomador)) return false;
	if (f.modalidade && String(c.modalidade ?? '').toUpperCase() !== f.modalidade.toUpperCase()) return false;
	if (f.numeroGarantia) {
		const busca = f.numeroGarantia.trim().toLowerCase();
		if (busca && !String(c.numeroGarantia ?? '').toLowerCase().includes(busca)) return false;
	}
	if (f.faixaJuros && !atendeFaixaJuros(c.taxaJurosAnual, f.faixaJuros)) return false;
	return true;
}

/** Tomadores distintos (responsavel), na grafia da primeira ocorrência, ordenados. */
export function listarTomadores(contratos: ContratoRow[]): string[] {
	const porChave = new Map<string, string>();
	for (const c of contratos) {
		const chave = normalizarTomador(c.responsavel);
		if (chave && !porChave.has(chave)) porChave.set(chave, String(c.responsavel).trim());
	}
	return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function montarRelatorioFinanciamentos(
	contratos: ContratoRow[],
	parcelas: ParcelaRow[],
	filtros: FiltrosRelatorio,
	hoje: string,
): RelatorioFinanciamentos {
	const ano = filtros.ano;
	const mes = filtros.mes && filtros.mes >= 1 && filtros.mes <= 12 ? filtros.mes : null;
	const { inicio, fim } = periodoDoFiltro(ano, mes ?? undefined);

	const parcelasPorContrato = new Map<number, ParcelaRow[]>();
	for (const p of parcelas) {
		const lista = parcelasPorContrato.get(p.idFinanciamento);
		if (lista) lista.push(p);
		else parcelasPorContrato.set(p.idFinanciamento, [p]);
	}

	const selecionados = contratos.filter((c) => atendeFiltrosContrato(c, filtros));

	// ---- Tabela ----
	const linhas: ItemRelatorio[] = [];
	const flags = new Map<number, { novo: boolean; quitado: boolean; valorContrato: number; pago: number; vincendo: number }>();
	for (const c of selecionados) {
		const dataContrato = dia(c.dataContrato);
		if (dataContrato && dataContrato > fim) continue; // ainda não existia no período

		const ps = [...(parcelasPorContrato.get(c.id) ?? [])].sort((a, b) => a.numParcela - b.numParcela);
		let pago = 0;
		let vincendo = 0;
		let ultimaLiquidacao = '';
		let todasLiquidadas = ps.length > 0;
		for (const p of ps) {
			const liq = liquidacaoEfetiva(p);
			if (liq && liq <= fim) {
				pago += centavos(p.valor);
				if (liq > ultimaLiquidacao) ultimaLiquidacao = liq;
			} else {
				vincendo += centavos(p.valor);
				todasLiquidadas = false;
			}
		}
		const dataQuitacao = todasLiquidadas ? ultimaLiquidacao : '';
		if (dataQuitacao && dataQuitacao < inicio) continue; // quitado antes do período

		const novo = !!dataContrato && dataContrato >= inicio && dataContrato <= fim;
		const statusContrato: StatusContrato = novo ? 'NOVO' : dataQuitacao ? 'QUITADO' : 'ATIVO';
		const valor =
			statusContrato === 'NOVO' ? centavos(c.valor) : statusContrato === 'QUITADO' ? pago : vincendo;
		flags.set(c.id, { novo, quitado: !!dataQuitacao, valorContrato: centavos(c.valor), pago, vincendo });

		const totalJuros = Number(c.totalJuros) || 0;
		linhas.push({
			idFinanciamento: c.id,
			numeroContrato: c.numeroContrato,
			responsavel: String(c.responsavel ?? '').trim(),
			banco: c.banco || undefined,
			pessoa: c.pessoa || undefined,
			dataContrato,
			valorContrato: Number(c.valor) || 0,
			totalJuros,
			valorTotal: (centavos(c.valor) + centavos(totalJuros)) / 100,
			modalidade: c.modalidade || undefined,
			nomeModalidadeParticular: c.nomeModalidadeParticular || undefined,
			numeroGarantia: c.numeroGarantia || undefined,
			taxaJurosAnual: c.taxaJurosAnual ?? undefined,
			statusContrato,
			valor: valor / 100,
			valorPago: pago / 100,
			valorVincendo: vincendo / 100,
			dataQuitacao: dataQuitacao || undefined,
			parcelas: ps.map((p) => ({
				idParcela: p.id,
				numParcela: p.numParcela,
				valor: Number(p.valor) || 0,
				dt_vencimento: dia(p.dt_vencimento),
				status: p.status,
				dt_liquidacao: dia(p.dt_liquidacao) || undefined,
			})),
		});
	}

	linhas.sort(
		(a, b) =>
			b.dataContrato.localeCompare(a.dataContrato) ||
			String(a.numeroContrato).localeCompare(String(b.numeroContrato), 'pt-BR', { numeric: true }),
	);

	const resumoStatus: ResumoStatus = {
		NOVO: { quantidade: 0, valor: 0 },
		ATIVO: { quantidade: 0, valor: 0 },
		QUITADO: { quantidade: 0, valor: 0 },
	};
	const resumoCentavos: Record<StatusContrato, number> = { NOVO: 0, ATIVO: 0, QUITADO: 0 };
	// Value of a contract under each status definition
	const valorNoStatus = (f: { valorContrato: number; pago: number; vincendo: number }, s: StatusContrato) =>
		s === 'NOVO' ? f.valorContrato : s === 'QUITADO' ? f.pago : f.vincendo;
	const pertence = (f: { novo: boolean; quitado: boolean }, s: StatusContrato) =>
		s === 'NOVO' ? f.novo : s === 'QUITADO' ? f.quitado : !f.quitado;
	for (const l of linhas) {
		const f = flags.get(l.idFinanciamento)!;
		for (const st of ['NOVO', 'ATIVO', 'QUITADO'] as StatusContrato[]) {
			if (!pertence(f, st)) continue;
			resumoStatus[st].quantidade++;
			resumoCentavos[st] += valorNoStatus(f, st);
		}
	}
	for (const s of Object.keys(resumoCentavos) as StatusContrato[]) {
		resumoStatus[s].valor = resumoCentavos[s] / 100;
	}

	// Status filter: each definition on its own; the row shows that status and its value
	const filtroStatus = filtros.statusContrato;
	const itens = filtroStatus
		? linhas
				.filter((l) => pertence(flags.get(l.idFinanciamento)!, filtroStatus))
				.map((l) => ({
					...l,
					statusContrato: filtroStatus,
					valor: valorNoStatus(flags.get(l.idFinanciamento)!, filtroStatus) / 100,
				}))
		: linhas;

	const soma = (vals: number[]) => vals.reduce((s, v) => s + centavos(v), 0) / 100;
	const todasParcelas = itens.flatMap((i) => i.parcelas);
	const totalizadores: Totalizadores = {
		totalContratos: itens.length,
		totalValorContratos: soma(itens.map((i) => i.valorContrato)),
		totalJuros: soma(itens.map((i) => i.totalJuros)),
		totalValor: soma(itens.map((i) => i.valor)),
		totalValorParcelas: soma(todasParcelas.map((p) => p.valor)),
		totalParcelas: todasParcelas.length,
		totalParcelasLiquidadas: todasParcelas.filter((p) => p.status === 'Liquidado').length,
		totalParcelasAberto: todasParcelas.filter((p) => p.status === 'Aberto').length,
		totalParcelasVencidas: todasParcelas.filter((p) => p.status === 'Vencido').length,
	};

	// ---- Gráficos (filtros de contrato, sem filtro de status/mês) ----
	const anoTxt = String(ano);
	const novosMes = new Array<number>(12).fill(0);
	const liquidadosMes = new Array<number>(12).fill(0);
	const compromissosMes = new Array<number>(12).fill(0);
	const liquidadosAno = new Map<number, number>();
	const anoAtual = Number(dia(hoje).slice(0, 4)) || ano;
	let anoFimCompromissos = ANO_LIMITE_COMPROMISSOS;
	const compromissosAno = new Map<number, number>();

	const idsSelecionados = new Set(selecionados.map((c) => c.id));
	for (const c of selecionados) {
		const dc = dia(c.dataContrato);
		if (dc.slice(0, 4) === anoTxt && idxMes(dc) >= 0) novosMes[idxMes(dc)] += centavos(c.valor);
	}
	for (const p of parcelas) {
		if (!idsSelecionados.has(p.idFinanciamento)) continue;
		const liq = liquidacaoEfetiva(p);
		if (liq) {
			const a = Number(liq.slice(0, 4));
			if (a) liquidadosAno.set(a, (liquidadosAno.get(a) ?? 0) + centavos(p.valor));
			if (liq.slice(0, 4) === anoTxt && idxMes(liq) >= 0) liquidadosMes[idxMes(liq)] += centavos(p.valor);
		} else {
			const venc = dia(p.dt_vencimento);
			const a = Number(venc.slice(0, 4));
			if (venc.slice(0, 4) === anoTxt && idxMes(venc) >= 0) compromissosMes[idxMes(venc)] += centavos(p.valor);
			if (a >= anoAtual) {
				compromissosAno.set(a, (compromissosAno.get(a) ?? 0) + centavos(p.valor));
				if (a > anoFimCompromissos) anoFimCompromissos = a; // não esconde parcelas depois de 2036
			}
		}
	}

	const mensal = novosMes.map((_, i) => ({
		mes: i + 1,
		novos: novosMes[i] / 100,
		liquidados: liquidadosMes[i] / 100,
		compromissos: compromissosMes[i] / 100,
	}));

	const compromissosPorAno: GraficosRelatorio['compromissosPorAno'] = [];
	for (let a = anoAtual; a <= anoFimCompromissos; a++) {
		compromissosPorAno.push({ ano: a, valor: (compromissosAno.get(a) ?? 0) / 100 });
	}

	const anosLiquidados = [...liquidadosAno.keys()];
	const liquidadosPorAno: GraficosRelatorio['liquidadosPorAno'] = [];
	if (anosLiquidados.length) {
		const ini = Math.min(...anosLiquidados);
		const ult = Math.max(...anosLiquidados);
		for (let a = ini; a <= ult; a++) liquidadosPorAno.push({ ano: a, valor: (liquidadosAno.get(a) ?? 0) / 100 });
	}

	return {
		periodo: { ano, mes, inicio, fim },
		tomadores: listarTomadores(contratos),
		itens,
		totalizadores,
		resumoStatus,
		graficos: { mensal, compromissosPorAno, liquidadosPorAno },
	};
}

/** Data de hoje (AAAA-MM-DD) no fuso do cliente. */
export function hojeISO(timeZone = 'America/Sao_Paulo'): string {
	try {
		const partes = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
			.formatToParts(new Date())
			.reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
		return `${partes.year}-${partes.month}-${partes.day}`;
	} catch {
		return new Date().toISOString().slice(0, 10);
	}
}
