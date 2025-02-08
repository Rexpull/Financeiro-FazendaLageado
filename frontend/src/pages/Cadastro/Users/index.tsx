import React from "react";
import Sidebar from "../../../components/Sidebar";
import UserForm from "../../../components/UserForm";

const Users = () => {
  return (
    <div >
      <h1 className="text-2xl font-bold mb-5">Cadastro de Usuários</h1>
      <UserForm />
    </div>
  );
};

export default Users;
