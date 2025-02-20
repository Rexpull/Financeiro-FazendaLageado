import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { UsuarioController } from "../controllers/UsuarioController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new UsuarioRepository(DB);
    const controller = new UsuarioController(repository);
    return controller.handleRequest(req);
}
