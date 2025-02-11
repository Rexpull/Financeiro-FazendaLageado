import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons';
import { listarPlanoContas, salvarPlanoConta, excluirPlanoConta } from "../../../services/planoContasService";
import { PlanoConta } from "../../../../../backend/src/models/PlanoConta";

const PlanoContasTable: React.FC = () => {
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [filteredPlanos, setFilteredPlanos] = useState<PlanoConta[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [planoData, setPlanoData] = useState<PlanoConta>({ id: 0, nivel: 1, hierarquia: "", descricao: "", inativo: false, tipo: "", idReferente: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletePlanoId, setDeletePlanoId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetchPlanos();
  }, []);

  const fetchPlanos = async () => {
    setIsLoading(true);
    try {
      const data = await listarPlanoContas();
      setPlanos(data);
      setFilteredPlanos(data);
    } catch (error) {
      console.error("Erro ao buscar planos de contas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!searchTerm) {
      setFilteredPlanos(planos);
    } else {
      const filtered = planos.filter(
        (plano) =>
          plano.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          plano.hierarquia.includes(searchTerm)
      );
      setFilteredPlanos(filtered);
    }
    setCurrentPage(1);
  }, [searchTerm, planos]);

  const openModal = (plano?: PlanoConta) => {
    setPlanoData(plano || { id: 0, nivel: 1, hierarquia: "", descricao: "", inativo: false, tipo: "", idReferente: null });
    setModalIsOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (planoData.id) {
        await salvarPlanoConta(planoData);
        setPlanos((prev) =>
          prev.map((plano) => (plano.id === planoData.id ? planoData : plano))
        );
      } else {
        const planoSalvo = await salvarPlanoConta(planoData);
        setPlanos((prev) => [...prev, planoSalvo]);
      }
      setModalIsOpen(false);
    } catch (error) {
      console.error("Erro ao salvar plano de contas:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletePlanoId === null) return;
    try {
      await excluirPlanoConta(deletePlanoId);
      setPlanos((prev) => prev.filter((plano) => plano.id !== deletePlanoId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir plano de contas:", error);
    }
  };

  const handleDelete = (id: number) => {
    setDeletePlanoId(id);
    setConfirmModalOpen(true);
  };


   // 🔹 Paginação: calcular registros exibidos
   const indexOfLastItem = currentPage * itemsPerPage;
   const indexOfFirstItem = indexOfLastItem - itemsPerPage;
   const currentItems = filteredPlanos.slice(indexOfFirstItem, indexOfLastItem);
   const totalPages = Math.ceil(filteredPlanos.length / itemsPerPage);
 

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
                placeholder="Filtrar por hierarquia ou descrição"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
            className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400"
            onClick={() => openModal()}
            >
                Adicionar Plano de Contas <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
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
                            <th className="p-2">Hierarquia</th>
                            <th className="p-2 text-left">Nivel</th>
                            <th className="p-2">Descrição</th>
                            <th className="p-2">Tipo</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 pr-11 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                      {currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                            Nenhum movimento encontrado!
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((planoC) => (
                          <tr key={planoC.id} className="border-b">
                            <td className="p-2 text-center">{planoC.hierarquia}</td>
                            <td className="p-2 text-left flex items-center gap-2">
                              {planoC.nivel}
                            </td>
                            <td className="p-2 text-center">{planoC.descricao}</td>
                            <td className="p-2 text-center">{planoC.tipo}</td>
                            <td className="p-2 text-center">{planoC.inativo}</td>

                            <td className="p-2 text-right pr-5">
                              <button
                                className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-700"
                                onClick={() => openModal(planoC)}
                              >
                                <FontAwesomeIcon icon={faPencil} />
                              </button>
                              <button
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
                                onClick={() => handleDelete(planoC.id)}
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
                <span className="text-gray-800 text-base w-auto whitespace-nowrap ml-2">{planos.length} <span className="text-sm">Registros</span></span>


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

export default PlanoContasTable;
