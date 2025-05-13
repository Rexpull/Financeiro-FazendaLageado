import { FinanciamentoRepository } from "../repositories/FinanciamentoRepository";
import { FinanciamentoController } from "../controllers/FinanciamentoController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new FinanciamentoRepository(DB);
    const controller = new FinanciamentoController(repository);
    return controller.handleRequest(req);
}
