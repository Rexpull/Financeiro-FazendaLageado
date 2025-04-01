import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

Modal.setAppElement("#root");

interface FiltroMovimentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleSearch: (filters: { dataInicio: string; dataFim: string; status: string }) => void;
  dataInicio: string;
  dataFim: string;
  status: string; 
}

const FiltroMovimentosModal: React.FC<FiltroMovimentosModalProps> = ({ isOpen, onClose, handleSearch,  dataInicio: dataInicioProp , dataFim: dataFimProp   }) => {

  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      inicio: firstDay.toISOString().split("T")[0],
      fim: lastDay.toISOString().split("T")[0],
    };
  };

  
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [status, setStatus] = useState<string>("todos");
  const [erroData, setErroData] = useState<string>("");

  // 🔹 Resetar filtros ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setDataInicio(dataInicioProp);
      setDataFim(dataFimProp);
      setStatus(status); 
      setErroData("");
    }
  }, [isOpen, dataInicioProp, dataFimProp, status]);


  // 🔹 Validação das datas
  useEffect(() => {
    if (dataInicio && dataFim) {
      if (dataInicio > dataFim) {
        setErroData("A data inicial não pode ser maior que a final.");
      } else {
        setErroData("");
      }
    }
  }, [dataInicio, dataFim]);

  // 🔹 Função para limpar todos os filtros
  const limparFiltros = () => {
    const { inicio, fim } = getCurrentMonthRange();
    setDataInicio(inicio);
    setDataFim(fim);
    setStatus("todos");
    setErroData("");
  };


  // 🔹 Função para submeter os filtros
  const buscarMovimentos = () => {
    handleSearch({ dataInicio, dataFim, status });
    onClose(); // Fecha o modal após a busca
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[600px] mx-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold text-gray-800">Filtros do Fluxo de Caixa</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Corpo do Modal */}
      <div className="p-4">

        {/* 🔹 Filtro por Status */}
        <div className="flex items-center justify-center gap-6 mb-4 mt-2">
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

        {/* 🔹 Data Início e Data Fim */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              De <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Até <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded bg-white"
            />
          </div>

        </div>


        {/* 🔹 Botões de Ação */}
        <div className="flex justify-between items-center mt-10 border-t pt-4">
          <button className="text-red-500 font-semibold hover:underline" onClick={limparFiltros}>
            Limpar tudo
          </button>
          <button
            className={`text-white font-semibold px-5 py-2 rounded flex items-center gap-2 transition ${
              dataInicio && dataFim ? "bg-red-500 hover:bg-red-600" : "bg-gray-300 cursor-not-allowed"
            }`}
            onClick={buscarMovimentos}
            disabled={!!erroData}
          >
            {erroData ? (
              <>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {erroData}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSave} />
                Buscar
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FiltroMovimentosModal;
