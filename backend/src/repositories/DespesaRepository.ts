export class DespesaRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getDespesasPorMes(ano: number) {
    try {
      const query = `
        SELECT 
          m.data,
          m.valor
        FROM movimentos_bancarios m
        JOIN plano_contas pc ON m.plano_conta_id = pc.id
        WHERE EXTRACT(YEAR FROM m.data) = $1
        AND pc.tipo = 'D'
        ORDER BY m.data
      `;

      const result = await this.db.prepare(query).bind(ano).all();
      return result.results;
    } catch (error) {
      console.error("Erro ao buscar despesas por mês:", error);
      throw error;
    }
  }
} 