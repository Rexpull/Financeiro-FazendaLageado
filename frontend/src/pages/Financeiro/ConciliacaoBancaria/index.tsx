import React from "react";
import TableMain from "../ConciliacaoBancaria/TableMain";
import BreadCrumb from "../../../components/BreadCrumb";

const Users = () => {
  return (
    <div >
      <BreadCrumb grupo="Financeiro" pagina="Conciliação Bancária" />
      <TableMain />
    </div>
  );
};

export default Users;
