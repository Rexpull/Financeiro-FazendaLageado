import { MovimentoBancarioRepository } from "../repositories/MovimentoBancarioRepository";
import { MovimentoBancarioController } from "../controllers/MovimentoBancarioController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new MovimentoBancarioRepository(DB);
    const controller = new MovimentoBancarioController(repository);
    return controller.handleRequest(req);
}
