import { D1Database } from '@cloudflare/workers-types';

export interface FiltrosRelatorioFinanciamentos {
  mesVencimento?: number;
  anoVencimento?: number;
  idBanco?: number;
  idPessoa?: number;
  numeroGarantia?: string;
  modalidade?: 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR';
  dataContratoInicio?: string;
  dataContratoFim?: string;
  faixaJuros?: string; // '<=8', '>8<=10', '>10<=12', '>12<=15', '>15'
  statusContrato?: 'ATIVO' | 'QUITADO' | 'NOVO';
}

export interface ItemRelatorioFinanciamentos {
  idFinanciamento: number;
  numeroContrato: string;
  responsavel: string;
  banco?: string;
  pessoa?: string;
  dataContrato: string;
  valorContrato: number;
  totalJuros: number;
  valorTotal: number;
  modalidade?: string;
  nomeModalidadeParticular?: string;
  numeroGarantia?: string;
  taxaJurosAnual?: number;
  statusContrato?: 'ATIVO' | 'QUITADO' | 'NOVO';
  parcelas: Array<{
    idParcela: number;
    numParcela: number;
    valor: number;
    dt_vencimento: string;
    status: string;
    dt_liquidacao?: string;
  }>;
}

export interface TotalizadoresRelatorioFinanciamentos {
  totalContratos: number;
  totalValorContratos: number;
  totalJuros: number;
  totalValorParcelas: number;
  totalParcelas: number;
  totalParcelasLiquidadas: number;
  totalParcelasAberto: number;
  totalParcelasVencidas: number;
}

export class RelatorioFinanciamentosRepository {
  constructor(private db: D1Database) {}

  private async ensureColumnsExist(): Promise<void> {
    try {
      const { results } = await this.db.prepare(`
        PRAGMA table_info(Financiamento)
      `).all();

      const columns = results.map((r: any) => r.name);
      const needsModalidade = !columns.includes('modalidade');
      const needsNomeModalidadeParticular = !columns.includes('nomeModalidadeParticular');

      if (needsModalidade) {
        await this.db.prepare(`
          ALTER TABLE Financiamento ADD COLUMN modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR'))
        `).run();
      }

      if (needsNomeModalidadeParticular) {
        await this.db.prepare(`
          ALTER TABLE Financiamento ADD COLUMN nomeModalidadeParticular TEXT
        `).run();
      }
    } catch (error) {
      console.error('❌ Erro ao verificar/criar colunas do Financiamento:', error);
    }
  }

  async getRelatorioFinanciamentos(filtros: FiltrosRelatorioFinanciamentos): Promise<{
    itens: ItemRelatorioFinanciamentos[];
    totalizadores: TotalizadoresRelatorioFinanciamentos;
    graficos: {
      mensais: Array<{ mes: string; novos: number; liquidados: number }>;
      anuais: Array<{ ano: number; novos: number; liquidados: number }>;
    };
  }> {
    await this.ensureColumnsExist();

    let whereConditions: string[] = [];
    let params: any[] = [];
    let joinParcela = false;

    // Filtro por mês de vencimento da parcela
    if (filtros.mesVencimento) {
      joinParcela = true;
      whereConditions.push(`CAST(strftime('%m', pf.dt_vencimento) AS INTEGER) = ?`);
      params.push(filtros.mesVencimento);
    }

    // Filtro por ano de vencimento da parcela
    if (filtros.anoVencimento) {
      if (!joinParcela) joinParcela = true;
      whereConditions.push(`CAST(strftime('%Y', pf.dt_vencimento) AS INTEGER) = ?`);
      params.push(filtros.anoVencimento);
    }

    // Filtro por banco
    if (filtros.idBanco) {
      whereConditions.push(`f.idBanco = ?`);
      params.push(filtros.idBanco);
    }

    // Filtro por tomador (pessoa)
    if (filtros.idPessoa) {
      whereConditions.push(`f.idPessoa = ?`);
      params.push(filtros.idPessoa);
    }

    // Filtro por garantia
    if (filtros.numeroGarantia) {
      whereConditions.push(`f.numeroGarantia LIKE ?`);
      params.push(`%${filtros.numeroGarantia}%`);
    }

    // Filtro por modalidade
    if (filtros.modalidade) {
      whereConditions.push(`f.modalidade = ?`);
      params.push(filtros.modalidade);
    }

    // Filtro por data de contratação
    if (filtros.dataContratoInicio) {
      whereConditions.push(`DATE(f.dataContrato) >= DATE(?)`);
      params.push(filtros.dataContratoInicio);
    }

    if (filtros.dataContratoFim) {
      whereConditions.push(`DATE(f.dataContrato) <= DATE(?)`);
      params.push(filtros.dataContratoFim);
    }

    // Filtro por faixa de juros
    if (filtros.faixaJuros) {
      switch (filtros.faixaJuros) {
        case '<=8':
          whereConditions.push(`(f.taxaJurosAnual IS NULL OR f.taxaJurosAnual <= 8)`);
          break;
        case '>8<=10':
          whereConditions.push(`f.taxaJurosAnual > 8 AND f.taxaJurosAnual <= 10`);
          break;
        case '>10<=12':
          whereConditions.push(`f.taxaJurosAnual > 10 AND f.taxaJurosAnual <= 12`);
          break;
        case '>12<=15':
          whereConditions.push(`f.taxaJurosAnual > 12 AND f.taxaJurosAnual <= 15`);
          break;
        case '>15':
          whereConditions.push(`f.taxaJurosAnual > 15`);
          break;
      }
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const joinClause = joinParcela 
      ? `LEFT JOIN parcelaFinanciamento pf ON f.id = pf.idFinanciamento`
      : '';

    // Query principal para buscar financiamentos e parcelas
    const query = `
      SELECT DISTINCT
        f.id as idFinanciamento,
        f.numeroContrato,
        f.responsavel,
        f.dataContrato,
        f.valor as valorContrato,
        COALESCE(f.totalJuros, 0) as totalJuros,
        f.valor + COALESCE(f.totalJuros, 0) as valorTotal,
        f.modalidade,
        f.nomeModalidadeParticular,
        f.numeroGarantia,
        f.taxaJurosAnual,
        b.nome as banco,
        p.nome as pessoa
      FROM Financiamento f
      LEFT JOIN Banco b ON f.idBanco = b.id
      LEFT JOIN Pessoa p ON f.idPessoa = p.id
      ${joinClause}
      ${whereClause}
      ORDER BY f.dataContrato DESC, f.numeroContrato
    `;

    const financiamentosResult = await this.db.prepare(query).bind(...params).all();
    
    // Usar Map para evitar duplicatas por idFinanciamento
    const financiamentosMap = new Map<number, any>();
    for (const row of financiamentosResult.results as any[]) {
      if (!financiamentosMap.has(row.idFinanciamento)) {
        financiamentosMap.set(row.idFinanciamento, row);
      }
    }
    
    // Buscar parcelas para cada financiamento
    const itens: ItemRelatorioFinanciamentos[] = [];
    
    for (const row of financiamentosMap.values()) {
      const parcelasQuery = `
        SELECT 
          id as idParcela,
          numParcela,
          valor,
          dt_vencimento,
          status,
          dt_liquidacao
        FROM parcelaFinanciamento
        WHERE idFinanciamento = ?
        ORDER BY numParcela
      `;
      
      const parcelasResult = await this.db.prepare(parcelasQuery).bind(row.idFinanciamento).all();
      
      // Aplicar filtros de vencimento nas parcelas se necessário
      let parcelas = parcelasResult.results as any[];
      
      if (filtros.mesVencimento || filtros.anoVencimento) {
        parcelas = parcelas.filter(p => {
          const dtVenc = new Date(p.dt_vencimento);
          if (filtros.mesVencimento && dtVenc.getMonth() + 1 !== filtros.mesVencimento) {
            return false;
          }
          if (filtros.anoVencimento && dtVenc.getFullYear() !== filtros.anoVencimento) {
            return false;
          }
          return true;
        });
      }

      // Calcular status do contrato baseado nas parcelas
      const temParcelasAbertas = parcelas.some(p => p.status !== 'Liquidado');
      let statusContrato: 'ATIVO' | 'QUITADO' | 'NOVO' = temParcelasAbertas ? 'ATIVO' : 'QUITADO';
      
      // Verificar se é um contrato novo (criado no período filtrado)
      if (filtros.dataContratoInicio || filtros.dataContratoFim) {
        const dataContrato = new Date(row.dataContrato);
        const dataInicio = filtros.dataContratoInicio ? new Date(filtros.dataContratoInicio) : null;
        const dataFim = filtros.dataContratoFim ? new Date(filtros.dataContratoFim) : null;
        
        const dentroDoPeriodo = (!dataInicio || dataContrato >= dataInicio) && 
                                (!dataFim || dataContrato <= dataFim);
        
        if (dentroDoPeriodo && statusContrato === 'ATIVO') {
          statusContrato = 'NOVO';
        }
      }

      // Aplicar filtro por statusContrato se especificado
      if (filtros.statusContrato) {
        if (filtros.statusContrato === 'NOVO') {
          // Para NOVO, verificar se foi criado no período
          const dataContrato = new Date(row.dataContrato);
          const dataInicio = filtros.dataContratoInicio ? new Date(filtros.dataContratoInicio) : null;
          const dataFim = filtros.dataContratoFim ? new Date(filtros.dataContratoFim) : null;
          
          const dentroDoPeriodo = (!dataInicio || dataContrato >= dataInicio) && 
                                  (!dataFim || dataContrato <= dataFim);
          
          if (!dentroDoPeriodo || !temParcelasAbertas) {
            return; // Pular este item se não for NOVO
          }
        } else if (filtros.statusContrato !== statusContrato) {
          return; // Pular este item se o status não corresponder
        }
      }

      itens.push({
        idFinanciamento: row.idFinanciamento,
        numeroContrato: row.numeroContrato,
        responsavel: row.responsavel,
        banco: row.banco || undefined,
        pessoa: row.pessoa || undefined,
        dataContrato: row.dataContrato,
        valorContrato: row.valorContrato,
        totalJuros: row.totalJuros || 0,
        valorTotal: row.valorTotal,
        modalidade: row.modalidade || undefined,
        nomeModalidadeParticular: row.nomeModalidadeParticular || undefined,
        numeroGarantia: row.numeroGarantia || undefined,
        taxaJurosAnual: row.taxaJurosAnual || undefined,
        statusContrato: statusContrato,
        parcelas: parcelas.map(p => ({
          idParcela: p.idParcela,
          numParcela: p.numParcela,
          valor: p.valor,
          dt_vencimento: p.dt_vencimento,
          status: p.status,
          dt_liquidacao: p.dt_liquidacao || undefined
        }))
      });
    }

    // Calcular totalizadores
    const totalizadores: TotalizadoresRelatorioFinanciamentos = {
      totalContratos: itens.length,
      totalValorContratos: itens.reduce((sum, item) => sum + item.valorContrato, 0),
      totalJuros: itens.reduce((sum, item) => sum + item.totalJuros, 0),
      totalValorParcelas: itens.reduce((sum, item) => 
        sum + item.parcelas.reduce((pSum, p) => pSum + p.valor, 0), 0),
      totalParcelas: itens.reduce((sum, item) => sum + item.parcelas.length, 0),
      totalParcelasLiquidadas: itens.reduce((sum, item) => 
        sum + item.parcelas.filter(p => p.status === 'Liquidado').length, 0),
      totalParcelasAberto: itens.reduce((sum, item) => 
        sum + item.parcelas.filter(p => p.status === 'Aberto').length, 0),
      totalParcelasVencidas: itens.reduce((sum, item) => 
        sum + item.parcelas.filter(p => p.status === 'Vencido').length, 0)
    };

    // Calcular gráficos mensais e anuais
    const graficos = await this.calcularGraficos(filtros);

    return {
      itens,
      totalizadores,
      graficos
    };
  }

  private async calcularGraficos(filtros: FiltrosRelatorioFinanciamentos): Promise<{
    mensais: Array<{ mes: string; novos: number; quitados: number; ativos: number }>;
    anuais: Array<{ ano: number; novos: number; quitados: number; ativos: number }>;
  }> {
    // Buscar todos os contratos com informações de parcelas
    const queryTodosContratos = `
      SELECT 
        f.id,
        f.valor,
        f.dataContrato,
        MAX(CASE WHEN pf.status = 'Liquidado' THEN pf.dt_liquidacao END) as dt_quitacao,
        COUNT(CASE WHEN pf.status != 'Liquidado' THEN 1 END) as parcelasNaoLiquidadas,
        COUNT(pf.id) as totalParcelas
      FROM Financiamento f
      LEFT JOIN parcelaFinanciamento pf ON f.id = pf.idFinanciamento
      GROUP BY f.id, f.valor, f.dataContrato
    `;
    
    const todosContratosResult = await this.db.prepare(queryTodosContratos).all();
    
    const mensaisMap = new Map<string, { novos: number; quitados: number; ativos: number }>();
    const anuaisMap = new Map<number, { novos: number; quitados: number; ativos: number }>();
    
    // Processar cada contrato
    for (const row of todosContratosResult.results as any[]) {
      const dataContrato = new Date(row.dataContrato);
      const mesContrato = `${String(dataContrato.getMonth() + 1).padStart(2, '0')}/${dataContrato.getFullYear()}`;
      const anoContrato = dataContrato.getFullYear();
      
      const temParcelasAbertas = (row.parcelasNaoLiquidadas || 0) > 0;
      const temParcelas = (row.totalParcelas || 0) > 0;
      const estaQuitado = temParcelas && !temParcelasAbertas;
      
      // Mensais
      if (!mensaisMap.has(mesContrato)) {
        mensaisMap.set(mesContrato, { novos: 0, quitados: 0, ativos: 0 });
      }
      const mensal = mensaisMap.get(mesContrato)!;
      
      // Contrato novo (criado neste mês)
      mensal.novos += row.valor || 0;
      
      if (estaQuitado && row.dt_quitacao) {
        // Contrato quitado - adicionar ao mês de quitação
        const dataQuitacao = new Date(row.dt_quitacao);
        const mesQuitacao = `${String(dataQuitacao.getMonth() + 1).padStart(2, '0')}/${dataQuitacao.getFullYear()}`;
        
        if (!mensaisMap.has(mesQuitacao)) {
          mensaisMap.set(mesQuitacao, { novos: 0, quitados: 0, ativos: 0 });
        }
        const mensalQuitacao = mensaisMap.get(mesQuitacao)!;
        mensalQuitacao.quitados += row.valor || 0;
      } else if (temParcelasAbertas) {
        // Contrato ativo - adicionar ao mês de contrato
        mensal.ativos += row.valor || 0;
      }
      
      // Anuais
      if (!anuaisMap.has(anoContrato)) {
        anuaisMap.set(anoContrato, { novos: 0, quitados: 0, ativos: 0 });
      }
      const anual = anuaisMap.get(anoContrato)!;
      
      // Contrato novo (criado neste ano)
      anual.novos += row.valor || 0;
      
      if (estaQuitado && row.dt_quitacao) {
        // Contrato quitado - adicionar ao ano de quitação
        const anoQuitacao = new Date(row.dt_quitacao).getFullYear();
        
        if (!anuaisMap.has(anoQuitacao)) {
          anuaisMap.set(anoQuitacao, { novos: 0, quitados: 0, ativos: 0 });
        }
        const anualQuitacao = anuaisMap.get(anoQuitacao)!;
        anualQuitacao.quitados += row.valor || 0;
      } else if (temParcelasAbertas) {
        // Contrato ativo - adicionar ao ano de contrato
        anual.ativos += row.valor || 0;
      }
    }
    
    const mensais = Array.from(mensaisMap.entries())
      .map(([mes, valores]) => ({ mes, ...valores }))
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
      })
      .slice(0, 12);
    
    const anuais = Array.from(anuaisMap.entries())
      .map(([ano, valores]) => ({ ano, ...valores }))
      .sort((a, b) => b.ano - a.ano);

    return { mensais, anuais };
  }
}

