import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { listarContas } from "../../../../services/contaCorrenteService";
import { getBancoLogo } from "../../../../Utils/bancoUtils";

Modal.setAppElement("#root");

/** Fields of /api/contas this modal shows (the service type does not describe them). */
export interface ContaOpcao {
  id: number;
  bancoNome?: string;
  bancoCodigo?: string;
  numConta?: string;
  responsavel?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `contas` = the whole list, so the caller can name other accounts (e.g. the origin of a move). */
  onSelect: (conta: any, contas: ContaOpcao[]) => void;
  titulo?: string;
  /**
   * true (default): the chosen account becomes the account of the screen (localStorage "contaSelecionada").
   * false: only report the choice — e.g. the destination of "Editar conta" of an OFX import.
   */
  salvarComoContaAtual?: boolean;
  /** Account highlighted as the current one (default: the screen's account). */
  contaDestacadaId?: number | null;
}

const SelecionarContaModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  titulo = "Selecione a Conta Corrente",
  salvarComoContaAtual = true,
  contaDestacadaId,
}) => {
  const [contas, setContas] = useState<ContaOpcao[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [contaAtualId, setContaAtualId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchContas = async () => {
      setIsLoading(true);
      try {
        setContas((await listarContas()) as unknown as ContaOpcao[]);
      } catch (error) {
        console.error("Erro ao carregar contas:", error);
        setContas([]);
      } finally {
        setIsLoading(false);
      }
    };
    if (isOpen) {
      setSearchTerm("");
      fetchContas();
      const storedConta = localStorage.getItem("contaSelecionada");
      setContaAtualId(storedConta ? JSON.parse(storedConta)?.id ?? null : null);
    }
  }, [isOpen]);

  // Case-insensitive on bank, account number and holder ("sicoob" finds "SICOOB GFS")
  const busca = searchTerm.trim().toLowerCase();
  const filteredContas = contas.filter(
    (conta) =>
      !busca ||
      [conta.bancoNome, conta.numConta, conta.responsavel].some((campo) => String(campo ?? "").toLowerCase().includes(busca))
  );
  const idDestacado = contaDestacadaId !== undefined ? contaDestacadaId : contaAtualId;

  const handleSelectConta = (conta: ContaOpcao) => {
    if (salvarComoContaAtual) {
      localStorage.setItem("contaSelecionada", JSON.stringify(conta));
    }
    onSelect(conta, contas);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[600px] max-h-[90vh] mx-auto p-5 z-50 flex flex-col"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center border-b pb-3 flex-shrink-0">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
          <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>
      </div>

      {/* 🔹 Campo de Busca */}
      <input
        type="text"
        placeholder="Buscar conta (banco, número ou titular)..."
        className="w-full p-2 mt-3 border border-gray-300 rounded flex-shrink-0"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={isLoading}
      />

      {/* 🔹 Lista de Contas */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-5">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
          </div>
        ) : filteredContas.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhuma conta encontrada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredContas.map((conta) => (
              <button
                type="button"
                key={conta.id}
                className={`flex flex-col items-center bg-gray-100 rounded-lg p-3 border cursor-pointer transition ${
                  idDestacado === conta.id ? "border-orange-200 bg-orange-50 shadow-md hover:bg-orange-200" : "hover:bg-gray-200"
                }`}
                onClick={() => handleSelectConta(conta)}
              >
                <img src={getBancoLogo(conta.bancoCodigo ?? "")} alt="" className="w-10 h-10 mb-2" />
                <span className="block text-sm font-bold">{conta.bancoNome}</span>
                <span className="block text-xs text-gray-600">{conta.numConta} - {conta.responsavel}</span>
                {idDestacado === conta.id && <span className="block text-[11px] text-orange-700 mt-1">Conta atual</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 🔹 Rodapé */}
      <div className="flex justify-end border-t pt-3 mt-4 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded hover:bg-gray-200 font-semibold"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
};

export default SelecionarContaModal;
