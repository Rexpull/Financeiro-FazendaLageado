import React from "react";
import BreadCrumb from "../../components/BreadCrumb";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

const Users = () => {
  return (
    <div>
      <BreadCrumb grupo="Cadastro" pagina="Parâmetros" />
      <div className="flex flex-col justify-between items-start gap-5 mb-4 ">   
      
        <div className="flex flex-col gap-5 w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano de Contas Transferência entre Contas <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              className="w-full max-w-md p-2 bg-gray-50 border border-gray-300 rounded"
              
            >
              <option value="custeio">Custeio</option>
              <option value="investimento">Investimento</option>
            </select>
            
          </div>
        </div>

        <hr className="w-full max-w-md"/>
        
        <div className="flex flex-col gap-5 w-full">
          <div >
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano de Contas Entradas de Financiamentos <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              className="w-full max-w-md p-2 bg-gray-50 border border-gray-300 rounded "
              
            >
              <option value="custeio">Custeio</option>
              <option value="investimento">Investimento</option>
            </select>
            
          </div>
        </div>

        <div className="flex flex-col gap-5 w-full">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano de Contas Pagamentos de Financiamentos <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              className="w-full max-w-md p-2 bg-gray-50 border border-gray-300 rounded"
              
            >
              <option value="custeio">Custeio</option>
              <option value="investimento">Investimento</option>
            </select>
            
          </div>
        </div>
      </div> 
    </div> 
  );
};

export default Users;
