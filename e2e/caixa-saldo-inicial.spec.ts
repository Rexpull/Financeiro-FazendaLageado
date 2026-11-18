// Dashboard › Caixa on the screen: a negative balance is always shown in red (also before the saldo inicial
// of the month is typed), and the saldo inicial can be informed as positive or negative (asked by the
// client on 17/11/2026). The API is mocked; the day-by-day numbers come from the real calculation.
import { test, expect, type Page } from '@playwright/test';
import { calcularCaixaDiario } from '../backend/src/utils/caixaDiario';

const MOCK_ORIGIN = process.env.PLAYWRIGHT_API_MOCK_ORIGIN ?? 'http://127.0.0.1:19999';
const pad = (n: number) => String(n).padStart(2, '0');

/** Caixa in memory: R$ 400.000 of boletos and a forecast debit of R$ 80.000 on day 1 of whatever month is opened. */
async function instalarCaixa(page: Page, saldoInicial: number | null = null) {
	let saldo = saldoInicial;
	const puts: Array<{ ano: number; mes: number; valor: number | null }> = [];
	await page.addInitScript(() => {
		localStorage.setItem('user', JSON.stringify({ id: 1, nome: 'E2E', email: 'e2e@test.com', foto_perfil: '', token: 'playwright-test-token' }));
	});
	await page.route(`${MOCK_ORIGIN}/**`, async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
		if (url.pathname === '/api/auth/session') return json({ id: 1 });
		if (url.pathname === '/api/caixa/saldo-inicial' && req.method() === 'PUT') {
			const body = req.postDataJSON() as { ano: number; mes: number; valor: number | null };
			puts.push(body);
			saldo = body.valor;
			return json({ ...body, atualizadoEm: '2026-11-17 23:00:00' });
		}
		if (url.pathname === '/api/caixa') {
			const ano = Number(url.searchParams.get('ano'));
			const mes = Number(url.searchParams.get('mes'));
			const dia1 = `${ano}-${pad(mes)}-01`;
			const previsao = { id: 1, tipo: 'PREVISAO' as const, natureza: 'D' as const, data: dia1, descricao: 'Arrendamentos', valor: 80000, criadoEm: null, atualizadoEm: null };
			const lancamentos = [{ tipo: 'BOLETO' as const, natureza: 'D' as const, data: dia1, valor: 400000 }, previsao];
			return json({
				ano,
				mes,
				saldoInicial: saldo,
				saldoInicialAtualizadoEm: saldo === null ? null : '2026-11-17 23:00:00',
				...calcularCaixaDiario({ ano, mes, saldoInicial: saldo, lancamentos, parcelas: [] }),
				lancamentos: [previsao],
				parcelas: [],
			});
		}
		if (url.pathname === '/api/dashboard') return json({});
		return json([]);
	});
	return { puts };
}

async function abrirCaixa(page: Page) {
	await page.goto('/dashboard');
	await page.getByRole('tab', { name: 'Caixa' }).click();
	await expect(campo(page)).toBeVisible();
}

const campo = (page: Page) => page.locator('input[aria-label^="Saldo inicial de"]');
const sinal = (page: Page, nome: 'Positivo' | 'Negativo') => page.getByRole('button', { name: nome, exact: true });

/** Colour of every table cell that shows a negative balance ("-R$ …"). */
const coresDosNegativos = (page: Page) =>
	page.locator('td').evaluateAll((tds) =>
		tds
			.filter((t) => /^-R\$/.test((t.textContent ?? '').trim()))
			.map((t) => getComputedStyle(t).color),
	);
const VERMELHOS = ['rgb(211, 47, 47)', 'rgb(239, 83, 80)']; // error.main and error.light of the theme

test.describe('Caixa: saldo negativo em vermelho', () => {
	test('sem saldo inicial no mês, todo saldo negativo já aparece em vermelho', async ({ page }) => {
		await instalarCaixa(page, null);
		await abrirCaixa(page);
		await expect(page.getByText(/Informe o saldo inicial/)).toBeVisible();
		await expect.poll(async () => (await coresDosNegativos(page)).length).toBeGreaterThan(30);
		const cores = await coresDosNegativos(page);
		expect(cores.filter((c) => !VERMELHOS.includes(c))).toEqual([]);
	});

	test('com saldo inicial que cobre o mês, nada fica em vermelho', async ({ page }) => {
		await instalarCaixa(page, 600000);
		await abrirCaixa(page);
		await expect(campo(page)).toHaveValue('R$ 600.000,00');
		expect(await coresDosNegativos(page)).toEqual([]);
	});
});

test.describe('Caixa: saldo inicial positivo ou negativo', () => {
	test('escolher "Negativo" e digitar o valor salva o saldo inicial negativo', async ({ page }) => {
		const api = await instalarCaixa(page, null);
		await abrirCaixa(page);
		await expect(sinal(page, 'Positivo')).toHaveAttribute('aria-pressed', 'true');
		await sinal(page, 'Negativo').click();
		await campo(page).click();
		await page.keyboard.type('80000');
		await page.keyboard.press('Enter');
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].valor).toBe(-80000);
		await expect(campo(page)).toHaveValue('R$ 80.000,00');
		await expect(sinal(page, 'Negativo')).toHaveAttribute('aria-pressed', 'true');
		// the month now starts at −80.000: 400.000 of boletos and 80.000 forecast on day 1
		await expect(page.getByText('-R$ 560.000,00').first()).toBeVisible();
	});

	test('a tecla "−" no campo vale como "Negativo", e "+" como "Positivo"', async ({ page }) => {
		const api = await instalarCaixa(page, null);
		await abrirCaixa(page);
		await campo(page).click();
		await page.keyboard.type('-50000');
		await expect(sinal(page, 'Negativo')).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Enter');
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].valor).toBe(-50000);

		await campo(page).click();
		await page.keyboard.type('+');
		await expect(sinal(page, 'Positivo')).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Enter');
		await expect.poll(() => api.puts.length).toBe(2);
		expect(api.puts[1].valor).toBe(50000);
	});

	test('trocar o sinal de um saldo já salvo grava na hora', async ({ page }) => {
		const api = await instalarCaixa(page, 600000);
		await abrirCaixa(page);
		await expect(sinal(page, 'Positivo')).toHaveAttribute('aria-pressed', 'true');
		await sinal(page, 'Negativo').click();
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].valor).toBe(-600000);
		await expect(sinal(page, 'Negativo')).toHaveAttribute('aria-pressed', 'true');
		await sinal(page, 'Positivo').click();
		await expect.poll(() => api.puts.length).toBe(2);
		expect(api.puts[1].valor).toBe(600000);
	});

	test('saldo positivo continua sendo digitado e salvo como antes', async ({ page }) => {
		const api = await instalarCaixa(page, null);
		await abrirCaixa(page);
		await campo(page).click();
		await page.keyboard.type('1970000');
		await page.keyboard.press('Enter');
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].valor).toBe(1970000);
		await expect(campo(page)).toHaveValue('R$ 1.970.000,00');
	});
});

test.describe('Caixa: seletor do saldo inicial em tela pequena', () => {
	test.use({ viewport: { width: 390, height: 800 } });

	test('o seletor Positivo / Negativo aparece logo abaixo do campo também no celular', async ({ page }) => {
		const api = await instalarCaixa(page, null);
		await abrirCaixa(page);
		await sinal(page, 'Negativo').scrollIntoViewIfNeeded();
		await expect(sinal(page, 'Positivo')).toBeInViewport();
		await expect(sinal(page, 'Negativo')).toBeInViewport();
		const caixaCampo = (await campo(page).boundingBox())!;
		const caixaSeletor = (await sinal(page, 'Negativo').boundingBox())!;
		expect(caixaSeletor.y).toBeGreaterThan(caixaCampo.y);
		expect(caixaSeletor.y - caixaCampo.y).toBeLessThan(120);
		await sinal(page, 'Negativo').click();
		await campo(page).click();
		await page.keyboard.type('1500');
		await page.keyboard.press('Enter');
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].valor).toBe(-1500);
	});
});
