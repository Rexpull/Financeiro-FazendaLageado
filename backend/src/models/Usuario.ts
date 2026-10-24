export interface Usuario {
    id: number;
    nome: string;
    usuario: string; // Nome de usuário para login
    email: string;
    senha: string; // bcrypt hash — nunca é devolvido pela API (ver UsuarioPublico)
    ativo: boolean;
    cpf_cnpj?: string;
    telefone?: string;
    foto_perfil?: string; // Base64 da foto de perfil
    dt_cadastro: string;
}

/** Shape returned by GET /api/usuario: no `senha` hash, no session `token`. */
export type UsuarioPublico = Omit<Usuario, "senha">;
