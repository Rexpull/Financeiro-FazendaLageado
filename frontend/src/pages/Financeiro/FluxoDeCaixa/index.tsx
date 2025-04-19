import React from "react";
import BreadCrumb from "../../../components/BreadCrumb";
import TableMain from "../FluxoDeCaixa/TableMain";

const FluxoCaixa = () => {
  return (
    <div >
      <BreadCrumb grupo="Financeiro" pagina="Fluxo de Caixa" />
      <TableMain />
    </div>
  );
};

export default FluxoCaixa;
