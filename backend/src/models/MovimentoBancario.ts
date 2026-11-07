import { Resultado } from "./Resultado";
import { MovimentoCentroCustos } from "./MovimentoCentroCustos";

export interface MovimentoBancario {
    id: number;
    dtMovimento: string;
    historico: string;
    idPlanoContas?: number;
    idContaCorrente: number;    
    idPessoa?: number;
    idBanco?: number;
    idCentroCustos?: number;
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
    idFinanciamento?: number;
    resultadoList?: Resultado[];
    centroCustosList?: MovimentoCentroCustos[];
    /** PUT only: "Limpar conciliação" — removes every plan and cost-centre split (also rateios) */
    limparConciliacao?: boolean;
    /** Line classified by a "memória de conciliação" on import (shows the "memória" tag); null after a manual change */
    idMemoriaConciliacao?: number | null;
    /** PUT only: true = remember this classification for the next imports of the conta; false = forget it */
    lembrarClassificacao?: boolean;
    /** PUT response only: what happened to the memory (saved, forgotten, or refused with the reason) */
    memoriaResultado?: { acao: 'salva' | 'esquecida' | 'recusada'; motivo?: string };
}
