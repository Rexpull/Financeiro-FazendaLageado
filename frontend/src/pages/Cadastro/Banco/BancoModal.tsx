import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import { Banco } from "../../../../../backend/src/models/Banco";

Modal.setAppElement("#root"); // 🔹 Corrige o erro de acessibilidade do modal

interface BancoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bancoData: Banco;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  isSaving: boolean;
}

const BancoModal: React.FC<BancoModalProps> = ({
  isOpen,
  onClose,
  bancoData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ nome?: string; codigo?: string }>({});

  // 🔹 Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { nome?: string; codigo?: string } = {};

    if (!bancoData.nome.trim()) {
      newErrors.nome = "O nome é obrigatório!";
    }
    if (!bancoData.codigo.trim()) {
      newErrors.codigo = "O código é obrigatório!";
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
          {bancoData.id ? "Editar Banco" : "Cadastro de Bancos"}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Formulário */}
      <div className="p-4">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Dados Gerais</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nome"
              className={`w-full p-2 bg-gray-50 border ${
                errors.nome ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-600`}
              placeholder="Nome do Banco"
              value={bancoData.nome}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.nome && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.nome}
              </p>
            )}
          </div>

          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="codigo"
              className={`w-full p-2 bg-gray-50 border ${
                errors.codigo ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-600`}
              placeholder="Código do Banco"
              value={bancoData.codigo}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.codigo && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.codigo}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 🔹 Botões */}
      <div className="flex justify-end gap-3 p-4 mt-5 border-t">
        <button
          className="bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded hover:bg-gray-200 transition"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancelar
        </button>

        <button
          className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600 transition"
          onClick={validateAndSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full"></div>
              Salvando...
            </>
          ) : (
            <>
              Salvar
              <FontAwesomeIcon icon={faSave} />
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

export default BancoModal;
