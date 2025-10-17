import { CentroCustosRepository } from "../repositories/CentroCustosRepository";
import { CentroCustosController } from "../controllers/CentroCustosController";
import { CentroCustosService } from "../services/CentroCustosService";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
  const repository = new CentroCustosRepository(DB);
  const service = new CentroCustosService(repository);
  const controller = new CentroCustosController(service);
  return controller.handleRequest(req);
}
