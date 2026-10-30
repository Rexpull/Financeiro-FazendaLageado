import { FinanciamentoRepository } from "../repositories/FinanciamentoRepository";
import { RenegociacaoRepository } from "../repositories/RenegociacaoRepository";
import { FinanciamentoController } from "../controllers/FinanciamentoController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new FinanciamentoRepository(DB);
    const controller = new FinanciamentoController(repository, new RenegociacaoRepository(DB));
    return controller.handleRequest(req);
}
