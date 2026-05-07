import type { Page } from '@playwright/test';

const MOCK_ORIGIN = process.env.PLAYWRIGHT_API_MOCK_ORIGIN ?? 'http://127.0.0.1:19999';

const json = (body: unknown, status = 200) => ({
	status,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

/** Session endpoint used by AuthContext on load */
export async function installAuthAndApiMocks(page: Page, options?: { financiamentos?: unknown[] }) {
	const financiamentos = options?.financiamentos ?? [];

	await page.route(`${MOCK_ORIGIN}/**`, async (route) => {
		const url = route.request().url();
		const method = route.request().method();

		if (url.includes('/api/auth/session') && method === 'GET') {
			return route.fulfill(json({ ok: true }));
		}
		if (url.includes('/api/auth/login')) {
			return route.fulfill(
				json({
					token: 'playwright-test-token',
					user: { id: 1, nome: 'E2E', email: 'e2e@test.com', foto_perfil: '' },
				})
			);
		}
		if (url.endsWith('/api/financiamento') && method === 'GET') {
			return route.fulfill(json(financiamentos));
		}
		if (url.includes('/api/financiamento/') && method === 'GET' && !url.includes('parcela')) {
			const id = parseInt(url.split('/').pop() || '0', 10);
			const one = (financiamentos as { id: number }[]).find((f) => f.id === id);
			return route.fulfill(json(one ?? null));
		}
		if (url.endsWith('/api/financiamento') && method === 'POST') {
			return route.fulfill(json({ id: 999 }));
		}
		if (url.includes('/api/financiamento/') && method === 'PUT') {
			return route.fulfill(json({ message: 'ok' }));
		}
		if (url.includes('/api/bancos') && method === 'GET') {
			return route.fulfill(json([{ id: 1, nome: 'Banco E2E', codigo: '001' }]));
		}
		if (url.includes('/api/pessoa') && method === 'GET' && !/\/api\/pessoa\/\d/.test(url)) {
			return route.fulfill(json([]));
		}
		if (url.includes('/api/parcelaFinanciamento') && method === 'POST') {
			const body = route.request().postDataJSON() as { numParcela?: number };
			return route.fulfill(json({ id: 8000 + (body?.numParcela ?? 0), message: 'ok' }));
		}
		if (url.includes('/api/parcelaFinanciamento/') && method === 'PUT') {
			return route.fulfill(json({ message: 'ok' }));
		}

		return route.fulfill({ status: 404, body: 'playwright mock: unhandled ' + url });
	});

	await page.addInitScript(() => {
		localStorage.setItem(
			'user',
			JSON.stringify({
				id: 1,
				nome: 'E2E',
				email: 'e2e@test.com',
				foto_perfil: '',
				token: 'playwright-test-token',
			})
		);
	});
}
