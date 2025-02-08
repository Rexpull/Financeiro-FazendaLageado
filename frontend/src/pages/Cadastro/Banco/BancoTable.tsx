import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons';
import { listarBancos, salvarBanco, excluirBanco } from "../../../services/bancoService";
import BancoModal from "./BancoModal";
import { Banco } from "../../../../../backend/src/models/Banco";



const BancoTable: React.FC = () => {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [filteredBancos, setFilteredBancos] = useState<Banco[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [bancoData, setBancoData] = useState<Banco>({ id: 0, nome: "", codigo: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteBancoId, setDeleteBancoId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15); // Quantidade de registros por página

   // 🔹 Buscar bancos ao carregar a página
   const fetchBancos = async () => {
    setIsLoading(true);
    try {
      const data = await listarBancos();
      setBancos(data);
      setFilteredBancos(data);
    } catch (error) {
      console.error("Erro ao buscar bancos:", error);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchBancos();
  }, []);
  


  // 🔹 Filtragem em tempo real
  useEffect(() => {
    if (!searchTerm) {
      setFilteredBancos(bancos);
    } else {
      const filtered = bancos.filter(
        (banco) =>
          banco.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          banco.codigo.includes(searchTerm)
      );
      setFilteredBancos(filtered);
    }
    setCurrentPage(1); // Reinicia a paginação ao filtrar
  }, [searchTerm, bancos]);


  // 🔹 Abrir modal para criar ou editar banco
  const openModal = (banco?: Banco) => {
    setBancoData(banco || { id: 0, nome: "", codigo: "" });
    setModalIsOpen(true);
  };

    // 🔹 Manipular o estado de bancos sem recarregar a lista
    const handleSave = async () => {
      // if (!bancoData.nome || !bancoData.codigo) return;
      setIsSaving(true);
  
      try {
        let bancoSalvo: Banco;
        if (bancoData.id) {
            await salvarBanco(bancoData);
            setBancos((prev) =>
                prev.map((banco) => (banco.id === bancoData.id ? bancoData : banco))
            );
        } else {
            // Criar banco e adicionar ao estado com ID correto
            bancoSalvo = await salvarBanco(bancoData);
            setBancos((prev) => [...prev, bancoSalvo]); // Adiciona novo banco com ID real
        }

        setModalIsOpen(false);
    } catch (error) {
        console.error("Erro ao salvar banco:", error);
    } finally {
        setIsSaving(false);
    }
  };

   // 🔹 Excluir banco com modal de confirmação
   const handleDeleteConfirm = async () => {
    if (deleteBancoId === null) return;
    try {
      await excluirBanco(deleteBancoId);
      setBancos((prev) => prev.filter((banco) => banco.id !== deleteBancoId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir banco:", error);
    }
  };

  // 🔹 Abrir modal de confirmação antes de excluir
  const handleDelete = (id: number) => {
    setDeleteBancoId(id);
    setConfirmModalOpen(true);
  };


    // 🔹 Paginação: calcular registros exibidos
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredBancos.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredBancos.length / itemsPerPage);
  

  return (
    <div>

        <div className="flex justify-end items-center gap-5 mb-4">
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center " style={{ paddingLeft: '0.75rem', color: '#666666'}}>
                    <FontAwesomeIcon icon={faSearch} />
                </span>
                <input
                type="text"
                className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full hover:border-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Filtrar por nome ou código"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
            className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400"
            onClick={() => openModal()}
            >
                Adicionar Banco <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
            </button>
      </div>
        <div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
            </div>
        ) : (
            <>
                <table className="w-full border-collapse"> 
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="p-2">ID</th>
                            <th className="p-2 text-left">Nome</th>
                            <th className="p-2">Código</th>
                            <th className="p-2 pr-11 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                      {currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                            Nenhum movimento encontrado!
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((banco) => (
                          <tr key={banco.id} className="border-b">
                            <td className="p-2 text-center">{banco.id}</td>
                            <td className="p-2 text-left">{banco.nome}</td>
                            <td className="p-2 text-center">{banco.codigo}</td>
                            <td className="p-2 text-right pr-5">
                              <button
                                className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-700"
                                onClick={() => openModal(banco)}
                              >
                                <FontAwesomeIcon icon={faPencil} />
                              </button>
                              <button
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
                                onClick={() => handleDelete(banco.id)}
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                </table>
                {/* 🔹 Paginação */}
                <div className="flex justify-center items-center my-2 mx-2">
                <span className="text-gray-800 text-base w-auto whitespace-nowrap ml-2">{bancos.length} <span className="text-sm">Registros</span></span>


                    <div className="flex items-center gap-2 w-full justify-end">
                        <button
                        className="px-3 py-1 border rounded mx-1"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>

                        <span className="px-3 py-1">{currentPage} / {totalPages}</span>

                        <button
                        className="px-3 py-1 border rounded mx-1"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>

                        <select
                        className="border border-gray-400 p-1 rounded"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        >
                            {[5, 10, 15, 30, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                {size}
                                </option>
                            ))}
                        </select>
                    </div>
                    


                </div>
        </>

        )}
        </div>
      {/* Modal para Criar/Editar Banco */}
      <BancoModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        bancoData={bancoData}
        handleInputChange={(e) => setBancoData({ ...bancoData, [e.target.name]: e.target.value })}
        handleSave={handleSave}
        isSaving={isSaving}
      />

      <DialogModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Atenção"
        type="warn"
        message="Tem certeza que deseja excluir este banco?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default BancoTable;
