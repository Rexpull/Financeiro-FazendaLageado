import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./MainLayout"; // 🔹 Importa o layout principal
import Dashboard from "./src/pages/Dashboard";
import Users from "./src/pages/Cadastro/Users";
import Pessoa from "./src/pages/Cadastro/Pessoa";
import Banco from "./src/pages/Cadastro/Banco";
import ContaCorrente from "./src/pages/Cadastro/ContaCorrente";
import PlanoDeContas from "./src/pages/Cadastro/PlanoDeContas";
import ConciliacaoBancaria from "./src/pages/Financeiro/ConciliacaoBancaria";
import FluxoDeCaixa from "./src/pages/Financeiro/FluxoDeCaixa";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cadastro/pessoa" element={<Pessoa />} />
          <Route path="cadastro/usuario" element={<Users />} />
          <Route path="cadastro/banco" element={<Banco />} />
          <Route path="cadastro/conta-corrente" element={<ContaCorrente />} />
          <Route path="cadastro/plano-de-contas" element={<PlanoDeContas />} />
          <Route path="financeiro/conciliacao-bancaria" element={<ConciliacaoBancaria />} />
          <Route path="financeiro/fluxo-de-caixa" element={<FluxoDeCaixa />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
