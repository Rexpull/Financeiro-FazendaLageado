import { describe, it, expect, vi } from 'vitest';
import { criarFetchAutenticado, deveEncerrarSessao, isUrlDaApi, obterToken, STORAGE_USER_KEY } from './apiFetch';

const API = 'https://api.fazenda.test';

function storage(valor: string | null) {
	return { getItem: (k: string) => (k === STORAGE_USER_KEY ? valor : null) };
}

describe('apiFetch helpers', () => {
	it('obterToken reads the token from the stored user', () => {
		expect(obterToken(storage(JSON.stringify({ id: 1, token: 'abc' })))).toBe('abc');
		expect(obterToken(storage(JSON.stringify({ id: 1 })))).toBeNull();
		expect(obterToken(storage(null))).toBeNull();
		expect(obterToken(storage('{nao-json'))).toBeNull();
		expect(obterToken(undefined)).toBeNull();
	});

	it('isUrlDaApi matches only the API base (with or without trailing slash) and relative /api', () => {
		expect(isUrlDaApi(`${API}/api/usuario`, API)).toBe(true);
		expect(isUrlDaApi(`${API}/api/usuario`, `${API}/`)).toBe(true);
		expect(isUrlDaApi('/api/financiamentos/parcelas/1', API)).toBe(true);
		expect(isUrlDaApi(`${API}.evil.test/api/usuario`, API)).toBe(false);
		expect(isUrlDaApi('https://outro.test/api/usuario', API)).toBe(false);
		expect(isUrlDaApi('/assets/logo.svg', API)).toBe(false);
		expect(isUrlDaApi('https://outro.test/x', undefined)).toBe(false);
	});

	it('deveEncerrarSessao: 401 except on login/session check', () => {
		expect(deveEncerrarSessao(`${API}/api/usuario`, 401)).toBe(true);
		expect(deveEncerrarSessao(`${API}/api/usuario`, 403)).toBe(false);
		expect(deveEncerrarSessao(`${API}/api/usuario`, 200)).toBe(false);
		expect(deveEncerrarSessao(`${API}/api/auth/login`, 401)).toBe(false);
		expect(deveEncerrarSessao(`${API}/api/auth/session`, 401)).toBe(false);
	});
});

describe('criarFetchAutenticado', () => {
	function setup(status = 200, token: string | null = 'tok123') {
		const original = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status }));
		const aoExpirar = vi.fn();
		const f = criarFetchAutenticado(original as unknown as typeof fetch, API, () => token, aoExpirar);
		return { original, aoExpirar, f };
	}

	it('adds the Bearer header to API calls and keeps existing headers', async () => {
		const { original, f } = setup();
		await f(`${API}/api/usuario`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
		const init = original.mock.calls[0][1]!;
		const headers = new Headers(init.headers);
		expect(headers.get('Authorization')).toBe('Bearer tok123');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(init.method).toBe('POST');
	});

	it('does not override an explicit Authorization header', async () => {
		const { original, f } = setup();
		await f(`${API}/api/auth/session`, { headers: { Authorization: 'Bearer outro' } });
		expect(new Headers(original.mock.calls[0][1]!.headers).get('Authorization')).toBe('Bearer outro');
	});

	it('leaves non-API requests and requests without a token untouched', async () => {
		const a = setup();
		await a.f('https://cdn.test/x.js');
		expect(a.original.mock.calls[0][1]).toBeUndefined();

		const b = setup(200, null);
		await b.f(`${API}/api/usuario`);
		expect(b.original.mock.calls[0][1]).toBeUndefined();
	});

	it('ends the session on 401 from the API, but not on a failed login', async () => {
		const a = setup(401);
		const res = await a.f(`${API}/api/movBancario`);
		expect(res.status).toBe(401);
		expect(a.aoExpirar).toHaveBeenCalledTimes(1);

		const b = setup(401);
		await b.f(`${API}/api/auth/login`, { method: 'POST' });
		expect(b.aoExpirar).not.toHaveBeenCalled();
	});
});
