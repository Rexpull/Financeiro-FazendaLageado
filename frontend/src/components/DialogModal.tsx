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
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: DialogType;
  /** When set, the confirm button only enables after the user types this text (irreversible bulk actions). */
  textoConfirmacao?: string;
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
  textoConfirmacao,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [digitado, setDigitado] = useState("");
  const confirmacaoPendente = !!textoConfirmacao && digitado.trim().toUpperCase() !== textoConfirmacao.toUpperCase();
  const fechar = () => {
    setDigitado("");
    onClose();
  };

  // 🔹 Função que ativa o loading ao confirmar
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      fechar(); // Fecha modal após sucesso
    } catch (error) {
      console.error("Erro ao confirmar:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={isProcessing ? undefined : fechar} // Desativa fechar enquanto processa
      className="bg-white p-5 rounded shadow-lg max-w-md mx-auto mt-20 text-center"
      overlayClassName="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-200"
    >
      {/* 🔹 Exibe o ícone correspondente ao tipo */}
      {ICONS[type]}

      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="mb-6 text-gray-700 whitespace-pre-line">{message}</div>

      {textoConfirmacao && (
        <label className="block mb-5 text-left text-sm text-gray-700">
          Para confirmar, digite <strong>{textoConfirmacao}</strong>:
          <input
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            disabled={isProcessing}
            autoFocus
          />
        </label>
      )}

      <div className="flex justify-center gap-3">
        <button
          className="bg-gray-500 text-white w-full px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          onClick={fechar}
          disabled={isProcessing} // 🔹 Desativa enquanto processa
        >
          {cancelLabel}
        </button>

        <button
          className={`${
            type === "error" || type === "warn" ? "bg-red-500 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          } text-white w-full px-4 py-2 rounded flex items-center justify-center disabled:opacity-50`}
          onClick={handleConfirm}
          disabled={isProcessing || confirmacaoPendente} // 🔹 Desativa enquanto processa
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
