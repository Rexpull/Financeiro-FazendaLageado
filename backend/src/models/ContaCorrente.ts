export interface ContaCorrente {
    id: number;
    tipo: "cartao" | "contaCorrente"; // Aceita apenas 'cartao' ou 'contaCorrente'
    idBanco: number;
    agencia: string;
    numConta?: string;
    numCartao?: string; 
    dtValidadeCartao?: string;
    responsavel: string;
    observacao?: string; // Opcional
    ativo: boolean;
  }
  