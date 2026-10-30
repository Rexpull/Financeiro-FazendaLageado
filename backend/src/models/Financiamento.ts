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

  modalidade?: 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR' | 'RENEGOCIACAO' | null;
  nomeModalidadeParticular?: string | null;

  criadoEm?: string;
  atualizadoEm?: string;

  /** Contract this one came from (renegotiation as "novo contrato"). */
  idFinanciamentoOrigem?: number | null;

  // ---- read-only, filled by GET /api/financiamento (renegotiation history) ----
  /** Date this contract was closed as renegotiated into another contract (latest NOVO_CONTRATO). */
  renegociadoEm?: string | null;
  idFinanciamentoNovo?: number | null;
  numeroContratoNovo?: string | null;
  /** numeroContrato of idFinanciamentoOrigem. */
  numeroContratoOrigem?: string | null;
  /** Renegotiations of this contract (aditivos + novo contrato). */
  qtdRenegociacoes?: number;
  /** Date of the latest aditivo. */
  ultimoAditivoEm?: string | null;

  parcelasList?: ParcelaFinanciamento[];
}
