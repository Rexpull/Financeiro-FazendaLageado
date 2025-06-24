export interface ParcelaDetalhadaDTO {
    id: number;
    numParcela: number;
    valor: number;
    dt_vencimento: string;
    dt_liquidacao?: string | null;
    status: 'Aberto' | 'Vencido' | 'Liquidado';
}

export interface FinanciamentoDetalhadoDTO {
    id: number;
    numeroContrato: string;
    valorTotal: number;
    credor: string;
    parcelas: ParcelaDetalhadaDTO[];
} 