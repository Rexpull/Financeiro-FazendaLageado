import { ContaCorrenteRepository } from "../repositories/ContaCorrenteRepository";
import { ContaCorrenteController } from "../controllers/ContaCorrenteController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new ContaCorrenteRepository(DB);
    const controller = new ContaCorrenteController(repository);
    return controller.handleRequest(req);
}
