import React from "react";
import Table from "./Table";
import BreadCrumb from "../../../components/BreadCrumb";
const PlanoContas = () => {
  return (
    <div>
        <BreadCrumb grupo="Cadastro" pagina="Plano de Contas" />
        <Table />
    </div>
  );
};

export default PlanoContas;
