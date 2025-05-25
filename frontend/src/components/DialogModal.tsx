import React, { useState } from "react";
import Modal from "react-modal";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";

// 🔹 Definição dos tipos de modal disponíveis
type DialogType = "info" | "warn" | "error" | "success";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>; // Agora `onConfirm` pode ser assíncrono
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: DialogType;
}

// 🔹 Ícones correspondentes para cada tipo de mensagem
const ICONS = {
  info: <FaInfoCircle className="text-blue-500 text-6xl mx-auto mb-3" />,
  warn: <FaExclamationTriangle className="text-yellow-500 text-6xl mx-auto mb-3" />,
  error: <FaTimesCircle className="text-red-500 text-6xl mx-auto mb-3" />,
  success: <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-3" />,
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  type = "info",
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // 🔹 Função que ativa o loading ao confirmar
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose(); // Fecha modal após sucesso
    } catch (error) {
      console.error("Erro ao confirmar:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={isProcessing ? undefined : onClose} // Desativa fechar enquanto processa
      className="bg-white p-5 rounded shadow-lg max-w-md mx-auto mt-20 text-center"
      overlayClassName="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-200"
    >
      {/* 🔹 Exibe o ícone correspondente ao tipo */}
      {ICONS[type]}

      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <p className="mb-6 text-gray-700">{message}</p>

      <div className="flex justify-center gap-3">
        <button
          className="bg-gray-500 text-white w-full px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          onClick={onClose}
          disabled={isProcessing} // 🔹 Desativa enquanto processa
        >
          {cancelLabel}
        </button>

        <button
          className="bg-red-500 text-white w-full px-4 py-2 rounded hover:bg-red-700 flex items-center justify-center disabled:opacity-50"
          onClick={handleConfirm}
          disabled={isProcessing} // 🔹 Desativa enquanto processa
        >
          {isProcessing ? (
            <>
              <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full mr-2"></div> 
              Processando...
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
