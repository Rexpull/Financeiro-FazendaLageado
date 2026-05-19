import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

const MOCK_ORIGIN = process.env.PLAYWRIGHT_API_MOCK_ORIGIN ?? 'http://127.0.0.1:19999';

const json = (body: unknown, status = 200) => ({
	status,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

export type CapturedBatch = {
	movimentos: Array<{ historico: string; valor: number; identificadorOfx: string }>;
};

export async function installOfxImportMocks(
	page: Page,
	options?: { onBatch?: (body: CapturedBatch) => void }
) {
	let nextId = 9000;

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
		if (url.includes('/api/contaCorrente') && method === 'GET') {
			return route.fulfill(
				json([
					{
						id: 38,
						bancoNome: 'Caixa E2E',
						numConta: '5848812752',
						responsavel: 'Teste',
						codigoBanco: '104',
					},
				])
			);
		}
		if (url.includes('/api/movBancario/batch') && method === 'POST') {
			const body = route.request().postDataJSON() as CapturedBatch;
			options?.onBatch?.(body);

			const movimentos = body.movimentos.map((m) => ({
				...m,
				id: nextId++,
				resultadoList: [],
				centroCustosList: [],
			}));

			return route.fulfill(
				json({
					movimentos,
					novos: movimentos.length,
					existentes: 0,
				})
			);
		}
		if (url.includes('/api/historico-importacao-ofx') && method === 'POST') {
			return route.fulfill(json({ id: 1 }));
		}
		if (url.includes('/api/movBancario/paginado') && method === 'GET') {
			return route.fulfill(
				json({
					movimentos: [],
					total: 0,
					currentPage: 1,
					totalPages: 0,
					hasNext: false,
					hasPrev: false,
				})
			);
		}
		if (url.includes('/api/movBancario') && method === 'GET') {
			return route.fulfill(json([]));
		}
		if (url.includes('/api/historico-importacao-ofx') && method === 'GET') {
			return route.fulfill(json([]));
		}
		if (url.includes('/api/planoContas') && method === 'GET') {
			return route.fulfill(json([]));
		}
		if (url.includes('/api/centroCustos') && method === 'GET') {
			return route.fulfill(json([]));
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
		localStorage.setItem(
			'contaSelecionada',
			JSON.stringify({
				id: 38,
				bancoNome: 'Caixa E2E',
				numConta: '5848812752',
				responsavel: 'Teste',
				codigoBanco: '104',
			})
		);
	});
}

export function caixaOfxFixturePath(): string {
	return path.join(process.cwd(), 'e2e', 'fixtures', 'extrato-caixa-marco.ofx');
}

export function readCaixaOfxFixture(): string {
	return readFileSync(caixaOfxFixturePath(), 'utf8');
}
