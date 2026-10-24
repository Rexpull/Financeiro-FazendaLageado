import bcrypt from "bcryptjs";
import { SessionRepository } from "../repositories/SessionRepository";
import { UserContext } from "../models/UserContext";
import { SignJWT } from "jose";
import { JWT_ALG, JWT_EXPIRACAO, chaveJwt, usuarioAtivo, verificarToken } from "../utils/authGuard";

export const MSG_USUARIO_INATIVO = "Usuário inativo. Fale com o administrador.";

export type LoginResult =
  | { ok: true; token: string; user: { id: number; nome: string; email: string; usuario?: string; foto_perfil?: string } }
  | { ok: false; motivo: "credenciais" | "inativo" };

export class AuthController {
  private sessionRepository: SessionRepository;

  constructor(sessionRepository: SessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  // 🔹 Login e criação de sessão
  async login(identificador: string | undefined, senha: string | undefined, env: { JWT_SECRET?: string }): Promise<LoginResult> {
    console.log("🔍 Tentativa de login para:", identificador);

    if (!identificador || !senha) return { ok: false, motivo: "credenciais" };

    // 🔹 Busca pelo email ou nome de usuário
    const userContext = await this.sessionRepository.getByEmailOrUsuario(identificador);
    if (!userContext || !userContext.senha) {
      console.log("❌ Usuário não encontrado:", identificador);
      return { ok: false, motivo: "credenciais" };
    }

    // 🔹 Comparação da senha digitada com a senha armazenada (bcrypt)
    const senhaValida = await bcrypt.compare(senha, userContext.senha);
    if (!senhaValida) {
      console.log("❌ Senha incorreta para:", identificador);
      return { ok: false, motivo: "credenciais" };
    }

    // Checked after the password so account status isn't revealed to someone guessing.
    if (!usuarioAtivo(userContext.ativo)) {
      console.log("⛔ Usuário inativo tentou entrar:", identificador);
      return { ok: false, motivo: "inativo" };
    }

    if (!env.JWT_SECRET) {
      // HMAC needs a non-empty key: fail clearly instead of signing with an empty secret.
      throw new Error("JWT_SECRET não configurado no worker");
    }

    // 🔹 Gera o token JWT
    const token = await new SignJWT({ id: userContext.id, email: userContext.email })
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRACAO)
      .sign(chaveJwt(env.JWT_SECRET));

    console.log("✅ Login bem-sucedido:", identificador);

    // 🔹 Atualiza sessão no banco
    await this.sessionRepository.updateSession(userContext.id, token);

    // 🔹 Retorna apenas os dados necessários para o front
    return {
      ok: true,
      token,
      user: {
        id: userContext.id,
        nome: userContext.nome,
        email: userContext.email,
        usuario: userContext.usuario,
        foto_perfil: userContext.foto_perfil,
      },
    };
  }

  // 🔹 Verifica sessão baseada no token (JWT válido + token ainda registrado + usuário ativo)
  async verifySession(token: string, env: { JWT_SECRET?: string }): Promise<Omit<UserContext, "senha" | "token"> | null> {
    const payload = await verificarToken(token, env.JWT_SECRET ?? "");
    if (!payload) return null;

    const user = await this.sessionRepository.getByToken(token);
    if (!user || !usuarioAtivo(user.ativo)) return null;

    const { senha: _senha, token: _token, ...publico } = user;
    return publico;
  }
}
