import { Resultado } from "./Resultado";

export interface MovimentoBancario {
    id: number;
    dtMovimento: string;
    historico: string;
    idPlanoContas?: number;
    idContaCorrente: number;    
    idPessoa?: number;
    idBanco?: number;
    valor: number;
    saldo: number;
    ideagro: boolean;
    parcelado: boolean;
    numeroDocumento?: string;
    descricao?: string;
    transfOrigem?: number | null;
    transfDestino?: number | null;
    identificadorOfx: string;
    criadoEm: string;
    atualizadoEm: string;
    idUsuario?: number;
    tipoMovimento?: "C" | "D";
	modalidadeMovimento?: "padrao" | "financiamento" | "transferencia";


    resultadoList?: Resultado[]; 
}
