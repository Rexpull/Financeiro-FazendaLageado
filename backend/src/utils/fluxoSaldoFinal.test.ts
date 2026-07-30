import { describe, it, expect } from 'vitest';
import { calcularSaldoFinalFluxo } from './fluxoSaldoFinal';

describe('calcularSaldoFinalFluxo', () => {
	it('does not include pendências de conciliação in the closing balance', () => {
		const saldo = calcularSaldoFinalFluxo({
			saldoInicial: -1517342.74,
			receitas: 2969719.23,
			despesas: 4219817.02,
			investimentos: 0,
			financiamentos: -288112.61,
		});
		// Same formula as management Fluxo: SI + (R - D) + I + F — no pendentes term
		expect(saldo).toBeCloseTo(-1517342.74 + (2969719.23 - 4219817.02) - 288112.61, 2);
	});

	it('ignores a hypothetical pendentes amount (must not be an input)', () => {
		const withOpsOnly = calcularSaldoFinalFluxo({
			saldoInicial: 1000,
			receitas: 500,
			despesas: 200,
			financiamentos: -50,
		});
		expect(withOpsOnly).toBe(1250);
		// If pendentes R$ 220.528,38 were wrongly added, saldo would be 221778.38
		expect(withOpsOnly).not.toBe(1250 + 220528.38);
	});
});
