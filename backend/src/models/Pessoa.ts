export interface Pessoa {
    id: number;
    nome: string; 
    cgcpf?: string; 
    tipo: "fisica" | "juridica"; // Aceita apenas 'fisica' ou 'juridica'
    idReceita: number | null; // Opcional
    idDespesa: number | null; // Opcional
    dtCadastro: string;
    telefone?: string; // Opcional
    email?: string; // Opcional
    observacao?: string; // Opcional
    ativo: boolean;
    fornecedor: boolean;
    cliente: boolean;
  }
  