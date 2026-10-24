import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import RelatorioCentroCustos from "./src/pages/Relatorios/RelatorioCentroCustos";
import RelatorioItensClassificados from "./src/pages/Relatorios/RelatorioItensClassificados";
import RelatorioFinanciamentos from "./src/pages/Relatorios/RelatorioFinanciamentos";
import Login from "./src/pages/Login/index";
import ProtectedRoute from "./src/pages/Login/ProtectedRoute";
import { AuthProvider } from "./src/pages/Login/AuthContext";


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
  // No artificial loading overlay between pages: each screen shows its own loading state
  return (
    <>
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
            <Route path="relatorios/centro-custos" element={<RelatorioCentroCustos />} />
            <Route path="relatorios/itens-classificados" element={<RelatorioItensClassificados />} />
            <Route path="relatorios/financiamentos" element={<RelatorioFinanciamentos />} />
            <Route path="relatorios/fluxo-de-caixa" element={<FluxoDeCaixa />} />
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