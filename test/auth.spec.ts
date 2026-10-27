// Auth/security tests: route guard (exigeAutenticacao), login (inactive users, JWT lifetime),
// user endpoints never exposing senha/token, and password update on PUT /api/usuario/:id.
// The vitest workers pool runs without JWT_SECRET (and with AUTH_DESATIVADA_TESTES='1', see vitest.config.mts),
// so the guard is exercised directly with explicit fake envs.
import { env, SELF, createExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { SignJWT, decodeJwt } from 'jose';
import schemaSql from './fixtures/schema.sql?raw';
import {
	CACHE_USUARIO_TTL_MS,
	exigeAutenticacao,
	extrairBearer,
	isBcryptHash,
	isRotaPublica,
	limparCacheUsuarios,
	semCredenciais,
	usuarioAtivo,
	usuarioContinuaAtivo,
	verificarToken,
	MSG_FALHA_VALIDAR_SESSAO,
	MSG_SEM_CONFIG_AUTH,
	MSG_SESSAO_INVALIDA,
} from '../backend/src/utils/authGuard';
import { prepararSenha } from '../backend/src/repositories/UsuarioRepository';
import { AuthController, MSG_USUARIO_INATIVO } from '../backend/src/controllers/AuthController';
import { SessionRepository } from '../backend/src/repositories/SessionRepository';
import worker from '../backend/src/index';

const BASE = 'https://worker.test';
const SECRET = 'segredo-de-teste-com-tamanho-suficiente-32b';
const db = (env as unknown as { DB: D1Database }).DB;

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) {
		await db.prepare(sql).run();
	}
}

// Low cost factor keeps bcrypt fast in tests; same format as production hashes.
const hash = (senha: string) => bcrypt.hash(senha, 4);

async function seedUsuarios() {
	await db
		.prepare(
			`INSERT INTO usuario (id, nome, usuario, email, senha, ativo, token) VALUES
			 (1, 'Ana Ativa', 'ana', 'ana@fazenda.test', ?, 1, 'token-antigo-ana'),
			 (2, 'Ivo Inativo', 'ivo', 'ivo@fazenda.test', ?, 0, NULL)`,
		)
		.bind(await hash('senhaAna1'), await hash('senhaIvo1'))
		.run();
}

async function tokenAssinado(opts: { secret?: string; exp?: string | number; alg?: string; claims?: Record<string, unknown> } = {}) {
	return new SignJWT(opts.claims ?? { id: 1, email: 'ana@fazenda.test' })
		.setProtectedHeader({ alg: opts.alg ?? 'HS256' })
		.setIssuedAt()
		.setExpirationTime(opts.exp ?? '12h')
		.sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

function req(path: string, init: RequestInit = {}) {
	return new Request(`${BASE}${path}`, init);
}

describe('auth helpers', () => {
	it('isRotaPublica: only OPTIONS, POST login and GET session are public', () => {
		expect(isRotaPublica('OPTIONS', '/api/usuario')).toBe(true);
		expect(isRotaPublica('POST', '/api/auth/login')).toBe(true);
		expect(isRotaPublica('GET', '/api/auth/session')).toBe(true);
		expect(isRotaPublica('GET', '/api/auth/login')).toBe(false);
		expect(isRotaPublica('POST', '/api/usuario')).toBe(false);
		expect(isRotaPublica('GET', '/api/auth/login/../../usuario')).toBe(false);
		expect(isRotaPublica('GET', '/api/movBancario')).toBe(false);
	});

	it('extrairBearer', () => {
		expect(extrairBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
		expect(extrairBearer('bearer   xyz ')).toBe('xyz');
		expect(extrairBearer('Basic abc')).toBeNull();
		expect(extrairBearer('Bearer')).toBeNull();
		expect(extrairBearer(null)).toBeNull();
		expect(extrairBearer(undefined)).toBeNull();
	});

	it('usuarioAtivo handles SQLite 0/1, booleans and strings', () => {
		expect(usuarioAtivo(1)).toBe(true);
		expect(usuarioAtivo(0)).toBe(false);
		expect(usuarioAtivo(true)).toBe(true);
		expect(usuarioAtivo(false)).toBe(false);
		expect(usuarioAtivo('0')).toBe(false);
		expect(usuarioAtivo('false')).toBe(false);
		expect(usuarioAtivo('1')).toBe(true);
		expect(usuarioAtivo(null)).toBe(true);
		expect(usuarioAtivo(undefined)).toBe(true);
	});

	it('isBcryptHash / prepararSenha', async () => {
		const h = await hash('abc123');
		expect(isBcryptHash(h)).toBe(true);
		expect(isBcryptHash('abc123')).toBe(false);
		expect(isBcryptHash('')).toBe(false);
		expect(isBcryptHash(undefined)).toBe(false);

		expect(await prepararSenha(h)).toBe(h); // client-side hash kept as-is
		expect(await prepararSenha('')).toBeNull();
		expect(await prepararSenha('   ')).toBeNull();
		expect(await prepararSenha(undefined)).toBeNull();
		const doTexto = await prepararSenha('texto-puro');
		expect(isBcryptHash(doTexto)).toBe(true);
		expect(await bcrypt.compare('texto-puro', doTexto!)).toBe(true);
	});

	it('semCredenciais removes senha and token', () => {
		expect(semCredenciais({ id: 1, nome: 'x', senha: 'h', token: 't' })).toEqual({ id: 1, nome: 'x' });
	});
});

describe('exigeAutenticacao (route guard)', () => {
	const envComSegredo = { JWT_SECRET: SECRET, DB: db };
	const comToken = (token: string, path = '/api/usuario') => req(path, { headers: { Authorization: `Bearer ${token}` } });

	beforeAll(async () => {
		await applySchema();
		await seedUsuarios();
	});
	beforeEach(() => limparCacheUsuarios());

	it('returns 401 JSON with CORS headers when there is no token', async () => {
		const res = await exigeAutenticacao(req('/api/usuario'), envComSegredo);
		expect(res).not.toBeNull();
		expect(res!.status).toBe(401);
		expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(await res!.json()).toEqual({ error: MSG_SESSAO_INVALIDA });
	});

	it('returns 401 for a malformed token, a token signed with another secret, alg none and an expired token', async () => {
		const expirado = await tokenAssinado({ exp: Math.floor(Date.now() / 1000) - 60 });
		const outroSegredo = await tokenAssinado({ secret: 'outro-segredo-qualquer-com-32-bytes!!' });
		const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '');
		const body = btoa(JSON.stringify({ id: 1, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '');
		const semAssinatura = `${header}.${body}.`;

		for (const token of ['abc', 'a.b.c', expirado, outroSegredo, semAssinatura]) {
			const res = await exigeAutenticacao(
				req('/api/movBancario', { headers: { Authorization: `Bearer ${token}` } }),
				envComSegredo,
			);
			expect(res?.status, token).toBe(401);
		}
	});

	it('lets a valid token of an active user through (any method / route), even when usuario.token holds another token', async () => {
		const token = await tokenAssinado();
		for (const [method, path] of [
			['GET', '/api/usuario'],
			['POST', '/api/usuario'],
			['DELETE', '/api/movBancario/1'],
			['GET', '/api/dashboard'],
		]) {
			const res = await exigeAutenticacao(req(path, { method, headers: { Authorization: `Bearer ${token}` } }), envComSegredo);
			expect(res, `${method} ${path}`).toBeNull();
		}
	});

	it('leaves preflight, login and session check open', async () => {
		expect(await exigeAutenticacao(req('/api/usuario', { method: 'OPTIONS' }), envComSegredo)).toBeNull();
		expect(await exigeAutenticacao(req('/api/auth/login', { method: 'POST' }), envComSegredo)).toBeNull();
		expect(await exigeAutenticacao(req('/api/auth/session'), envComSegredo)).toBeNull();
	});

	it('fails closed (503 JSON + CORS) when JWT_SECRET or the DB binding is missing', async () => {
		const envsSemConfig = [{}, undefined, { DB: db }, { JWT_SECRET: SECRET }, { AUTH_DESATIVADA_TESTES: 'true' }, { AUTH_DESATIVADA_TESTES: '0' }];
		for (const envSemConfig of envsSemConfig) {
			const res = await exigeAutenticacao(req('/api/usuario'), envSemConfig);
			expect(res?.status, JSON.stringify(envSemConfig)).toBe(503);
			expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(await res!.json()).toEqual({ error: MSG_SEM_CONFIG_AUTH });
		}
		// public routes stay reachable so the login can report its own error
		expect(await exigeAutenticacao(req('/api/auth/login', { method: 'POST' }), {})).toBeNull();
	});

	it("is skipped only with AUTH_DESATIVADA_TESTES === '1' and no JWT_SECRET (vitest pool)", async () => {
		expect(await exigeAutenticacao(req('/api/usuario'), { AUTH_DESATIVADA_TESTES: '1' })).toBeNull();
		// with the secret configured the flag changes nothing
		const res = await exigeAutenticacao(req('/api/usuario'), { ...envComSegredo, AUTH_DESATIVADA_TESTES: '1' });
		expect(res?.status).toBe(401);
	});

	it('returns 401 for a valid token of an inactive, deleted or unidentified user', async () => {
		const tokens = [
			await tokenAssinado({ claims: { id: 2, email: 'ivo@fazenda.test' } }), // ativo = 0
			await tokenAssinado({ claims: { id: 999, email: 'apagado@fazenda.test' } }),
			await tokenAssinado({ claims: { email: 'ana@fazenda.test' } }),
			await tokenAssinado({ claims: { id: 'abc' } }),
		];
		for (const token of tokens) {
			const res = await exigeAutenticacao(comToken(token), envComSegredo);
			expect(res?.status).toBe(401);
			expect(await res!.json()).toEqual({ error: MSG_SESSAO_INVALIDA });
		}
	});

	it('a deactivated or deleted user loses access once the per-isolate cache expires', async () => {
		const token = await tokenAssinado();
		expect(await exigeAutenticacao(comToken(token), envComSegredo)).toBeNull();

		await db.prepare('UPDATE usuario SET ativo = 0 WHERE id = 1').run();
		limparCacheUsuarios(); // simulates the TTL running out
		expect((await exigeAutenticacao(comToken(token), envComSegredo))?.status).toBe(401);

		await db.prepare('UPDATE usuario SET ativo = 1 WHERE id = 1').run();
		limparCacheUsuarios();
		expect(await exigeAutenticacao(comToken(token), envComSegredo)).toBeNull();

		await db.prepare('DELETE FROM usuario WHERE id = 1').run();
		limparCacheUsuarios();
		expect((await exigeAutenticacao(comToken(token), envComSegredo))?.status).toBe(401);
	});

	it('usuarioContinuaAtivo caches the answer for CACHE_USUARIO_TTL_MS (<= 1 min) per user id', async () => {
		expect(CACHE_USUARIO_TTL_MS).toBeLessThanOrEqual(60_000);
		await db.prepare("INSERT INTO usuario (id, nome, usuario, email, senha, ativo) VALUES (3, 'Cacau', 'cacau', 'cacau@fazenda.test', 'x', 1), (4, 'Dito', 'dito', 'dito@fazenda.test', 'x', 0)").run();
		const t0 = 1_000_000;
		expect(await usuarioContinuaAtivo(db, 3, t0)).toBe(true);
		expect(await usuarioContinuaAtivo(db, 4, t0)).toBe(false);

		await db.prepare('UPDATE usuario SET ativo = CASE id WHEN 3 THEN 0 ELSE 1 END WHERE id IN (3, 4)').run();
		expect(await usuarioContinuaAtivo(db, 3, t0 + CACHE_USUARIO_TTL_MS - 1)).toBe(true); // still cached
		expect(await usuarioContinuaAtivo(db, 4, t0 + CACHE_USUARIO_TTL_MS - 1)).toBe(false);
		expect(await usuarioContinuaAtivo(db, 3, t0 + CACHE_USUARIO_TTL_MS)).toBe(false); // re-read
		expect(await usuarioContinuaAtivo(db, 4, t0 + CACHE_USUARIO_TTL_MS)).toBe(true);
	});

	it('answers 503 (not 401, so the front does not log out) when the user lookup fails', async () => {
		const dbQuebrado = {
			prepare() {
				throw new Error('D1 indisponível');
			},
		} as unknown as D1Database;
		const res = await exigeAutenticacao(comToken(await tokenAssinado()), { JWT_SECRET: SECRET, DB: dbQuebrado });
		expect(res?.status).toBe(503);
		expect(await res!.json()).toEqual({ error: MSG_FALHA_VALIDAR_SESSAO });
	});

	it('verificarToken accepts only HS256 tokens signed with the secret', async () => {
		expect(await verificarToken(await tokenAssinado(), SECRET)).not.toBeNull();
		expect(await verificarToken(await tokenAssinado(), 'outro')).toBeNull();
	});
});

describe('login', () => {
	beforeAll(async () => {
		await applySchema();
		await seedUsuarios();
	});

	it('rejects an inactive user with a clear message (403)', async () => {
		const res = await SELF.fetch(`${BASE}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'ivo', senha: 'senhaIvo1' }),
		});
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: MSG_USUARIO_INATIVO });
	});

	it('inactive user with a wrong password gets the generic 401 (status not revealed)', async () => {
		const res = await SELF.fetch(`${BASE}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'ivo', senha: 'errada' }),
		});
		expect(res.status).toBe(401);
		await res.text();
	});

	it('rejects a wrong password and an unknown user with 401', async () => {
		for (const body of [
			{ email: 'ana@fazenda.test', senha: 'errada' },
			{ email: 'ninguem@fazenda.test', senha: 'senhaAna1' },
			{ email: 'ana@fazenda.test' },
		]) {
			const res = await SELF.fetch(`${BASE}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			expect(res.status).toBe(401);
			await res.text();
		}
	});

	it('login ignores upper/lower case in the username and e-mail', async () => {
		const controller = new AuthController(new SessionRepository(db));
		for (const identificador of ['Ana', 'ANA', ' ana ', 'Ana@Fazenda.Test']) {
			const result = await controller.login(identificador, 'senhaAna1', { JWT_SECRET: SECRET });
			expect(result.ok, identificador).toBe(true);
		}
		expect((await controller.login('Ana', 'errada', { JWT_SECRET: SECRET })).ok).toBe(false);
	});

	it('active user gets a 12h HS256 token accepted by the guard; session check never returns senha/token', async () => {
		const controller = new AuthController(new SessionRepository(db));
		const result = await controller.login('ana@fazenda.test', 'senhaAna1', { JWT_SECRET: SECRET });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.user).not.toHaveProperty('senha');
		const claims = decodeJwt(result.token);
		expect(claims.exp! - claims.iat!).toBe(12 * 60 * 60);

		limparCacheUsuarios();
		const passou = await exigeAutenticacao(
			req('/api/usuario', { headers: { Authorization: `Bearer ${result.token}` } }),
			{ JWT_SECRET: SECRET, DB: db },
		);
		expect(passou).toBeNull();

		const sessao = await controller.verifySession(result.token, { JWT_SECRET: SECRET });
		expect(sessao).toMatchObject({ id: 1, email: 'ana@fazenda.test' });
		expect(sessao).not.toHaveProperty('senha');
		expect(sessao).not.toHaveProperty('token');

		// A newer login (e.g. on another device) keeps this session valid.
		const outroAparelho = await controller.login('ana@fazenda.test', 'senhaAna1', { JWT_SECRET: SECRET });
		expect(outroAparelho.ok).toBe(true);
		expect(await controller.verifySession(result.token, { JWT_SECRET: SECRET })).toMatchObject({ id: 1 });

		// After the user is deactivated the session check fails.
		await db.prepare('UPDATE usuario SET ativo = 0 WHERE id = 1').run();
		expect(await controller.verifySession(result.token, { JWT_SECRET: SECRET })).toBeNull();
	});

	it('without JWT_SECRET a valid login fails with a generic 500 (no hash/secret details leaked)', async () => {
		const res = await SELF.fetch(`${BASE}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'ana', senha: 'senhaAna1' }),
		});
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(JSON.parse(text)).toEqual({ error: 'Erro interno no login' });
		expect(text).not.toMatch(/\$2[aby]\$/);
	});
});

describe('/api/usuario', () => {
	beforeAll(async () => {
		await applySchema();
		await seedUsuarios();
	});

	it('GET list never contains senha or token', async () => {
		const res = await SELF.fetch(`${BASE}/api/usuario`);
		expect(res.status).toBe(200);
		const lista = (await res.json()) as Record<string, unknown>[];
		expect(lista).toHaveLength(2);
		for (const u of lista) {
			expect(u).not.toHaveProperty('senha');
			expect(u).not.toHaveProperty('token');
			expect(u).toHaveProperty('nome');
			expect(u).toHaveProperty('ativo');
		}
		expect(JSON.stringify(lista)).not.toMatch(/\$2[aby]\$|token-antigo-ana/);
	});

	it('PUT with a new (client-hashed) senha replaces the password', async () => {
		const novoHash = await hash('novaSenha9');
		const res = await SELF.fetch(`${BASE}/api/usuario/1`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nome: 'Ana Ativa', usuario: 'ana', email: 'ana@fazenda.test', ativo: true, senha: novoHash }),
		});
		expect(res.status).toBe(200);
		await res.text();

		const controller = new AuthController(new SessionRepository(db));
		expect((await controller.login('ana', 'senhaAna1', { JWT_SECRET: SECRET })).ok).toBe(false);
		expect((await controller.login('ana', 'novaSenha9', { JWT_SECRET: SECRET })).ok).toBe(true);
	});

	it('PUT without senha (or with empty senha) keeps the current password', async () => {
		const antes = await db.prepare('SELECT senha FROM usuario WHERE id = 2').first<{ senha: string }>();
		for (const extra of [{}, { senha: '' }]) {
			const res = await SELF.fetch(`${BASE}/api/usuario/2`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nome: 'Ivo Renomeado', usuario: 'ivo', email: 'ivo@fazenda.test', ativo: false, ...extra }),
			});
			expect(res.status).toBe(200);
			await res.text();
		}
		const depois = await db.prepare('SELECT nome, senha FROM usuario WHERE id = 2').first<{ nome: string; senha: string }>();
		expect(depois!.nome).toBe('Ivo Renomeado');
		expect(depois!.senha).toBe(antes!.senha);
	});

	it('POST without senha is rejected; POST with a hash creates the user without echoing it', async () => {
		const semSenha = await SELF.fetch(`${BASE}/api/usuario`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nome: 'Sem Senha', usuario: 'sem', email: 'sem@fazenda.test', ativo: true }),
		});
		expect(semSenha.status).toBe(400);
		await semSenha.text();

		const comSenha = await SELF.fetch(`${BASE}/api/usuario`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nome: 'Nova', usuario: 'nova', email: 'nova@fazenda.test', ativo: true, senha: await hash('abc12345') }),
		});
		expect(comSenha.status).toBe(201);
		expect(await comSenha.text()).not.toMatch(/\$2[aby]\$/);
	});
});

describe('worker fetch with JWT_SECRET set (production-like)', () => {
	const envProd = () => ({ ...(env as object), JWT_SECRET: SECRET });
	const call = (path: string, init: RequestInit = {}) =>
		worker.fetch(new Request(`${BASE}${path}`, init), envProd(), createExecutionContext());

	beforeAll(async () => {
		await applySchema();
		await seedUsuarios();
	});
	beforeEach(() => limparCacheUsuarios());

	it('blocks data routes without a token, including user creation', async () => {
		for (const [method, path] of [
			['GET', '/api/usuario'],
			['POST', '/api/usuario'],
			['GET', '/api/movBancario'],
			['DELETE', '/api/bancos/1'],
			['GET', '/api/dashboard'],
		]) {
			const res = await call(path, { method });
			expect(res.status, `${method} ${path}`).toBe(401);
			await res.text();
			expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
		}
		const preflight = await call('/api/usuario', { method: 'OPTIONS' });
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get('Access-Control-Max-Age')).toBe('86400');
		expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
	});

	it('login -> token -> authorized call works end to end', async () => {
		const login = await call('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'ana', senha: 'senhaAna1' }),
		});
		expect(login.status).toBe(200);
		const { token, user } = (await login.json()) as { token: string; user: Record<string, unknown> };
		expect(user).not.toHaveProperty('senha');

		const lista = await call('/api/usuario', { headers: { Authorization: `Bearer ${token}` } });
		expect(lista.status).toBe(200);
		await lista.text();

		const sessao = await call('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } });
		expect(sessao.status).toBe(200);
		const corpo = (await sessao.json()) as Record<string, unknown>;
		expect(corpo).not.toHaveProperty('senha');
		expect(corpo).not.toHaveProperty('token');

		// A second login (another device) replaces usuario.token; the first token keeps working on the API.
		const segundoLogin = await call('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'ana', senha: 'senhaAna1' }),
		});
		expect(segundoLogin.status).toBe(200);
		await segundoLogin.text();
		const comPrimeiroToken = await call('/api/usuario', { headers: { Authorization: `Bearer ${token}` } });
		expect(comPrimeiroToken.status).toBe(200);
		await comPrimeiroToken.text();

		// Deactivating the user cuts API access (after the cache window) even with an unexpired token.
		await db.prepare('UPDATE usuario SET ativo = 0 WHERE id = 1').run();
		limparCacheUsuarios();
		const bloqueado = await call('/api/usuario', { headers: { Authorization: `Bearer ${token}` } });
		expect(bloqueado.status).toBe(401);
		expect(await bloqueado.json()).toEqual({ error: MSG_SESSAO_INVALIDA });
	});

	it('without JWT_SECRET and without AUTH_DESATIVADA_TESTES the worker fails closed with 503', async () => {
		const envSemAuth = { ...(env as object), JWT_SECRET: undefined, AUTH_DESATIVADA_TESTES: undefined };
		const res = await worker.fetch(new Request(`${BASE}/api/usuario`), envSemAuth, createExecutionContext());
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: MSG_SEM_CONFIG_AUTH });
	});
});
