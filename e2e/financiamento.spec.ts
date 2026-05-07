import { test, expect } from '@playwright/test';
import { installAuthAndApiMocks } from './helpers/financiamentoApiMock';

/**
 * Verification (D1 + Worker logs) — run manually or in CI with a real Worker:
 *   wrangler d1 execute financeiro_db --remote --command "SELECT COUNT(*) FROM parcelaFinanciamento WHERE idFinanciamento = <id>;"
 *   wrangler tail
 * See also: verificar_financiamentos_fluxo.sql and migration_financiamentos_legacy_juros.sql at repo root.
 */

test.describe('Financiamentos page', () => {
	test('loads list and shows Novo Financiamento', async ({ page }) => {
		await installAuthAndApiMocks(page, { financiamentos: [] });
		await page.goto('/financeiro/financiamento');
		await expect(page.getByRole('button', { name: /Novo Financiamento/i })).toBeVisible();
		await expect(page.getByText(/Nenhum financiamento encontrado/i)).toBeVisible();
	});

	test('card view shows overdue warning for past-due open parcel', async ({ page }) => {
		const past = '2020-06-15';
		await installAuthAndApiMocks(page, {
			financiamentos: [
				{
					id: 42,
					idBanco: 1,
					idPessoa: null,
					responsavel: 'Resp E2E',
					dataContrato: '2020-01-01',
					valor: 10000,
					taxaJurosAnual: 10,
					totalJuros: null,
					numeroContrato: 'C51221539-8',
					numeroGarantia: null,
					observacao: null,
					dataVencimentoPrimeiraParcela: past,
					dataVencimentoUltimaParcela: past,
					modalidade: 'CUSTEIO',
					nomeModalidadeParticular: null,
					parcelasList: [
						{
							id: 501,
							idFinanciamento: 42,
							idMovimentoBancario: null,
							valor: 10000,
							status: 'Aberto',
							numParcela: 1,
							dt_lancamento: '2020-01-01',
							dt_vencimento: past,
							dt_liquidacao: null,
						},
					],
				},
			],
		});
		await page.goto('/financeiro/financiamento');
		await expect(page.getByText('C51221539-8')).toBeVisible();
		await expect(page.getByTestId('financiamento-overdue-icon')).toBeVisible();
	});

	test('new financing modal opens', async ({ page }) => {
		await installAuthAndApiMocks(page, { financiamentos: [] });
		await page.goto('/financeiro/financiamento');
		await page.getByRole('button', { name: /Novo Financiamento/i }).click();
		await expect(page.getByRole('heading', { name: /Novo Financiamento/i })).toBeVisible();
		await expect(page.getByText('Taxa de juros (% a.a.)')).toBeVisible();
	});
});
