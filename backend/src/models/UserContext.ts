export interface UserContext {
    id: number;
    nome: string;
    usuario?: string;
    email: string;
    senha: string; // Senha criptografada
    ativo: boolean | number; // SQLite devolve 0/1
    token?: string; 
    foto_perfil?: string;
  }
  