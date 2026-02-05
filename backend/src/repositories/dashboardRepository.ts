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

  async getTotaisAno(ano: number, contas: number[] = []): Promise<DashboardTotais> {
    this.validarAno(ano);
    
    // Construir filtro de contas se fornecido
    let contasFilter = '';
    let queryParams: any[] = [ano];
    
    if (contas && contas.length > 0) {
      contasFilter = `AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})`;
      queryParams = [ano, ...contas];
    }
    
    // Usar MovimentoBancario diretamente para receitas e despesas (valores brutos)
    // Para investimentos, verificar se tem plano de contas com tipo = 'investimento'
    // Se tipoMovimento for NULL, usar o sinal do valor (positivo = crédito, negativo = débito)
    const query = `
      SELECT 
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'C' THEN mb.valor
          WHEN mb.tipoMovimento IS NULL AND mb.valor > 0 THEN mb.valor
          ELSE 0 
        END), 0) as receitas,
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'D' AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          WHEN mb.tipoMovimento IS NULL AND mb.valor < 0 AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          ELSE 0 
        END), 0) as despesas,
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'D' AND pc.tipo = 'investimento' THEN ABS(mb.valor)
          WHEN mb.tipoMovimento IS NULL AND mb.valor < 0 AND pc.tipo = 'investimento' THEN ABS(mb.valor)
          ELSE 0 
        END), 0) as investimentos
      FROM MovimentoBancario mb
      LEFT JOIN planoContas pc ON mb.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?
        ${contasFilter}
    `;
    const result = await this.db.prepare(query).bind(...queryParams).first();
    const receitas = result && typeof result.receitas === 'number' ? result.receitas : 0;
    const despesas = result && typeof result.despesas === 'number' ? result.despesas : 0;
    const investimentos = result && typeof result.investimentos === 'number' ? result.investimentos : 0;

    // Financiamentos: total contratado no ano
    const queryFin = `
      SELECT 
        COUNT(*) as contratosAtivos,
        COALESCE(SUM(valor),0) as totalFinanciado
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
    `;
    const fin = await this.db.prepare(queryFin).bind(ano).first();
    const contratosAtivos = fin && typeof fin.contratosAtivos === 'number' ? fin.contratosAtivos : 0;
    const totalFinanciado = fin && typeof fin.totalFinanciado === 'number' ? fin.totalFinanciado : 0;

    // Total quitado no ano: soma das parcelas com dt_liquidacao no ano
    const queryQuitado = `
      SELECT COALESCE(SUM(pf.valor), 0) as totalQuitado
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      WHERE pf.dt_liquidacao IS NOT NULL
        AND CAST(strftime('%Y', pf.dt_liquidacao) AS INTEGER) = ?
    `;
    const resQuitado = await this.db.prepare(queryQuitado).bind(ano).first();
    const totalQuitado = resQuitado && typeof resQuitado.totalQuitado === 'number' ? resQuitado.totalQuitado : 0;
    const totalEmAberto = Math.max(0, totalFinanciado - totalQuitado);

    return {
      receitas,
      despesas,
      investimentos,
      financiamentos: {
        contratosAtivos,
        totalFinanciado,
        totalQuitado,
        totalEmAberto,
      },
    };
  }

  async getTotaisMes(ano: number, mes: number, contas: number[]): Promise<{ receitas: number, despesas: number, investimentos: number, financiamentos: number }> {
    this.validarAno(ano);
    if (isNaN(mes) || mes < 1 || mes > 12) throw new Error("Mês inválido");
    
    // Construir filtro de contas
    let contasFilter = '';
    let queryParams: any[] = [ano, mes];
    
    if (contas && contas.length > 0) {
      contasFilter = `AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})`;
      queryParams = [ano, mes, ...contas];
    }
    
    // Usar MovimentoBancario diretamente para receitas e despesas (valores brutos)
    // Para investimentos, verificar se tem plano de contas com tipo = 'investimento'
    // Se tipoMovimento for NULL, usar o sinal do valor (positivo = crédito, negativo = débito)
    const query = `
      SELECT 
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'C' THEN mb.valor
          WHEN mb.tipoMovimento IS NULL AND mb.valor > 0 THEN mb.valor
          ELSE 0 
        END), 0) as receitas,
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'D' AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          WHEN mb.tipoMovimento IS NULL AND mb.valor < 0 AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          ELSE 0 
        END), 0) as despesas,
        COALESCE(SUM(CASE 
          WHEN mb.tipoMovimento = 'D' AND pc.tipo = 'investimento' THEN ABS(mb.valor)
          WHEN mb.tipoMovimento IS NULL AND mb.valor < 0 AND pc.tipo = 'investimento' THEN ABS(mb.valor)
          ELSE 0 
        END), 0) as investimentos
      FROM MovimentoBancario mb
      LEFT JOIN planoContas pc ON mb.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?
        AND CAST(strftime('%m', mb.dtMovimento) AS INTEGER) = ?
        ${contasFilter}
    `;
    const result = await this.db.prepare(query).bind(...queryParams).first();
    
    // Buscar financiamentos do mês específico
    const queryFin = `
      SELECT 
        COALESCE(SUM(valor),0) as totalFinanciado
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
        AND CAST(strftime('%m', dataContrato) AS INTEGER) = ?
    `;
    const fin = await this.db.prepare(queryFin).bind(ano, mes).first();
    const financiamentos = fin && typeof fin.totalFinanciado === 'number' ? fin.totalFinanciado : 0;
    
    return {
      receitas: result && typeof result.receitas === 'number' ? result.receitas : 0,
      despesas: result && typeof result.despesas === 'number' ? result.despesas : 0,
      investimentos: result && typeof result.investimentos === 'number' ? result.investimentos : 0,
      financiamentos,
    };
  }

  async getReceitasDespesasPorMes(ano: number, contas: number[] = []): Promise<{ labels: string[], receitas: number[], despesas: number[] }> {
    this.validarAno(ano);
    
    // Construir filtro de contas se fornecido
    let contasFilter = '';
    let queryParams: any[] = [ano];
    
    if (contas && contas.length > 0) {
      contasFilter = `AND mb.idContaCorrente IN (${contas.map(() => '?').join(',')})`;
      queryParams = [ano, ...contas];
    }
    
    // Usar MovimentoBancario diretamente para o gráfico mensal (valores brutos)
    // Se tipoMovimento for NULL, usar o sinal do valor (positivo = crédito, negativo = débito)
    const query = `
      SELECT 
        CAST(strftime('%m', mb.dtMovimento) AS INTEGER) as mes,
        SUM(CASE 
          WHEN mb.tipoMovimento = 'C' THEN mb.valor
          WHEN mb.tipoMovimento IS NULL AND mb.valor > 0 THEN mb.valor
          ELSE 0 
        END) as receitas,
        SUM(CASE 
          WHEN mb.tipoMovimento = 'D' AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          WHEN mb.tipoMovimento IS NULL AND mb.valor < 0 AND COALESCE(pc.tipo, '') != 'investimento' THEN ABS(mb.valor)
          ELSE 0 
        END) as despesas
      FROM MovimentoBancario mb
      LEFT JOIN planoContas pc ON mb.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?
        ${contasFilter}
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(...queryParams).all();
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

  async getInvestimentosPorMes(ano: number, contas: number[] = []): Promise<{ labels: string[], values: number[] }> {
    this.validarAno(ano);
    
    // Construir filtro de contas se fornecido
    let contasFilter = '';
    let queryParams: any[] = [ano];
    
    if (contas && contas.length > 0) {
      contasFilter = `AND m.idContaCorrente IN (${contas.map(() => '?').join(',')})`;
      queryParams = [ano, ...contas];
    }
    
    const query = `
      SELECT 
        CAST(strftime('%m', m.dtMovimento) AS INTEGER) as mes,
        SUM(m.valor) as valor
      FROM MovimentoBancario m
      JOIN planoContas pc ON m.idPlanoContas = pc.id
      WHERE CAST(strftime('%Y', m.dtMovimento) AS INTEGER) = ?
      AND pc.tipo = 'investimento'
      ${contasFilter}
      GROUP BY mes
      ORDER BY mes
    `;
    const result = await this.db.prepare(query).bind(...queryParams).all();
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
    // Quitado por mês: soma de pf.valor onde dt_liquidacao está no mês/ano
    const queryQuitado = `
      SELECT 
        CAST(strftime('%m', pf.dt_liquidacao) AS INTEGER) as mes,
        SUM(pf.valor) as valor_quitado
      FROM parcelaFinanciamento pf
      WHERE pf.dt_liquidacao IS NOT NULL
        AND CAST(strftime('%Y', pf.dt_liquidacao) AS INTEGER) = ?
      GROUP BY mes
      ORDER BY mes
    `;
    const resQuitado = await this.db.prepare(queryQuitado).bind(ano).all();
    const quitado = Array(12).fill(0);
    resQuitado.results.forEach((row: any) => {
      const idx = row.mes - 1;
      if (idx >= 0 && idx < 12) quitado[idx] = row.valor_quitado || 0;
    });

    // Em aberto por mês: ao fim de cada mês, saldo = contratos (até aquele mês) - parcelas liquidadas (até aquele mês)
    // Contratos no ano: valor total por mês de dataContrato (acumulado até o mês)
    const queryContratos = `
      SELECT 
        CAST(strftime('%m', dataContrato) AS INTEGER) as mes,
        SUM(valor) as valor_contratado
      FROM Financiamento
      WHERE CAST(strftime('%Y', dataContrato) AS INTEGER) = ?
      GROUP BY mes
      ORDER BY mes
    `;
    const resContratos = await this.db.prepare(queryContratos).bind(ano).all();
    const contratadoPorMes = Array(12).fill(0);
    resContratos.results.forEach((row: any) => {
      const idx = row.mes - 1;
      if (idx >= 0 && idx < 12) contratadoPorMes[idx] = row.valor_contratado || 0;
    });

    let acumuladoContratos = 0;
    let acumuladoQuitado = 0;
    const emAberto = Array(12).fill(0);
    for (let m = 0; m < 12; m++) {
      acumuladoContratos += contratadoPorMes[m];
      acumuladoQuitado += quitado[m];
      emAberto[m] = Math.max(0, acumuladoContratos - acumuladoQuitado);
    }

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
    return {
      labels: result.results.map((row: any) => row.faixa),
      values: result.results.map((row: any) => ({
        faixa: row.faixa,
        valor: row.valor
      }))
    };
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
    return {
      labels: result.results.map((row: any) => row.nome || 'Banco não informado'),
      values: result.results.map((row: any) => ({
        nome: row.nome || 'Banco não informado',
        total: row.total,
        comGarantia: row.comGarantia,
        semGarantia: row.semGarantia
      }))
    };
  }

  async getParcelasFinanciamento(ano: number): Promise<{ labels: string[], pagas: number[], vencidas: number[], totalPagas: number, totalVencidas: number, detalhes: any[] }> {
    this.validarAno(ano);
    const query = `
      SELECT 
        CAST(strftime('%m', pf.dt_vencimento) AS INTEGER) as mes,
        SUM(CASE WHEN pf.status = 'Liquidado' THEN pf.valor ELSE 0 END) as pagas,
        SUM(CASE WHEN pf.status = 'Vencido' THEN pf.valor ELSE 0 END) as vencidas
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
        SUM(CASE WHEN pf.status = 'Liquidado' THEN pf.valor ELSE 0 END) as totalPagas,
        SUM(CASE WHEN pf.status = 'Vencido' THEN pf.valor ELSE 0 END) as totalVencidas
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
          WHEN pf.status = 'Liquidado' THEN 'Paga'
          WHEN pf.status = 'Vencido' THEN 'Vencida'
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
      totalPagas: totais && typeof totais.totalPagas === 'number' ? totais.totalPagas : 0,
      totalVencidas: totais && typeof totais.totalVencidas === 'number' ? totais.totalVencidas : 0,
      detalhes: detalhes.results.map((row: any) => ({
        mes: row.mes,
        valor: row.valor,
        status: row.status
      }))
    };
  }

  async getReceitasDespesas(ano: number, mes?: number, contas: number[] = [], tipoAgrupamento: 'planos' | 'centros' = 'planos'): Promise<{ 
    receitas: number[], 
    despesas: number[], 
    detalhamento: Array<{ descricao: string, valor: number, data: string, classificacao: string }>,
    agrupadoPor: Array<{ descricao: string, valor: number, tipoMovimento: 'C' | 'D', conciliado: boolean }>,
    totalConciliado: number,
    totalSemConciliar: number,
    totalReceitas: number,
    totalDespesas: number
  }> {
    this.validarAno(ano);
    
    // Construir filtro de contas se fornecido
    let contasFilter = '';
    let contasParams: any[] = [];
    
    if (contas && contas.length > 0) {
      contasFilter = `JOIN MovimentoBancario mb ON r.idMovimentoBancario = mb.id`;
      contasParams = contas;
    }
    
    let whereClause = "WHERE";
    if (contas && contas.length > 0) {
      whereClause += ` mb.idContaCorrente IN (${contas.map(() => '?').join(',')}) AND`;
    }
    whereClause += " CAST(strftime('%Y', r.dtMovimento) AS INTEGER) = ?";
    let params = [...contasParams, ano];
    
    if (mes && mes >= 1 && mes <= 12) {
      whereClause += " AND CAST(strftime('%m', r.dtMovimento) AS INTEGER) = ?";
      params.push(mes);
    }
    
    const query = `
      SELECT 
        CAST(strftime('%m', r.dtMovimento) AS INTEGER) as mes,
        SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '001%' THEN r.valor 
          ELSE 0 
        END) as receitas,
        SUM(CASE 
          WHEN pc.tipo = 'investimento' THEN 0
          WHEN pc.hierarquia LIKE '002%' THEN r.valor 
          ELSE 0 
        END) as despesas
      FROM Resultado r
      JOIN planoContas pc ON r.idPlanoContas = pc.id
      ${contasFilter}
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
    let detalhamentoContasFilter = '';
    let detalhamentoContasParams: any[] = [];
    
    if (contas && contas.length > 0) {
      detalhamentoContasFilter = `JOIN MovimentoBancario mb ON r.idMovimentoBancario = mb.id`;
      detalhamentoContasParams = contas;
    }
    
    let detalhamentoWhereClause = "WHERE";
    if (contas && contas.length > 0) {
      detalhamentoWhereClause += ` mb.idContaCorrente IN (${contas.map(() => '?').join(',')}) AND`;
    }
    detalhamentoWhereClause += " CAST(strftime('%Y', r.dtMovimento) AS INTEGER) = ?";
    let detalhamentoParams = [...detalhamentoContasParams, ano];

    if (mes && mes >= 1 && mes <= 12) {
      detalhamentoWhereClause += " AND CAST(strftime('%m', r.dtMovimento) AS INTEGER) = ?";
      detalhamentoParams.push(mes);
    }
    detalhamentoWhereClause += " AND pc.hierarquia NOT LIKE '003%'";

    const queryDetalhamento = `
      SELECT 
        pc.descricao,
        r.valor,
        r.dtMovimento as data,
        pc.hierarquia as classificacao
      FROM Resultado r
      JOIN planoContas pc ON r.idPlanoContas = pc.id
      ${detalhamentoContasFilter}
      ${detalhamentoWhereClause}
      ORDER BY r.dtMovimento DESC
      LIMIT 100
    `;
    const detalhamento = await this.db.prepare(queryDetalhamento).bind(...detalhamentoParams).all();

    // Buscar dados agrupados por planos ou centros
    let agrupadoPor: Array<{ descricao: string, valor: number, tipoMovimento: 'C' | 'D', conciliado: boolean }> = [];
    let totalConciliado = 0;
    let totalSemConciliar = 0;
    let totalReceitas = 0;
    let totalDespesas = 0;

    if (tipoAgrupamento === 'planos') {
      // Agrupamento por Planos de Contas usando Resultado (rateio)
      let agrupamentoWhereClause = "WHERE";
      let agrupamentoParams: any[] = [];
      
      if (contas && contas.length > 0) {
        agrupamentoWhereClause += ` mb.idContaCorrente IN (${contas.map(() => '?').join(',')}) AND`;
        agrupamentoParams = [...contas];
      }
      
      agrupamentoWhereClause += " CAST(strftime('%Y', r.dtMovimento) AS INTEGER) = ?";
      agrupamentoParams.push(ano);

      if (mes && mes >= 1 && mes <= 12) {
        agrupamentoWhereClause += " AND CAST(strftime('%m', r.dtMovimento) AS INTEGER) = ?";
        agrupamentoParams.push(mes);
      }
      agrupamentoWhereClause += " AND pc.hierarquia NOT LIKE '003%'";

      const queryAgrupamento = `
        SELECT 
          pc.descricao,
          SUM(r.valor) as valor,
          mb.tipoMovimento,
          SUM(CASE 
            WHEN mb.tipoMovimento = 'C' THEN
              CASE 
                WHEN (mb.idCentroCustos IS NOT NULL OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc WHERE mcc.idMovimentoBancario = mb.id))
                THEN ABS(r.valor)
                ELSE 0 
              END
            WHEN mb.tipoMovimento = 'D' THEN
              CASE 
                WHEN mb.idPlanoContas IS NOT NULL 
                  AND (mb.idCentroCustos IS NOT NULL 
                       OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc WHERE mcc.idMovimentoBancario = mb.id))
                THEN ABS(r.valor)
                ELSE 0 
              END
            ELSE 0
          END) as valorConciliado
        FROM Resultado r
        JOIN planoContas pc ON r.idPlanoContas = pc.id
        JOIN MovimentoBancario mb ON r.idMovimentoBancario = mb.id
        ${agrupamentoWhereClause}
        GROUP BY pc.descricao, mb.tipoMovimento
        ORDER BY pc.descricao
      `;
      const agrupamentoResult = await this.db.prepare(queryAgrupamento).bind(...agrupamentoParams).all();
      
      agrupadoPor = agrupamentoResult.results.map((row: any) => {
        const valor = row.valor || 0;
        const valorConciliado = row.valorConciliado || 0;
        const valorTotal = Math.abs(valor);
        const conciliado = valorConciliado > 0 && Math.abs(valorConciliado) >= valorTotal * 0.99; // Considera conciliado se 99% ou mais está conciliado
        
        if (row.tipoMovimento === 'C') {
          totalReceitas += valorTotal;
        } else {
          totalDespesas += valorTotal;
        }
        
        if (conciliado) {
          totalConciliado += valorTotal;
        } else {
          totalSemConciliar += valorTotal;
        }
        
        return {
          descricao: row.descricao,
          valor: valorTotal,
          tipoMovimento: row.tipoMovimento as 'C' | 'D',
          conciliado
        };
      });
    } else {
      // Agrupamento por Centros de Custos usando MovimentoCentroCustos (rateio)
      let agrupamentoWhereClause = "WHERE";
      let agrupamentoParams: any[] = [];
      
      if (contas && contas.length > 0) {
        agrupamentoWhereClause += ` mb.idContaCorrente IN (${contas.map(() => '?').join(',')}) AND`;
        agrupamentoParams = [...contas];
      }
      
      agrupamentoWhereClause += " CAST(strftime('%Y', mb.dtMovimento) AS INTEGER) = ?";
      agrupamentoParams.push(ano);

      if (mes && mes >= 1 && mes <= 12) {
        agrupamentoWhereClause += " AND CAST(strftime('%m', mb.dtMovimento) AS INTEGER) = ?";
        agrupamentoParams.push(mes);
      }

      const queryAgrupamento = `
        SELECT 
          cc.descricao,
          SUM(mcc.valor) as valor,
          mb.tipoMovimento,
          SUM(CASE 
            WHEN mb.tipoMovimento = 'C' THEN
              CASE 
                WHEN (mb.idCentroCustos IS NOT NULL OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc2 WHERE mcc2.idMovimentoBancario = mb.id))
                THEN ABS(mcc.valor)
                ELSE 0 
              END
            WHEN mb.tipoMovimento = 'D' THEN
              CASE 
                WHEN mb.idPlanoContas IS NOT NULL 
                  AND (mb.idCentroCustos IS NOT NULL 
                       OR EXISTS (SELECT 1 FROM MovimentoCentroCustos mcc2 WHERE mcc2.idMovimentoBancario = mb.id))
                THEN ABS(mcc.valor)
                ELSE 0 
              END
            ELSE 0
          END) as valorConciliado
        FROM MovimentoCentroCustos mcc
        JOIN centroCustos cc ON mcc.idCentroCustos = cc.id
        JOIN MovimentoBancario mb ON mcc.idMovimentoBancario = mb.id
        ${agrupamentoWhereClause}
        GROUP BY cc.descricao, mb.tipoMovimento
        ORDER BY cc.descricao
      `;
      const agrupamentoResult = await this.db.prepare(queryAgrupamento).bind(...agrupamentoParams).all();
      
      agrupadoPor = agrupamentoResult.results.map((row: any) => {
        const valor = row.valor || 0;
        const valorConciliado = row.valorConciliado || 0;
        const valorTotal = Math.abs(valor);
        const conciliado = valorConciliado > 0 && Math.abs(valorConciliado) >= valorTotal * 0.99; // Considera conciliado se 99% ou mais está conciliado
        
        if (row.tipoMovimento === 'C') {
          totalReceitas += valorTotal;
        } else {
          totalDespesas += valorTotal;
        }
        
        if (conciliado) {
          totalConciliado += valorTotal;
        } else {
          totalSemConciliar += valorTotal;
        }
        
        return {
          descricao: row.descricao,
          valor: valorTotal,
          tipoMovimento: row.tipoMovimento as 'C' | 'D',
          conciliado
        };
      });
    }

    return {
      receitas,
      despesas,
      detalhamento: detalhamento.results.map((row: any) => ({
        descricao: row.descricao,
        valor: row.valor,
        data: row.data,
        classificacao: row.classificacao
      })),
      agrupadoPor,
      totalConciliado,
      totalSemConciliar,
      totalReceitas,
      totalDespesas
    };
  }

  // Novo método: Parcelas a vencer por mês/ano com visualização futura
  async getParcelasAVencer(ano?: number, mes?: number): Promise<{ 
    labels: string[], 
    valores: number[], 
    totalVencimento: number,
    detalhes: Array<{
      mes: string,
      ano: number,
      valor: number,
      quantidade: number,
      financiamentos: Array<{
        contrato: string,
        tomador: string,
        banco: string,
        valor: number,
        vencimento: string,
        modalidade: string,
        taxaJuros: number,
        garantia: string
      }>
    }>
  }> {
    let whereClause = "WHERE pf.status = 'Aberto' AND pf.dt_vencimento >= date('now')";
    let params: any[] = [];
    
    if (ano) {
      whereClause += " AND CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) = ?";
      params.push(ano);
    }
    
    if (mes) {
      whereClause += " AND CAST(strftime('%m', pf.dt_vencimento) AS INTEGER) = ?";
      params.push(mes);
    }

    const query = `
      SELECT 
        strftime('%m/%Y', pf.dt_vencimento) as mes_ano,
        CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) as ano,
        SUM(pf.valor) as valor_total,
        COUNT(*) as quantidade
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      ${whereClause}
      GROUP BY mes_ano, ano
      ORDER BY pf.dt_vencimento
    `;
    
    const result = await this.db.prepare(query).bind(...params).all();
    
    // Buscar detalhes das parcelas com informações completas para exportação
    const queryDetalhes = `
      SELECT 
        strftime('%m/%Y', pf.dt_vencimento) as mes_ano,
        CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) as ano,
        pf.valor,
        f.numeroContrato,
        p.nome as tomador,
        b.nome as banco,
        pf.dt_vencimento,
        f.taxaJurosAnual,
        f.numeroGarantia,
        'Parcela a Vencer' as modalidade
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      LEFT JOIN pessoa p ON f.idPessoa = p.id
      LEFT JOIN banco b ON f.idBanco = b.id
      ${whereClause}
      ORDER BY pf.dt_vencimento
    `;
    
    const detalhes = await this.db.prepare(queryDetalhes).bind(...params).all();
    
    // Agrupar detalhes por mês/ano
    const detalhesAgrupados = new Map<string, any>();
    detalhes.results.forEach((row: any) => {
      const key = row.mes_ano;
      if (!detalhesAgrupados.has(key)) {
        detalhesAgrupados.set(key, {
          mes: row.mes_ano,
          ano: row.ano,
          valor: 0,
          quantidade: 0,
          financiamentos: []
        });
      }
      
      const grupo = detalhesAgrupados.get(key);
      grupo.valor += row.valor;
      grupo.quantidade += 1;
      grupo.financiamentos.push({
        contrato: row.numeroContrato,
        tomador: row.tomador || 'N/A',
        banco: row.banco || 'N/A',
        valor: row.valor,
        vencimento: row.dt_vencimento,
        modalidade: row.modalidade,
        taxaJuros: row.taxaJurosAnual || 0,
        garantia: row.numeroGarantia || 'Sem Garantia'
      });
    });

    const labels = result.results.map((row: any) => row.mes_ano);
    const valores = result.results.map((row: any) => row.valor_total);
    const totalVencimento = valores.reduce((sum, val) => sum + val, 0);

    return {
      labels,
      valores,
      totalVencimento,
      detalhes: Array.from(detalhesAgrupados.values())
    };
  }

  // Novo método: Contratos liquidados por mês/ano
  async getContratosLiquidados(ano?: number, mes?: number): Promise<{
    labels: string[],
    valores: number[],
    totalLiquidado: number,
    detalhes: Array<{
      mes: string,
      ano: number,
      valor: number,
      quantidade: number,
      contratos: Array<{
        numero: string,
        tomador: string,
        banco: string,
        valor: number,
        dataLiquidacao: string,
        modalidade: string,
        taxaJuros: number,
        garantia: string
      }>
    }>
  }> {
    let whereClause = "WHERE pf.status = 'Liquidado' AND pf.dt_liquidacao IS NOT NULL";
    let params: any[] = [];
    
    if (ano) {
      whereClause += " AND CAST(strftime('%Y', pf.dt_liquidacao) AS INTEGER) = ?";
      params.push(ano);
    }
    
    if (mes) {
      whereClause += " AND CAST(strftime('%m', pf.dt_liquidacao) AS INTEGER) = ?";
      params.push(mes);
    }

    const query = `
      SELECT 
        strftime('%m/%Y', pf.dt_liquidacao) as mes_ano,
        CAST(strftime('%Y', pf.dt_liquidacao) AS INTEGER) as ano,
        SUM(pf.valor) as valor_total,
        COUNT(DISTINCT f.id) as quantidade_contratos
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      ${whereClause}
      GROUP BY mes_ano, ano
      ORDER BY pf.dt_liquidacao DESC
    `;
    
    const result = await this.db.prepare(query).bind(...params).all();
    
    // Buscar detalhes dos contratos liquidados com informações completas
    const queryDetalhes = `
      SELECT 
        strftime('%m/%Y', pf.dt_liquidacao) as mes_ano,
        CAST(strftime('%Y', pf.dt_liquidacao) AS INTEGER) as ano,
        f.numeroContrato,
        p.nome as tomador,
        b.nome as banco,
        f.valor,
        pf.dt_liquidacao,
        f.taxaJurosAnual,
        f.numeroGarantia,
        'Contrato Liquidado' as modalidade
      FROM parcelaFinanciamento pf
      JOIN Financiamento f ON pf.idFinanciamento = f.id
      LEFT JOIN pessoa p ON f.idPessoa = p.id
      LEFT JOIN banco b ON f.idBanco = b.id
      ${whereClause}
      ORDER BY pf.dt_liquidacao DESC
    `;
    
    const detalhes = await this.db.prepare(queryDetalhes).bind(...params).all();
    
    // Agrupar detalhes por mês/ano
    const detalhesAgrupados = new Map<string, any>();
    detalhes.results.forEach((row: any) => {
      const key = row.mes_ano;
      if (!detalhesAgrupados.has(key)) {
        detalhesAgrupados.set(key, {
          mes: row.mes_ano,
          ano: row.ano,
          valor: 0,
          quantidade: 0,
          contratos: []
        });
      }
      
      const grupo = detalhesAgrupados.get(key);
      grupo.valor += row.valor;
      grupo.quantidade += 1;
      grupo.contratos.push({
        numero: row.numeroContrato,
        tomador: row.tomador || 'N/A',
        banco: row.banco || 'N/A',
        valor: row.valor,
        dataLiquidacao: row.dt_liquidacao,
        modalidade: row.modalidade,
        taxaJuros: row.taxaJurosAnual || 0,
        garantia: row.numeroGarantia || 'Sem Garantia'
      });
    });

    const labels = result.results.map((row: any) => row.mes_ano);
    const valores = result.results.map((row: any) => row.valor_total);
    const totalLiquidado = valores.reduce((sum, val) => sum + val, 0);

    return {
      labels,
      valores,
      totalLiquidado,
      detalhes: Array.from(detalhesAgrupados.values())
    };
  }

  // Novo método: Contratos novos por mês/ano
  async getContratosNovos(ano?: number, mes?: number): Promise<{
    labels: string[],
    valores: number[],
    totalNovos: number,
    detalhes: Array<{
      mes: string,
      ano: number,
      valor: number,
      quantidade: number,
      contratos: Array<{
        numero: string,
        tomador: string,
        banco: string,
        valor: number,
        dataContrato: string,
        modalidade: string,
        taxaJuros: number,
        garantia: string,
        numeroParcelas: number
      }>
    }>
  }> {
    let whereClause = "WHERE 1=1";
    let params: any[] = [];
    
    if (ano) {
      whereClause += " AND CAST(strftime('%Y', f.dataContrato) AS INTEGER) = ?";
      params.push(ano);
    }
    
    if (mes) {
      whereClause += " AND CAST(strftime('%m', f.dataContrato) AS INTEGER) = ?";
      params.push(mes);
    }

    const query = `
      SELECT 
        strftime('%m/%Y', f.dataContrato) as mes_ano,
        CAST(strftime('%Y', f.dataContrato) AS INTEGER) as ano,
        SUM(f.valor) as valor_total,
        COUNT(*) as quantidade
      FROM Financiamento f
      ${whereClause}
      GROUP BY mes_ano, ano
      ORDER BY f.dataContrato DESC
    `;
    
    const result = await this.db.prepare(query).bind(...params).all();
    
    // Buscar detalhes dos contratos novos com informações completas
    const queryDetalhes = `
      SELECT 
        strftime('%m/%Y', f.dataContrato) as mes_ano,
        CAST(strftime('%Y', f.dataContrato) AS INTEGER) as ano,
        f.numeroContrato,
        p.nome as tomador,
        b.nome as banco,
        f.valor,
        f.dataContrato,
        f.taxaJurosAnual,
        f.numeroGarantia,
        'Contrato Novo' as modalidade,
        (SELECT COUNT(*) FROM parcelaFinanciamento pf WHERE pf.idFinanciamento = f.id) as numeroParcelas
      FROM Financiamento f
      LEFT JOIN pessoa p ON f.idPessoa = p.id
      LEFT JOIN banco b ON f.idBanco = b.id
      ${whereClause}
      ORDER BY f.dataContrato DESC
    `;
    
    const detalhes = await this.db.prepare(queryDetalhes).bind(...params).all();
    
    // Agrupar detalhes por mês/ano
    const detalhesAgrupados = new Map<string, any>();
    detalhes.results.forEach((row: any) => {
      const key = row.mes_ano;
      if (!detalhesAgrupados.has(key)) {
        detalhesAgrupados.set(key, {
          mes: row.mes_ano,
          ano: row.ano,
          valor: 0,
          quantidade: 0,
          contratos: []
        });
      }
      
      const grupo = detalhesAgrupados.get(key);
      grupo.valor += row.valor;
      grupo.quantidade += 1;
      grupo.contratos.push({
        numero: row.numeroContrato,
        tomador: row.tomador || 'N/A',
        banco: row.banco || 'N/A',
        valor: row.valor,
        dataContrato: row.dataContrato,
        modalidade: row.modalidade,
        taxaJuros: row.taxaJurosAnual || 0,
        garantia: row.numeroGarantia || 'Sem Garantia',
        numeroParcelas: row.numeroParcelas || 0
      });
    });

    const labels = result.results.map((row: any) => row.mes_ano);
    const valores = result.results.map((row: any) => row.valor_total);
    const totalNovos = valores.reduce((sum, val) => sum + val, 0);

    return {
      labels,
      valores,
      totalNovos,
      detalhes: Array.from(detalhesAgrupados.values())
    };
  }
} 