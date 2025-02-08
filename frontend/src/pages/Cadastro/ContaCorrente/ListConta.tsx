import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import { listarContas, excluirConta } from "../../../services/contaCorrenteService";
import ContaCorrenteModal from "./ContaCorrenteModal"; // Importando o Modal
import { ContaCorrente } from "../../../../../backend/src/models/ContaCorrente";

const ListConta: React.FC = () => {
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [filteredContas, setFilteredContas] = useState<ContaCorrente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para controlar o modal
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [contaData, setContaData] = useState<ContaCorrente | null>(null);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    try {
      const data = await listarContas();
      setContas(data);
      setFilteredContas(data);
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    }
  };

  useEffect(() => {
    if (!searchTerm) {
      setFilteredContas(contas);
    } else {
      const filtered = contas.filter((conta) =>
        conta.bancoNome.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredContas(filtered);
    }
  }, [searchTerm, contas]);

  // Abrir o modal para adicionar ou editar conta
  const openModal = (conta?: ContaCorrente) => {
    setContaData(conta || { id: 0, tipo: "contaCorrente", banco: "", agencia: "", numConta: "", numCartao: "", responsavel: "", observacao: "", ativo: true });
    setModalIsOpen(true);
  };

  // Fechar modal
  const closeModal = () => {
    setModalIsOpen(false);
    setContaData(null);
  };

  return (
    <div>
      {/* 🔹 Barra de busca e botão de adicionar */}
      <div className="flex justify-end items-center gap-5 mb-4 border-b pb-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full hover:border-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Pesquisar Conta Corrente"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          className="bg-primary text-white font-bold px-4 py-2 flex items-center rounded hover:bg-orange-400"
          onClick={() => openModal()}
        >
          Nova Conta Corrente <FontAwesomeIcon icon={faPlus} className="ml-3" />
        </button>
      </div>

      {/* 🔹 Listagem de Contas no Formato de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContas.length === 0 ? (
          <p className="text-gray-600 text-center col-span-full">Nenhuma conta encontrada!</p>
        ) : (
          filteredContas.map((conta) => (
            <div 
              key={conta.id} 
              className="bg-white rounded-lg shadow-md p-4 border border-gray-200 relative cursor-pointer"
              onClick={() => openModal(conta)} // Abre o modal ao clicar no card
            >
              {/* Status ativo */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Ativo</span>
                <span className="w-3 h-3 bg-red-400 rounded-full"></span>
              </div>

              {/* Menu de ações */}
              <div className="absolute top-3 right-3 cursor-pointer">
                <FontAwesomeIcon icon={faEllipsisV} className="text-gray-600" />
              </div>

              {/* Nome do banco */}
              <div className="flex flex-col items-center mt-6">
                <span className="text-lg font-bold">{conta.bancoNome.toUpperCase()}</span>
                <p className="text-sm text-gray-600">{conta.agencia} - {conta.responsavel}</p>
                <p className="text-sm text-gray-600">{conta.numConta || "Número não disponível"}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 🔹 Modal para Criar/Editar Conta */}
      {modalIsOpen && contaData && (
        <ContaCorrenteModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          contaData={contaData}
          handleInputChange={(e) => setContaData({ ...contaData, [e.target.name]: e.target.value })}
          handleSave={() => {
            console.log("Salvar conta:", contaData);
            closeModal();
          }}
          isSaving={false}
        />
      )}
    </div>
  );
};

export default ListConta;
