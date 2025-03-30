import React, { useEffect, useState, useRef } from "react";
import DialogModal from "../../../components/DialogModal";
import LancamentoManual from "./Modals/LancarManual";
import ImportOFXModal from "./Modals/ImportOFXModal";
import FiltroMovimentosModal from "./Modals/FiltroMovimentos";
import SelectContaCorrente from "./Modals/SelectContaCorrente";
import Transferir from "./Modals/Transferir";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil, faFileArchive, faFileExcel, faFilePdf, faExchange, faExchangeAlt, faChevronDown, faBank, faEllipsisV } from '@fortawesome/free-solid-svg-icons';
import { listarMovimentosBancarios, salvarMovimentoBancario, excluirMovimentoBancario } from "../../../services/movimentoBancarioService";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";
import {salvarParcelaFinanciamento} from "../../../services/financiamentoParcelasService"

const MovimentoBancarioTable: React.FC = () => {
  const [movimentos, setMovimentos] = useState<MovimentoBancario[]>([]);
  const [filteredMovimentos, setFilteredMovimentos] = useState<MovimentoBancario[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [acoesMenu, setAcoesMenu] = useState(false);
  const [modalImportOFXIsOpen, setModalImportOFXIsOpen] = useState(false);
  const [modalFiltroMovimentosIsOpen, setModalFiltroMovimentosIsOpen] = useState(false);
	const [modalContaIsOpen, setModalContaIsOpen] = useState(false);
	const [modalTransferirIsOpen, setModalTransferirIsOpen] = useState(false);
	const [contaSelecionada, setContaSelecionada] = useState(() => {
    const storedConta = localStorage.getItem("contaSelecionada");
    return storedConta ? JSON.parse(storedConta) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteMovimentoId, setDeleteMovimentoId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAtivoId, setMenuAtivoId] = useState<number | null>(null);
  const [planos, setPlanos] = useState<{id: number, descricao: string}[]>([]);

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
    let contaAtt = localStorage.getItem("contaSelecionada");

    const parsedConta = contaAtt ? JSON.parse(contaAtt) : null;
    console.log(parsedConta);
    console.log(movimentos);
    setFilteredMovimentos(movimentos.filter(m => m.idContaCorrente === parsedConta?.id));

	};


  const fetchMovimentos = async () => {
    setIsLoading(true);
    try {
      const data = await listarMovimentosBancarios();
			setMovimentos(data);
      console.log(contaSelecionada)
      const filtrados = data.filter(m => m.idContaCorrente === contaSelecionada?.id);
      setFilteredMovimentos(filtrados);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erro ao buscar Movimentos Bancários:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calcularSaldoDinamico = () => {
    let saldo = 0;
    return currentItems.map((mov) => {
      const valor = mov.valor;
      if (mov.tipoMovimento === "C") {
        saldo += valor;
      } else {
        saldo -= valor;
      }
      return { ...mov, saldo };
    });
  };
  

  const handleImportFile = (file: File) => {
    console.log("Arquivo importado:", file);
    // Aqui você pode processar o arquivo OFX
  };

  const handleSearchFilters = (filters: { dataInicio: string; dataFim: string; status: string }) => {
    console.log("Filtros aplicados:", filters);
    // Aqui você pode fazer a requisição para buscar os movimentos filtrados
  };

  const handleTransferir = async () =>{
    console.log("ajustar para transferir, saida da origem e entrada no destino")
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAcoesMenu(false);
      }
    };
  
    if (acoesMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [acoesMenu]);
  

  const openModal = (movimento?: MovimentoBancario) => {
    setModalIsOpen(true);
  };

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const usuario = JSON.parse(localStorage.getItem("user") || "{}");
      const movimentoCompleto = {
        ...formData,
        valor: parseFloat((formData.valor || "0").replace(",", ".")), // garantir número
        dtMovimento: new Date(formData.dtMovimento).toISOString(),
        idPlanoContas: parseInt(formData.idPlanoContas),
        idContaCorrente: formData.idContaCorrente,
        historico: formData.historico,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        idUsuario: usuario?.id,
        identificadorOfx: formData.identificadorOfx || crypto.randomUUID(),

      };
      console.log("Movimento a ser salvo:", movimentoCompleto);


      const movimentoSalvo = await salvarMovimentoBancario(movimentoCompleto);

      console.log("movimentoSalvo", movimentoSalvo);

      if (
        movimentoSalvo?.id &&
        formData.modalidadeMovimento === "financiamento" &&
        formData.parcelado &&
        formData.parcelas &&
        formData.parcelas.length > 0
      ) {
        for (const parcela of formData.parcelas) {
          
          parcela.idMovimentoBancario = movimentoSalvo.id;
          console.log("parcela sendo enviada:" , parcela)
          salvarParcelaFinanciamento(parcela)
          
        }
      }

      if (movimentoSalvo !== undefined && movimentoSalvo !== null) {
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

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

   // 🔹 Paginação: calcular registros exibidos
   const indexOfLastItem = currentPage * itemsPerPage;
   const indexOfFirstItem = indexOfLastItem - itemsPerPage;
   const currentItems = filteredMovimentos.slice(indexOfFirstItem, indexOfLastItem);
   const totalPages = Math.ceil(filteredMovimentos.length / itemsPerPage);


  return (
    <div>

        <div className="flex justify-between items-end gap-5 mb-4">
          <div className="flex items-end gap-3 relative w-auto whitespace-nowrap" ref={menuRef}>
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
                  <button onClick={()=>setModalTransferirIsOpen(true)}>
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
        <div className="bg-gray-50 shadow-md rounded-lg border border-gray-200">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
            </div>
        ) : (
            <>
                <table className="w-full border-collapse">
                    <thead>

                        <tr className="bg-gray-200">

                          <th className="pl-5 p-2 text-left">Data do Movimento</th>
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
                        calcularSaldoDinamico().map((movBancario) => (
                          <tr key={movBancario.id} className="border-b">
                            <td className="pl-5 p-2 text-left">{formatarData(movBancario.dtMovimento)}</td>
                            <td className="p-2 text-left">{movBancario.historico}</td>

                            <td className="p-2 text-center cursor-pointer hover:underline" onClick={() => openModal(movBancario)}>
                              {planos.find(p => p.id === movBancario.idPlanoContas)?.descricao || '---'}
                            </td>
                            <td className={`p-2 text-center capitalize ${movBancario.valor >= 0 ? "text-green-600" : "text-red-600"}`}>{formatarMoeda(movBancario.valor)}</td>
														<td className="p-2 text-center capitalize">{formatarMoeda(movBancario.saldo)}</td>
														<td className="p-2 justify-end mr-1 capitalize flex items-center gap-8 relative">
                              <input type="checkbox" checked={movBancario.ideagro} readOnly className="w-4 h-4 accent-orange-500" />

                              <button
                                className="text-gray-700 hover:text-black px-2"
                                onClick={() => setMenuAtivoId(menuAtivoId === movBancario.id ? null : movBancario.id)}
                              >
                                <FontAwesomeIcon icon={faEllipsisV} />
                              </button>

                              {menuAtivoId === movBancario.id && (
                                <div className="absolute right-5 top-6 z-10 bg-white border rounded shadow-md text-sm w-32">
                                  <button
                                    className="w-full px-4 py-2 hover:bg-gray-100 text-left"
                                    onClick={() => openModal(movBancario)}
                                  >
                                    Informação
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 hover:bg-red-100 text-left text-red-600"
                                    onClick={() => handleDelete(movBancario.id)}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              )}
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

      <Transferir 
        isOpen={modalTransferirIsOpen}
        onClose={() => setModalTransferirIsOpen(false)}
        onTransferir={handleTransferir}
        />
    </div>
  );
};

export default MovimentoBancarioTable;
