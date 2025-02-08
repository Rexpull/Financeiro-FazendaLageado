export interface ContaCorrente {
    id: number;
    tipo: "cartao" | "contaCorrente"; // Aceita apenas 'cartao' ou 'contaCorrente'
    idBanco: number;
    agencia: string;
    numConta?: string; // Opcional
    numCartao?: string; // Opcional
    responsavel: string;
    observacao?: string; // Opcional
    ativo: boolean;
  }
  