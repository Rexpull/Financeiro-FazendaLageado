import { test, expect } from '@playwright/test';
import {
	caixaOfxFixturePath,
	installOfxImportMocks,
	type CapturedBatch,
} from './helpers/ofxApiMock';

test.describe('Caixa OFX import', () => {
	test('parses CONSORCIO and sends both movements in batch', async ({ page }) => {
		let captured: CapturedBatch | null = null;

		await installOfxImportMocks(page, {
			onBatch: (body) => {
				captured = body;
			},
		});

		await page.goto('/financeiro/conciliacao-bancaria', { waitUntil: 'networkidle' });

		// Select conta if modal opens on first visit
		const contaModal = page.getByRole('heading', { name: /Selecione a Conta Corrente/i });
		if (await contaModal.isVisible().catch(() => false)) {
			await page.locator('.grid').getByText('5848812752').click();
		}

		await page.getByRole('button', { name: /Buscar OFX/i }).click({ timeout: 15000 });
		await expect(page.getByRole('heading', { name: /Buscar Arquivo OFX/i })).toBeVisible();

		const fileInput = page.locator('input[type="file"][accept=".ofx"]');
		await fileInput.setInputFiles(caixaOfxFixturePath());

		await page.getByRole('button', { name: /^Importar$/i }).click();

		// Select conta after parse (import starts only after explicit selection)
		await expect(page.getByRole('heading', { name: /Selecione a Conta Corrente/i })).toBeVisible({
			timeout: 15000,
		});
		const contaCards = page.locator('.ReactModal__Content .grid > div');
		const targetConta = page.getByText('5848812752');
		if (await targetConta.isVisible().catch(() => false)) {
			await targetConta.click();
		} else {
			await contaCards.first().click();
		}
		await expect(page.getByRole('button', { name: /Continuar para Conciliação/i })).toBeVisible({
			timeout: 20000,
		});

		await expect.poll(() => captured?.movimentos?.length ?? 0).toBe(2);

		expect(captured).not.toBeNull();
		expect(captured!.movimentos).toHaveLength(2);

		const consorcio = captured!.movimentos.find((m) => m.historico === 'CONSORCIO');
		const capitalizacao = captured!.movimentos.find((m) =>
			m.historico.includes('CAPITALIZACAO')
		);

		expect(consorcio?.valor).toBe(-1061.52);
		expect(capitalizacao?.valor).toBe(-114.35);
		expect(consorcio?.identificadorOfx).toContain('-1061.52');
	});
});
