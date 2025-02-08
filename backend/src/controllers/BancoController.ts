import { BancoService } from "../services/BancoService";

export class BancoController {
  private bancoService: BancoService;

  constructor(bancoService: BancoService) {
    this.bancoService = bancoService;
  }

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    try {
      if (req.method === "GET" && pathname === "/bancos") {
        const bancos = await this.bancoService.listarBancos();
        return Response.json(bancos);
      }

      if (req.method === "GET" && pathname.startsWith("/bancos/")) {
        const id = parseInt(pathname.split("/")[2]);
        const banco = await this.bancoService.buscarBanco(id);
        return banco ? Response.json(banco) : new Response("Banco não encontrado", { status: 404 });
      }

      if (req.method === "POST" && pathname === "/bancos") {
        const { nome, codigo }: { nome: string; codigo: string } = await req.json();
        await this.bancoService.criarBanco(nome, codigo);
        return new Response("Banco criado com sucesso", { status: 201 });
      }

      if (req.method === "PUT" && pathname.startsWith("/bancos/")) {
        const id = parseInt(pathname.split("/")[2]);
        const { nome, codigo }: { nome: string; codigo: string } = await req.json();
        await this.bancoService.atualizarBanco(id, nome, codigo);
        return new Response("Banco atualizado com sucesso", { status: 200 });
      }

      if (req.method === "DELETE" && pathname.startsWith("/bancos/")) {
        const id = parseInt(pathname.split("/")[2]);
        await this.bancoService.excluirBanco(id);
        return new Response("Banco excluído com sucesso", { status: 200 });
      }

      return new Response("Rota não encontrada", { status: 404 });
    } catch (error: any) {
      return new Response(error.message, { status: 500 });
    }
  }
}
