import React from "react";
import BreadCrumb from "../../../components/BreadCrumb";
import ListConta from "./ListConta";

const Users = () => {
  return (
    <div >
      <BreadCrumb grupo="Cadastro" pagina="Conta Corrente" />
      <ListConta />
    </div>
  );
};

export default Users;
