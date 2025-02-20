export interface Usuario {
    id: number;
    nome: string;
    usuario: string; // Nome de usuário para login
    email: string;
    senha: string;
    ativo: boolean;
    cpfCnpj?: string;
    telefone?: string;
    fotoPerfil?: string; // Base64 da foto de perfil
    dtCadastro: string;
}
