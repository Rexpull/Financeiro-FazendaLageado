import React from "react";
import EmBreve from "../../../components/EmBreve";
import BreadCrumb from "../../../components/BreadCrumb";

const FluxoCaixa = () => {
  return (
    <div >
      <BreadCrumb grupo="Financeiro" pagina="Fluxo de Caixa" />
      <EmBreve />
    </div>
  );
};

export default FluxoCaixa;
