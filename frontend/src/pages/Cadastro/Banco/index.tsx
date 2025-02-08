import BancoTable from "./BancoTable";
import BreadCrumb from "../../../components/BreadCrumb";

const Bancos = () => {
  return (
    <div>
        <BreadCrumb grupo="Cadastro" pagina="Banco" />
        <BancoTable />
    </div>
  );
};

export default Bancos;
