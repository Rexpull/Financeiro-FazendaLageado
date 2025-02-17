import { ParametroRepository } from "../repositories/ParametroRepository";
import { ParametroController } from "../controllers/ParametroController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new ParametroRepository(DB);
    const controller = new ParametroController(repository);
    return controller.handleRequest(req);
}
