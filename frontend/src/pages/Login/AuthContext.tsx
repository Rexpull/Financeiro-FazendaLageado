import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Define a estrutura dos dados do usuário autenticado
interface AuthUser {
  id: number;
  nome: string;
  email: string;
  token: string; // Token JWT ou outro identificador de sessão
}

// Define a estrutura do contexto de autenticação
interface AuthContextProps {
  user: AuthUser | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
}

// Criando o contexto de autenticação
const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// 🔹 Hook para acessar o contexto facilmente
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};

// 🔹 Componente Provider para envolver a aplicação e gerenciar autenticação
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const navigate = useNavigate();

  // 🔹 Login do usuário
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

      const data: AuthUser = await response.json();
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));

      // Redireciona para o dashboard após login
      navigate("/dashboard");
      return true;
    } catch (error) {
      console.error("Erro no login:", error);
      return false;
    }
  };

  // 🔹 Logout do usuário
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    navigate("/login");
  };

  // 🔹 Verifica a sessão ao carregar a página
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

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
