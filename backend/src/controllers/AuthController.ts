// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";
// import { SessionRepository } from "../repositories/SessionRepository";
// import { Usuario } from "../models/Usuario";

// const JWT_SECRET = process.env.JWT_SECRET || "chave_secreta"; // Define um segredo seguro

// export class AuthController {
//   private sessionRepository: SessionRepository;

//   constructor(sessionRepository: SessionRepository) {
//     this.sessionRepository = SessionRepository;
//   }

//   // 🔹 Login do usuário
//   async login(email: string, senha: string): Promise<{ token: string; user: Usuario } | null> {
//     const usuario = await this.sessionRepository.getByEmail(email);
//     if (!usuario) return null;

//     // 🔹 Comparando a senha informada com a senha armazenada
//     const senhaValida = await bcrypt.compare(senha, usuario.senha);
//     if (!senhaValida) return null;

//     // 🔹 Gerando um token JWT válido por 1 hora
//     const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: "1h" });

//     return { token, user: usuario };
//   }

//   // 🔹 Verifica sessão baseada no token
//   async verifySession(token: string): Promise<Usuario | null> {
//     try {
//       const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
//       return await this.usuarioRepository.getById(decoded.id);
//     } catch {
//       return null;
//     }
//   }
// }
