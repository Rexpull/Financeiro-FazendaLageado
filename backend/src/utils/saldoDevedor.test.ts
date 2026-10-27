import { describe, it, expect } from 'vitest';
import { resumoSaldoDevedor, resumoSaldoDevedorMeses, mesesDoIntervalo, contratosDoPeriodo } from './saldoDevedor';

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
