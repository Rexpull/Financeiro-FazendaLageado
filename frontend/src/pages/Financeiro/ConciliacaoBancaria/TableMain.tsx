import React, { useEffect, useState } from "react";
import DialogModal from "../../../components/DialogModal";
import LancamentoManual from "./Modals/LancarManual";
import ImportOFXModal from "./Modals/ImportOFXModal";
import FiltroMovimentosModal from "./Modals/FiltroMovimentos";
import SelectContaCorrente from "./Modals/SelectContaCorrente"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil, faFileArchive, faFileExcel, faFilePdf, faExchange, faExchangeAlt, faChevronDown, faBank } from '@fortawesome/free-solid-svg-icons';
import { listarMovimentosBancarios, salvarMovimentoBancario, excluirMovimentoBancario } from "../../../services/movimentoBancarioService";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";
import { log } from "console";


const MovimentoBancarioTable: React.FC = () => {
  const [movimentos, setMovimentos] = useState<MovimentoBancario[]>([]);
  const [filteredMovimentos, setFilteredMovimentos] = useState<MovimentoBancario[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [acoesMenu, setAcoesMenu] = useState(false);
  const [modalImportOFXIsOpen, setModalImportOFXIsOpen] = useState(false);
  const [modalFiltroMovimentosIsOpen, setModalFiltroMovimentosIsOpen] = useState(false);
	const [modalContaIsOpen, setModalContaIsOpen] = useState(false);
	const [contaSelecionada, setContaSelecionada] = useState(() => {
    const storedConta = localStorage.getItem("contaSelecionada");
    return storedConta ? JSON.parse(storedConta) : null;
  });
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
  const [deleteMovimentoId, setDeleteMovimentoId] = useState<number | null>(null);

  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetchMovimentos();
  }, []);

	useEffect(() => {
		if (!contaSelecionada) {
			setModalContaIsOpen(true);
		}
	}, [contaSelecionada]);

	const handleSelectConta = (conta) => {
		setContaSelecionada(conta);
		localStorage.setItem("contaSelecionada", JSON.stringify(conta));
	};


  const fetchMovimentos = async () => {
    setIsLoading(true);
    try {
      const data = await listarMovimentosBancarios();
			setMovimentos(data);
      setFilteredMovimentos(data);
    } catch (error) {
      console.error("Erro ao buscar Movimentos Bancários:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...movimentos];

    setFilteredMovimentos(filtered);
    setCurrentPage(1);
  }, [movimentos]);

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
      console.log("Movimento a ser salvo:", movimentoData);
      if (movimentoData.id) {
        await salvarMovimentoBancario(movimentoData);
        setMovimentos((prev) =>
					prev.map((movimento) => (movimento.id === movimentoData.id ? { ...movimentoData } : { ...movimento }))
				);

      } else {
        const movimentoSalvo = await salvarMovimentoBancario(movimentoData);
        setMovimentos((prev) => [...prev, movimentoSalvo]);
      }
      setModalIsOpen(false);
      fetchMovimentos();
    } catch (error) {
      console.error("Erro ao salvar movimento bancário:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteMovimentoId === null) return;
    try {
      await excluirMovimentoBancario(deleteMovimentoId);
      setMovimentos((prev) => prev.filter((movimento) => movimento.id !== deleteMovimentoId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir movimento bancário:", error);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteMovimentoId(id);
    setConfirmModalOpen(true);
  };

   // 🔹 Paginação: calcular registros exibidos
   const indexOfLastItem = currentPage * itemsPerPage;
   const indexOfFirstItem = indexOfLastItem - itemsPerPage;
   const currentItems = filteredMovimentos.slice(indexOfFirstItem, indexOfLastItem);
   const totalPages = Math.ceil(filteredMovimentos.length / itemsPerPage);


  return (
    <div>

        <div className="flex justify-between items-end gap-5 mb-4">
          <div className="flex items-end gap-3 relative w-auto whitespace-nowrap">
							<div className="relative w-auto whitespace-nowrap">
								<button className="bg-gray-50 font-bold h-10 px-4 pt-0 pb-0 flex items-center rounded-md border border-gray-300 hover:bg-gray-100"
								onClick={() => setModalContaIsOpen(true)} >
										{contaSelecionada ? `${contaSelecionada.numConta} - ${contaSelecionada.bancoNome} - ${contaSelecionada.responsavel}` : "Selecionar Conta"}

										<FontAwesomeIcon style={{marginLeft: '10px'}} icon={faBank}/>
								</button>
							</div>
							<div className="relative w-auto whitespace-nowrap">
								<div className="relative w-auto whitespace-nowrap">
									<button
									className="bg-gray-50 font-bold h-8 px-4 pt-0 pb-0 flex items-center rounded-lg border border-gray-300 hover:bg-gray-100"
									onClick={() => setAcoesMenu(!acoesMenu)}
									>
									Ações <FontAwesomeIcon icon={faChevronDown} className="ml-3" />
									</button>
								</div>
								{acoesMenu && (
									<div className="absolute flex flex-col bg-white shadow-md font-medium rounded-md border p-1 mt-2 z-10" style={{width: "9rem"}}>
										<button>
											<p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100">
												<FontAwesomeIcon icon={faExchange} className="mr-2"/>
												Transferir
											</p>
										</button>
										<button>
											<p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100" style={{opacity: '0.5'}}>
												<FontAwesomeIcon icon={faFilePdf} className="mr-2"/>
												Imprimir PDF
											</p>
										</button>
										<button>
											<p className="font-bold text-sm rounded text-left text-gray-800 px-2 py-1 hover:bg-gray-100" style={{opacity: '0.5'}}>
												<FontAwesomeIcon icon={faFileExcel} className="mr-2"/>
												Imprimir Excel
											</p>
										</button>

									</div>
								)}
							</div>
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
                <table className="w-full border-collapse">
                    <thead>

                        <tr className="bg-gray-200">

                          <th className="p-2 text-left">Data do Movimento</th>
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
                        currentItems.map((movBancario) => (
                          <tr key={movBancario.id} className="border-b">
                            <td className="p-2 text-left">
                              {movBancario.dtMovimento}
                            </td>
                            <td className="p-2 text-left">{movBancario.historico}</td>

                            <td className="p-2 text-left">{movBancario.idPlanoContas}</td>
                            <td className="p-2 text-center capitalize">{movBancario.valor}</td>
														<td className="p-2 text-center capitalize">{movBancario.saldo}</td>
														<td className="p-2 text-center capitalize">{movBancario.ideagro ? 'ativo' : 'Inativo'}</td>

                            <td className="p-2 text-right pr-5">
                              <button
                                className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-700"
                                onClick={() => openModal(movBancario)}
                              >
                                <FontAwesomeIcon icon={faPencil} />
                              </button>
                              <button
                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
                                onClick={() => handleDelete(movBancario.id)}
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
                <span className="text-gray-800 text-base w-auto whitespace-nowrap ml-2">{movimentos.length} <span className="text-sm">Registros</span></span>


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
        message="Tem certeza que deseja excluir este Movimento Bancário?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />

			<SelectContaCorrente
				isOpen={modalContaIsOpen}
				onClose={() => setModalContaIsOpen(false)}
				onSelect={handleSelectConta}
			/>
    </div>
  );
};

export default MovimentoBancarioTable;
