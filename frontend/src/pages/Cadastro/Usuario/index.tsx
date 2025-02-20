import React from "react";
import List from "./List";
import BreadCrumb from "../../../components/BreadCrumb";

const Usuario = () => {
  return (
    <div>
        <BreadCrumb grupo="Cadastro" pagina="Usuário" />
        <List />
    </div>
  );
};

export default Usuario;
