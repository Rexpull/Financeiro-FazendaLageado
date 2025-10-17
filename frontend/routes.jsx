import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import MainLayout from "./MainLayout"; // 🔹 Importa o layout principal
import Dashboard from "./src/pages/Dashboard";
import Parametros from "./src/pages/Parametros";
import Users from "./src/pages/Cadastro/Usuario";
import Pessoa from "./src/pages/Cadastro/Pessoa";
import Banco from "./src/pages/Cadastro/Banco";
import ContaCorrente from "./src/pages/Cadastro/ContaCorrente";
import PlanoDeContas from "./src/pages/Cadastro/PlanoDeContas";
import CentroCustos from "./src/pages/Cadastro/CentroCustos";
import ConciliacaoBancaria from "./src/pages/Financeiro/ConciliacaoBancaria";
import Financiamento from "./src/pages/Financeiro/Financiamento";
import FluxoDeCaixa from "./src/pages/Financeiro/FluxoDeCaixa";
import Login from "./src/pages/Login/index";
import ProtectedRoute from "./src/pages/Login/ProtectedRoute";
import { AuthProvider } from "./src/pages/Login/AuthContext";

import LoadingScreen from "./src/components/LoadingScreen";

const AppRoutes = React.memo(() => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/*" element={<MainLayoutWithLoading />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
});

const MainLayoutWithLoading = React.memo(() => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  const handleNavigation = useCallback(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300); // Reduzido de 500ms para 300ms

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = handleNavigation();
    return cleanup;
  }, [location.pathname]); // Mudança específica para pathname em vez de location completo

  return (
    <>
      {isLoading && <LoadingScreen />} 
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="cadastro/pessoa" element={<Pessoa />} />
            <Route path="cadastro/usuario" element={<Users />} />
            <Route path="cadastro/banco" element={<Banco />} />
            <Route path="cadastro/conta-corrente" element={<ContaCorrente />} />
            <Route path="cadastro/plano-de-contas" element={<PlanoDeContas />} />
            <Route path="cadastro/centro-custos" element={<CentroCustos />} />
            <Route path="financeiro/conciliacao-bancaria" element={<ConciliacaoBancaria />} />
            <Route path="financeiro/financiamento" element={<Financiamento />} />
            <Route path="financeiro/fluxo-de-caixa" element={<FluxoDeCaixa />} />
            <Route path="parametros" element={<Parametros />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
});

AppRoutes.displayName = 'AppRoutes';
MainLayoutWithLoading.displayName = 'MainLayoutWithLoading';

export default AppRoutes;