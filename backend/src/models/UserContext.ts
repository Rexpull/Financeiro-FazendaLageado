export interface UserContext {
    id: number;
    nome: string;
    email: string;
    senha: string; // Senha criptografada
    ativo: boolean;
    token?: string; 
    foto_perfil?: string;
  }
  