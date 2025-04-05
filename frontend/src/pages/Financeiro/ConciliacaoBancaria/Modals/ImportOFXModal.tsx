import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave } from "@fortawesome/free-solid-svg-icons";
import SelectContaCorrente from "../Modals/SelectContaCorrente";
import ConciliacaoOFXModal from "../ConciliacaoOFX";
import { parseOFXFile, TotalizadoresOFX } from "../../../../Utils/parseOfxFile";
import { MovimentoBancario } from "../../../../../../backend/src/models/MovimentoBancario";

Modal.setAppElement("#root");

interface ImportOFXProps {
  isOpen: boolean;
  onClose: () => void;
  handleImport: (file: File) => void;
}

const ImportOFXModal: React.FC<ImportOFXProps> = ({ isOpen, onClose, handleImport }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [modalContaIsOpen, setModalContaIsOpen] = useState(false);
  const [modalConciliacaoIsOpen, setModalConciliacaoIsOpen] = useState(false);
  const [movimentosOFX, setMovimentosOFX] = useState<MovimentoBancario[]>([]);
  const [totalizadores, setTotalizadores] = useState<TotalizadoresOFX>({
    receitas: 0,
    despesas: 0,
    liquido: 0,
    saldoFinal: 0,
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setError("");
    }
  }, [isOpen]);


  // 🔹 Função para validar e armazenar o arquivo
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      setError("Nenhum arquivo selecionado.");
      return;
    }

    // 🔹 Verifica se a extensão do arquivo é .ofx
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      setSelectedFile(null);
      setError("Apenas arquivos .OFX são permitidos.");
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  const handleConfirmImport = async () => {
    if (selectedFile) {
      try {
        const { movimentos, totalizadores } = await parseOFXFile(selectedFile);
        console.log("Movimentos OFX:", movimentos);
        setMovimentosOFX(movimentos);
        setTotalizadores(totalizadores);
        setModalContaIsOpen(true);
        onClose();
      } catch (error) {
        setError("Erro ao processar o arquivo OFX.");
      }
    }
  };

  const handleSelectConta = () => {
    setModalContaIsOpen(false);
    setModalConciliacaoIsOpen(true);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={() => {}} 
        shouldCloseOnOverlayClick={false} 
        className="bg-white rounded-lg shadow-lg w-full max-w-[500px] mx-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        {/* 🔹 Cabeçalho */}
        <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
          <h2 className="text-xl font-semibold text-gray-800">Buscar Arquivo OFX</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FontAwesomeIcon icon={faTimes} size="xl" />
          </button>
        </div>

        {/* 🔹 Corpo do Modal */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo OFX</label>
          <input
            type="file"
            accept=".ofx"
            className="w-full p-2 border border-gray-300 rounded bg-white cursor-pointer"
            onChange={handleFileChange}
          />
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>

        {/* 🔹 Botão de Importação */}
        <div className="p-4 flex justify-end border-t">
          <button
            className={`text-white font-semibold px-5 py-2 rounded flex items-center gap-2 transition ${
              selectedFile ? "bg-red-500 hover:bg-red-600" : "bg-gray-300 cursor-not-allowed"
            }`}
            onClick={handleConfirmImport}
            disabled={!selectedFile}
          >
            <FontAwesomeIcon icon={faSave} />
            Importar
          </button>
        </div>
      </Modal>
      <SelectContaCorrente isOpen={modalContaIsOpen} onClose={() => setModalContaIsOpen(false)} onSelect={handleSelectConta} />
      <ConciliacaoOFXModal isOpen={modalConciliacaoIsOpen} onClose={() => setModalConciliacaoIsOpen(false)} movimentos={movimentosOFX} totalizadores={totalizadores} />
    </>
  );
};

export default ImportOFXModal;
