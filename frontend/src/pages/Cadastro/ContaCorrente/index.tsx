import React from "react";
import UserForm from "../../../components/UserForm";
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
