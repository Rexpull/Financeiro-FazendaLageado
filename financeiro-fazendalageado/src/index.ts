import { handleRequest } from "./routes/SetupRoutes";

interface Env {
  DB: D1Database;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return handleRequest(req, env.DB);
  },
} satisfies ExportedHandler<Env>;
