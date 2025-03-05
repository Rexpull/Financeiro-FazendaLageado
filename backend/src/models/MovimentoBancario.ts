export interface MovimentoBancario {
    id: number;
    dtMovimento: string; // Formatado como ISO String ou Date
    historico: string;
    idPlanoContas: number;
    idContaCorrente: number;
    valor: number;
    saldo: number;
    ideagro: boolean;
    numeroDocumento?: string; // Opcional
    descricao?: string; // Opcional
    transfOrigem?: number | null; // Referência a ContaCorrente (Transferência de saída)
    transfDestino?: number | null; // Referência a ContaCorrente (Transferência de entrada)
    identificadorOfx: string; // Garantia de unicidade do movimento no arquivo OFX
    criadoEm: string; // Formatado como ISO String ou Date
    atualizadoEm: string; // Formatado como ISO String ou Date
}
