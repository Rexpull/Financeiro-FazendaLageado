import React, { useState } from "react";
import { useAuth } from "./AuthContext";
// Artwork chosen by the client: farm triptych (crop, dairy cow, cattle) with the logo and "FINANCEIRO" built in
import arteLageado from "../../assets/img/loginBg-lageado.webp";

// Palette taken from the farm's logo: pasture green, field green, straw yellow.
const COR = {
  pasto: "#1E4D2B",
  campo: "#3F7D3A",
  campoEscuro: "#33682F",
  palha: "#E2B23A",
  terra: "#2A2622",
  texto2: "#5B6158",
  linha: "#D5DACF",
};

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro("");

    const mensagemErro = await login(email, senha);
    if (mensagemErro) setErro(mensagemErro);
    setIsLoading(false);
  };

  return (
    <div
      className="login-v3 min-h-screen w-full flex items-center justify-center p-4 md:p-8"
      style={{ color: COR.terra, background: "linear-gradient(160deg, #EEF3EA 0%, #E1EAD9 100%)" }}
    >
      <style>{`
        .login-v3 { font-family: "Nunito Sans", system-ui, sans-serif; }
        .login-v3 .slab { font-family: "Zilla Slab", Georgia, serif; }
        .login-v3 .campo {
          width: 100%; height: 48px; padding: 0 14px; border-radius: 8px;
          border: 1px solid ${COR.linha}; background: #fff; color: ${COR.terra};
          font-size: 16px; outline: none; transition: border-color .15s, box-shadow .15s;
        }
        .login-v3 .campo::placeholder { color: #9AA096; }
        .login-v3 .campo:focus { border-color: ${COR.campo}; box-shadow: 0 0 0 3px ${COR.palha}66; }
        .login-v3 .entrar {
          height: 48px; width: 100%; border-radius: 8px; border: 0; cursor: pointer;
          background: ${COR.campo}; color: #fff; font-weight: 700; font-size: 16px;
          transition: background-color .15s;
        }
        .login-v3 .entrar:hover:not(:disabled) { background: ${COR.campoEscuro}; }
        .login-v3 .entrar:focus-visible, .login-v3 .olho:focus-visible { outline: 3px solid ${COR.palha}; outline-offset: 2px; }
        .login-v3 .entrar:disabled { opacity: .7; cursor: progress; }
        @media (prefers-reduced-motion: reduce) { .login-v3 * { transition: none !important; animation: none !important; } }
      `}</style>

      {/* One card: the client's artwork shown WHOLE (no crop, 3:2) with the form beside it; stacked on phones.
          The card width is capped by the screen height so the picture never needs scrolling on a laptop. */}
      <div
        className="w-full flex flex-col md:flex-row overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ maxWidth: "min(1180px, calc((100vh - 4rem) * 1.5 + 380px))" }}
      >
        <img
          src={arteLageado}
          alt="Fazenda Lageado — Financeiro: lavoura de milho, vaca leiteira e gado de corte"
          className="block w-full md:w-[66%] h-auto aspect-[3/2] object-cover select-none"
          draggable={false}
        />

        {/* Sign-in form */}
        <main className="flex-1 flex flex-col justify-center px-6 py-8 md:px-10">
          <div className="w-full max-w-[340px] mx-auto">
            {/* The logo is in the artwork beside the form: not repeated here */}
            {/* Wording requested by the client: Bem-vindo! / Usuário / Senha / Entrar */}
            <h2 className="slab text-[30px] font-semibold leading-tight mb-8">Bem-vindo!</h2>

            <form onSubmit={handleLogin} noValidate={false} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-usuario" className="text-[14px] font-bold">
                  Usuário
                </label>
                <input
                  id="login-usuario"
                  type="text"
                  autoComplete="username"
                  className="campo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-senha" className="text-[14px] font-bold">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="login-senha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    className="campo"
                    style={{ paddingRight: 84 }}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="olho absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[13px] font-bold"
                    style={{ color: COR.campo, background: "transparent" }}
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-pressed={mostrarSenha}
                    aria-controls="login-senha"
                  >
                    {mostrarSenha ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {erro && (
                <p
                  role="alert"
                  className="text-[14px] rounded-lg px-3 py-2.5"
                  style={{ color: "#8A1C1C", background: "#FCEDEC", border: "1px solid #F3C9C6" }}
                >
                  {erro}
                </p>
              )}

              <button type="submit" className="entrar mt-1" disabled={isLoading}>
                {isLoading ? (
                  <span className="inline-flex items-center justify-center gap-3">
                    <span className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                    Entrando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
