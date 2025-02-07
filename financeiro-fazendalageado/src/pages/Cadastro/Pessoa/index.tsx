import React from "react";
import Sidebar from "../../../components/Sidebar";
import UserForm from "../../../components/UserForm";
const Users = () => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-5">
        <h1 className="text-2xl font-bold mb-5">Cadastro de Pessoa</h1>
        <UserForm />
      </div>
    </div>
  );
};

export default Users;
