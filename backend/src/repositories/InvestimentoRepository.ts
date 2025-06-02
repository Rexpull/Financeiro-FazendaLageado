export class InvestimentoRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async getInvestimentosPorMes(ano: number) {
    try {
      const query = `
        SELECT 
          m.data,
          m.valor
        FROM movimentos_bancarios m
        JOIN plano_contas pc ON m.plano_conta_id = pc.id
        WHERE EXTRACT(YEAR FROM m.data) = $1
        AND pc.tipo = 'I'
        ORDER BY m.data
      `;

      const result = await this.db.prepare(query).bind(ano).all();
      return result.results;
    } catch (error) {
      console.error("Erro ao buscar investimentos por mês:", error);
      throw error;
    }
  }
} 