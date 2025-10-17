import CentroCustosTable from "./CentroCustosTable";
import BreadCrumb from "../../../components/BreadCrumb";

const CentroCustos = () => {
  return (
    <div>
        <BreadCrumb grupo="Cadastro" pagina="Centro de Custos" />
        <CentroCustosTable />
    </div>
  );
};

export default CentroCustos;
