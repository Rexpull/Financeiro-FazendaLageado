import { NotificacaoRepository } from "../repositories/notificacaoRepository";

export class NotificacaoController {
  private repository: NotificacaoRepository;

  constructor(repository: NotificacaoRepository) {
    this.repository = repository;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "GET" && path === "/api/notificacoes/conciliacao") {
      try {
        const notificacoes = await this.repository.getNotificacoesConciliacao();
        
        return new Response(JSON.stringify(notificacoes), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }
    }

    if (method === "GET" && path === "/api/notificacoes/total") {
      try {
        const total = await this.repository.getTotalNotificacoes();
        
        return new Response(JSON.stringify({ total }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
          }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
