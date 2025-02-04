import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Users from "./pages/Users";
import Dashboard from "./pages/Dashboard";
import Pessoa from "./pages/Pessoa";
import Banco from "./pages/Banco";
import ContaCorrente from "./pages/ContaCorrente";
import PlanoDeContas from "./pages/PlanoDeContas";
import ConciliacaoBancaria from "./pages/ConciliacaoBancaria";
import FluxoDeCaixa from "./pages/FluxoDeCaixa";


function RoutesApp(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pessoa" element={<Pessoa />} />
        <Route path="/usuario" element={<Users />} />
        <Route path="/banco" element={<Banco />} />
        <Route path="/conta-corrente" element={<ContaCorrente />} />
        <Route path="/plano-de-contas" element={<PlanoDeContas />} />
        <Route path="/conciliacao-bancaria" element={<ConciliacaoBancaria />} />
        <Route path="/fluxo-de-caixa" element={<FluxoDeCaixa />} />
      </Routes>
    </BrowserRouter>
  );
}


export default RoutesApp;
