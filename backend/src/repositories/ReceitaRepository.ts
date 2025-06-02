import { Database } from "../database";

export class ReceitaRepository {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async getReceitasPorMes(ano: number) {
    try {
      const query = `
        SELECT 
          m.data,
          m.valor
        FROM movimentos_bancarios m
        JOIN plano_contas pc ON m.plano_conta_id = pc.id
        WHERE EXTRACT(YEAR FROM m.data) = $1
        AND pc.tipo = 'R'
        ORDER BY m.data
      `;

      const result = await this.db.prepare(query).bind(ano).all();
      return result.results;
    } catch (error) {
      console.error("Erro ao buscar receitas por mês:", error);
      throw error;
    }
  }
} 