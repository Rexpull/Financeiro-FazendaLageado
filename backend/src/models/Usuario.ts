export interface Usuario {
    id: number;
    nome: string;
    usuario: string; // Nome de usuário para login
    email: string;
    senha: string;
    ativo: boolean;
    cpf_cnpj?: string;
    telefone?: string;
    foto_perfil?: string; // Base64 da foto de perfil
    dt_cadastro: string;
}
