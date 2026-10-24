import { describe, it, expect } from 'vitest';
import { resumoSaldoDevedor } from './saldoDevedor';

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
