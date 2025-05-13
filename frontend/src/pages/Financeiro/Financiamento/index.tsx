import React from "react";
import BreadCrumb from "../../../components/BreadCrumb";
import ListFinanciamentos from './ListFinanciamentos'

const Financiamento = () => {
  return (
    <div >
      <BreadCrumb grupo="Financeiro" pagina="Financiamento" />
      <ListFinanciamentos />
    </div>
  );
};

export default Financiamento;
