import { AuthController } from "../controllers/AuthController";
import { SessionRepository } from "../repositories/SessionRepository";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Permite requisições de qualquer origem
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function handleAuthRequest(req: Request, env: { JWT_SECRET: string }, DB: D1Database): Promise<Response> {
  const repository = new SessionRepository(DB);
  const controller = new AuthController(repository);

  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const { email, senha } = await req.json();
      const result = await controller.login(email, senha, env);

      if (!result) {
        return new Response(JSON.stringify({ error: "Credenciais inválidas" }), { status: 401, headers: corsHeaders });
      }

      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error("❌ Erro interno no login:", error);
      return new Response(JSON.stringify({ error: "Erro interno no login", details: (error as Error).message }), { status: 500, headers: corsHeaders });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const token = req.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), { status: 401, headers: corsHeaders });
    }

    const user = await controller.verifySession(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 403, headers: corsHeaders });
    }

    return new Response(JSON.stringify(user), { status: 200, headers: corsHeaders });
  }

  return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
}
