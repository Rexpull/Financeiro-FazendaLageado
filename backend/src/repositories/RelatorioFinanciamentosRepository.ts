import { D1Database } from '@cloudflare/workers-types';
import {
  montarRelatorioFinanciamentos,
  hojeISO,
  type ContratoRow,
  type ParcelaRow,
  type FiltrosRelatorio,
  type RelatorioFinanciamentos,
} from '../utils/relatorioFinanciamentos';

export type {
  ContratoRelatorio as ContratoRelatorioFinanciamentos,
  RelatorioFinanciamentos,
} from '../utils/relatorioFinanciamentos';

export type FiltrosRelatorioFinanciamentos = FiltrosRelatorio;

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
          ALTER TABLE Financiamento ADD COLUMN modalidade TEXT CHECK(modalidade IN ('INVESTIMENTO', 'CUSTEIO', 'PARTICULAR', 'RENEGOCIACAO'))
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

  /**
   * Busca contratos e parcelas em 2 consultas (tabelas pequenas) e aplica as regras em
   * montarRelatorioFinanciamentos (visões ativos/contratados/liquidados/por tomador, filtros e gráficos).
   */
  async getRelatorioFinanciamentos(
    filtros: FiltrosRelatorioFinanciamentos,
    hoje: string = hojeISO(),
  ): Promise<RelatorioFinanciamentos> {
    await this.ensureColumnsExist();

    const [contratosResult, parcelasResult] = await Promise.all([
      this.db.prepare(`
        SELECT
          f.id,
          f.numeroContrato,
          f.responsavel,
          f.idBanco,
          f.dataContrato,
          f.valor,
          f.totalJuros,
          f.taxaJurosAnual,
          f.modalidade,
          f.nomeModalidadeParticular,
          f.numeroGarantia,
          b.nome AS banco,
          p.nome AS pessoa
        FROM Financiamento f
        LEFT JOIN Banco b ON f.idBanco = b.id
        LEFT JOIN Pessoa p ON f.idPessoa = p.id
      `).all<ContratoRow>(),
      this.db.prepare(`
        SELECT id, idFinanciamento, numParcela, valor, status, dt_vencimento, dt_liquidacao
        FROM parcelaFinanciamento
      `).all<ParcelaRow>(),
    ]);

    return montarRelatorioFinanciamentos(
      contratosResult.results ?? [],
      parcelasResult.results ?? [],
      filtros,
      hoje,
    );
  }
}
