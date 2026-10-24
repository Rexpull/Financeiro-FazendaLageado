import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MSG_SESSAO_EXPIRADA, SESSAO_EXPIRADA_KEY, STORAGE_USER_KEY } from "../../services/apiFetch";

interface AuthUser {
  id: number;
  nome: string;
  email: string;
  foto_perfil: string;
  token: string;
}

interface AuthContextProps {
  user: AuthUser | null;
  /** null = success; otherwise the message to show on the login screen */
  login: (email: string, senha: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const navigate = useNavigate();

  const login = async (email: string, senha: string): Promise<string | null> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
  
      if (!response.ok) {
        if (response.status === 403) {
          // Inactive user: the backend says so ("Usuário inativo. Fale com o administrador.")
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          return body?.error || "Usuário inativo. Fale com o administrador.";
        }
        return "Usuário ou senha incorretos. Confira os dados e tente de novo.";
      }
  
      const { token, user } = (await response.json()) as { token: string; user: Omit<AuthUser, "token"> }; // Agora pegamos `{ token, user }`
      
      const userData: AuthUser = { 
        id: user.id, 
        nome: user.nome, 
        foto_perfil: user.foto_perfil,
        email: user.email, 
        token 
      };
      setUser(userData);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
  
      navigate("/dashboard");
      return null;
    } catch (error) {
      console.error("Erro no login:", error);
      return "Não foi possível entrar agora. Verifique a conexão e tente de novo.";
    }
  };
  

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    navigate("/login");
  };

  // apiFetch sets this flag before redirecting to /login after a 401 from the API.
  useEffect(() => {
    let expirou = false;
    try {
      expirou = sessionStorage.getItem(SESSAO_EXPIRADA_KEY) === "1";
      sessionStorage.removeItem(SESSAO_EXPIRADA_KEY);
    } catch {
      // storage unavailable
    }
    if (expirou) {
      setUser(null);
      // defer so the ToastContainer (rendered after the routes in main.tsx) is mounted
      setTimeout(() => toast.warning(MSG_SESSAO_EXPIRADA, { toastId: "sessao-expirada", autoClose: 6000 }), 0);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      if (!user) return;

      let response: Response;
      try {
        response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/session`, {
          method: "GET",
          headers: { Authorization: `Bearer ${user.token}` },
        });
      } catch {
        return; // network failure: keep the session, the next API call will tell
      }

      if (response.status === 401 || response.status === 403) {
        toast.warning(MSG_SESSAO_EXPIRADA, { toastId: "sessao-expirada", autoClose: 6000 });
        logout();
      }
    };

    checkSession();
  }, [user]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};
