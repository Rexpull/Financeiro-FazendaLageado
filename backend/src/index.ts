import { handleRequest as handleBancoRequest } from "./routes/SetupRoutes";
import { handleRequest as handleContaCorrenteRequest } from "./routes/handleContaCorrente";
import { handleRequest as handlePlanoContaRequest } from "./routes/handlePlanoConta";
import { handleRequest as handleParametroRequest } from "./routes/handleParametro";
import { handleRequest as handlePessoaRequest } from "./routes/handlePessoa";


export default {
  async fetch(req: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    switch (true) {
      case  pathname.startsWith("/api/bancos"):
        return handleBancoRequest(req, env.DB);
      case  pathname.startsWith("/api/contas"):
        return handleContaCorrenteRequest(req, env.DB);
      case pathname.startsWith("/api/planoContas"):
        return handlePlanoContaRequest(req, env.DB);
      case pathname.startsWith("/api/parametro"):
        return handleParametroRequest(req, env.DB);
        case pathname.startsWith("/api/pessoa"):
        return handlePessoaRequest(req, env.DB);
      default:
        return new Response("Rota não encontrada", { status: 404 });
  
    }
  },
};
