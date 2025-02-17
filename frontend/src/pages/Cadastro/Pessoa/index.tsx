import React from "react";
import List from "./List";
import BreadCrumb from "../../../components/BreadCrumb";

const Users = () => {
  return (
    <div>
        <BreadCrumb grupo="Cadastro" pagina="Pessoa" />
        <List />
    </div>
  );
};

export default Users;
