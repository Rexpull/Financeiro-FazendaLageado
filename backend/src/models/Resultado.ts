export interface Resultado{
    id?: number;
	dtMovimento: string;
	idPlanoContas: number;
	idContaCorrente: number;
	idMovimentoBancario?: number;
	idParcelaFinanciamento?: number;
	valor: number;
    tipo: "C" | "D";
}

