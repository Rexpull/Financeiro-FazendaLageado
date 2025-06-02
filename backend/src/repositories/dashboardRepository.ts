export interface DashboardTotais {
  receitas: number;
  despesas: number;
  investimentos: number;
  financiamentos: {
    contratosAtivos: number;
    totalFinanciado: number;
    totalQuitado: number;
    totalEmAberto: number;
  };
}

export class DashboardRepository {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  private validarAno(ano: number) {
    if (!ano || isNaN(ano) || ano < 2000 || ano > 2100) {
      throw new Error("Ano inválido");
    }
  }

  async getTotaisAno(ano: number): Promise<DashboardTotais> {
    this.validarAno(ano);
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN pc.tipo = 'R' THEN m.valor ELSE 0 END), 0) as receitas,
        COALESCE(SUM(CASE WHEN pc.tipo = 'D' THEN m.valor ELSE 0 END), 0) as despesas,
        COALESCE(SUM(CASE WHEN pc.tipo = 'I' THEN m.valor ELSE 0 END), 0) as investimentos
      FROM movimentos_bancarios m
      JOIN plano_contas pc ON m.plano_conta_id = pc.id
      WHERE EXTRACT(YEAR FROM m.data) = ?
    `;
    const result = await this.db.prepare(query).bind(ano).first();

    const queryFin = `
      SELECT 
        COUNT(*) as contratosAtivos,
        COALESCE(SUM(valor_total),0) as totalFinanciado,
        COALESCE(SUM(valor_quitado),0) as totalQuitado,
        COALESCE(SUM(valor_total - valor_quitado),0) as totalEmAberto
      FROM Financiamento
      WHERE EXTRACT(YEAR FROM dataContrato) = ?
    `;
    const fin = await this.db.prepare(queryFin).bind(ano).first();

    return {
      receitas: result.receitas,
      despesas: result.despesas,
      investimentos: result.investimentos,
      financiamentos: {
        contratosAtivos: fin.contratosAtivos,
        totalFinanciado: fin.totalFinanciado,
        totalQuitado: fin.totalQuitado,
        totalEmAberto: fin.totalEmAberto,
      },
    };
  }

  async getReceitasDespesasPorMes(ano: number) {
    this.validarAno(ano);
    const query = `
      SELECT 
        EXTRACT(MONTH FROM m.data) as mes,
        SUM(CASE WHEN pc.tipo = 'R' THEN m.valor ELSE 0 END) as receitas,
        SUM(CASE WHEN pc.tipo = 'D' THEN m.valor ELSE 0 END) as despesas
      FROM movimentos_bancarios m
      JOIN plano_contas pc ON m.plano_conta_id = pc.id
      WHERE EXTRACT(YEAR FROM m.data) = ?
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    const receitas = Array(12).fill(0);
    const despesas = Array(12).fill(0);
    result.results.forEach((row: any) => {
      const idx = row.mes - 1;
      receitas[idx] = row.receitas;
      despesas[idx] = row.despesas;
    });
    return {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      receitas,
      despesas,
    };
  }

  async getInvestimentosPorMes(ano: number) {
    this.validarAno(ano);
    const query = `
      SELECT 
        EXTRACT(MONTH FROM m.data) as mes,
        SUM(m.valor) as valor
      FROM movimentos_bancarios m
      JOIN plano_contas pc ON m.plano_conta_id = pc.id
      WHERE EXTRACT(YEAR FROM m.data) = ?
      AND pc.tipo = 'I'
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    const values = Array(12).fill(0);
    result.results.forEach((row: any) => {
      const idx = row.mes - 1;
      values[idx] = row.valor;
    });
    return {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      values,
    };
  }

  async getFinanciamentosPorMes(ano: number) {
    this.validarAno(ano);
    const query = `
      SELECT 
        EXTRACT(MONTH FROM dataContrato) as mes,
        SUM(valor_quitado) as quitado,
        SUM(valor_total - valor_quitado) as emAberto
      FROM Financiamento
      WHERE EXTRACT(YEAR FROM dataContrato) = ?
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    const quitado = Array(12).fill(0);
    const emAberto = Array(12).fill(0);
    result.results.forEach((row: any) => {
      const idx = row.mes - 1;
      quitado[idx] = row.quitado;
      emAberto[idx] = row.emAberto;
    });
    return {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      quitado,
      emAberto,
    };
  }

  async getFinanciamentosPorCredor(ano: number) {
    this.validarAno(ano);
    const query = `
      SELECT 
        p.nome as credor,
        SUM(f.valor_total) as valor_total,
        SUM(f.valor_quitado) as valor_quitado,
        SUM(f.valor_total - f.valor_quitado) as valor_aberto
      FROM Financiamento f
      JOIN Pessoa p ON f.idPessoa = p.id
      WHERE EXTRACT(YEAR FROM f.dataContrato) = ?
      GROUP BY p.nome
      ORDER BY valor_total DESC
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    return {
      labels: result.results.map((row: any) => row.credor),
      values: result.results.map((row: any) => row.valor_total),
      quitados: result.results.map((row: any) => row.valor_quitado),
      emAberto: result.results.map((row: any) => row.valor_aberto),
    };
  }
} 