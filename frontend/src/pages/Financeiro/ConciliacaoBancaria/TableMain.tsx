import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal";
import CrudModal from "./CrudModal";
import LancamentoManual from "./LancarManual";
import ImportOFXModal from "./ImportOFXModal";
import FiltroMovimentosModal from "./FiltroMovimentosModal";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil, faFileArchive } from '@fortawesome/free-solid-svg-icons';
import { listarPlanoContas, salvarPlanoConta, excluirPlanoConta, atualizarStatusConta } from "../../../services/planoContasService";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";

const MovimentoBancarioTable: React.FC = () => {
  const [planos, setPlanos] = useState<MovimentoBancario[]>([]);
  const [filteredPlanos, setFilteredPlanos] = useState<MovimentoBancario[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalImportOFXIsOpen, setModalImportOFXIsOpen] = useState(false);
  const [modalFiltroMovimentosIsOpen, setModalFiltroMovimentosIsOpen] = useState(false);
  
  const [movimentoData, setMovimentoData] = useState<MovimentoBancario>({
    id: 0,
    dtMovimento: new Date().toISOString(),
    historico: "",
    idPlanoContas: 0,
    idContaCorrente: 0,
    valor: 0,
    saldo: 0,
    ideagro: false,
    identificadorOfx: "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletePlanoId, setDeletePlanoId] = useState<number | null>(null);

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
      // setPlanos(data);
      // setFilteredPlanos(data);
    } catch (error) {
      console.error("Erro ao buscar planos de contas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...planos];


    setFilteredPlanos(filtered);
    setCurrentPage(1); // Reinicia a página ao alterar os filtros
  }, [planos]);

  const handleImportFile = (file: File) => {
    console.log("Arquivo importado:", file);
    // Aqui você pode processar o arquivo OFX
  };

  const handleSearchFilters = (filters: { dataInicio: string; dataFim: string; status: string }) => {
    console.log("Filtros aplicados:", filters);
    // Aqui você pode fazer a requisição para buscar os movimentos filtrados
  };


  const openModal = (movimento?: MovimentoBancario) => {
    setModalIsOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // if (movimentoData.id) {
      //   await salvarPlanoConta(movimentoData);
      //   setPlanos((prev) =>
      //     prev.map((plano) => (plano.id === movimentoData.id ? movimentoData : plano))
      //   );
      // } else {
      //   const planoSalvo = await salvarPlanoConta(planoData);
      //   setPlanos((prev) => [...prev, planoSalvo]);
      // }
      setModalIsOpen(false);
      fetchPlanos();
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

        <div className="flex justify-between items-end gap-5 mb-4">
          <div className="relative w-auto whitespace-nowrap">

            teste
          </div>
          <div className="flex justify-end items-center gap-3 w-full">
            <button
            className="bg-gray-200 text-black font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-gray-300"
            onClick={() => setModalFiltroMovimentosIsOpen(true)}
            >
                Pesquisar <FontAwesomeIcon icon={faSearch} className="ml-3 font-bold" />
            </button>
            <button
            className="bg-suport text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400"
            onClick={() => openModal()}
            >
                Lançar Manual <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
            </button>
            <button
            className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-500"
            onClick={() => setModalImportOFXIsOpen(true)}
            >
                Buscar OFX <FontAwesomeIcon icon={faFileArchive} className="ml-3 font-bold" />
            </button>
          </div>
      </div>
        <div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
            </div>
        ) : (
            <>
                {/* <table className="w-full border-collapse"> 
                    <thead>
                    
                        <tr className="bg-gray-200">
                          
                          <th className="p-2 text-center">Data do Movimento</th>
                          <th className="p-2 text-left">Histórico</th>
                          <th className="p-2 text-center">Plano Contas</th>
                          <th className="p-2 text-center">Valor R$</th>

                          <th className="p-2 text-center">Saldo R$</th>
                          <th className="p-2 pr-11 text-right">IdeAgri</th>
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
                            <td className="p-2 text-center">
                              {planoC.nivel}
                            </td>
                            <td className="p-2 text-left">{planoC.hierarquia}</td>
                            
                            <td className="p-2 text-left">{planoC.descricao}</td>
                            <td className="p-2 text-center capitalize">{planoC.tipo.toLowerCase()}</td>
                            <td className="p-2 text-right">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={!planoC.inativo}
                                  onChange={() => handleStatusChange(planoC.id, !planoC.inativo)}
                                />
                                <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                              </label>
                            </td>

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

                </table> */}
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
      <LancamentoManual
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        handleSave={handleSave}
        isSaving={isSaving}
      />

      <ImportOFXModal
        isOpen={modalImportOFXIsOpen}
        onClose={() => setModalImportOFXIsOpen(false)}
        handleImport={handleImportFile}
      />

      <FiltroMovimentosModal
        isOpen={modalFiltroMovimentosIsOpen}
        onClose={() => setModalFiltroMovimentosIsOpen(false)}
        handleSearch={handleSearchFilters}
      />

      <DialogModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Atenção"
        type="warn"
        message="Tem certeza que deseja excluir este Plano de Conta?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default MovimentoBancarioTable;
