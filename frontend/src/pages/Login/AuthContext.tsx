import { log } from "console";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthUser {
  id: number;
  nome: string;
  email: string;
  foto_perfil: string;
  token: string;
}

interface AuthContextProps {
  user: AuthUser | null;
  login: (email: string, senha: string) => Promise<boolean>;
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
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const navigate = useNavigate();

  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
  
      if (!response.ok) {
        throw new Error("Credenciais inválidas");
      }
  
      const { token, user } = await response.json(); // Agora pegamos `{ token, user }`
      
      const userData: AuthUser = { 
        id: user.id, 
        nome: user.nome, 
        foto_perfil: user.foto_perfil,
        email: user.email, 
        token 
      };
      console.log("userData:" + userData.foto);
      
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
  
      navigate("/dashboard");
      return true;
    } catch (error) {
      console.error("Erro no login:", error);
      return false;
    }
  };
  

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!user) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/session`, {
        method: "GET",
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        logout();
      }
    };

    checkSession();
  }, [user]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};
