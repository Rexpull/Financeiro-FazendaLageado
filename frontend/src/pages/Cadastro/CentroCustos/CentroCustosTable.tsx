import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons';
import { listarCentroCustos, salvarCentroCustos, excluirCentroCustos } from "../../../services/centroCustosService";
import CentroCustosModal from "./CentroCustosModal";
import { CentroCustos } from "../../../../../backend/src/models/CentroCustos";

Modal.setAppElement("#root");

const CentroCustosTable: React.FC = () => {
  const [centroCustos, setCentroCustos] = useState<CentroCustos[]>([]);
  const [filteredCentroCustos, setFilteredCentroCustos] = useState<CentroCustos[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [centroCustosData, setCentroCustosData] = useState<CentroCustos>({ id: 0, descricao: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteCentroCustosId, setDeleteCentroCustosId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const fetchCentroCustos = async () => {
    setIsLoading(true);
    try {
      const data = await listarCentroCustos();
      setCentroCustos(data);
      setFilteredCentroCustos(data);
    } catch (error) {
      console.error("Erro ao buscar centro de custos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCentroCustos();
  }, []);
  
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCentroCustos(centroCustos);
    } else {
      const filtered = centroCustos.filter(
        (centro) =>
          centro.descricao.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCentroCustos(filtered);
    }
    setCurrentPage(1); 
  }, [searchTerm, centroCustos]);

  const openModal = (centroCustos?: CentroCustos) => {
    setCentroCustosData(centroCustos || { id: 0, descricao: "" });
    setModalIsOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      let centroCustosSalvo: CentroCustos;
      if (centroCustosData.id) {
          await salvarCentroCustos(centroCustosData);
          setCentroCustos((prev) =>
              prev.map((centro) => (centro.id === centroCustosData.id ? centroCustosData : centro))
          );
      } else {
          centroCustosSalvo = await salvarCentroCustos(centroCustosData);
          setCentroCustos((prev) => [...prev, centroCustosSalvo]);
      }

      setModalIsOpen(false);
  } catch (error) {
      console.error("Erro ao salvar centro de custos:", error);
  } finally {
      setIsSaving(false);
  }
};

  const handleDeleteConfirm = async () => {
    if (deleteCentroCustosId === null) return;
    try {
      await excluirCentroCustos(deleteCentroCustosId);
      setCentroCustos((prev) => prev.filter((centro) => centro.id !== deleteCentroCustosId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir centro de custos:", error);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteCentroCustosId(id);
    setConfirmModalOpen(true);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCentroCustos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCentroCustos.length / itemsPerPage);

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
            placeholder="Filtrar por descrição"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400"
          onClick={() => openModal()}
        >
          Adicionar Centro de Custos <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
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
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 pr-11 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                      Nenhum centro de custos encontrado!
                    </td>
                  </tr>
                ) : (
                  currentItems.map((centro) => (
                    <tr key={centro.id} className="border-b">
                      <td className="p-2 text-center">{centro.id}</td>
                      <td className="p-2 text-left">{centro.descricao}</td>
                      <td className="p-2 text-right pr-5">
                        <button
                          className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-700"
                          onClick={() => openModal(centro)}
                        >
                          <FontAwesomeIcon icon={faPencil} />
                        </button>
                        <button
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
                          onClick={() => handleDelete(centro.id)}
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
              <span className="text-gray-800 text-base w-auto whitespace-nowrap ml-2">{centroCustos.length} <span className="text-sm">Registros</span></span>

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

      <CentroCustosModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        centroCustosData={centroCustosData}
        handleInputChange={(e) => setCentroCustosData({ ...centroCustosData, [e.target.name]: e.target.value })}
        handleSave={handleSave}
        isSaving={isSaving}
      />

      <DialogModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Atenção"
        type="warn"
        message="Tem certeza que deseja excluir este centro de custos?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default CentroCustosTable;
