import { PessoaRepository } from "../repositories/PessoaRepository";
import { PessoaController } from "../controllers/PessoaController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new PessoaRepository(DB);
    const controller = new PessoaController(repository);
    return controller.handleRequest(req);
}
