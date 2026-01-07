import { RelatorioFinanciamentosController } from '../controllers/RelatorioFinanciamentosController';
import { RelatorioFinanciamentosRepository } from '../repositories/RelatorioFinanciamentosRepository';

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
  const repository = new RelatorioFinanciamentosRepository(DB);
  const controller = new RelatorioFinanciamentosController(repository);
  return await controller.handleRequest(req);
}

