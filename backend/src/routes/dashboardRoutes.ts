import { DashboardRepository } from "../repositories/dashboardRepository";
import { DashboardService } from "../services/dashboardService";
import { DashboardController } from "../controllers/dashboardController";

export async function handleRequest(req: Request, DB: any): Promise<Response> {
  const repository = new DashboardRepository(DB);
  const service = new DashboardService(repository);
  const controller = new DashboardController(service);
  return controller.handleRequest(req);
} 