/**
 * Caixa diário (previsão de posição de caixa dia a dia de um mês).
 *
 * Saldo       = saldo inicial − Σ boletos − Σ financiamento (acumulado até o dia, inclusive)
 * Saldo final = saldo + Σ previsões C − Σ previsões D (acumulado até o dia, inclusive)
 *
 * Datas são comparadas como strings 'YYYY-MM-DD' (só os 10 primeiros caracteres contam,
 * então '2026-10-05T03:00:00.000Z' cai no dia 05). Valores são somados em centavos
 * inteiros para não acumular erro de ponto flutuante ao longo do mês.
 */

export type TipoLancamentoCaixa = 'BOLETO' | 'PREVISAO';
export type NaturezaCaixa = 'C' | 'D';

export interface LancamentoCaixaCalculo {
	tipo: TipoLancamentoCaixa;
	natureza: NaturezaCaixa;
	data: string;
	valor: number;
}

export interface ParcelaCaixaCalculo {
	data: string;
	valor: number;
}

export interface DiaCaixa {
	data: string; // YYYY-MM-DD
	boletos: number;
	financiamento: number;
	saldo: number;
	previsaoC: number;
	previsaoD: number;
	/** previsaoC − previsaoD do dia */
	previsao: number;
	saldoFinal: number;
}

export interface TotaisCaixa {
	boletos: number;
	financiamento: number;
	previsaoC: number;
	previsaoD: number;
	previsao: number;
	/** saldo no último dia do mês */
	saldo: number;
	/** saldo final (com previsões) no último dia do mês */
	saldoFinal: number;
}

export interface PontoMinimoCaixa {
	valor: number;
	/** primeiro dia em que o mínimo é atingido */
	data: string;
	/** quanto falta para o saldo não ficar negativo: max(0, −valor) */
	aporteNecessario: number;
	/** saldo inicial mínimo para honrar todos os compromissos do mês: max(0, saldoInicial − valor) */
	caixaNecessario: number;
}

export interface MinimoCaixa {
	saldo: PontoMinimoCaixa;
	saldoFinal: PontoMinimoCaixa;
}

export interface CaixaDiarioResultado {
	dias: DiaCaixa[];
	totais: TotaisCaixa;
	minimo: MinimoCaixa;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const paraCentavos = (valor: number) => (Number.isFinite(valor) ? Math.round(valor * 100) : 0);
const paraReais = (centavos: number) => centavos / 100;

/** Número de dias do mês (mes 1–12), sem depender do fuso local. */
export function diasNoMes(ano: number, mes: number): number {
	return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Lista 'YYYY-MM-DD' de todos os dias do mês. */
export function datasDoMes(ano: number, mes: number): string[] {
	const total = diasNoMes(ano, mes);
	const prefixo = `${ano}-${pad2(mes)}-`;
	return Array.from({ length: total }, (_, i) => `${prefixo}${pad2(i + 1)}`);
}

/** Intervalo [inicio, fimExclusivo) do mês para filtros por string em SQL. */
export function intervaloDoMes(ano: number, mes: number): { inicio: string; fimExclusivo: string } {
	const proxAno = mes === 12 ? ano + 1 : ano;
	const proxMes = mes === 12 ? 1 : mes + 1;
	return { inicio: `${ano}-${pad2(mes)}-01`, fimExclusivo: `${proxAno}-${pad2(proxMes)}-01` };
}

export function calcularCaixaDiario(args: {
	ano: number;
	mes: number;
	saldoInicial: number | null | undefined;
	lancamentos: LancamentoCaixaCalculo[];
	parcelas: ParcelaCaixaCalculo[];
}): CaixaDiarioResultado {
	const { ano, mes } = args;
	const datas = datasDoMes(ano, mes);
	const saldoInicialCent = paraCentavos(args.saldoInicial ?? 0);

	type Acum = { boletos: number; financiamento: number; previsaoC: number; previsaoD: number };
	const porDia = new Map<string, Acum>(datas.map((d) => [d, { boletos: 0, financiamento: 0, previsaoC: 0, previsaoD: 0 }]));

	for (const l of args.lancamentos) {
		const dia = porDia.get(String(l.data ?? '').slice(0, 10));
		if (!dia) continue;
		const v = Math.abs(paraCentavos(l.valor));
		if (l.tipo === 'BOLETO') dia.boletos += v; // boleto é sempre saída
		else if (l.natureza === 'C') dia.previsaoC += v;
		else dia.previsaoD += v;
	}

	for (const p of args.parcelas) {
		const dia = porDia.get(String(p.data ?? '').slice(0, 10));
		if (!dia) continue;
		dia.financiamento += Math.abs(paraCentavos(p.valor));
	}

	let saldo = saldoInicialCent;
	let saldoFinal = saldoInicialCent;
	const tot = { boletos: 0, financiamento: 0, previsaoC: 0, previsaoD: 0 };
	let minSaldo = { valor: Number.POSITIVE_INFINITY, data: datas[0] };
	let minSaldoFinal = { valor: Number.POSITIVE_INFINITY, data: datas[0] };

	const dias: DiaCaixa[] = datas.map((data) => {
		const a = porDia.get(data)!;
		const saida = a.boletos + a.financiamento;
		const previsao = a.previsaoC - a.previsaoD;
		saldo -= saida;
		saldoFinal += previsao - saida;

		tot.boletos += a.boletos;
		tot.financiamento += a.financiamento;
		tot.previsaoC += a.previsaoC;
		tot.previsaoD += a.previsaoD;

		if (saldo < minSaldo.valor) minSaldo = { valor: saldo, data };
		if (saldoFinal < minSaldoFinal.valor) minSaldoFinal = { valor: saldoFinal, data };

		return {
			data,
			boletos: paraReais(a.boletos),
			financiamento: paraReais(a.financiamento),
			saldo: paraReais(saldo),
			previsaoC: paraReais(a.previsaoC),
			previsaoD: paraReais(a.previsaoD),
			previsao: paraReais(previsao),
			saldoFinal: paraReais(saldoFinal),
		};
	});

	const ponto = (m: { valor: number; data: string }): PontoMinimoCaixa => ({
		valor: paraReais(m.valor),
		data: m.data,
		aporteNecessario: paraReais(Math.max(0, -m.valor)),
		caixaNecessario: paraReais(Math.max(0, saldoInicialCent - m.valor)),
	});

	return {
		dias,
		totais: {
			boletos: paraReais(tot.boletos),
			financiamento: paraReais(tot.financiamento),
			previsaoC: paraReais(tot.previsaoC),
			previsaoD: paraReais(tot.previsaoD),
			previsao: paraReais(tot.previsaoC - tot.previsaoD),
			saldo: paraReais(saldo),
			saldoFinal: paraReais(saldoFinal),
		},
		minimo: { saldo: ponto(minSaldo), saldoFinal: ponto(minSaldoFinal) },
	};
}
