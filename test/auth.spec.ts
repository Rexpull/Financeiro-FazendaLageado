// Auth/security tests: route guard (exigeAutenticacao), login (inactive users, JWT lifetime),
// user endpoints never exposing senha/token, and password update on PUT /api/usuario/:id.
// The vitest workers pool runs without JWT_SECRET, so the guard is exercised directly with a fake env.
import { env, SELF, createExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { SignJWT, decodeJwt } from 'jose';
import schemaSql from './fixtures/schema.sql?raw';
import {
	exigeAutenticacao,
	extrairBearer,
	isBcryptHash,
	isRotaPublica,
	semCredenciais,
	usuarioAtivo,
	verificarToken,
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

async function tokenAssinado(opts: { secret?: string; exp?: string | number; alg?: string } = {}) {
	return new SignJWT({ id: 1, email: 'ana@fazenda.test' })
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
	const envComSegredo = { JWT_SECRET: SECRET };

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

	it('lets a request with a valid token through (any method / route)', async () => {
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

	it('is not enforced when JWT_SECRET is missing (test pool / local dev)', async () => {
		expect(await exigeAutenticacao(req('/api/usuario'), {})).toBeNull();
		expect(await exigeAutenticacao(req('/api/usuario'), undefined)).toBeNull();
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
		}
	});

	it('active user gets a 12h HS256 token accepted by the guard; session check never returns senha/token', async () => {
		const controller = new AuthController(new SessionRepository(db));
		const result = await controller.login('ana@fazenda.test', 'senhaAna1', { JWT_SECRET: SECRET });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.user).not.toHaveProperty('senha');
		const claims = decodeJwt(result.token);
		expect(claims.exp! - claims.iat!).toBe(12 * 60 * 60);

		const passou = await exigeAutenticacao(
			req('/api/usuario', { headers: { Authorization: `Bearer ${result.token}` } }),
			{ JWT_SECRET: SECRET },
		);
		expect(passou).toBeNull();

		const sessao = await controller.verifySession(result.token, { JWT_SECRET: SECRET });
		expect(sessao).toMatchObject({ id: 1, email: 'ana@fazenda.test' });
		expect(sessao).not.toHaveProperty('senha');
		expect(sessao).not.toHaveProperty('token');

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
			expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
		}
		expect((await call('/api/usuario', { method: 'OPTIONS' })).status).toBe(204);
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

		const sessao = await call('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } });
		expect(sessao.status).toBe(200);
		const corpo = (await sessao.json()) as Record<string, unknown>;
		expect(corpo).not.toHaveProperty('senha');
		expect(corpo).not.toHaveProperty('token');
	});
});
