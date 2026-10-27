import { describe, it, expect } from 'vitest';
import {
	montarRelatorioFinanciamentos,
	listarTomadores,
	periodoDoFiltro,
	ultimoDiaAntes,
	SEM_TOMADOR,
	type ContratoRow,
	type ParcelaRow,
	type ValorContrato,
} from './relatorioFinanciamentos';

const HOJE = '2026-10-24';

const contrato = (c: Partial<ContratoRow> & Pick<ContratoRow, 'id' | 'dataContrato' | 'valor'>): ContratoRow => ({
	numeroContrato: `C-${c.id}`,
	responsavel: 'GFS',
	idBanco: 1,
	banco: 'Banco Teste',
	modalidade: 'CUSTEIO',
	taxaJurosAnual: 7,
	totalJuros: 0,
	...c,
});

let seq = 0;
const parcela = (
	idFinanciamento: number,
	valor: number,
	status: 'Aberto' | 'Vencido' | 'Liquidado',
	dt_vencimento: string,
	dt_liquidacao: string | null = null,
): ParcelaRow => ({ id: ++seq, idFinanciamento, numParcela: seq, valor, status, dt_vencimento, dt_liquidacao });

const contratos: ContratoRow[] = [
	contrato({ id: 1, dataContrato: '2024-03-10', valor: 10000, responsavel: 'GFS', totalJuros: 2000 }), // ativo, amortizado em 2026
	contrato({ id: 2, dataContrato: '2026-05-20 00:00:00', valor: 50000, responsavel: 'CGF', modalidade: 'INVESTIMENTO', idBanco: 2, banco: 'Sicredi', taxaJurosAnual: 11 }), // contratado em 2026
	contrato({ id: 3, dataContrato: '2023-01-15', valor: 20000, responsavel: ' gfs ' }), // quitado em 2026
	contrato({ id: 4, dataContrato: '2022-06-01', valor: 5000, responsavel: 'RLF', modalidade: 'PARTICULAR', idBanco: null, banco: null, pessoa: 'Fulano' }), // quitado em 2025
	contrato({ id: 5, dataContrato: '2027-02-01', valor: 8000, responsavel: 'MLF', modalidade: 'RENEGOCIACAO' }), // assinado em 2027
	contrato({ id: 6, dataContrato: '2026-02-10', valor: 3000, responsavel: 'GJN' }), // contratado e quitado em 2026
	contrato({ id: 7, dataContrato: '2025-01-01', valor: 1000, responsavel: 'DCC', taxaJurosAnual: null }), // ativo com parcela vencida
	contrato({ id: 8, dataContrato: '2026-03-31', valor: 7000, responsavel: null }), // último dia do 1º trimestre, sem tomador
	contrato({ id: 9, dataContrato: '2025-06-15', valor: 2000, responsavel: 'GFS' }), // parcelas pagas em 30/06 e 01/07/2026
	contrato({ id: 10, dataContrato: '2024-01-10', valor: 1500, responsavel: 'CGF' }), // parcela atrasada desde 2025
];

const parcelas: ParcelaRow[] = [
	parcela(1, 4000, 'Liquidado', '2025-03-10', '2025-03-08'),
	parcela(1, 4000, 'Liquidado', '2026-03-10', '2026-03-09'),
	parcela(1, 4000, 'Aberto', '2027-03-10'),
	parcela(2, 30000, 'Aberto', '2027-05-20'),
	parcela(2, 30000, 'Aberto', '2028-05-20'),
	parcela(3, 11000, 'Liquidado', '2025-01-15', '2025-01-14'),
	parcela(3, 11000, 'Liquidado', '2026-01-15', '2026-02-01'),
	parcela(4, 5500, 'Liquidado', '2025-06-01', '2025-06-01'),
	parcela(5, 9000, 'Aberto', '2028-02-01'),
	parcela(6, 3300, 'Liquidado', '2026-09-10', '2026-09-10'),
	parcela(7, 1100, 'Liquidado', '2025-07-01', null), // liquidada sem data: vale o vencimento
	parcela(7, 1100, 'Vencido', '2026-04-01'),
	parcela(8, 3500, 'Aberto', '2026-12-31'),
	parcela(8, 3500, 'Aberto', '2027-12-31'),
	parcela(9, 1000, 'Liquidado', '2026-06-30', '2026-06-30'),
	parcela(9, 1000, 'Liquidado', '2026-07-01', '2026-07-01'),
	parcela(10, 1500, 'Vencido', '2025-11-10'),
];

const ids = (lista: ValorContrato[]) => lista.map((c) => c.idFinanciamento).sort((a, b) => a - b);
const pares = (lista: ValorContrato[]) => lista.map((c) => [c.idFinanciamento, c.valor]);
const rel = (f: Parameters<typeof montarRelatorioFinanciamentos>[2]) => montarRelatorioFinanciamentos(contratos, parcelas, f, HOJE);

describe('periodoDoFiltro / ultimoDiaAntes', () => {
	it('ano inteiro, mês ou inicio/fim (fim exclusivo)', () => {
		expect(periodoDoFiltro({ ano: 2026 })).toEqual({ inicio: '2026-01-01', fim: '2027-01-01' });
		expect(periodoDoFiltro({ ano: 2026, mes: 2 })).toEqual({ inicio: '2026-02-01', fim: '2026-03-01' });
		expect(periodoDoFiltro({ ano: 2026, mes: 12 })).toEqual({ inicio: '2026-12-01', fim: '2027-01-01' });
		expect(periodoDoFiltro({ ano: 2026, inicio: '2025-11-01', fim: '2026-11-01' })).toEqual({ inicio: '2025-11-01', fim: '2026-11-01' });
	});

	it('inicio/fim inválidos caem no ano/mês', () => {
		expect(periodoDoFiltro({ ano: 2026, mes: 3, inicio: '2026-05-01', fim: '2026-04-01' })).toEqual({ inicio: '2026-03-01', fim: '2026-04-01' });
		expect(periodoDoFiltro({ ano: 2026, inicio: '01/01/2026', fim: '2026-04-01' })).toEqual({ inicio: '2026-01-01', fim: '2027-01-01' });
	});

	it('último dia do período (inclusive fevereiro e virada de ano)', () => {
		expect(ultimoDiaAntes('2026-03-01')).toBe('2026-02-28');
		expect(ultimoDiaAntes('2024-03-01')).toBe('2024-02-29');
		expect(ultimoDiaAntes('2027-01-01')).toBe('2026-12-31');
		expect(rel({ ano: 2026, mes: 5 }).periodo).toEqual({ ano: 2026, inicio: '2026-05-01', fim: '2026-06-01', ultimoDia: '2026-05-31' });
	});
});

describe('Contratos ativos (posição de hoje, sem distinguir novos)', () => {
	const r = rel({ ano: 2026 });

	it('ativo = alguma parcela não liquidada (antigos, novos e até de ano futuro); quitados ficam fora', () => {
		expect(ids(r.ativos.contratos)).toEqual([1, 2, 5, 7, 8, 10]);
	});

	it('valor que prevalece = soma das parcelas a vencer (inclui vencidas); valor do contrato é informativo', () => {
		expect(pares(r.ativos.contratos)).toEqual([
			[2, 60000],
			[5, 9000],
			[8, 7000],
			[1, 4000],
			[10, 1500],
			[7, 1100],
		]);
		expect(r.ativos).toMatchObject({ quantidade: 6, valor: 82600, valorContratos: 77500 });
	});

	it('não depende do período escolhido', () => {
		expect(rel({ ano: 2024 }).ativos).toEqual(r.ativos);
		expect(rel({ ano: 2026, inicio: '2026-04-01', fim: '2026-07-01' }).ativos).toEqual(r.ativos);
	});

	it('dados do contrato: tomador sem espaços, credor, datas AAAA-MM-DD, situação', () => {
		const m = new Map(r.contratos.map((c) => [c.idFinanciamento, c]));
		expect(m.get(3)).toMatchObject({ tomador: 'gfs', ativo: false, valorVincendo: 0, valorPago: 22000, dataQuitacao: '2026-02-01' });
		expect(m.get(2)).toMatchObject({ dataContrato: '2026-05-20', credor: 'Sicredi', valorContrato: 50000, valorVincendo: 60000, parcelasAbertas: 2 });
		expect(m.get(4)?.credor).toBe('Fulano');
		expect(m.get(7)).toMatchObject({ ativo: true, valorVincendo: 1100, valorPago: 1100 });
		expect(m.get(1)?.parcelas.map((p) => p.numParcela)).toEqual([...m.get(1)!.parcelas.map((p) => p.numParcela)].sort((a, b) => a - b));
	});

	it('contrato sem parcelas continua ativo com R$ 0 a vencer', () => {
		const s = montarRelatorioFinanciamentos([contrato({ id: 30, dataContrato: '2026-02-01', valor: 100 })], [], { ano: 2026 }, HOJE);
		expect(pares(s.ativos.contratos)).toEqual([[30, 0]]);
		expect(pares(s.contratados.contratos)).toEqual([[30, 0]]);
		expect(s.graficos.novosXLiquidados[1].novos).toEqual({ valor: 0, contratos: [{ idFinanciamento: 30, valor: 0 }] });
	});
});

describe('Contratados no período (só ativos)', () => {
	it('ano: contratos assinados no ano e ainda ativos; o contratado e já quitado (6) fica fora', () => {
		const r = rel({ ano: 2026 });
		expect(pares(r.contratados.contratos)).toEqual([
			[2, 60000],
			[8, 7000],
		]);
		expect(r.contratados).toMatchObject({ quantidade: 2, valor: 67000, valorContratos: 57000 });
	});

	it('trimestre: contrato do último dia (31/03) entra no 1º trimestre e não no 2º', () => {
		expect(ids(rel({ ano: 2026, inicio: '2026-01-01', fim: '2026-04-01' }).contratados.contratos)).toEqual([8]);
		expect(ids(rel({ ano: 2026, inicio: '2026-04-01', fim: '2026-07-01' }).contratados.contratos)).toEqual([2]);
	});

	it('mês e ano futuro', () => {
		expect(ids(rel({ ano: 2026, mes: 5 }).contratados.contratos)).toEqual([2]);
		expect(ids(rel({ ano: 2026, mes: 3 }).contratados.contratos)).toEqual([8]);
		expect(ids(rel({ ano: 2027 }).contratados.contratos)).toEqual([5]);
	});
});

describe('Liquidados no período (amortizados ou quitados)', () => {
	it('ano: valor = parcelas liquidadas no período; quitado quando a última liquidação cai no período', () => {
		const l = rel({ ano: 2026 }).liquidados;
		expect(l.contratos).toEqual([
			{ idFinanciamento: 3, valor: 11000, quitado: true },
			{ idFinanciamento: 1, valor: 4000, quitado: false },
			{ idFinanciamento: 6, valor: 3300, quitado: true },
			{ idFinanciamento: 9, valor: 2000, quitado: true },
		]);
		expect(l).toMatchObject({ quantidade: 4, valor: 20300, quitados: 3, amortizados: 1, valorVincendo: 4000, valorContratos: 35000 });
	});

	it('limites: pagamento no último dia (30/06) entra no 1º semestre; quitação em 01/07 só no 2º', () => {
		const s1 = rel({ ano: 2026, inicio: '2026-01-01', fim: '2026-07-01' }).liquidados.contratos;
		expect(s1.find((c) => c.idFinanciamento === 9)).toEqual({ idFinanciamento: 9, valor: 1000, quitado: false });
		const s2 = rel({ ano: 2026, inicio: '2026-07-01', fim: '2027-01-01' }).liquidados.contratos;
		expect(s2.find((c) => c.idFinanciamento === 9)).toEqual({ idFinanciamento: 9, valor: 1000, quitado: true });
		expect(ids(s2)).toEqual([6, 9]);
	});

	it('liquidada sem data conta no vencimento; ano anterior', () => {
		const l = rel({ ano: 2025 }).liquidados;
		expect(pares(l.contratos)).toEqual([
			[3, 11000],
			[4, 5500],
			[1, 4000],
			[7, 1100],
		]);
		expect(l.contratos.find((c) => c.idFinanciamento === 4)?.quitado).toBe(true);
		expect(l.contratos.find((c) => c.idFinanciamento === 3)?.quitado).toBe(false); // quitado só em 2026
	});
});

describe('Contratos por tomador (ativos)', () => {
	const r = rel({ ano: 2026 });

	it('agrupa os ativos por tomador, maior saldo a vencer primeiro; sem tomador num grupo próprio', () => {
		expect(r.porTomador.grupos.map((g) => [g.tomador, g.quantidade, g.valor, g.valorContratos])).toEqual([
			['CGF', 2, 61500, 51500],
			['MLF', 1, 9000, 8000],
			[SEM_TOMADOR, 1, 7000, 7000],
			['GFS', 1, 4000, 10000],
			['DCC', 1, 1100, 1000],
		]);
		expect(ids(r.porTomador.grupos[0].contratos)).toEqual([2, 10]);
	});

	it('total por tomador = total dos ativos (saldo devedor)', () => {
		expect(r.porTomador).toMatchObject({ quantidade: 6, valor: 82600, valorContratos: 77500 });
		expect(r.porTomador.grupos.reduce((s, g) => s + g.valor, 0)).toBe(r.ativos.valor);
	});

	it('mesmo tomador com grafias diferentes fica num grupo só', () => {
		const s = montarRelatorioFinanciamentos(
			[contrato({ id: 40, dataContrato: '2026-01-01', valor: 1, responsavel: 'LMV' }), contrato({ id: 41, dataContrato: '2026-01-01', valor: 1, responsavel: ' lmv ' })],
			[parcela(40, 10, 'Aberto', '2027-01-01'), parcela(41, 20, 'Aberto', '2027-01-01')],
			{ ano: 2026 },
			HOJE,
		);
		expect(s.porTomador.grupos).toHaveLength(1);
		expect(s.porTomador.grupos[0]).toMatchObject({ tomador: 'LMV', quantidade: 2, valor: 30 });
	});
});

describe('Filtros de contrato (valem para todas as visões e gráficos)', () => {
	it('tomador sem diferenciar maiúsculas/espaços, e "Sem tomador"', () => {
		const gfs = rel({ ano: 2026, tomador: 'gfs' });
		expect(ids(gfs.ativos.contratos)).toEqual([1]);
		expect(ids(gfs.liquidados.contratos)).toEqual([1, 3, 9]);
		expect(gfs.graficos.novosXLiquidados.every((m) => m.novos.valor === 0)).toBe(true);
		expect(ids(rel({ ano: 2026, tomador: SEM_TOMADOR }).ativos.contratos)).toEqual([8]);
	});

	it('banco, modalidade (inclui RENEGOCIACAO), garantia e faixa de juros', () => {
		expect(ids(rel({ ano: 2026, idBanco: 2 }).ativos.contratos)).toEqual([2]);
		expect(ids(rel({ ano: 2026, modalidade: 'RENEGOCIACAO' }).ativos.contratos)).toEqual([5]);
		const juros = ids(rel({ ano: 2026, faixaJuros: '<=8' }).ativos.contratos);
		expect(juros).not.toContain(2);
		expect(juros).toContain(7); // taxa nula entra em <= 8
		const garantia = montarRelatorioFinanciamentos(
			[contrato({ id: 50, dataContrato: '2026-01-01', valor: 1, numeroGarantia: 'MAT-123' }), contrato({ id: 51, dataContrato: '2026-01-01', valor: 1 })],
			[],
			{ ano: 2026, numeroGarantia: 'mat-12' },
			HOJE,
		);
		expect(ids(garantia.ativos.contratos)).toEqual([50]);
	});

	it('lista de tomadores vem de todos os contratos (ignora filtros), distinta e ordenada', () => {
		expect(listarTomadores(contratos)).toEqual(['CGF', 'DCC', 'GFS', 'GJN', 'MLF', 'RLF']);
		expect(rel({ ano: 2026, tomador: 'GFS' }).tomadores).toHaveLength(6);
	});
});

describe('Gráficos', () => {
	it('novos x liquidados: um ponto por mês do período, com os contratos de cada barra', () => {
		const g = rel({ ano: 2026 }).graficos.novosXLiquidados;
		expect(g).toHaveLength(12);
		// novos = soma das parcelas dos contratos assinados no mês (6 e 8 entram mesmo já quitados/sem saldo)
		expect(g.map((m) => m.novos.valor)).toEqual([0, 3300, 7000, 0, 60000, 0, 0, 0, 0, 0, 0, 0]);
		expect(g.map((m) => m.liquidados.valor)).toEqual([0, 11000, 4000, 0, 0, 1000, 1000, 0, 3300, 0, 0, 0]);
		expect(g[4].novos.contratos).toEqual([{ idFinanciamento: 2, valor: 60000 }]);
		expect(g[1].liquidados.contratos).toEqual([{ idFinanciamento: 3, valor: 11000 }]);
	});

	it('novos x liquidados em trimestre e em 12 meses cruzando o ano', () => {
		const t1 = rel({ ano: 2026, inicio: '2026-01-01', fim: '2026-04-01' }).graficos.novosXLiquidados;
		expect(t1.map((m) => [m.ano, m.mes])).toEqual([
			[2026, 1],
			[2026, 2],
			[2026, 3],
		]);
		const doze = rel({ ano: 2026, inicio: '2025-11-01', fim: '2026-11-01' }).graficos.novosXLiquidados;
		expect(doze).toHaveLength(12);
		expect(doze[0]).toMatchObject({ ano: 2025, mes: 11 });
		expect(doze[11]).toMatchObject({ ano: 2026, mes: 10 });
	});

	it('compromissos do ano: parcelas não liquidadas pelo mês de vencimento (inclui vencidas)', () => {
		const c = rel({ ano: 2026 }).graficos.compromissosDoAno;
		expect(c.ano).toBe(2026);
		expect(c.meses.map((m) => m.valor)).toEqual([0, 0, 0, 1100, 0, 0, 0, 0, 0, 0, 0, 3500]);
		expect(c.meses[11].contratos).toEqual([{ idFinanciamento: 8, valor: 3500 }]);
		// o ano do gráfico é o ano escolhido, mesmo com período de trimestre
		expect(rel({ ano: 2027, inicio: '2027-01-01', fim: '2027-04-01' }).graficos.compromissosDoAno.meses[2].valor).toBe(4000);
	});

	it('compromissos por ano: inclui atrasadas de anos anteriores e anos futuros; soma = saldo dos ativos', () => {
		const r = rel({ ano: 2026 });
		const c = r.graficos.compromissosPorAno;
		expect(c.map((a) => [a.ano, a.valor])).toEqual([
			[2025, 1500],
			[2026, 4600],
			[2027, 37500],
			[2028, 39000],
		]);
		expect(c.reduce((s, a) => s + a.valor, 0)).toBe(r.ativos.valor);
		expect(ids(c[2].contratos)).toEqual([1, 2, 8]);
	});

	it('anos futuros distantes: preenche os anos intermediários com zero', () => {
		const longo = montarRelatorioFinanciamentos(
			[contrato({ id: 20, dataContrato: '2026-01-01', valor: 1 })],
			[parcela(20, 500, 'Aberto', '2029-01-01')],
			{ ano: 2026 },
			HOJE,
		).graficos.compromissosPorAno;
		expect(longo.map((a) => [a.ano, a.valor])).toEqual([
			[2026, 0],
			[2027, 0],
			[2028, 0],
			[2029, 500],
		]);
	});

	it('sem parcelas a vencer: gráfico por ano vazio', () => {
		expect(montarRelatorioFinanciamentos([], [], { ano: 2026 }, HOJE).graficos.compromissosPorAno).toEqual([]);
	});
});
