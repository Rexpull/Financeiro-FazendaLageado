import { jwtVerify, type JWTPayload } from "jose";

/** Lifetime of the JWT issued at login (also enforced by GET /api/auth/session via jwtVerify). */
export const JWT_EXPIRACAO = "12h";
export const JWT_ALG = "HS256";

export const MSG_SESSAO_INVALIDA = "Sessão expirada ou inválida. Entre novamente.";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Routes reachable without a token (method + exact path). */
const ROTAS_PUBLICAS: ReadonlyArray<{ method: string; path: string }> = [
	{ method: "POST", path: "/api/auth/login" },
	{ method: "GET", path: "/api/auth/session" },
];

export function isRotaPublica(method: string, pathname: string): boolean {
	if (method === "OPTIONS") return true;
	return ROTAS_PUBLICAS.some((r) => r.method === method && r.path === pathname);
}

export function extrairBearer(authorization: string | null | undefined): string | null {
	if (!authorization) return null;
	const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
	return match ? match[1] : null;
}

export function chaveJwt(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

/** Returns the payload when the token is a valid, unexpired HS256 JWT signed with `secret`; otherwise null. */
export async function verificarToken(token: string, secret: string): Promise<JWTPayload | null> {
	try {
		const { payload } = await jwtVerify(token, chaveJwt(secret), { algorithms: [JWT_ALG] });
		return payload;
	} catch {
		return null;
	}
}

export const MSG_SEM_CONFIG_AUTH = "Servidor sem configuração de autenticação";
export const MSG_FALHA_VALIDAR_SESSAO = "Não foi possível validar a sessão. Tente novamente.";

/** How long (per isolate) the "user still exists and is active" answer is reused: a deactivation takes effect within this window. */
export const CACHE_USUARIO_TTL_MS = 60_000;

const cacheUsuarioAtivo = new Map<number, { ativo: boolean; ate: number }>();

export function limparCacheUsuarios(): void {
	cacheUsuarioAtivo.clear();
}

/** True when usuario `id` still exists and is active. Answer cached per isolate for CACHE_USUARIO_TTL_MS. */
export async function usuarioContinuaAtivo(db: D1Database, id: number, agora = Date.now()): Promise<boolean> {
	const cache = cacheUsuarioAtivo.get(id);
	if (cache && cache.ate > agora) return cache.ativo;

	const row = await db.prepare("SELECT ativo FROM usuario WHERE id = ?").bind(id).first<{ ativo: unknown }>();
	const ativo = row !== null && usuarioAtivo(row.ativo);
	cacheUsuarioAtivo.set(id, { ativo, ate: agora + CACHE_USUARIO_TTL_MS });
	return ativo;
}

function respostaJson(status: number, error: string): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

export type EnvAuth = { JWT_SECRET?: string; AUTH_DESATIVADA_TESTES?: string; DB?: D1Database };

let avisoAuthDesativadaEmitido = false;

/**
 * Auth guard for the worker's fetch handler. Returns the error Response when the request must be
 * rejected, or null when it may proceed.
 *
 * A request passes when it carries a valid HS256 JWT whose user (payload.id) still exists and is
 * active. The token does NOT have to match usuario.token, so several devices can stay signed in.
 *
 * Fail-closed: without env.JWT_SECRET (or the DB binding) every protected route answers 503, unless
 * env.AUTH_DESATIVADA_TESTES === '1' (binding set only by the vitest workers pool).
 */
export async function exigeAutenticacao(req: Request, env: EnvAuth | undefined): Promise<Response | null> {
	const { pathname } = new URL(req.url);
	if (isRotaPublica(req.method, pathname)) return null;

	const secret = env?.JWT_SECRET;
	if (!secret || !env?.DB) {
		if (!secret && env?.AUTH_DESATIVADA_TESTES === "1") {
			if (!avisoAuthDesativadaEmitido) {
				avisoAuthDesativadaEmitido = true;
				console.warn("⚠️ AUTH_DESATIVADA_TESTES=1 e sem JWT_SECRET: autenticação das rotas /api está DESATIVADA.");
			}
			return null;
		}
		console.error("❌ JWT_SECRET ou binding DB ausente: rotas /api bloqueadas.");
		return respostaJson(503, MSG_SEM_CONFIG_AUTH);
	}

	const token = extrairBearer(req.headers.get("Authorization"));
	const payload = token ? await verificarToken(token, secret) : null;
	const idUsuario = Number(payload?.id);
	if (!payload || !Number.isInteger(idUsuario) || idUsuario <= 0) return respostaJson(401, MSG_SESSAO_INVALIDA);

	try {
		if (await usuarioContinuaAtivo(env.DB, idUsuario)) return null;
	} catch (error) {
		console.error("❌ Erro ao validar usuário da sessão:", error);
		return respostaJson(503, MSG_FALHA_VALIDAR_SESSAO);
	}
	return respostaJson(401, MSG_SESSAO_INVALIDA);
}

/** `ativo` comes from SQLite as 0/1 (BOOLEAN affinity); tolerate booleans/strings too. Missing = active (column default 1). */
export function usuarioAtivo(ativo: unknown): boolean {
	if (ativo === null || ativo === undefined) return true;
	if (typeof ativo === "string") return !["0", "false", ""].includes(ativo.trim().toLowerCase());
	return Boolean(ativo);
}

/** Matches a bcrypt hash ($2a$/$2b$/$2y$, cost, 53 chars of salt+hash). */
export function isBcryptHash(valor: unknown): valor is string {
	return typeof valor === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(valor);
}

/** Removes credential fields before a user row leaves the API. */
export function semCredenciais<T extends Record<string, unknown>>(usuario: T): Omit<T, "senha" | "token"> {
	const { senha: _senha, token: _token, ...resto } = usuario;
	return resto;
}
