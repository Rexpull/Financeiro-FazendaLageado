import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import logoFazenda from "../../assets/img/logo-FazendaLageado.svg";
import bgPasto from "../../assets/img/loginBg-grass.jpg";

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
    <div className="login-v3 min-h-screen w-full flex flex-col md:flex-row bg-white" style={{ color: COR.terra }}>
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

      {/* Pasture photo: the one memorable element. Short band on mobile, full height on desktop. */}
      <section
        className="relative h-44 md:h-auto md:min-h-screen md:w-[56%] overflow-hidden"
        style={{ backgroundImage: `url(${bgPasto})`, backgroundSize: "cover", backgroundPosition: "center 70%" }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(30,77,43,0) 20%, rgba(30,77,43,.55) 60%, ${COR.pasto} 100%)` }}
        />
        <div className="absolute left-0 right-0 bottom-0 px-6 pb-5 md:px-14 md:pb-14">
          <div className="hidden md:block mb-5" style={{ width: 56, height: 4, background: COR.palha, borderRadius: 2 }} />
          <h1 className="slab text-white leading-[0.95] font-semibold text-[34px] md:text-[64px]" style={{ letterSpacing: "-0.01em" }}>
            Financeiro
            <br className="hidden md:block" /> Lageado
          </h1>
          <p className="hidden md:block mt-4 max-w-md text-[17px] leading-relaxed" style={{ color: "rgba(255,255,255,.88)" }}>
            Conciliação bancária, fluxo de caixa e financiamentos da fazenda em um só lugar.
          </p>
        </div>
      </section>

      {/* Sign-in form */}
      <main className="flex-1 flex flex-col px-6 py-10 md:px-16">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[380px]">
            <img src={logoFazenda} alt="Fazenda Lageado — Pecuária leiteira" className="w-44 md:w-52 mb-10 select-none" draggable={false} />

            <h2 className="slab text-[30px] font-semibold leading-tight">Entrar</h2>
            <p className="mt-1 mb-8 text-[15px]" style={{ color: COR.texto2 }}>
              Use o usuário ou e-mail cadastrado no sistema.
            </p>

            <form onSubmit={handleLogin} noValidate={false} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-usuario" className="text-[14px] font-bold">
                  Usuário ou e-mail
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
        </div>

        <p className="mt-10 text-[13px] text-center md:text-left" style={{ color: COR.texto2 }}>
          Fazenda Lageado, pecuária leiteira
        </p>
      </main>
    </div>
  );
};

export default Login;
