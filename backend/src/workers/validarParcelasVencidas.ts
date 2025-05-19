import { ParcelaFinanciamentoRepository } from '../repositories/ParcelaFinanciamentoRepository';

export async function validarParcelasVencidas(db: D1Database) {
    try {
        const repository = new ParcelaFinanciamentoRepository(db);
        
        // Busca todas as parcelas que não estão liquidadas
        const { results } = await db.prepare(`
            SELECT * FROM parcelaFinanciamento 
            WHERE status != 'Liquidado'
        `).all();

        const parcelas = results as ParcelaFinanciamento[];
        const dataAtual = new Date();
        dataAtual.setHours(0, 0, 0, 0);

        // Filtra e atualiza apenas as parcelas vencidas
        for (const parcela of parcelas) {
            const dataVencimento = new Date(parcela.dt_vencimento);
            dataVencimento.setHours(0, 0, 0, 0);

            if (dataVencimento < dataAtual) {
                await repository.update(parcela.id, {
                    ...parcela,
                    status: 'Vencido'
                });
            }
        }

        console.log(`Validação de parcelas vencidas concluída em ${new Date().toISOString()}`);
    } catch (error) {
        console.error('Erro ao validar parcelas vencidas:', error);
        throw error;
    }
} 