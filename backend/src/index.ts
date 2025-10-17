import { handleRequest as handleBancoRequest } from "./routes/SetupRoutes";
import { handleRequest as handleContaCorrenteRequest } from "./routes/handleContaCorrente";
import { handleRequest as handlePlanoContaRequest } from "./routes/handlePlanoConta";
import { handleRequest as handleParametroRequest } from "./routes/handleParametro";
import { handleRequest as handlePessoaRequest } from "./routes/handlePessoa";
import { handleRequest as handleUsuarioRequest } from "./routes/handleUsuario";
import { handleRequest as handeMovimentoBancario } from "./routes/handeMovimentoBancario";
import { handleRequest as handleParcelaFinanciamento } from "./routes/handleParcelaFinanciamento";
import { handleRequest as handleFinanciamento } from "./routes/handleFinanciamento";
import { handleAuthRequest as handleAuthRequest } from "./routes/handleAuthRequest";
import { handleRequest as handleNotificacaoRequest } from "./routes/handleNotifications";
import { handleRequest as handleCentroCustosRequest } from "./routes/handleCentroCustos";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(req: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    switch (true) {
      case pathname.startsWith("/api/bancos"):
        return handleBancoRequest(req, env.DB);
      case pathname.startsWith("/api/contas"):
        return handleContaCorrenteRequest(req, env.DB);
      case pathname.startsWith("/api/planoContas"):
        return handlePlanoContaRequest(req, env.DB);
      case pathname.startsWith("/api/parametro"):
        return handleParametroRequest(req, env.DB);
      case pathname.startsWith("/api/pessoa"):
        return handlePessoaRequest(req, env.DB);
      case pathname.startsWith("/api/usuario"):
        return handleUsuarioRequest(req, env.DB);
      case pathname.startsWith("/api/movBancario"):
        return handeMovimentoBancario(req, env.DB);
      case pathname.startsWith("/api/fluxoCaixa"):
        return handeMovimentoBancario(req, env.DB);
      case pathname.startsWith("/api/centro-custos"):
        return handleCentroCustosRequest(req, env.DB);
      case pathname.startsWith("/api/parcelaFinanciamento"):
        return handleParcelaFinanciamento(req, env.DB);
      case pathname.startsWith("/api/financiamento"):
        return handleFinanciamento(req, env.DB);
      case pathname.startsWith("/api/notificacoes"):
        return handleNotificacaoRequest(req, env.DB);
      case pathname.startsWith("/api/historico-importacao-ofx"):
        return handleBancoRequest(req, env.DB);
      case pathname.startsWith("/api/auth"):
        return handleAuthRequest(req, env, env.DB);
      case pathname.startsWith("/api/dashboard"):
        {
          const { handleRequest } = await import("./routes/dashboardRoutes");
          return handleRequest(req, env.DB);
        }
      default:
        return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
    }
  },
};
