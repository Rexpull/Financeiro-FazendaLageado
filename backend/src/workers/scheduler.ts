import { validarParcelasVencidas } from './validarParcelasVencidas';

export interface Env {
    DB: D1Database;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        // Executa a validação de parcelas vencidas
        await validarParcelasVencidas(env.DB);
    }
}; 