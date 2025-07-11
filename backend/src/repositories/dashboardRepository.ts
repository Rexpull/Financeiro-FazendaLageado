import { D1Database } from "@cloudflare/workers-types";

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
  private db: D1Database;

  constructor(db: D1Database) {
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
        COALESCE(SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '001%' THEN r.valor 
          ELSE 0 
        END), 0) as receitas,
        COALESCE(SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '002%' THEN r.valor 
          ELSE 0 
        END), 0) as despesas,
        COALESCE(SUM(CASE WHEN pc.tipo = 'investimento' THEN r.valor ELSE 0 END), 0) as investimentos
      FROM Resultado r
      JOIN planoContas pc ON r.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', r.dtMovimento) AS INTEGER) = ?
    `;
    const result = await this.db.prepare(query).bind(ano).first();
    const receitas = result && typeof result.receitas === 'number' ? result.receitas : 0;
    const despesas = result && typeof result.despesas === 'number' ? result.despesas : 0;
    const investimentos = result && typeof result.investimentos === 'number' ? result.investimentos : 0;

    const queryFin = `
      SELECT 
        COUNT(*) as contratosAtivos,
        COALESCE(SUM(valor),0) as totalFinanciado,
        0 as totalQuitado,
        COALESCE(SUM(valor),0) as totalEmAberto
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
    `;
    const fin = await this.db.prepare(queryFin).bind(ano).first();
    const contratosAtivos = fin && typeof fin.contratosAtivos === 'number' ? fin.contratosAtivos : 0;
    const totalFinanciado = fin && typeof fin.totalFinanciado === 'number' ? fin.totalFinanciado : 0;
    const totalEmAberto = fin && typeof fin.totalEmAberto === 'number' ? fin.totalEmAberto : 0;

    return {
      receitas,
      despesas,
      investimentos,
      financiamentos: {
        contratosAtivos,
        totalFinanciado,
        totalQuitado: 0,
        totalEmAberto,
      },
    };
  }

  async getTotaisMes(ano: number, mes: number, contas: number[]): Promise<{ receitas: number, despesas: number, investimentos: number }> {
    this.validarAno(ano);
    if (isNaN(mes) || mes < 1 || mes > 12) throw new Error("Mês inválido");
    const query = `
      SELECT 
        COALESCE(SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '001%' THEN r.valor 
          ELSE 0 
        END), 0) as receitas,
        COALESCE(SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '002%' THEN r.valor 
          ELSE 0 
        END), 0) as despesas,
        COALESCE(SUM(CASE WHEN pc.tipo = 'investimento' THEN r.valor ELSE 0 END), 0) as investimentos
      FROM Resultado r
      JOIN planoContas pc ON r.idPlanoContas = pc.id
      JOIN MovimentoBancario mb ON r.idMovimentoBancario = mb.id
      WHERE CAST(strftime('%Y', r.dtMovimento) AS INTEGER) = ?
        AND CAST(strftime('%m', r.dtMovimento) AS INTEGER) = ?
        AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})
    `;
    const result = await this.db.prepare(query).bind(ano, mes, ...contas).first();
    return {
      receitas: result && typeof result.receitas === 'number' ? result.receitas : 0,
      despesas: result && typeof result.despesas === 'number' ? result.despesas : 0,
      investimentos: result && typeof result.investimentos === 'number' ? result.investimentos : 0,
    };
  }

  async getReceitasDespesasPorMes(ano: number): Promise<{ labels: string[], receitas: number[], despesas: number[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CAST(strftime('%m', m.dtMovimento) AS INTEGER) as mes,
        SUM(CASE 
          WHEN pc.hierarquia LIKE '001%' THEN m.valor 
          ELSE 0 
        END) as receitas,
        SUM(CASE 
          WHEN pc.hierarquia LIKE '002%' THEN m.valor 
          ELSE 0 
        END) as despesas
      FROM MovimentoBancario m
      JOIN planoContas pc ON m.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', m.dtMovimento) AS INTEGER) = ?
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

  async getInvestimentosPorMes(ano: number): Promise<{ labels: string[], values: number[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CAST(strftime('%m', m.dtMovimento) AS INTEGER) as mes,
        SUM(m.valor) as valor
      FROM MovimentoBancario m
      JOIN planoContas pc ON m.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', m.dtMovimento) AS INTEGER) = ?
      AND pc.tipo = 'investimento'
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

  async getFinanciamentosPorMes(ano: number): Promise<{ labels: string[], quitado: number[], emAberto: number[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CAST(strftime('%m', dataContrato) AS INTEGER) as mes,
        0 as quitado,
        SUM(valor) as emAberto
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
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

  async getFinanciamentosPorCredor(ano: number): Promise<{ labels: string[], values: number[], quitados: number[], emAberto: number[], detalhamento: any[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        p.nome as credor,
        SUM(f.valor) as valor_total,
        0 as valor_quitado,
        SUM(f.valor) as valor_aberto
      FROM Financiamento f
      JOIN pessoa p ON f.idPessoa = p.id
      WHERE CAST(strftime('%Y', f.dataContrato) AS INTEGER) = ?
      GROUP BY p.nome
      ORDER BY valor_total DESC
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    
    // Buscar detalhamento
    const queryDetalhamento = `
      SELECT 
        p.nome as tomador,
        b.nome as banco,
        f.dataContrato as dataFinanciamento,
        f.valor,
        CASE WHEN f.numeroGarantia IS NOT NULL AND f.numeroGarantia != '' THEN 'Com Garantia' ELSE 'Sem Garantia' END as tipo
      FROM Financiamento f
      JOIN pessoa p ON f.idPessoa = p.id
      LEFT JOIN banco b ON f.idBanco = b.id
      WHERE CAST(strftime('%Y', f.dataContrato) AS INTEGER) = ?
      ORDER BY f.dataContrato DESC
    `;
    const detalhamento = await this.db.prepare(queryDetalhamento).bind(ano).all();
    
    return {
      labels: result.results.map((row: any) => row.credor),
      values: result.results.map((row: any) => row.valor_total),
      quitados: result.results.map((row: any) => row.valor_quitado),
      emAberto: result.results.map((row: any) => row.valor_aberto),
      detalhamento: detalhamento.results.map((row: any) => ({
        tomador: row.tomador,
        banco: row.banco || 'N/A',
        dataFinanciamento: row.dataFinanciamento,
        valor: row.valor,
        tipo: row.tipo
      }))
    };
  }

  async getFinanciamentosPorFaixaJuros(ano: number): Promise<{ labels: string[], values: any[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CASE 
          WHEN taxaJurosAnual <= 5 THEN 'Até 5%'
          WHEN taxaJurosAnual <= 10 THEN '5% a 10%'
          WHEN taxaJurosAnual <= 15 THEN '10% a 15%'
          WHEN taxaJurosAnual <= 20 THEN '15% a 20%'
          ELSE 'Acima de 20%'
        END as faixa,
        SUM(valor) as valor
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
      GROUP BY faixa
      ORDER BY valor DESC
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    return result.results.map((row: any) => ({
      faixa: row.faixa,
      valor: row.valor
    }));
  }

  async getFinanciamentosPorBanco(ano: number): Promise<{ labels: string[], values: any[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        b.nome,
        SUM(f.valor) as total,
        SUM(CASE WHEN f.numeroGarantia IS NOT NULL AND f.numeroGarantia != '' THEN f.valor ELSE 0 END) as comGarantia,
        SUM(CASE WHEN f.numeroGarantia IS NULL OR f.numeroGarantia = '' THEN f.valor ELSE 0 END) as semGarantia
      FROM Financiamento f
      LEFT JOIN banco b ON f.idBanco = b.id
      WHERE CAST(strftime('%Y', f.dataContrato) AS INTEGER) = ?
      GROUP BY b.nome
      ORDER BY total DESC
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    return result.results.map((row: any) => ({
      nome: row.nome || 'Banco não informado',
      total: row.total,
      comGarantia: row.comGarantia,
      semGarantia: row.semGarantia
    }));
  }

  async getParcelasFinanciamento(ano: number): Promise<{ labels: string[], pagas: number[], vencidas: number[], totalPagas: number, totalVencidas: number, detalhes: any[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CAST(strftime('%m', pf.dt_vencimento) AS INTEGER) as mes,
        SUM(CASE WHEN pf.status = 'P' THEN pf.valor ELSE 0 END) as pagas,
        SUM(CASE WHEN pf.status = 'V' THEN pf.valor ELSE 0 END) as vencidas
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      WHERE CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) = ?
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(ano).all();
    
    const pagas = Array(12).fill(0);
    const vencidas = Array(12).fill(0);
    result.results.forEach((row: any) => {
      const idx = row.mes - 1;
      pagas[idx] = row.pagas;
      vencidas[idx] = row.vencidas;
    });

    // Buscar totais
    const queryTotais = `
      SELECT 
        SUM(CASE WHEN pf.status = 'P' THEN pf.valor ELSE 0 END) as totalPagas,
        SUM(CASE WHEN pf.status = 'V' THEN pf.valor ELSE 0 END) as totalVencidas
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      WHERE CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) = ?
    `;
    const totais = await this.db.prepare(queryTotais).bind(ano).first();

    // Buscar detalhes
    const queryDetalhes = `
      SELECT 
        strftime('%m/%Y', pf.dt_vencimento) as mes,
        pf.valor,
        CASE 
          WHEN pf.status = 'P' THEN 'Paga'
          WHEN pf.status = 'V' THEN 'Vencida'
          ELSE 'Pendente'
        END as status
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      WHERE CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) = ?
      ORDER BY pf.dt_vencimento DESC
      LIMIT 50
    `;
    const detalhes = await this.db.prepare(queryDetalhes).bind(ano).all();

    return {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      pagas,
      vencidas,
      totalPagas: totais?.totalPagas || 0,
      totalVencidas: totais?.totalVencidas || 0,
      detalhes: detalhes.results.map((row: any) => ({
        mes: row.mes,
        valor: row.valor,
        status: row.status
      }))
    };
  }

  async getReceitasDespesas(ano: number, mes?: number): Promise<{ receitas: number[], despesas: number[], detalhamento: Array<{ descricao: string, valor: number, data: string, classificacao: string }> }> {
    this.validarAno(ano);
    
    let whereClause = "WHERE CAST(strftime('%Y', m.dtMovimento) AS INTEGER) = ?";
    let params = [ano];
    
    if (mes && mes >= 1 && mes <= 12) {
      whereClause += " AND CAST(strftime('%m', m.dtMovimento) AS INTEGER) = ?";
      params.push(mes);
    }
    
    const query = `
      SELECT 
        CAST(strftime('%m', m.dtMovimento) AS INTEGER) as mes,
        SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '001%' THEN m.valor 
          ELSE 0 
        END) as receitas,
        SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '002%' THEN m.valor 
          ELSE 0 
        END) as despesas
      FROM MovimentoBancario m
      JOIN planoContas pc ON m.idPlanoContas = pc.id
      ${whereClause}
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(...params).all();
    
    const receitas = Array(12).fill(0);
    const despesas = Array(12).fill(0);
    result.results.forEach((row: any) => {
      const idx = row.mes - 1;
      receitas[idx] = row.receitas;
      despesas[idx] = row.despesas;
    });

    // Buscar detalhamento com filtro de mês e ignorar movimentações (003%)
    let detalhamentoWhereClause = "WHERE CAST(strftime('%Y', m.dtMovimento) AS INTEGER) = ?";
    let detalhamentoParams = [ano];

    if (mes && mes >= 1 && mes <= 12) {
      detalhamentoWhereClause += " AND CAST(strftime('%m', m.dtMovimento) AS INTEGER) = ?";
      detalhamentoParams.push(mes);
    }

    const queryDetalhamento = `
      SELECT 
        pc.descricao,
        m.valor
      FROM MovimentoBancario m
      JOIN planoContas pc ON m.idPlanoContas = pc.id
      ${detalhamentoWhereClause}
      AND pc.hierarquia NOT LIKE '003%'
      ORDER BY m.dtMovimento DESC
      LIMIT 100
    `;
    const detalhamento = await this.db.prepare(queryDetalhamento).bind(...detalhamentoParams).all();

    return {
      receitas,
      despesas,
      detalhamento: detalhamento.results.map((row: any) => ({
        descricao: row.descricao,
        valor: row.valor
      }))
    };
  }
} 