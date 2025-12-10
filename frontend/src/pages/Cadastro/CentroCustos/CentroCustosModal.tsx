import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faExclamationCircle, faCheck } from "@fortawesome/free-solid-svg-icons";
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
  const [errors, setErrors] = useState<{ descricao?: string; tipoReceitaDespesa?: string; tipo?: string }>({});

  // 🔹 Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { descricao?: string; tipoReceitaDespesa?: string; tipo?: string } = {};

    if (!centroCustosData.descricao.trim()) {
      newErrors.descricao = "A descrição é obrigatória!";
    }

    if (!centroCustosData.tipoReceitaDespesa || (centroCustosData.tipoReceitaDespesa !== 'RECEITA' && centroCustosData.tipoReceitaDespesa !== 'DESPESA')) {
      newErrors.tipoReceitaDespesa = "O tipo Receita/Despesa é obrigatório!";
    }

    if (centroCustosData.tipoReceitaDespesa === 'DESPESA' && (!centroCustosData.tipo || (centroCustosData.tipo !== 'CUSTEIO' && centroCustosData.tipo !== 'INVESTIMENTO'))) {
      newErrors.tipo = "O tipo (Custeio/Investimento) é obrigatório para Despesas!";
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

        {/* Tipo Receita/Despesa - Tabs */}
        <div className="flex items-center justify-center mb-6 flex w-full justify-center rounded-lg border overflow-hidden">
          {['RECEITA', 'DESPESA'].map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => !isSaving && handleInputChange({
                target: { name: 'tipoReceitaDespesa', value: tipo }
              } as React.ChangeEvent<HTMLInputElement>)}
              className={`px-4 flex-1 text-center text-lg py-1 font-semibold ${
                centroCustosData.tipoReceitaDespesa === tipo 
                  ? (tipo === 'RECEITA' ? 'bg-green-700 text-white' : 'bg-red-500 text-white')
                  : 'bg-gray-100 text-gray-700'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={isSaving}
            >
              {tipo === 'RECEITA' && 'Receita'}
              {tipo === 'DESPESA' && 'Despesa'}
            </button>
          ))}
        </div>
        {errors.tipoReceitaDespesa && (
          <p className="text-red-500 text-xs mb-4 flex items-center gap-1">
            <FontAwesomeIcon icon={faExclamationCircle} /> {errors.tipoReceitaDespesa}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4">
          {/* Descrição e Tipo na mesma linha quando for Despesa */}
          {centroCustosData.tipoReceitaDespesa === 'DESPESA' ? (
            <div className="flex gap-4">
          {/* Descrição */}
              <div className="flex-1">
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

              {/* Tipo (Custeio/Investimento) - Radio Buttons */}
              <div className="w-64">
                <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo <span className="text-red-500">*</span>
            </label>
                <div className="flex items-center gap-5">
                  <label className={`flex items-center gap-2 cursor-pointer ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="tipo"
                      value="CUSTEIO"
                      checked={centroCustosData.tipo === 'CUSTEIO'}
                      onChange={handleInputChange}
                      className="hidden"
                      disabled={isSaving}
                    />
                    <div
                      className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
                        centroCustosData.tipo === 'CUSTEIO' ? 'bg-orange-500 border-orange-500' : 'border-gray-400'
                      }`}
                      style={{ padding: '0.60rem' }}
                    >
                      {centroCustosData.tipo === 'CUSTEIO' && (
                        <span className="text-white text-md">
                          <FontAwesomeIcon icon={faCheck} />
                        </span>
                      )}
                    </div>
                    <span className={centroCustosData.tipo === 'CUSTEIO' ? 'text-gray-800 font-medium' : 'text-gray-600'}>Custeio</span>
                  </label>

                  <label className={`flex items-center gap-2 cursor-pointer ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
              name="tipo"
                      value="INVESTIMENTO"
                      checked={centroCustosData.tipo === 'INVESTIMENTO'}
              onChange={handleInputChange}
                      className="hidden"
              disabled={isSaving}
                    />
                    <div
                      className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
                        centroCustosData.tipo === 'INVESTIMENTO' ? 'bg-orange-500 border-orange-500' : 'border-gray-400'
                      }`}
                      style={{ padding: '0.60rem' }}
                    >
                      {centroCustosData.tipo === 'INVESTIMENTO' && (
                        <span className="text-white text-md">
                          <FontAwesomeIcon icon={faCheck} />
                        </span>
                      )}
                    </div>
                    <span className={centroCustosData.tipo === 'INVESTIMENTO' ? 'text-gray-800 font-medium' : 'text-gray-600'}>Investimento</span>
                  </label>
                </div>
            {errors.tipo && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.tipo}
              </p>
            )}
          </div>
            </div>
          ) : (
            /* Descrição quando for Receita */
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
          )}
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
