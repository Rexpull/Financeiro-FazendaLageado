import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faEquals, faMinus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { formatarMoeda } from "../../../Utils/formataMoeda";
import { getBancoLogo } from "../../../Utils/bancoUtils";


Modal.setAppElement("#root");

const ConciliacaoOFXModal = ({ isOpen, onClose, movimentos, totalizadores }) => {

  const [contaSelecionada, setContaSelecionada] = useState<any | null>(null);
  const [status, setStatus] = useState<string>("todos");

  useEffect(() => {
    if (isOpen) {
      const storedConta = localStorage.getItem("contaSelecionada");
      if (storedConta) {
        setContaSelecionada(JSON.parse(storedConta));
      }
    }
    
    setStatus("todos");
  }, [isOpen]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        className="bg-white rounded-lg shadow-lg w-full mx-auto h-full"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-t-lg border-b">
          <h2 className="text-xl font-semibold text-gray-800">Conciliação de Movimentos OFX</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FontAwesomeIcon icon={faTimes} size="xl" />
          </button>
        </div>

        <div className="h-full overflow-y-auto p-4 flex flex-col items-center gap-4 w-full">

          <div className="flex w-full justify-between items-center">
            <span className="font-bold text-2xl">Resumo do Extrato</span>
            {/* 🔹 Filtro por Status */}
            <div className="flex items-center justify-center gap-6">
              <label className={`flex items-center gap-2 cursor-pointer transition-all ${status === "todos" ? "" : "text-gray-500"}`}>
                <input type="radio" name="status" value="todos" checked={status === "todos"} onChange={() => setStatus("todos")} className="hidden" />
                <div className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${status === "todos" ? "bg-red-500 border-red-500" : "border-gray-400"}`} style={{padding: '0.60rem'}}>
                  {status === "todos" && <span className="text-white text-md"><FontAwesomeIcon icon={faCheck}/></span>}
                </div>
                <span>Mostrar todos</span>
              </label>
    
              <label className={`flex items-center gap-2 cursor-pointer transition-all ${status === "pendentes" ? "" : "text-gray-500"}`}>
                <input type="radio" name="status" value="pendentes" checked={status === "pendentes"} onChange={() => setStatus("pendentes")} className="hidden" />
                <div className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${status === "pendentes" ? "bg-red-500 border-red-500" : "border-gray-400"}`} style={{padding: '0.60rem'}}>
                  {status === "pendentes" && <span className="text-white text-md"><FontAwesomeIcon icon={faCheck}/></span>}
                </div>
                <span>Apenas pendentes</span>
              </label>
            </div>
          </div>

          {/* Totalizadores */}
          <div className="px-4 pt-2 pb-3 border rounded-lg w-full border-gray-300">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={getBancoLogo(contaSelecionada ? contaSelecionada.bancoCodigo : '')} alt="Logo Banco" className="w-12 h-12" />
                <div className="flex flex-col items-start">
                  <span className="font-bold text-xl">{contaSelecionada ? contaSelecionada.bancoNome : ''} </span> 
                  <span className="text-md font-medium text-gray-600">{contaSelecionada ? contaSelecionada.numConta : ''} - {contaSelecionada ? contaSelecionada.responsavel : ''} </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold text-grey-900" style={{lineHeight:'20px'}}>Período do Arquivo</span>
                <span className="text-sm font-medium text-gray-600">{totalizadores.dtInicialExtrato} à {totalizadores.dtFinalExtrato}</span>
            
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-center text-lg font-bold">
              <div className="flex flex-col items-start">
                <span className="text-gray-600" style={{fontSize: '0.950rem'}}>Saldo na conta corrente atualmente</span>
                <span className="text-2xl font-bold text-green-600">R$ 1.000,00 (Todo)</span>
              </div>
              <div className="totalDivider"/>
              <div className="flex flex-col items-center">
                <span className="text-gray-600" style={{fontSize: '0.950rem'}}>Valor das Receitas do Extrato</span>
                <span className="text-2xl font-bold text-blue-600">R$ {formatarMoeda(totalizadores.receitas, 2)}</span>
              </div>
              <div className="totalMinus"><FontAwesomeIcon icon={faMinus}/></div>
              <div className="flex flex-col items-center">
                <span className="text-gray-600" style={{fontSize: '0.950rem'}}>Valor das Despesas do Extrato</span>
                <span className="text-2xl font-bold text-orange-600">R$ {formatarMoeda(totalizadores.despesas, 2)}</span>
              </div>
              <div className="totalEquals"><FontAwesomeIcon icon={faEquals}/></div>
              <div className="flex flex-col items-center">
                <span className="text-gray-600" style={{fontSize: '0.950rem'}}>Valor Líquido do Extrato</span>
                <span className="text-2xl font-bold text-gray-600" 
                style={{textDecoration: 'underline', textDecorationThickness:'3px', textDecorationColor:'#00c100', textUnderlineOffset:'4px'}}>R$ {formatarMoeda(totalizadores.liquido, 2)}</span>
              </div>
              <div className="totalDivider"/>
              <div className="flex flex-col items-center">
                <span className="text-gray-600" style={{fontSize: '0.950rem'}}>Saldo na conta após o Extrato</span>
                <span className="text-2xl font-bold text-green-600">R$ {formatarMoeda(totalizadores.saldoFinal, 2)}</span>
              </div>
            </div>
          </div>
          
          {/* Tabela de Movimentos */}
          <div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200 w-full" style={{marginBottom:'50px'}}>
            <div className="overflow-y-auto" style={{maxHeight:'100%'}}>
              <table className="w-full border-collapse">
                <thead className="bg-gray-200 sticky top-0 z-10">
                  <tr className="bg-gray-200">
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Histórico</th>
                    <th className="p-2 text-center">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                        Nenhum movimento encontrado!
                      </td>
                    </tr>
                  ) : (
                    movimentos.map((mov, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 text-left">{mov.dtMovimento}</td>
                        <td className="p-2 text-left">{mov.historico}</td>
                        <td className={`p-2 font-medium text-center ${mov.valor >= 0 ? "text-green-600" : "text-red-600"}`}>R$ {formatarMoeda(mov.valor,2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        

        {/* Rodapé */}
        <div className="p-4 flex justify-end border-t">
          <button
            className="bg-red-500 text-white font-semibold px-5 py-2 rounded hover:bg-red-600"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
};

export default ConciliacaoOFXModal;
