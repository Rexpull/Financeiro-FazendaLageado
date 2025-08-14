import { NotificacaoRepository } from "../repositories/notificacaoRepository";
import { NotificacaoController } from "../controllers/notificacaoController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new NotificacaoRepository(DB);
    const controller = new NotificacaoController(repository);
    return controller.handleRequest(req);
}
