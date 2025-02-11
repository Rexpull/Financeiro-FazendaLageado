import { handleRequest as handleBancoRequest } from "./routes/SetupRoutes";
import { handleRequest as handleContaCorrenteRequest } from "./routes/handleContaCorrente";

export default {
  async fetch(req: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/bancos")) {
      return handleBancoRequest(req, env.DB);
    } else if (pathname.startsWith("/api/contas")) {
      return handleContaCorrenteRequest(req, env.DB);
    }

    return new Response("Rota não encontrada", { status: 404 });
  },
};
