import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { CentroCustos } from "../../../../../backend/src/models/CentroCustos";

Modal.setAppElement("#root");

interface CentroCustosModalProps {
  isOpen: boolean;
  onClose: () => void;
  centroCustosData: CentroCustos;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSave: () => void;
  isSaving: boolean;
}

const CentroCustosModal: React.FC<CentroCustosModalProps> = ({
  isOpen,
  onClose,
  centroCustosData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ descricao?: string; tipo?: string }>({});

  // 🔹 Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { descricao?: string; tipo?: string } = {};

    if (!centroCustosData.descricao.trim()) {
      newErrors.descricao = "A descrição é obrigatória!";
    }

    if (!centroCustosData.tipo || (centroCustosData.tipo !== 'CUSTEIO' && centroCustosData.tipo !== 'INVESTIMENTO')) {
      newErrors.tipo = "O tipo é obrigatório!";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      handleSave();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}} 
      shouldCloseOnOverlayClick={false} 
      className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold text-gray-800">
          {centroCustosData.id ? "Editar Centro de Custos" : "Cadastro de Centro de Custos"}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Formulário */}
      <div className="p-4">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Dados Gerais</p>

        <div className="grid grid-cols-1 gap-4">
          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="descricao"
              className={`w-full p-2 bg-gray-50 border ${
                errors.descricao ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-600`}
              placeholder="Descrição do Centro de Custos"
              value={centroCustosData.descricao}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.descricao && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.descricao}
              </p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              className={`w-full p-2 bg-gray-50 border ${
                errors.tipo ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-1 focus:ring-gray-300`}
              value={centroCustosData.tipo || "CUSTEIO"}
              onChange={handleInputChange}
              disabled={isSaving}
            >
              <option value="CUSTEIO">Custeio</option>
              <option value="INVESTIMENTO">Investimento</option>
            </select>
            {errors.tipo && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.tipo}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 🔹 Rodapé */}
      <div className="flex justify-end gap-3 px-4 py-3 bg-gray-50 rounded-b-lg border-t">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          onClick={validateAndSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Salvando...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faSave} />
              {centroCustosData.id ? "Atualizar" : "Cadastrar"}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

export default CentroCustosModal;
