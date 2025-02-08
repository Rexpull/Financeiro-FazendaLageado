import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

Modal.setAppElement("#root");

interface ContaCorrenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  contaData: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSave: () => void;
  isSaving: boolean;
}

const ContaCorrenteModal: React.FC<ContaCorrenteModalProps> = ({
  isOpen,
  onClose,
  contaData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [tipo, setTipo] = useState<"contaCorrente" | "cartao">(contaData.tipo || "contaCorrente");

  // Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { [key: string]: string } = {};

    if (!contaData.banco) newErrors.banco = "O banco é obrigatório!";
    if (!contaData.responsavel) newErrors.responsavel = "O responsável é obrigatório!";
    
    if (tipo === "contaCorrente") {
      if (!contaData.agencia) newErrors.agencia = "A agência é obrigatória!";
      if (!contaData.numConta) newErrors.numConta = "O número da conta é obrigatório!";
    } else {
      if (!contaData.numCartao) newErrors.numCartao = "O número do cartão é obrigatório!";
      if (!contaData.validade) newErrors.validade = "A validade é obrigatória!";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      handleSave();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="bg-white rounded-lg shadow-lg w-[500px] h-[95vh] p-6 overflow-y-auto z-50 mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-xl font-semibold">{tipo === "contaCorrente" ? "Cadastro de Conta Corrente" : "Cadastro de Cartão"}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Alternar entre Conta e Cartão */}
      <div className="flex justify-center mt-4">
        <button
          className={`px-4 py-2 font-bold rounded-l ${tipo === "contaCorrente" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
          onClick={() => setTipo("contaCorrente")}
        >
          Conta
        </button>
        <button
          className={`px-4 py-2 font-bold rounded-r ${tipo === "cartao" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
          onClick={() => setTipo("cartao")}
        >
          Cartão
        </button>
      </div>

      {/* 🔹 Formulário */}
      <div className="mt-6">
        <div className="mb-4">
          <label className="block text-sm font-medium">Banco *</label>
          <input
            type="text"
            name="banco"
            className={`w-full p-2 border ${errors.banco ? "border-red-500" : "border-gray-300"} rounded`}
            placeholder="Banco"
            value={contaData.banco}
            onChange={handleInputChange}
            disabled={isSaving}
          />
          {errors.banco && <p className="text-red-500 text-xs mt-1">{errors.banco}</p>}
        </div>

        {tipo === "contaCorrente" ? (
          <>
            {/* 🔹 Campos para Conta Corrente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Agência *</label>
                <input
                  type="text"
                  name="agencia"
                  className={`w-full p-2 border ${errors.agencia ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Agência"
                  value={contaData.agencia}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.agencia && <p className="text-red-500 text-xs mt-1">{errors.agencia}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">N° Conta *</label>
                <input
                  type="text"
                  name="numConta"
                  className={`w-full p-2 border ${errors.numConta ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Número da Conta"
                  value={contaData.numConta}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.numConta && <p className="text-red-500 text-xs mt-1">{errors.numConta}</p>}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 🔹 Campos para Cartão */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Número do Cartão *</label>
                <input
                  type="text"
                  name="numCartao"
                  className={`w-full p-2 border ${errors.numCartao ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Número do Cartão"
                  value={contaData.numCartao}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.numCartao && <p className="text-red-500 text-xs mt-1">{errors.numCartao}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium">Data de Validade *</label>
                <input
                  type="date"
                  name="validade"
                  className={`w-full p-2 border ${errors.validade ? "border-red-500" : "border-gray-300"} rounded`}
                  value={contaData.validade}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.validade && <p className="text-red-500 text-xs mt-1">{errors.validade}</p>}
              </div>
            </div>
          </>
        )}

        {/* 🔹 Responsável */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Responsável *</label>
          <input
            type="text"
            name="responsavel"
            className={`w-full p-2 border ${errors.responsavel ? "border-red-500" : "border-gray-300"} rounded`}
            placeholder="Responsável"
            value={contaData.responsavel}
            onChange={handleInputChange}
            disabled={isSaving}
          />
          {errors.responsavel && <p className="text-red-500 text-xs mt-1">{errors.responsavel}</p>}
        </div>

        {/* 🔹 Observação */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Observação</label>
          <textarea
            name="observacao"
            className="w-full p-2 border border-gray-300 rounded"
            rows={3}
            placeholder="Observações..."
            value={contaData.observacao}
            onChange={handleInputChange}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* 🔹 Botões */}
      <div className="flex justify-end gap-3 p-4 mt-5 border-t">
        <button className="bg-gray-300 text-gray-700 px-5 py-2 rounded" onClick={onClose} disabled={isSaving}>
          Cancelar
        </button>
        <button className="bg-red-500 text-white px-5 py-2 rounded flex items-center gap-2" onClick={validateAndSave} disabled={isSaving}>
          <FontAwesomeIcon icon={faSave} />
          Salvar
        </button>
      </div>
    </Modal>
  );
};

export default ContaCorrenteModal;
