import { describe, it, expect } from 'vitest';
import {
	resumoSaldoDevedor,
	resumoSaldoDevedorMeses,
	mesesDoIntervalo,
	contratosDoPeriodo,
	parcelasComRenegociacoes,
	comValorOriginal,
} from './saldoDevedor';

const fin = [
	{ id: 1, dataContrato: '2025-06-06', valor: 1000 }, // contrato antigo
	{ id: 2, dataContrato: '2026-10-15', valor: 5000 }, // novo em outubro/2026
];
const parcelas = [
	{ idFinanciamento: 1, valor: 300, status: 'Liquidado', dt_vencimento: '2026-03-15', dt_liquidacao: '2026-03-10' },
	{ idFinanciamento: 1, valor: 300, status: 'Liquidado', dt_vencimento: '2026-10-15', dt_liquidacao: '2026-10-14' },
	{ idFinanciamento: 1, valor: 300, status: 'Vencido', dt_vencimento: '2026-09-15', dt_liquidacao: null },
	{ idFinanciamento: 1, valor: 450, status: 'Aberto', dt_vencimento: '2027-06-15', dt_liquidacao: null },
	{ idFinanciamento: 2, valor: 3000, status: 'Aberto', dt_vencimento: '2027-10-15', dt_liquidacao: null },
	{ idFinanciamento: 2, valor: 3000, status: 'Aberto', dt_vencimento: '2028-10-15', dt_liquidacao: null },
];

describe('resumoSaldoDevedor', () => {
	const r = resumoSaldoDevedor(2026, fin, parcelas);
	const out = r[9]; // outubro

	it('saldo inicial = parcelas não liquidadas antes do mês (inclui vencidas não pagas)', () => {
		expect(r[0].saldoInicial).toBe(1350); // jan: 300+300+300+450
		expect(out.saldoInicial).toBe(1050); // out: menos a de março
	});

	it('quitados = parcelas liquidadas no mês', () => {
		expect(r[2].quitados).toBe(300);
		expect(out.quitados).toBe(300);
	});

	it('créditos novos = parcelas dos contratos do mês, com o valor de contrato à parte', () => {
		expect(out.creditosNovos).toBe(6000);
		expect(out.valorContratadoNovos).toBe(5000);
		expect(out.contratosNovos).toBe(1);
	});

	it('saldo final = inicial − quitados + novos, e encadeia com o mês seguinte', () => {
		expect(out.saldoFinal).toBe(out.saldoInicial - out.quitados + out.creditosNovos);
		expect(r[10].saldoInicial).toBe(out.saldoFinal);
		for (const m of r) {
			expect(m.saldoFinal).toBeCloseTo(m.saldoInicial - m.quitados + m.creditosNovos, 2);
		}
	});

	it('contrato sem parcelas não entra no saldo', () => {
		const s = resumoSaldoDevedor(2026, [{ id: 9, dataContrato: '2026-01-10', valor: 100000 }], []);
		expect(s[0].creditosNovos).toBe(0);
		expect(s[0].valorContratadoNovos).toBe(100000);
		expect(s[11].saldoFinal).toBe(0);
	});
});

describe('resumoSaldoDevedorMeses / mesesDoIntervalo (filtro de período)', () => {
	it('lista os meses de um intervalo que cruza o ano', () => {
		expect(mesesDoIntervalo('2025-11-01', '2026-02-01')).toEqual([
			{ ano: 2025, mes: 11 },
			{ ano: 2025, mes: 12 },
			{ ano: 2026, mes: 1 },
		]);
		expect(mesesDoIntervalo('2026-01-01', '2027-01-01')).toHaveLength(12);
	});

	it('últimos 12 meses: mesmos números do ano mês a mês, encadeados entre os anos', () => {
		const r = resumoSaldoDevedorMeses(mesesDoIntervalo('2025-11-01', '2026-11-01'), fin, parcelas);
		expect(r).toHaveLength(12);
		expect(r[0]).toMatchObject({ ano: 2025, mes: 11 });
		// Jan..Out/2026 equal to the year view
		expect(r.slice(2)).toEqual(resumoSaldoDevedor(2026, fin, parcelas).slice(0, 10));
		for (let i = 1; i < r.length; i++) expect(r[i].saldoInicial).toBe(r[i - 1].saldoFinal);
	});
});

describe('contratosDoPeriodo (contratos dos quadros Créditos novos / Quitados)', () => {
	const contratos = fin.map((f) => ({ ...f, numeroContrato: `C${f.id}`, credor: 'BB', tomador: 'GJN' }));
	const parcelasComId = parcelas.map((p, i) => ({ ...p, id: i + 1, numParcela: i + 1 }));

	it('somam exatamente os quadros do período', () => {
		const { novos, quitados } = contratosDoPeriodo('2026-01-01', '2027-01-01', contratos, parcelasComId);
		const r = resumoSaldoDevedor(2026, fin, parcelas);
		const soma = (k: 'quitados' | 'creditosNovos') => r.reduce((s, m) => s + m[k], 0);
		expect(novos.map((c) => c.numeroContrato)).toEqual(['C2']);
		expect(novos.reduce((s, c) => s + c.valorNoPeriodo, 0)).toBe(soma('creditosNovos'));
		expect(quitados.map((c) => c.numeroContrato)).toEqual(['C1']);
		expect(quitados[0].parcelas.map((p) => p.dt_liquidacao)).toEqual(['2026-03-10', '2026-10-14']);
		expect(quitados.reduce((s, c) => s + c.valorNoPeriodo, 0)).toBe(soma('quitados'));
	});

	it('trimestre: só as parcelas liquidadas dentro dele', () => {
		const { novos, quitados } = contratosDoPeriodo('2026-01-01', '2026-04-01', contratos, parcelasComId);
		expect(novos).toEqual([]);
		expect(quitados).toHaveLength(1);
		expect(quitados[0].valorNoPeriodo).toBe(300);
	});
});

describe('saldo devedor em mês fechado (cards x gráfico de evolução)', () => {
	const f = [
		{ id: 1, dataContrato: '2026-06-30', valor: 2000 },
		{ id: 2, dataContrato: '2026-07-01', valor: 8000 },
		{ id: 3, dataContrato: '2026-10-01', valor: 9000 },
	];
	const p = [
		{ idFinanciamento: 1, valor: 1000, status: 'Liquidado', dt_vencimento: '2026-07-15', dt_liquidacao: '2026-07-01' },
		{ idFinanciamento: 1, valor: 1000, status: 'Liquidado', dt_vencimento: '2026-10-01', dt_liquidacao: '2026-10-01' },
		{ idFinanciamento: 2, valor: 5000, status: 'Liquidado', dt_vencimento: '2026-09-30', dt_liquidacao: null },
		{ idFinanciamento: 2, valor: 5000, status: 'Aberto', dt_vencimento: '2027-07-01', dt_liquidacao: null },
		{ idFinanciamento: 3, valor: 9000, status: 'Aberto', dt_vencimento: '2027-10-01', dt_liquidacao: null },
	];

	it('trimestre: início = fim de junho, fim = fim de setembro, início − quitados + novos = fim', () => {
		const t3 = resumoSaldoDevedorMeses(mesesDoIntervalo('2026-07-01', '2026-10-01'), f, p);
		const soma = (k: 'quitados' | 'creditosNovos') => t3.reduce((s, m) => s + m[k], 0);
		expect(t3[0].saldoInicial).toBe(2000); // C-3 inteiro: a parcela paga em 01/07 ainda estava em aberto em 30/06
		expect(soma('quitados')).toBe(6000);
		expect(soma('creditosNovos')).toBe(10000); // F-6 (01/10) fica de fora
		expect(t3[2].saldoFinal).toBe(t3[0].saldoInicial - soma('quitados') + soma('creditosNovos'));
	});

	it('o mesmo mês tem o mesmo saldo em qualquer intervalo (o ano e o trimestre concordam)', () => {
		const ano = resumoSaldoDevedor(2026, f, p);
		const t3 = resumoSaldoDevedorMeses(mesesDoIntervalo('2026-07-01', '2026-10-01'), f, p);
		expect(ano[5].saldoFinal).toBe(t3[0].saldoInicial); // fim de junho
		expect(ano[8].saldoFinal).toBe(t3[2].saldoFinal); // fim de setembro
		expect(ano.slice(6, 9)).toEqual(t3);
	});
});

describe('renegociações no saldo devedor', () => {
	const aberta = (id: number, idFinanciamento: number, numParcela: number, valor: number, dt_vencimento: string) => ({
		id, idFinanciamento, numParcela, valor, status: 'Aberto', dt_vencimento, dt_liquidacao: null,
	});
	const fecha = (meses: ReturnType<typeof resumoSaldoDevedor>) => {
		for (const m of meses) expect(m.saldoFinal).toBeCloseTo(m.saldoInicial - m.quitados + m.creditosNovos + m.renegociacoes, 2);
	};

	it('aditivo: meses anteriores não mudam e a diferença aparece em "renegociações" no mês dele', () => {
		const f = [{ id: 1, dataContrato: '2026-02-10', valor: 1000 }];
		const antes = resumoSaldoDevedor(2026, f, [aberta(1, 1, 1, 500, '2027-02-10'), aberta(2, 1, 2, 500, '2028-02-10')]);
		// aditivo em 15/06: parcelas 1 e 2 (1000) viram 1, 2, 3 (1200)
		const atuais = [aberta(3, 1, 1, 400, '2027-06-15'), aberta(4, 1, 2, 400, '2028-06-15'), aberta(5, 1, 3, 400, '2029-06-15')];
		const reneg = [{
			id: 1, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-06-15',
			parcelasAnteriores: JSON.stringify([{ numParcela: 1, dt_vencimento: '2027-02-10', valor: 500 }, { numParcela: 2, dt_vencimento: '2028-02-10', valor: 500 }]),
			parcelasNovas: '[1,2,3]',
		}];
		const depois = resumoSaldoDevedor(2026, f, parcelasComRenegociacoes(atuais, reneg));
		expect(depois.slice(0, 5)).toEqual(antes.slice(0, 5).map((m) => ({ ...m, renegociacoes: 0 })));
		expect(depois[5]).toMatchObject({ saldoInicial: 1000, creditosNovos: 0, quitados: 0, renegociacoes: 200, saldoFinal: 1200 });
		expect(depois[1].creditosNovos).toBe(1000); // fevereiro: o crédito assumido na assinatura continua lá
		fecha(depois);
	});

	it('dois aditivos seguidos: cada parcela entra e sai do saldo uma vez só', () => {
		const f = [{ id: 1, dataContrato: '2026-01-05', valor: 1000 }];
		const reneg = [
			{ id: 1, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-04-01', parcelasAnteriores: [{ numParcela: 1, dt_vencimento: '2027-01-05', valor: 1000 }], parcelasNovas: [1, 2] },
			{ id: 2, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-08-01', parcelasAnteriores: [{ numParcela: 1, dt_vencimento: '2027-04-01', valor: 600 }, { numParcela: 2, dt_vencimento: '2028-04-01', valor: 600 }], parcelasNovas: [1] },
		];
		const r = resumoSaldoDevedor(2026, f, parcelasComRenegociacoes([aberta(9, 1, 1, 1500, '2028-08-01')], reneg));
		expect(r.map((m) => m.saldoFinal)).toEqual([1000, 1000, 1000, 1200, 1200, 1200, 1200, 1500, 1500, 1500, 1500, 1500]);
		expect(r[3].renegociacoes).toBe(200);
		expect(r[7].renegociacoes).toBe(300);
		fecha(r);
	});

	it('novo contrato: o contrato novo não conta como crédito novo e os meses anteriores não mudam', () => {
		const f = [
			{ id: 1, dataContrato: '2025-05-01', valor: 1000 },
			{ id: 2, dataContrato: '2026-09-20', valor: 1000, idFinanciamentoOrigem: 1 },
		];
		const contratos = f.map((c) => ({ ...c, numeroContrato: `C-${c.id}` }));
		const reneg = [{ id: 1, idFinanciamento: 1, tipo: 'NOVO_CONTRATO', dataRenegociacao: '2026-09-20', parcelasAnteriores: '[{"numParcela":2,"dt_vencimento":"2026-12-01","valor":800}]' }];
		const parc = parcelasComRenegociacoes([aberta(7, 2, 1, 450, '2027-09-20'), aberta(8, 2, 2, 450, '2028-09-20')], reneg);
		const r = resumoSaldoDevedor(2026, f, parc);
		expect(r.slice(0, 8).every((m) => m.saldoFinal === 800 && m.renegociacoes === 0)).toBe(true);
		expect(r[8]).toMatchObject({ saldoInicial: 800, creditosNovos: 0, contratosNovos: 0, renegociacoes: 100, saldoFinal: 900 });
		fecha(r);
		expect(contratosDoPeriodo('2026-09-01', '2026-10-01', contratos, parc).novos).toEqual([]);
	});

	it('renegociação com data antes do contrato e parcela paga antes do aditivo: cada mês continua fechando', () => {
		const f = [{ id: 1, dataContrato: '2026-05-10', valor: 100 }];
		const reneg = [{ id: 1, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-03-01', parcelasAnteriores: [{ numParcela: 1, dt_vencimento: '2027-01-01', valor: 100 }], parcelasNovas: [1, 2] }];
		const atuais = [
			aberta(5, 1, 1, 60, '2027-03-01'),
			{ id: 6, idFinanciamento: 1, numParcela: 2, valor: 60, status: 'Liquidado', dt_vencimento: '2026-04-01', dt_liquidacao: '2026-02-15' },
		];
		const r = resumoSaldoDevedor(2026, f, parcelasComRenegociacoes(atuais, reneg));
		fecha(r);
		expect(r[11].saldoFinal).toBe(60);
		expect(r.reduce((s, m) => s + m.quitados, 0)).toBe(60); // paid once, never before it entered the saldo
	});

	it('valor contratado do mês de assinatura: o de antes do primeiro aditivo', () => {
		const f = [{ id: 1, dataContrato: '2026-02-10', valor: 1500 }, { id: 2, dataContrato: '2026-02-11', valor: 300 }];
		const reneg = [
			{ id: 1, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-06-01', parcelasAnteriores: '[]', condicoesAnteriores: '{"valor":1000}' },
			{ id: 2, idFinanciamento: 1, tipo: 'ADITIVO', dataRenegociacao: '2026-07-01', parcelasAnteriores: '[]', condicoesAnteriores: '{"valor":1200}' },
		];
		expect(comValorOriginal(f, reneg).map((c) => c.valor)).toEqual([1000, 300]);
		expect(resumoSaldoDevedor(2026, comValorOriginal(f, reneg), [])[1].valorContratadoNovos).toBe(1300);
	});
});
