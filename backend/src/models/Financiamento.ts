import { ParcelaFinanciamento } from './ParcelaFinanciamento';

export interface Financiamento {
  id: number;

  idBanco?: number | null;
  idPessoa?: number | null;

  responsavel: string;
  dataContrato: string;
  valor: number;

  taxaJurosAnual?: number | null;
  taxaJurosMensal?: number | null;

  numeroContrato: string;
  numeroGarantia?: string | null;
  observacao?: string | null;

  dataVencimentoPrimeiraParcela?: string | null;
  dataVencimentoUltimaParcela?: string | null;
  totalJuros?: number | null;

  criadoEm?: string;
  atualizadoEm?: string;

  parcelasList?: ParcelaFinanciamento[];
}
