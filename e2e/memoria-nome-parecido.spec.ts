// Conciliação Bancária: a line classified by the memória of a similar name (not the identical text) is
// marked "memória · nome parecido" so it gets checked (asked by the client on 18/11/2026).
import { test, expect } from '@playwright/test';
import { installConciliacaoMocks } from './helpers/conciliacaoApiMock';

test('lançamento vindo da memória por nome parecido aparece marcado para conferir', async ({ page }) => {
	await installConciliacaoMocks(page, {
		movimentos: [
			{ id: 1, historico: 'LAFOR COMERCIO DE COMBUSTIVEIS', valor: -1918, idPlanoContas: 300, idCentroCustos: 42, idMemoriaConciliacao: 13, memoriaPorNomeParecido: false },
			{ id: 2, historico: 'LAFOR COMERCIO DE COMBUSTIVEIS LTDA', valor: -4078, idPlanoContas: 300, idCentroCustos: 42, idMemoriaConciliacao: 13, memoriaPorNomeParecido: true },
			{ id: 3, historico: 'Pagamento de Boleto - CEMIG', valor: -500, idPlanoContas: 300, idCentroCustos: 42 },
		],
	});
	await page.goto('/financeiro/conciliacao-bancaria', { waitUntil: 'networkidle' });

	const identica = page.locator('tr', { hasText: /LAFOR COMERCIO DE COMBUSTIVEIS(?! LTDA)/ }).first();
	const parecida = page.locator('tr', { hasText: 'LAFOR COMERCIO DE COMBUSTIVEIS LTDA' });
	const semMemoria = page.locator('tr', { hasText: 'CEMIG' });

	await expect(parecida.getByText('memória · nome parecido').first()).toBeVisible();
	await expect(parecida.getByTitle(/nome parecido.*confira/).first()).toBeVisible();
	await expect(identica.getByText('memória', { exact: true }).first()).toBeVisible();
	await expect(identica.getByText('nome parecido')).toHaveCount(0);
	await expect(semMemoria.getByText('memória')).toHaveCount(0);
});
