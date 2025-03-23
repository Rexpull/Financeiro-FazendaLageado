import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { listarContas } from "../../../../services/contaCorrenteService";
import { getBancoLogo } from "../../../../Utils/bancoUtils";

Modal.setAppElement("#root");

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (conta: any) => void;
}

const SelecionarContaModal: React.FC<ModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [contas, setContas] = useState([]);
  const [filteredContas, setFilteredContas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState<any | null>(null);

  useEffect(() => {
    const fetchContas = async () => {
      const data = await listarContas();
      setContas(data);
      setFilteredContas(data);
    };
    if (isOpen) {
      fetchContas();
      const storedConta = localStorage.getItem("contaSelecionada");
      if (storedConta) {
        setContaSelecionada(JSON.parse(storedConta));
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = contas.filter(
      (conta) =>
        conta.bancoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.numConta.includes(searchTerm) ||
		conta.responsavel.includes(searchTerm)
    );
    setFilteredContas(filtered);
  }, [searchTerm, contas]);

  const handleSelectConta = (conta: any) => {
    setContaSelecionada(conta);
    localStorage.setItem("contaSelecionada", JSON.stringify(conta));
    onSelect(conta);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[600px] mx-auto p-5 z-50 "
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 "
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-lg font-bold">Selecione a Conta Corrente</h2>

      </div>

      {/* 🔹 Campo de Busca */}
      <input
        type="text"
        placeholder="Buscar conta..."
        className="w-full p-2 mt-3 border border-gray-300 rounded"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* 🔹 Lista de Contas */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        {filteredContas.map((conta) => (
          <div
            key={conta.id}
            className={`flex flex-col items-center bg-gray-100 rounded-lg p-3 border cursor-pointer transition ${
              contaSelecionada && contaSelecionada.id === conta.id ? "border-orange-200 bg-orange-50 shadow-md hover:bg-orange-200" : "hover:bg-gray-200"
            }`}
            onClick={() => handleSelectConta(conta)}
          >
            <img src={getBancoLogo(conta.bancoCodigo)} alt="Banco" className="w-10 h-10 mb-2" />
            <p className="text-sm font-bold">{conta.bancoNome}</p>
            <p className="text-xs text-gray-600">{conta.numConta} - {conta.responsavel}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SelecionarContaModal;
