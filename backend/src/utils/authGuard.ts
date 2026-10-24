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

let avisoSemSegredoEmitido = false;

/**
 * Auth guard for the worker's fetch handler. Returns a 401 Response when the request must be
 * rejected, or null when it may proceed.
 *
 * Enforced only when env.JWT_SECRET is set (production secret). Without it (vitest workers pool,
 * local dev without .dev.vars) the guard is skipped and a warning is logged once.
 */
export async function exigeAutenticacao(req: Request, env: { JWT_SECRET?: string } | undefined): Promise<Response | null> {
	const { pathname } = new URL(req.url);
	if (isRotaPublica(req.method, pathname)) return null;

	const secret = env?.JWT_SECRET;
	if (!secret) {
		if (!avisoSemSegredoEmitido) {
			avisoSemSegredoEmitido = true;
			console.warn("⚠️ JWT_SECRET não configurado: autenticação das rotas /api está DESATIVADA.");
		}
		return null;
	}

	const token = extrairBearer(req.headers.get("Authorization"));
	if (token && (await verificarToken(token, secret))) return null;

	return new Response(JSON.stringify({ error: MSG_SESSAO_INVALIDA }), {
		status: 401,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
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
