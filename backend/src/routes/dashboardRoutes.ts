import { DashboardRepository } from "../repositories/dashboardRepository";
import { DashboardController } from "../controllers/dashboardController";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
  const repository = new DashboardRepository(DB);
  const controller = new DashboardController(repository);
  return controller.handleRequest(req);
} 