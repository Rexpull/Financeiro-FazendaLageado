/**
 * Relatório de Financiamentos (regras confirmadas pelo cliente).
 *
 * Não diferencia contratos "novos" de "ativos": todo contrato com alguma parcela não liquidada é ATIVO
 * (antigo ou novo); QUITADO quando todas as parcelas estão liquidadas.
 * O valor que prevalece é a SOMA DAS PARCELAS A VENCER (não liquidadas; cada parcela já inclui os juros,
 * então a soma dos ativos = saldo devedor). O valor do contrato é mostrado ao lado, só como informação.
 *
 * Visões (o cliente escolhe quais quer ver; todas respeitam os filtros de contrato — tomador, banco, ...):
 * - ativos: posição de hoje (situação das parcelas), independe do período.
 * - contratados: contratos ATIVOS com data do contrato dentro do período.
 * - liquidados: contratos com parcelas liquidadas dentro do período (amortizados ou quitados).
 *   Valor = parcelas liquidadas no período; quitado = todas liquidadas e a última liquidação no período.
 * - porTomador: contratos ativos agrupados pelo tomador (Financiamento.responsavel).
 *
 * Gráficos:
 * - novosXLiquidados (mês a mês do período): novos = soma das parcelas dos contratos assinados no mês
 *   (dívida assumida, mesma regra do Dashboard); liquidados = parcelas liquidadas no mês.
 * - compromissosDoAno: parcelas não liquidadas pelo mês de vencimento, no ano escolhido.
 * - compromissosPorAno: parcelas não liquidadas pelo ano de vencimento — inclui atrasadas de anos
 *   anteriores e todos os anos futuros, então a soma = saldo devedor dos ativos.
 *
 * Período = [inicio, fim) em AAAA-MM-DD (fim exclusivo, igual ao Dashboard). Datas comparadas como
 * texto (sem new Date, evita erro de fuso). Parcela "Liquidado" sem dt_liquidacao: vale o vencimento
 * (liquidacaoEfetiva, mesma regra do Dashboard e do Fluxo de Caixa).
 */
import { liquidacaoEfetiva } from './saldoDevedor';

export const MODALIDADES_FINANCIAMENTO = ['INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'] as const;
export type ModalidadeFinanciamento = (typeof MODALIDADES_FINANCIAMENTO)[number];

export const FAIXAS_JUROS = ['<=8', '>8<=10', '>10<=12', '>12<=15', '>15'] as const;

export const SEM_TOMADOR = 'Sem tomador';

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
	/** Ano do gráfico "Compromissos financeiros de <ano>" (e do período, quando inicio/fim não vêm) */
	ano: number;
	mes?: number; // 1..12; usado só quando inicio/fim não vêm
	inicio?: string; // AAAA-MM-DD, inclusivo
	fim?: string; // AAAA-MM-DD, exclusivo
	idBanco?: number;
	tomador?: string; // Financiamento.responsavel
	modalidade?: string;
	numeroGarantia?: string;
	faixaJuros?: string;
};

export type ParcelaRelatorio = {
	idParcela: number;
	numParcela: number;
	valor: number;
	dt_vencimento: string;
	status: string;
	dt_liquidacao?: string;
};

export type ContratoRelatorio = {
	idFinanciamento: number;
	numeroContrato: string;
	tomador: string; // Financiamento.responsavel
	credor: string; // banco, pessoa ou nome da modalidade particular
	dataContrato: string;
	valorContrato: number;
	totalJuros: number;
	modalidade?: string;
	nomeModalidadeParticular?: string;
	numeroGarantia?: string;
	taxaJurosAnual?: number;
	ativo: boolean;
	/** Soma das parcelas não liquidadas (o valor que prevalece) */
	valorVincendo: number;
	/** Soma das parcelas liquidadas (até hoje) */
	valorPago: number;
	parcelasAbertas: number;
	/** Última liquidação, quando todas as parcelas estão liquidadas */
	dataQuitacao?: string;
	parcelas: ParcelaRelatorio[];
};

/** Contrato dentro de uma visão ou barra de gráfico, com o valor que ele soma ali. */
export type ValorContrato = { idFinanciamento: number; valor: number; quitado?: boolean };

export type BlocoContratos = {
	quantidade: number;
	valor: number; // soma de contratos[].valor
	valorContratos: number; // soma do valor dos contratos (informativo)
	contratos: ValorContrato[];
};

export type BlocoLiquidados = BlocoContratos & { quitados: number; amortizados: number; valorVincendo: number };

export type GrupoTomador = {
	tomador: string;
	quantidade: number;
	valor: number; // parcelas a vencer
	valorContratos: number;
	contratos: ValorContrato[];
};

export type PontoGrafico = { valor: number; contratos: ValorContrato[] };

export type GraficosRelatorio = {
	novosXLiquidados: Array<{ ano: number; mes: number; novos: PontoGrafico; liquidados: PontoGrafico }>;
	compromissosDoAno: { ano: number; meses: Array<{ mes: number } & PontoGrafico> };
	compromissosPorAno: Array<{ ano: number } & PontoGrafico>;
};

export type RelatorioFinanciamentos = {
	periodo: { ano: number; inicio: string; fim: string; ultimoDia: string };
	hoje: string;
	tomadores: string[];
	/** Todos os contratos citados nas visões e gráficos (filtros de contrato aplicados) */
	contratos: ContratoRelatorio[];
	ativos: BlocoContratos;
	contratados: BlocoContratos;
	liquidados: BlocoLiquidados;
	porTomador: { grupos: GrupoTomador[]; quantidade: number; valor: number; valorContratos: number };
	graficos: GraficosRelatorio;
};

const dia = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : '');
const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => c / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const normalizarTomador = (s: string | null | undefined) => String(s ?? '').trim().toUpperCase();
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** First day of month m (1..13) of `ano`; m = 13 → Jan 1 of the next year. */
const inicioMes = (ano: number, m: number) => (m > 12 ? `${ano + 1}-01-01` : `${ano}-${pad(m)}-01`);

/** Last day of a range whose end is exclusive: '2026-04-01' → '2026-03-31'. */
export function ultimoDiaAntes(fim: string): string {
	const d = new Date(Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 1, Number(fim.slice(8, 10)) - 1));
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Período [inicio, fim) do filtro: inicio/fim válidos (AAAA-MM-DD, inicio < fim) prevalecem;
 * senão o mês `mes` de `ano`; senão o ano inteiro.
 */
export function periodoDoFiltro(f: Pick<FiltrosRelatorio, 'ano' | 'mes' | 'inicio' | 'fim'>): { inicio: string; fim: string } {
	if (f.inicio && f.fim && DATA_ISO.test(f.inicio) && DATA_ISO.test(f.fim) && f.inicio < f.fim) {
		return { inicio: f.inicio, fim: f.fim };
	}
	if (f.mes && f.mes >= 1 && f.mes <= 12) return { inicio: inicioMes(f.ano, f.mes), fim: inicioMes(f.ano, f.mes + 1) };
	return { inicio: `${f.ano}-01-01`, fim: `${f.ano + 1}-01-01` };
}

/** Meses (ano, mes 1..12) de [inicio, fim). */
function mesesDoPeriodo(inicio: string, fim: string): Array<{ ano: number; mes: number }> {
	const out: Array<{ ano: number; mes: number }> = [];
	let ano = Number(inicio.slice(0, 4));
	let mes = Number(inicio.slice(5, 7));
	while (ano && mes && inicioMes(ano, mes) < fim && out.length < 600) {
		out.push({ ano, mes });
		if (++mes > 12) {
			mes = 1;
			ano++;
		}
	}
	return out;
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

/** Filtros de contrato (valem para todas as visões e gráficos). */
function atendeFiltrosContrato(c: ContratoRow, f: FiltrosRelatorio): boolean {
	if (f.idBanco && Number(c.idBanco) !== Number(f.idBanco)) return false;
	if (f.tomador) {
		const alvo = normalizarTomador(f.tomador);
		const tomador = normalizarTomador(c.responsavel);
		if (alvo === normalizarTomador(SEM_TOMADOR) ? tomador !== '' : tomador !== alvo) return false;
	}
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

/** Acumulador de "valor por contrato" em centavos, para barras de gráfico e visões. */
class Acumulador {
	private porContrato = new Map<number, number>();
	somar(id: number, c: number) {
		this.porContrato.set(id, (this.porContrato.get(id) ?? 0) + c);
	}
	ponto(): PontoGrafico {
		let total = 0;
		const contratos: ValorContrato[] = [];
		for (const [idFinanciamento, c] of this.porContrato) {
			total += c;
			contratos.push({ idFinanciamento, valor: reais(c) });
		}
		contratos.sort((a, b) => b.valor - a.valor || a.idFinanciamento - b.idFinanciamento);
		return { valor: reais(total), contratos };
	}
}

export function montarRelatorioFinanciamentos(
	contratosRows: ContratoRow[],
	parcelasRows: ParcelaRow[],
	filtros: FiltrosRelatorio,
	hoje: string,
): RelatorioFinanciamentos {
	const { inicio, fim } = periodoDoFiltro(filtros);
	const noPeriodo = (d: string | null | undefined) => !!d && d >= inicio && d < fim;

	const parcelasPorContrato = new Map<number, ParcelaRow[]>();
	for (const p of parcelasRows) {
		const lista = parcelasPorContrato.get(p.idFinanciamento);
		if (lista) lista.push(p);
		else parcelasPorContrato.set(p.idFinanciamento, [p]);
	}

	// ---- Contratos (filtros de contrato) com a posição de hoje ----
	const contratos: ContratoRelatorio[] = [];
	for (const c of contratosRows) {
		if (!atendeFiltrosContrato(c, filtros)) continue;
		const ps = [...(parcelasPorContrato.get(c.id) ?? [])].sort(
			(a, b) => a.numParcela - b.numParcela || dia(a.dt_vencimento).localeCompare(dia(b.dt_vencimento)),
		);
		let vincendo = 0;
		let pago = 0;
		let abertas = 0;
		let ultimaLiquidacao = '';
		for (const p of ps) {
			const liq = liquidacaoEfetiva(p);
			if (liq) {
				pago += centavos(p.valor);
				if (liq > ultimaLiquidacao) ultimaLiquidacao = liq;
			} else {
				vincendo += centavos(p.valor);
				abertas++;
			}
		}
		// Sem parcelas cadastradas: continua ATIVO (dívida ainda não parcelada no sistema), com R$ 0 a vencer
		const ativo = abertas > 0 || ps.length === 0;
		contratos.push({
			idFinanciamento: c.id,
			numeroContrato: String(c.numeroContrato ?? ''),
			tomador: String(c.responsavel ?? '').trim(),
			credor: c.banco || c.pessoa || c.nomeModalidadeParticular || '—',
			dataContrato: dia(c.dataContrato),
			valorContrato: Number(c.valor) || 0,
			totalJuros: Number(c.totalJuros) || 0,
			modalidade: c.modalidade || undefined,
			nomeModalidadeParticular: c.nomeModalidadeParticular || undefined,
			numeroGarantia: c.numeroGarantia || undefined,
			taxaJurosAnual: c.taxaJurosAnual ?? undefined,
			ativo,
			valorVincendo: reais(vincendo),
			valorPago: reais(pago),
			parcelasAbertas: abertas,
			dataQuitacao: !ativo ? ultimaLiquidacao : undefined,
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
	const porId = new Map(contratos.map((c) => [c.idFinanciamento, c]));

	const ordenar = (lista: ValorContrato[]) =>
		lista.sort(
			(a, b) =>
				b.valor - a.valor ||
				String(porId.get(a.idFinanciamento)?.numeroContrato).localeCompare(String(porId.get(b.idFinanciamento)?.numeroContrato), 'pt-BR', {
					numeric: true,
				}),
		);
	const bloco = (lista: ValorContrato[]): BlocoContratos => ({
		quantidade: lista.length,
		valor: reais(lista.reduce((s, v) => s + centavos(v.valor), 0)),
		valorContratos: reais(lista.reduce((s, v) => s + centavos(porId.get(v.idFinanciamento)?.valorContrato), 0)),
		contratos: ordenar(lista),
	});

	// ---- Visões ----
	const ativosLista = contratos.filter((c) => c.ativo);
	const ativos = bloco(ativosLista.map((c) => ({ idFinanciamento: c.idFinanciamento, valor: c.valorVincendo })));
	const contratados = bloco(
		ativosLista.filter((c) => noPeriodo(c.dataContrato)).map((c) => ({ idFinanciamento: c.idFinanciamento, valor: c.valorVincendo })),
	);

	const liquidadosLista: ValorContrato[] = [];
	for (const c of contratos) {
		const pagasNoPeriodo = c.parcelas.filter((p) => noPeriodo(liquidacaoEfetiva(p)));
		if (!pagasNoPeriodo.length) continue;
		liquidadosLista.push({
			idFinanciamento: c.idFinanciamento,
			valor: reais(pagasNoPeriodo.reduce((s, p) => s + centavos(p.valor), 0)),
			quitado: !c.ativo && noPeriodo(c.dataQuitacao),
		});
	}
	const blocoLiq = bloco(liquidadosLista);
	const liquidados: BlocoLiquidados = {
		...blocoLiq,
		quitados: liquidadosLista.filter((l) => l.quitado).length,
		amortizados: liquidadosLista.filter((l) => !l.quitado).length,
		valorVincendo: reais(liquidadosLista.reduce((s, l) => s + centavos(porId.get(l.idFinanciamento)?.valorVincendo), 0)),
	};

	const grupos = new Map<string, { tomador: string; lista: ValorContrato[] }>();
	for (const c of ativosLista) {
		const chave = normalizarTomador(c.tomador);
		const g = grupos.get(chave) ?? { tomador: c.tomador || SEM_TOMADOR, lista: [] };
		g.lista.push({ idFinanciamento: c.idFinanciamento, valor: c.valorVincendo });
		grupos.set(chave, g);
	}
	const gruposTomador: GrupoTomador[] = [...grupos.values()]
		.map((g) => {
			const b = bloco(g.lista);
			return { tomador: g.tomador, quantidade: b.quantidade, valor: b.valor, valorContratos: b.valorContratos, contratos: b.contratos };
		})
		.sort((a, b) => b.valor - a.valor || a.tomador.localeCompare(b.tomador, 'pt-BR'));

	// ---- Gráficos ----
	const meses = mesesDoPeriodo(inicio, fim);
	const chaveMes = (d: string) => d.slice(0, 7);
	const novosMes = new Map<string, Acumulador>();
	const liquidadosMes = new Map<string, Acumulador>();
	for (const m of meses) {
		const k = `${m.ano}-${pad(m.mes)}`;
		novosMes.set(k, new Acumulador());
		liquidadosMes.set(k, new Acumulador());
	}
	const anoCompromissos = filtros.ano;
	const compromissosMes = Array.from({ length: 12 }, () => new Acumulador());
	const compromissosAno = new Map<number, Acumulador>();

	for (const c of contratos) {
		const novo = novosMes.get(chaveMes(c.dataContrato));
		if (novo) {
			novo.somar(c.idFinanciamento, 0); // contrato sem parcelas ainda aparece na lista
			for (const p of c.parcelas) novo.somar(c.idFinanciamento, centavos(p.valor));
		}
		for (const p of c.parcelas) {
			const liq = liquidacaoEfetiva(p);
			if (liq) {
				liquidadosMes.get(chaveMes(liq))?.somar(c.idFinanciamento, centavos(p.valor));
				continue;
			}
			const venc = p.dt_vencimento;
			const a = Number(venc.slice(0, 4));
			const m = Number(venc.slice(5, 7));
			if (!a) continue;
			if (a === anoCompromissos && m >= 1 && m <= 12) compromissosMes[m - 1].somar(c.idFinanciamento, centavos(p.valor));
			const acc = compromissosAno.get(a) ?? new Acumulador();
			acc.somar(c.idFinanciamento, centavos(p.valor));
			compromissosAno.set(a, acc);
		}
	}

	const anosComValor = [...compromissosAno.keys()];
	const anoAtual = Number(dia(hoje).slice(0, 4)) || anoCompromissos;
	const compromissosPorAno: GraficosRelatorio['compromissosPorAno'] = [];
	if (anosComValor.length) {
		const primeiro = Math.min(anoAtual, ...anosComValor);
		const ultimo = Math.max(anoAtual, ...anosComValor);
		for (let a = primeiro; a <= ultimo; a++) {
			compromissosPorAno.push({ ano: a, ...(compromissosAno.get(a) ?? new Acumulador()).ponto() });
		}
	}

	const graficos: GraficosRelatorio = {
		novosXLiquidados: meses.map((m) => {
			const k = `${m.ano}-${pad(m.mes)}`;
			return { ano: m.ano, mes: m.mes, novos: novosMes.get(k)!.ponto(), liquidados: liquidadosMes.get(k)!.ponto() };
		}),
		compromissosDoAno: { ano: anoCompromissos, meses: compromissosMes.map((acc, i) => ({ mes: i + 1, ...acc.ponto() })) },
		compromissosPorAno,
	};

	return {
		periodo: { ano: filtros.ano, inicio, fim, ultimoDia: ultimoDiaAntes(fim) },
		hoje: dia(hoje),
		tomadores: listarTomadores(contratosRows),
		contratos,
		ativos,
		contratados,
		liquidados,
		porTomador: {
			grupos: gruposTomador,
			quantidade: ativos.quantidade,
			valor: ativos.valor,
			valorContratos: ativos.valorContratos,
		},
		graficos,
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
