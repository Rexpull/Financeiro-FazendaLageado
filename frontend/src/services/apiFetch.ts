// Adds `Authorization: Bearer <token>` to every request to the API and handles expired sessions.
// Installed once in main.tsx by wrapping window.fetch, so service files keep calling fetch directly.

export const STORAGE_USER_KEY = "user"; // AuthContext stores { id, nome, email, foto_perfil, token } here
export const SESSAO_EXPIRADA_KEY = "sessaoExpirada"; // sessionStorage flag read by AuthContext to show the toast
export const MSG_SESSAO_EXPIRADA = "Sua sessão expirou. Entre novamente.";

const ROTAS_SEM_REDIRECIONAMENTO = ["/api/auth/login", "/api/auth/session"];

export function obterToken(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): string | null {
	try {
		const raw = storage?.getItem(STORAGE_USER_KEY);
		if (!raw) return null;
		const token = JSON.parse(raw)?.token;
		return typeof token === "string" && token ? token : null;
	} catch {
		return null;
	}
}

export function urlDaRequisicao(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

/** True for URLs that target our API: absolute under VITE_API_URL, or relative /api/... */
export function isUrlDaApi(url: string, apiUrl: string | undefined): boolean {
	const base = (apiUrl ?? "").replace(/\/+$/, "");
	if (base && (url === base || url.startsWith(`${base}/`))) return true;
	return url.startsWith("/api/");
}

function caminho(url: string): string {
	try {
		return new URL(url, "http://local").pathname;
	} catch {
		return url;
	}
}

/** 401 from the API on anything but login/session-check means the stored token is no longer accepted. */
export function deveEncerrarSessao(url: string, status: number): boolean {
	return status === 401 && !ROTAS_SEM_REDIRECIONAMENTO.includes(caminho(url));
}

let encerrando = false;

function encerrarSessao() {
	if (encerrando) return;
	encerrando = true;
	try {
		localStorage.removeItem(STORAGE_USER_KEY);
		sessionStorage.setItem(SESSAO_EXPIRADA_KEY, "1");
	} catch {
		// storage unavailable: the redirect below still sends the user to the login page
	}
	if (window.location.pathname !== "/login") {
		window.location.assign("/login");
	} else {
		encerrando = false;
	}
}

export function criarFetchAutenticado(
	fetchOriginal: typeof fetch,
	apiUrl: string | undefined,
	lerToken: () => string | null = obterToken,
	aoExpirar: () => void = encerrarSessao,
): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = urlDaRequisicao(input);
		if (!isUrlDaApi(url, apiUrl)) return fetchOriginal(input, init);

		const token = lerToken();
		let novoInit = init;
		if (token) {
			const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
			if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
			novoInit = { ...init, headers };
		}

		const res = await fetchOriginal(input, novoInit);
		if (deveEncerrarSessao(url, res.status)) aoExpirar();
		return res;
	};
}

let instalado = false;

export function instalarFetchAutenticado(apiUrl: string | undefined = import.meta.env.VITE_API_URL) {
	if (instalado || typeof window === "undefined") return;
	instalado = true;
	window.fetch = criarFetchAutenticado(window.fetch.bind(window), apiUrl);
}
