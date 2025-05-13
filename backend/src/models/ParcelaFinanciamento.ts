export interface ParcelaFinanciamento {
	id: number;
	idMovimentoBancario?: number | null;
	idFinanciamento: number;
  
	valor: number;
	status: 'Aberto' | 'Vencido' | 'Liquidado'; 
  
	numParcela: number;
	dt_lancamento: string;
	dt_vencimento: string;
	dt_liquidacao?: string | null;
}
  