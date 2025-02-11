import { PlanoContaRepository } from "../repositories/PlanoContaRepository";
import { PlanoContaController } from "../controllers/PlanoContaController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new PlanoContaRepository(DB);
    const controller = new PlanoContaController(repository);
    return controller.handleRequest(req);
}
