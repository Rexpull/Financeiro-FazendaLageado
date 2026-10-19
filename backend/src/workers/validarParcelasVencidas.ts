/**
 * Cron: marks past-due parcelas (not Liquidado) as Vencido.
 * Single UPDATE touching only `status`, so it cannot overwrite a liquidação made
 * while the job runs and stays within D1's per-invocation query limit.
 * Dates are compared as UTC calendar days (same as the previous per-row version).
 */
export async function validarParcelasVencidas(db: D1Database) {
    try {
        const { meta } = await db.prepare(`
            UPDATE parcelaFinanciamento
            SET status = 'Vencido'
            WHERE status NOT IN ('Liquidado', 'Vencido')
              AND date(dt_vencimento) < date('now')
        `).run();

        console.log(`Validação de parcelas vencidas concluída em ${new Date().toISOString()}: ${meta.changes} parcela(s) marcada(s) como Vencido`);
    } catch (error) {
        console.error('Erro ao validar parcelas vencidas:', error);
        throw error;
    }
}
