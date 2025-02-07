import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "../App";
import Users from "../pages/Cadastro/Users";
import Dashboard from "../pages/Dashboard";
import Pessoa from "../pages/Cadastro/Pessoa";
import Banco from "../pages/Cadastro/Banco";
import ContaCorrente from "../pages/Cadastro/ContaCorrente";
import PlanoDeContas from "../pages/Cadastro/PlanoDeContas";
import ConciliacaoBancaria from "../pages/Financeiro/ConciliacaoBancaria";
import FluxoDeCaixa from "../pages/Financeiro/FluxoDeCaixa";


function RoutesApp(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cadastro/pessoa" element={<Pessoa />} />
        <Route path="/cadastro/usuario" element={<Users />} />
        <Route path="/cadastro/banco" element={<Banco />} />
        <Route path="/cadastro/conta-corrente" element={<ContaCorrente />} />
        <Route path="/cadastro/plano-de-contas" element={<PlanoDeContas />} />
        <Route path="/financeiro/conciliacao-bancaria" element={<ConciliacaoBancaria />} />
        <Route path="/financeiro/fluxo-de-caixa" element={<FluxoDeCaixa />} />
      </Routes>
    </BrowserRouter>
  );
}


export default RoutesApp;
