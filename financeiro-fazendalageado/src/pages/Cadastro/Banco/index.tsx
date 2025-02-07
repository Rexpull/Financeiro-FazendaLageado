import React from "react";
import Sidebar from "../../../components/Sidebar";
import BancoTable from "./BancoTable";

const Bancos = () => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-5">
        <h1 className="text-2xl font-bold mb-5">Cadastro de Banco</h1>
        <BancoTable />
      </div>
    </div>
  );
};

export default Bancos;
