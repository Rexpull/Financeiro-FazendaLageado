export interface ContaCorrente {
    id: number;
    tipo: "cartao" | "contaCorrente";
    idBanco: number;
    agencia: string;
    numConta?: string;
    numCartao?: string; 
    dtValidadeCartao?: string;
    responsavel: string;
    observacao?: string; 
    ativo: boolean;

    bancoNome? : string;
  }
  