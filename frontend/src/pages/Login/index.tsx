import React, { use, useState } from "react";
import { useAuth } from "./AuthContext";
import artLogin from "../../assets/img/loginArt.svg"
import logoFazenda from "../../assets/img/logo-FazendaLageado.svg";
import dashedGreen from "../../assets/img/dashedArt-green.svg"
import bgGrass from  "../../assets/img/loginBg-grass.jpg"
import footerBg from "../../assets/img/footer-bg.webp"
import { log } from "console";

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro("");

    const success = await login(email, senha);
    
    if (!success) {      
      setErro("Usuário/E-mail ou senha inválidos");
    }
    setIsLoading(false);
  };

  return (
    <div className="container-login" style={{ height: "100vh", position: "relative" }}>
      {/* Background de montanhas fixo */}
      <img src={footerBg} alt="Patos Valley" width={240} height={72} style={{ height: "45vh" }} className="absolute bottom-0 w-full mx-auto" />


      <div className="content-login" style={{ maxHeight: "750px", position: "relative", zIndex: 1 }}>
        <div className="login-container-image" style={{ height: "100%" }}>
          <div className="login-div" style={{ height: "100%", width: "100%", borderRadius: "25px 0 0 25px" }}>
            <div className="login-image-child" style={{ position: "relative", pointerEvents: 'none' }}>
              <div className="background-image" loading="lazy"></div> 
              <img src={artLogin} style={{ width: "65%", float: "left", zIndex: 2 }} className="LogoBg" />
              <div className="spanBg" style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", paddingTop: "30px" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
                  <span className="font-nun spanBgTitle text-center" style={{ zIndex: 2, fontWeight: 700, fontSize: "45px", color: "antiquewhite" }}>Financeiro Lageado</span>
                  <span className="font-nun spanBgSubTitle" style={{ zIndex: 2, fontWeight: 400, fontSize: "25px", color: "antiquewhite" }}>Mais gestão para seu negócio</span>
                </div>
              </div>
              <div className="area">
                <ul className="circles">
                  <li></li>
                  <li></li>
                  <li></li>
                  <li></li>
                  <li></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div id="page-container" className="fade in" style={{ position: "relative", overflowY: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, borderRadius: "0 20px 0 0", overflow: "hidden" }}>
            <img src={dashedGreen} alt="Bolha Verde" style={{ pointerEvents: "none", width: "100px", transform: "translate(5px, -5px)" }} className="bubbleRed" />
          </div>
          <img src={dashedGreen} alt="Bolha Verde" style={{ pointerEvents: "none", position: "absolute", bottom: "-5%", left: "-11%", width: "23%", float: "right" }} />
          <div className="login-container-info">
            <div className="login login-v2 animated flipInX" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", marginBottom: "55px" }} data-pageload-addclass="animated flipInX">
              <div className="login-header">
                <div className="brand" style={{ display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
                  <img src={logoFazenda} style={{ width: "70%", float: "left", pointerEvents: 'none' }} className="logoFullMetre" />
                  <span className="font-nun" style={{ marginTop: "20px", fontWeight: 700, fontSize: "40px", color: "#222222" }}>Login da sua conta</span>
                  <span className="font-nun" style={{ marginBottom: "15px", fontWeight: 400, fontSize: "18px", color: "#525252" }}>Que bom te ver por aqui, seja bem vindo!</span>
                </div>
              </div>
              <div className="login-content">
                <form onSubmit={handleLogin} className="w-full">
                  <div className="form-group" style={{ display: "flex", flexDirection: "column", cursor: "text", marginBottom: "15px" }}>
                    <span className="span-form">Usuário / E-mail</span>
                    <input
                      type="text"
                      placeholder="Usuário ou E-mail"
                      className="ui-inputfield ui-inputtext ui-widget ui-state-default ui-corner-all form-control form-login input-lg"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ display: "flex", flexDirection: "column", cursor: "text" }}>
                    <span className="span-form">Senha</span>
                    <input
                      type="password"
                      placeholder="Senha"
                      className="ui-inputfield ui-inputtext ui-widget ui-state-default ui-corner-all form-control form-login input-lg"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-buttons">
                    <button type="submit" className={`btn btn-login btn-success btn-block btn-lg text-center ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"}`} id="btnEntrar" disabled={isLoading}>
                      {!isLoading ? (
                        <span>Entrar</span>
                      ) : (
                        <div style={{    display: 'flex',
                              width: '100%',
                              justifyContent: 'center',
                              gap: '15px',
                              alignItems: 'center',
                              opacity: '0.5',}}>
                          <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full"></div>
                          <span>Entrando...</span>
                        </div>
                      )} 
                    </button>
                  </div>
                  {erro.includes("E-mail ou senha inválidos") && (
                    <div className="alert alert-danger font-nun" style={{ marginTop: "15px", alignSelf: "center", justifyContent: "center" }}>
                    <strong style={{ color: "#ff4646" }}>Ops... Falha na autenticação, tente novamente</strong>
                  </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
