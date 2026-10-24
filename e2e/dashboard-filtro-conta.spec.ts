import { test, expect, type Page } from '@playwright/test';

const MOCK_ORIGIN = process.env.PLAYWRIGHT_API_MOCK_ORIGIN ?? 'http://127.0.0.1:19999';

const CONTAS = [
	{ id: 1, tipo: 'Conta Corrente', bancoNome: 'Banco do Brasil', numConta: '1234-5', responsavel: 'BB GFS', ativo: 1 },
	{ id: 2, tipo: 'Conta Corrente', bancoNome: 'Sicredi', numConta: '9876-0', responsavel: 'Sicredi Lageado', ativo: 1 },
];

const DASHBOARD_VAZIO = {
	totaisAno: { receitas: 0, despesas: 0, investimentos: 0, financiamentos: { contratosAtivos: 0, totalFinanciado: 0, totalQuitado: 0, totalEmAberto: 0 } },
	receitasDespesasPorMes: { labels: [], receitas: [], despesas: [] },
	investimentosPorMes: { labels: [], values: [] },
	financiamentosPorMes: { labels: [], quitado: [], emAberto: [] },
	financiamentosPorCredor: { labels: [], values: [], quitados: [], emAberto: [], detalhamento: [] },
	financiamentos: { porFaixaJuros: [], porBanco: [] },
	parcelasFinanciamento: { labels: [], pagas: [], vencidas: [], totalPagas: 0, totalVencidas: 0, detalhes: [] },
	receitasDespesas: { receitas: [], despesas: [], detalhamento: [], receitasAgrupadoPorCentros: [] },
};

/** Mocks the API and records the `contas` param of every GET /api/dashboard. */
async function instalarMocks(page: Page) {
	const contasPedidas: string[] = [];
	await page.addInitScript(() => {
		localStorage.setItem('user', JSON.stringify({ id: 1, nome: 'E2E', email: 'e2e@test.com', foto_perfil: '', token: 'playwright-test-token' }));
	});
	await page.route(`${MOCK_ORIGIN}/**`, async (route) => {
		const url = new URL(route.request().url());
		const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
		if (url.pathname === '/api/auth/session') return json({ id: 1 });
		if (url.pathname === '/api/contas') return json(CONTAS);
		if (url.pathname === '/api/dashboard') {
			contasPedidas.push(url.searchParams.get('contas') ?? '');
			return json(DASHBOARD_VAZIO);
		}
		if (url.pathname.startsWith('/api/dashboard/') || url.pathname.startsWith('/api/notificacoes') || url.pathname.startsWith('/api/caixa')) return json([]);
		return route.fulfill({ status: 404, body: 'playwright mock: unhandled ' + url.href });
	});
	return contasPedidas;
}

test('Dashboard: filtro "Conta" envia a conta escolhida, "Limpar filtros" volta para Todas', async ({ page }) => {
	const contasPedidas = await instalarMocks(page);
	await page.goto('/dashboard');

	const conta = page.getByRole('combobox', { name: 'Conta' });
	await expect(conta).toHaveText('Todas');
	await expect.poll(() => contasPedidas.at(-1)).toBe('1,2');

	await conta.click();
	await page.getByRole('option', { name: /BB GFS/ }).click();
	await expect.poll(() => contasPedidas.at(-1)).toBe('1');
	await expect(page.getByRole('combobox', { name: 'Conta' })).toHaveText('BB GFS');

	await page.getByRole('button', { name: 'Limpar filtros' }).click();
	await expect.poll(() => contasPedidas.at(-1)).toBe('1,2');
	await expect(page.getByRole('combobox', { name: 'Conta' })).toHaveText('Todas');

	// Financiamentos and Caixa don't depend on accounts: the filter is disabled there.
	await page.getByRole('tab', { name: 'Financiamentos' }).click();
	await expect(page.getByRole('combobox', { name: 'Conta' })).toHaveAttribute('aria-disabled', 'true');
	await page.getByRole('tab', { name: 'Receitas e Despesas' }).click();
	await expect(page.getByRole('combobox', { name: 'Conta' })).not.toHaveAttribute('aria-disabled', 'true');
});
