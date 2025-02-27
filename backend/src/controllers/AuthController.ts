import bcrypt from "bcryptjs";
import { SessionRepository } from "../repositories/SessionRepository";
import { UserContext } from "../models/UserContext";
import { SignJWT, jwtVerify } from "jose";

export class AuthController {
  private sessionRepository: SessionRepository;

  constructor(sessionRepository: SessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  // 🔹 Login e criação de sessão
  async login(identificador: string, senha: string, env: { JWT_SECRET: string }) {
    console.log("🔍 Tentativa de login para:", identificador);

    // 🔹 Busca pelo email ou nome de usuário
    const userContext = await this.sessionRepository.getByEmailOrUsuario(identificador);
    if (!userContext) {
      console.log("❌ Usuário não encontrado:", identificador);
      return null;
    }

    console.log("🔑 Senha armazenada no banco:", userContext.senha);

    // 🔹 Comparação da senha digitada com a senha armazenada (bcrypt)
    const senhaValida = await bcrypt.compare(senha, userContext.senha);
    console.log("🔐 Resultado da comparação:", senhaValida);

    if (!senhaValida) {
      console.log("❌ Senha incorreta para:", identificador);
      return null;
    }

    // 🔹 Converte a chave JWT para TextEncoder
    const secretKey = new TextEncoder().encode(env.JWT_SECRET);

    // 🔹 Gera o token JWT
    const token = await new SignJWT({ id: userContext.id, email: userContext.email })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("2h")
      .sign(secretKey);

    console.log("✅ Login bem-sucedido:", identificador);

    // 🔹 Atualiza sessão no banco
    await this.sessionRepository.updateSession(userContext.id, token);

    // 🔹 Retorna apenas os dados necessários para o front
    return { 
      token, 
      user: {
        id: userContext.id,
        nome: userContext.nome,
        email: userContext.email,
        usuario: userContext.usuario, // Agora retornamos o nome de usuário também
        foto_perfil: userContext.foto_perfil
      }
    };
  }

  // 🔹 Verifica sessão baseada no token
  async verifySession(token: string, env: { JWT_SECRET: string }): Promise<UserContext | null> {
    try {
      const secretKey = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secretKey);
      return await this.sessionRepository.getByToken(token);
    } catch {
      return null;
    }
  }
}
