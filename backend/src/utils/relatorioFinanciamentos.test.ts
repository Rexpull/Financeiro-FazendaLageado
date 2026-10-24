import { describe, it, expect } from 'vitest';
import { montarRelatorioFinanciamentos, listarTomadores, periodoDoFiltro, type ContratoRow, type ParcelaRow } from './relatorioFinanciamentos';

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
	contrato({ id: 1, dataContrato: '2024-03-10', valor: 10000, responsavel: 'GFS', totalJuros: 2000 }), // ativo
	contrato({ id: 2, dataContrato: '2026-05-20 00:00:00', valor: 50000, responsavel: 'CGF', modalidade: 'INVESTIMENTO', idBanco: 2, taxaJurosAnual: 11 }), // novo
	contrato({ id: 3, dataContrato: '2023-01-15', valor: 20000, responsavel: ' gfs ' }), // quitado em 2026
	contrato({ id: 4, dataContrato: '2022-06-01', valor: 5000, responsavel: 'RLF', modalidade: 'PARTICULAR', idBanco: null, banco: null, pessoa: 'Fulano' }), // quitado em 2025
	contrato({ id: 5, dataContrato: '2027-02-01', valor: 8000, responsavel: 'MLF', modalidade: 'RENEGOCIACAO' }), // assinado depois de 2026
	contrato({ id: 6, dataContrato: '2026-02-10', valor: 3000, responsavel: 'GJN' }), // novo e quitado em 2026
	contrato({ id: 7, dataContrato: '2025-01-01', valor: 1000, responsavel: 'DCC', taxaJurosAnual: null }), // ativo com parcela vencida
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
	parcela(7, 1100, 'Liquidado', '2025-07-01', null), // liquidada sem data: assume o vencimento
	parcela(7, 1100, 'Vencido', '2026-04-01'),
];

const porId = (r: ReturnType<typeof montarRelatorioFinanciamentos>) => new Map(r.itens.map((i) => [i.idFinanciamento, i]));

describe('periodoDoFiltro', () => {
	it('ano inteiro ou mês', () => {
		expect(periodoDoFiltro(2026)).toEqual({ inicio: '2026-01-01', fim: '2026-12-31' });
		expect(periodoDoFiltro(2026, 2)).toEqual({ inicio: '2026-02-01', fim: '2026-02-31' });
	});
});

describe('montarRelatorioFinanciamentos — status e valor (ano 2026)', () => {
	const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026 }, HOJE);
	const m = porId(r);

	it('NOVO pela data do contrato; QUITADO pela última liquidação no período; demais ATIVO', () => {
		expect(m.get(1)?.statusContrato).toBe('ATIVO');
		expect(m.get(2)?.statusContrato).toBe('NOVO');
		expect(m.get(3)?.statusContrato).toBe('QUITADO');
		expect(m.get(7)?.statusContrato).toBe('ATIVO');
	});

	it('NOVO tem precedência sobre QUITADO, mas informa a data de quitação', () => {
		expect(m.get(6)?.statusContrato).toBe('NOVO');
		expect(m.get(6)?.dataQuitacao).toBe('2026-09-10');
	});

	it('exclui contratos quitados antes do período e assinados depois dele', () => {
		expect(m.has(4)).toBe(false);
		expect(m.has(5)).toBe(false);
		expect(r.itens).toHaveLength(5);
	});

	it('valor: NOVO = contrato; ATIVO = parcelas não liquidadas (inclui vencidas); QUITADO = valor pago', () => {
		expect(m.get(2)?.valor).toBe(50000);
		expect(m.get(6)?.valor).toBe(3000);
		expect(m.get(1)?.valor).toBe(4000);
		expect(m.get(7)?.valor).toBe(1100);
		expect(m.get(3)?.valor).toBe(22000);
		expect(m.get(3)?.dataQuitacao).toBe('2026-02-01');
	});

	it('tomador = responsavel (sem espaços), datas como AAAA-MM-DD', () => {
		expect(m.get(3)?.responsavel).toBe('gfs');
		expect(m.get(2)?.dataContrato).toBe('2026-05-20');
		expect(m.get(1)?.valorTotal).toBe(12000);
	});

	it('resumo por status e totalizadores', () => {
		expect(r.resumoStatus.NOVO).toEqual({ quantidade: 2, valor: 53000 });
		// "Todo contrato que não estiver quitado está ativo": o novo 2 (em aberto) também é ativo
		expect(r.resumoStatus.ATIVO).toEqual({ quantidade: 3, valor: 65100 });
		// o 6 é novo e foi quitado no ano: conta também como quitado (valor pago)
		expect(r.resumoStatus.QUITADO).toEqual({ quantidade: 2, valor: 25300 });
		expect(r.totalizadores.totalContratos).toBe(5);
		expect(r.totalizadores.totalValor).toBe(80100);
		expect(r.totalizadores.totalParcelasVencidas).toBe(1);
	});

	it('ordena por data do contrato (mais recente primeiro)', () => {
		expect(r.itens.map((i) => i.idFinanciamento)).toEqual([2, 6, 7, 1, 3]);
	});
});

describe('montarRelatorioFinanciamentos — período mensal e histórico', () => {
	it('mês: contrato quitado depois do fim do mês continua ATIVO pelo saldo no fim do mês', () => {
		const m = porId(montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, mes: 5 }, HOJE));
		expect(m.get(2)?.statusContrato).toBe('NOVO');
		expect(m.has(3)).toBe(false); // quitado em fevereiro
		expect(m.get(6)?.statusContrato).toBe('ATIVO');
		expect(m.get(6)?.valor).toBe(3300);
		expect(m.get(1)?.valor).toBe(4000);
	});

	it('ano passado: considera as liquidações até o fim daquele ano', () => {
		const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2025 }, HOJE);
		const m = porId(r);
		expect(m.get(1)).toMatchObject({ statusContrato: 'ATIVO', valor: 8000 });
		expect(m.get(3)).toMatchObject({ statusContrato: 'ATIVO', valor: 11000 });
		expect(m.get(4)).toMatchObject({ statusContrato: 'QUITADO', valor: 5500 });
		expect(m.get(7)).toMatchObject({ statusContrato: 'NOVO', valor: 1000 });
		expect(m.has(2)).toBe(false);
		expect(m.has(6)).toBe(false);
	});

	it('contrato sem parcelas e não novo fica ATIVO com valor 0', () => {
		const r = montarRelatorioFinanciamentos([contrato({ id: 9, dataContrato: '2025-01-10', valor: 100 })], [], { ano: 2026 }, HOJE);
		expect(r.itens[0]).toMatchObject({ statusContrato: 'ATIVO', valor: 0 });
	});
});

describe('montarRelatorioFinanciamentos — filtros', () => {
	it('filtro de status filtra de verdade (não aborta o relatório) e mantém o resumo completo', () => {
		const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, statusContrato: 'QUITADO' }, HOJE);
		expect(r.itens.map((i) => [i.idFinanciamento, i.statusContrato, i.valor])).toEqual([
			[6, 'QUITADO', 3300],
			[3, 'QUITADO', 22000],
		]);
		expect(r.totalizadores.totalContratos).toBe(2);
		expect(r.resumoStatus.NOVO.quantidade).toBe(2);
		// Ativos incluem o novo ainda em aberto, com o valor a pagar (não o valor do contrato)
		const ativos = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, statusContrato: 'ATIVO' }, HOJE);
		expect(ativos.itens.map((i) => [i.idFinanciamento, i.valor]).sort((a, b) => a[0] - b[0])).toEqual([
			[1, 4000],
			[2, 60000],
			[7, 1100],
		]);
		const novos = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, statusContrato: 'NOVO' }, HOJE);
		expect(novos.itens.map((i) => [i.idFinanciamento, i.valor]).sort((a, b) => a[0] - b[0])).toEqual([
			[2, 50000],
			[6, 3000],
		]);
	});

	it('tomador usa responsavel, sem diferenciar maiúsculas/espaços', () => {
		const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, tomador: 'GFS' }, HOJE);
		expect(r.itens.map((i) => i.idFinanciamento).sort()).toEqual([1, 3]);
	});

	it('modalidade (inclui RENEGOCIACAO), banco, garantia e faixa de juros', () => {
		const reneg = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2027, modalidade: 'RENEGOCIACAO' }, HOJE);
		expect(reneg.itens.map((i) => [i.idFinanciamento, i.statusContrato])).toEqual([[5, 'NOVO']]);
		const banco2 = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, idBanco: 2 }, HOJE);
		expect(banco2.itens.map((i) => i.idFinanciamento)).toEqual([2]);
		const juros = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, faixaJuros: '<=8' }, HOJE);
		expect(juros.itens.map((i) => i.idFinanciamento)).not.toContain(2);
		expect(juros.itens.map((i) => i.idFinanciamento)).toContain(7); // taxa nula entra em <= 8
		const garantia = montarRelatorioFinanciamentos(
			[contrato({ id: 10, dataContrato: '2026-01-01', valor: 1, numeroGarantia: 'MAT-123' })],
			[],
			{ ano: 2026, numeroGarantia: 'mat-12' },
			HOJE,
		);
		expect(garantia.itens).toHaveLength(1);
	});

	it('lista de tomadores vem de todos os contratos, distinta e ordenada', () => {
		expect(listarTomadores(contratos)).toEqual(['CGF', 'DCC', 'GFS', 'GJN', 'MLF', 'RLF']);
		const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, tomador: 'GFS' }, HOJE);
		expect(r.tomadores).toHaveLength(6);
	});
});

describe('montarRelatorioFinanciamentos — gráficos', () => {
	const r = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, statusContrato: 'QUITADO' }, HOJE);
	const g = r.graficos;

	it('novos x quitados por mês do ano filtrado (o filtro de status não afeta os gráficos)', () => {
		expect(g.mensal).toHaveLength(12);
		expect(g.mensal[1].novos).toBe(3000); // fev
		expect(g.mensal[4].novos).toBe(50000); // mai
		expect(g.mensal[1].liquidados).toBe(11000);
		expect(g.mensal[2].liquidados).toBe(4000);
		expect(g.mensal[8].liquidados).toBe(3300);
		expect(g.mensal.reduce((s, x) => s + x.novos, 0)).toBe(53000);
	});

	it('compromissos do ano filtrado, mês a mês (parcelas não liquidadas pelo vencimento)', () => {
		expect(g.mensal[3].compromissos).toBe(1100); // abr: vencida não paga
		expect(g.mensal.reduce((s, x) => s + x.compromissos, 0)).toBe(1100);
	});

	it('compromissos por ano: do ano atual até 2036', () => {
		expect(g.compromissosPorAno[0]).toEqual({ ano: 2026, valor: 1100 });
		expect(g.compromissosPorAno[g.compromissosPorAno.length - 1].ano).toBe(2036);
		expect(g.compromissosPorAno).toHaveLength(11);
		expect(g.compromissosPorAno.find((x) => x.ano === 2027)?.valor).toBe(34000);
		expect(g.compromissosPorAno.find((x) => x.ano === 2028)?.valor).toBe(39000);
	});

	it('liquidados por ano (pela data de liquidação)', () => {
		expect(g.liquidadosPorAno).toEqual([
			{ ano: 2025, valor: 21600 },
			{ ano: 2026, valor: 18300 },
		]);
	});

	it('gráficos respeitam filtros de contrato (tomador)', () => {
		const gfs = montarRelatorioFinanciamentos(contratos, parcelas, { ano: 2026, tomador: 'GFS' }, HOJE).graficos;
		expect(gfs.mensal.every((x) => x.novos === 0)).toBe(true);
		expect(gfs.mensal[1].liquidados).toBe(11000);
		expect(gfs.mensal[2].liquidados).toBe(4000);
		expect(gfs.compromissosPorAno.find((x) => x.ano === 2027)?.valor).toBe(4000);
	});

	it('não esconde parcelas depois de 2036', () => {
		const longo = montarRelatorioFinanciamentos(
			[contrato({ id: 20, dataContrato: '2026-01-01', valor: 1 })],
			[parcela(20, 500, 'Aberto', '2038-01-01')],
			{ ano: 2026 },
			HOJE,
		).graficos.compromissosPorAno;
		expect(longo[longo.length - 1]).toEqual({ ano: 2038, valor: 500 });
	});
});
