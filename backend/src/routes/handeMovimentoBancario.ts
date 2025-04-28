import { MovimentoBancarioRepository } from "../repositories/MovimentoBancarioRepository";
import { MovimentoBancarioController } from "../controllers/MovimentoBancarioController";
import { PlanoContaRepository } from "../repositories/PlanoContaRepository";
import { ParcelaFinanciamentoRepository } from "../repositories/ParcelaFinanciamentoRepository";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new MovimentoBancarioRepository(DB);
    const planoContaRepository = new PlanoContaRepository(DB)
    const parcelaFinanciamentoRepository = new ParcelaFinanciamentoRepository(DB);

    const controller = new MovimentoBancarioController(repository, planoContaRepository, parcelaFinanciamentoRepository);
    return controller.handleRequest(req);
}
