import { ParcelaFinanciamentoRepository } from "../repositories/ParcelaFinanciamentoRepository";
import { ParcelaFinanciamentoController } from "../controllers/ParcelaFinanciamentoController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new ParcelaFinanciamentoRepository(DB);
    const controller = new ParcelaFinanciamentoController(repository);
    return controller.handleRequest(req);
}
