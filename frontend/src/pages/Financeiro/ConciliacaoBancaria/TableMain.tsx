import React, { useEffect, useState, useRef } from "react";
import DialogModal from "../../../components/DialogModal";
import LancamentoManual from "./Modals/LancarManual";
import ImportOFXModal from "./Modals/ImportOFXModal";
import FiltroMovimentosModal from "./Modals/FiltroMovimentos";
import SelectContaCorrente from "./Modals/SelectContaCorrente";
import DetalhamentoMovimento from "./Modals/DetalhamentoMovimento";
import Transferir from "./Modals/Transferir";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil, faFileArchive, faFileExcel, faFilePdf, faExchange, faExchangeAlt, faChevronDown, faBank, faEllipsisV, faInfo, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { listarMovimentosBancarios, salvarMovimentoBancario, excluirMovimentoBancario, atualizarStatusIdeagro, transferirMovimentoBancario, buscarMovimentoBancarioById } from "../../../services/movimentoBancarioService";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";
import { excluirParcelaFinanciamento, listarParcelaFinanciamentos, salvarParcelaFinanciamento, verificarParcelasAssociadas} from "../../../services/financiamentoParcelasService"
import { listarPlanoContas } from "../../../services/planoContasService"
import { Tooltip } from 'react-tooltip';
import ConciliarPlano from "./Modals/ConciliarPlano";
import { formatarData } from "../../../Utils/formatarData";

const MovimentoBancarioTable: React.FC = () => {
  const [movimentos, setMovimentos] = useState<MovimentoBancario[]>([]);
  const [filteredMovimentos, setFilteredMovimentos] = useState<MovimentoBancario[]>([]);
  const [movimentosFiltradosComSaldo, setMovimentosFiltradosComSaldo] = useState<MovimentoBancario[]>([]);
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
  const [confirmDeleteParcelaModalOpen, setConfirmDeleteParcelaModalOpen] = useState(false);
  const [deleteMovimentoId, setDeleteMovimentoId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAtivoId, setMenuAtivoId] = useState<number | null>(null);
  const [planos, setPlanos] = useState<{ id: number, descricao: string, tipo: string  }[]>([]);

  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const [modalConciliaIsOpen, setModalConciliaIsOpen] = useState(false);
  const [movimentoParaConciliar, setMovimentoParaConciliar] = useState<MovimentoBancario | null>(null);

  const [modalDetalheOpen, setModalDetalheOpen] = useState(false);
  const [movimentoSelecionado, setMovimentoSelecionado] = useState<MovimentoBancario | null>(null);


  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);


  useEffect(() => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    console.log("setando inicio:" + inicio)
    console.log("setando fim:" + fim)
    setDataInicio(inicio);
    setDataFim(fim);
  }, []);


  useEffect(() => {
    if (contaSelecionada) {
      fetchMovimentos();
    }

    listarPlanoContas().then((planos) => setPlanos(planos));

  }, [contaSelecionada]);


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

  useEffect(() => {
    if (contaSelecionada && dataInicio && dataFim && movimentos.length > 0) {
      const lista = gerarListaComSaldos(dataInicio, dataFim);
      setFilteredMovimentos(lista);
      setMovimentosFiltradosComSaldo(lista);
      setCurrentPage(1);
      setIsLoading(false);
    }
  }, [contaSelecionada, dataInicio, dataFim, movimentos]);


  const fetchMovimentos = async () => {
    setIsLoading(true);
    try {
      const data = await listarMovimentosBancarios();
      atualizarListasMovimentos(data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erro ao buscar Movimentos Bancários:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const gerarListaComSaldos = (dataInicio: string, dataFim: string) => {
    if (!contaSelecionada) return [];

    const movimentosConta = movimentos.filter(m => m.idContaCorrente === contaSelecionada.id).sort((a, b) => new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime());;

    const dataInicioDate = new Date(dataInicio + "T00:00:00");
    const dataFimDate = new Date(dataFim + "T23:59:59");

    const movimentosAnteriores = movimentosConta.filter(m => new Date(m.dtMovimento) < dataInicioDate);
    const movimentosPeriodo = movimentosConta.filter(m =>
      new Date(m.dtMovimento) >= dataInicioDate && new Date(m.dtMovimento) <= dataFimDate
    );

    const saldoAnterior = movimentosAnteriores.reduce((acc, m) => acc + m.valor, 0);

    let saldoAtual = saldoAnterior;

    const movimentosCalculados = movimentosPeriodo.map((mov) => {
      saldoAtual += mov.valor;
      return {
        ...mov,
        saldo: saldoAtual,
      };
    });

    const saldoFinal = saldoAtual;

    const registroSaldoAnterior = {
      id: -1,
      dtMovimento: dataInicio.slice(0, 10) + " 00:00:00",
      historico: "Saldo Anterior",
      idPlanoContas: 0,
      valor: saldoAnterior,
      saldo: saldoAnterior,
      ideagro: false,
      idContaCorrente: contaSelecionada.id,
      identificadorOfx: "",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    const registroSaldoFinal = {
      id: -2,
      dtMovimento: dataFim.slice(0, 10) + " 23:59:59",
      historico: "Saldo Final do período",
      idPlanoContas: 0,
      valor: saldoFinal,
      saldo: saldoFinal,
      ideagro: false,
      idContaCorrente: contaSelecionada.id,
      identificadorOfx: "",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    return [registroSaldoAnterior, ...movimentosCalculados, registroSaldoFinal];
  };



  const handleImportFile = (file: File) => {
    console.log("Arquivo importado:", file);
    // Aqui você pode processar o arquivo OFX
  };


  const handleSearchFilters = (filters: { dataInicio: string; dataFim: string; status: string }) => {
    setDataInicio(filters.dataInicio);
    setDataFim(filters.dataFim);
    setStatusFiltro(filters.status);

    atualizarListasMovimentos(movimentos, filters);
  };

  const handleTransferir = async (data: any) => {
    try {
      const usuario = JSON.parse(localStorage.getItem("user") || "{}");
      const contaDestino = data.contas.find((c) => c.id === parseInt(data.idContaDestino));
      if (!contaDestino) throw new Error("Conta destino não encontrada");

      const payload = {
        contaOrigemId: data.contaOrigem.id,
        contaOrigemDescricao: `${data.contaOrigem.responsavel} | ${data.contaOrigem.bancoNome} | ${data.contaOrigem.numConta}`,
        contaDestinoId: parseInt(data.idContaDestino),
        contaDestinoDescricao: `${contaDestino.responsavel} | ${contaDestino.bancoNome} | ${contaDestino.numConta}`,
        valor: data.valor,
        descricao: data.descricao,
        data: new Date(data.data).toISOString(),
        idUsuario: usuario?.id,
      };

      console.log("Enviando payload:", payload);
      await transferirMovimentoBancario(payload);

      setModalTransferirIsOpen(false);
      fetchMovimentos();
    } catch (error) {
      console.error("Erro ao transferir:", error);
    }
  };

  const openModalConcilia = async (movimento: MovimentoBancario) => {
    try {
      const movimentoCompleto = await buscarMovimentoBancarioById(movimento.id);
      console.log("Movimento completo:", movimentoCompleto);
      setMovimentoParaConciliar(movimentoCompleto);
      setTimeout(() => {
        setModalConciliaIsOpen(true);
      }, 0); 
    } catch (error) {
      console.error("Erro ao buscar dados completos:", error);
    }
  };


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

  useEffect(() => {
    const handleClickOutsideMenuAtivo = (event: MouseEvent) => {
      const target = event.target as Node;

      // Evita fechar quando clicar no botão que abre o menu
      const isButton = (target as HTMLElement).closest("button");

      if (menuRef.current && !menuRef.current.contains(target) && !isButton) {
        setMenuAtivoId(null);
      }
    };

    if (menuAtivoId !== null) {
      document.addEventListener("mousedown", handleClickOutsideMenuAtivo);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideMenuAtivo);
    };
  }, [menuAtivoId]);



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
          console.log("parcela sendo enviada:", parcela)
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

  const handleDelete = async (id: number) => {
    const temParcelas = await verificarParcelasAssociadas(id);
    setDeleteMovimentoId(id);

    if (temParcelas) {
      setConfirmDeleteParcelaModalOpen(true);
    } else{
      setConfirmModalOpen(true);
    }
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const handleStatusChange = async (id: number, novoStatus: boolean) => {
    try {
      await atualizarStatusIdeagro(id, novoStatus);

      await fetchMovimentos();
  
    } catch (error) {
      console.error("Erro ao atualizar status do movimento:", error);
    }
  };

  const atualizarListasMovimentos = (novaLista: MovimentoBancario[], filtros?: { dataInicio: string; dataFim: string; status: string }) => {
    setMovimentos(novaLista);
  
    const dataInicioAtual = filtros?.dataInicio || dataInicio;
    const dataFimAtual = filtros?.dataFim || dataFim;
    const statusAtual = filtros?.status || statusFiltro;
  
    const listaComSaldos = gerarListaComSaldos(dataInicioAtual, dataFimAtual);
  
    if (statusAtual === "pendentes") {
      const apenasPendentes = listaComSaldos.filter(m => m.idPlanoContas === null || m.idPlanoContas === 0);
      setFilteredMovimentos(apenasPendentes);
      setMovimentosFiltradosComSaldo(apenasPendentes);
    } else {
      setFilteredMovimentos(listaComSaldos);
      setMovimentosFiltradosComSaldo(listaComSaldos);
    }
  };
  
  const handleConcilia = async (data: any) => {
    try {
      const movimentoAtualizado: MovimentoBancario = {
        ...movimentoParaConciliar!,
        idPlanoContas: data.idPlanoContas,
        modalidadeMovimento: data.modalidadeMovimento,
        idPessoa: data.idPessoa ?? null,
      };
  
      if (data.modalidadeMovimento === 'padrao') {
        movimentoAtualizado.idBanco = null;
        movimentoAtualizado.parcelado = false;
        movimentoAtualizado.numeroDocumento = null;
        
        let temParcelas = await verificarParcelasAssociadas(movimentoAtualizado.id);
        if (temParcelas) {
          await excluirParcelaFinanciamento(movimentoAtualizado.id);
        }
      }
      console.log("movimentoAtualizado", movimentoAtualizado);
      await salvarMovimentoBancario(movimentoAtualizado); 

    //   const salvo = await salvarMovimentoBancario(movimentoAtualizado); 
     
      
    // if (salvo && salvo.id) {
    //   setMovimentos((prevMovimentos) =>
    //     prevMovimentos.map((m) => (m.id === salvo.id ? { ...m, ...salvo } : m))
    //   );
    // }
    
      setModalConciliaIsOpen(false);
      fetchMovimentos();
    } catch (error) {
      console.error('Erro ao conciliar movimento:', error);
    }
  };
  


  // 🔹 Paginação: calcular registros exibidos
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = movimentosFiltradosComSaldo.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(movimentosFiltradosComSaldo.length / itemsPerPage);


  return (
    <div>

      <div className="flex justify-between items-end gap-5 mb-4">
        <div className="flex items-end gap-3 relative w-auto whitespace-nowrap" ref={menuRef}>
          <div className="relative w-auto whitespace-nowrap">
            <button className="bg-gray-50 font-bold h-10 px-4 pt-0 pb-0 flex items-center rounded-md border border-gray-300 hover:bg-gray-100"
              onClick={() => setModalContaIsOpen(true)} >
              {contaSelecionada ? `${contaSelecionada.numConta} - ${contaSelecionada.bancoNome} - ${contaSelecionada.responsavel}` : "Selecionar Conta"}

              <FontAwesomeIcon style={{ marginLeft: '10px' }} icon={faBank} />
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
              <div className="absolute flex flex-col bg-white shadow-md font-medium rounded-md border p-1 mt-2 z-10" style={{ width: "9rem" }}>
                <button onClick={() => setModalTransferirIsOpen(true)}>
                  <p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100">
                    <FontAwesomeIcon icon={faExchange} className="mr-2" />
                    Transferir
                  </p>
                </button>
                <button>
                  <p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100" style={{ opacity: '0.5' }}>
                    <FontAwesomeIcon icon={faFilePdf} className="mr-2" />
                    Imprimir PDF
                  </p>
                </button>
                <button>
                  <p className="font-bold text-sm rounded text-left text-gray-800 px-2 py-1 hover:bg-gray-100" style={{ opacity: '0.5' }}>
                    <FontAwesomeIcon icon={faFileExcel} className="mr-2" />
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

                  <th className="pl-5 p-2 text-left truncate">Data do Movimento</th>
                  <th className="p-2 text-left">Histórico</th>
                  <th className="p-2 text-center">Plano Contas</th>
                  <th className="p-2 text-center">Valor R$</th>

                  <th className="p-2 text-center">Saldo R$</th>
                  <th className="p-2 pr-11 text-right">IdeAgri</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 2 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                      Nenhum movimento encontrado!
                    </td>
                  </tr>
                ) : (
                  currentItems.map((movBancario) => {
                    const isSaldo = movBancario.id === -1 || movBancario.id === -2;
                    return (
                      <tr key={movBancario.id} className="border-b">
                        <td className="pl-5 p-2 text-left truncate">{formatarData(movBancario.dtMovimento)}</td>
                        <td className="p-2 text-left max-w-[490px] truncate">
                          <span id={`tooltip-${movBancario.id}`}>{movBancario.historico}</span>
                          <Tooltip anchorId={`tooltip-${movBancario.id}`} place="top" content={movBancario.historico} />
                        </td>

                        {!isSaldo ? (
                          <>
                            <td
                              className={`p-2 text-center cursor-pointer underline truncate hover:text-gray-500 max-w-[220px] ${
                                movBancario.resultadoList?.length > 1
                                  ? 'text-blue-600 font-semibold'
                                  : !planos.find(p => p.id === movBancario.idPlanoContas)
                                    ? 'text-orange-500 font-semibold'
                                    : ''
                              }`}
                              style={{ textUnderlineOffset: '2px' }}
                              onClick={() => openModalConcilia(movBancario)}
                            >
                               {movBancario.resultadoList?.length > 1
                                ? 'Múltiplos Planos'
                                : planos.find(p => p.id === movBancario.idPlanoContas)?.descricao || 'Selecione um Plano de Contas'}

                            </td>
                            <td className={`p-2 text-center font-semibold capitalize ${movBancario.valor >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatarMoeda(movBancario.valor)}
                            </td>
                            <td className="p-2 text-center capitalize">{formatarMoeda(movBancario.saldo)}</td>
                            <td className="p-2 justify-end mr-1 capitalize flex items-center gap-6 relative">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={movBancario.ideagro}
                                  onChange={() => handleStatusChange(movBancario.id, !movBancario.ideagro)}
                                />
                                <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                              </label>

                              <button
                                className="text-gray-700 hover:text-black px-2"
                                onClick={() => setMenuAtivoId(menuAtivoId === movBancario.id ? null : movBancario.id)}
                              >
                                <FontAwesomeIcon icon={faEllipsisV} />
                              </button>

                              {menuAtivoId === movBancario.id && (
                                <div className="absolute right-5 top-6 z-10 bg-white border rounded shadow-md text-sm w-33 font-semibold">
                                  <button
                                    className="w-full px-4 py-2 hover:bg-gray-100 text-left text-blue-600" 
                                    style={{textWrap: 'nowrap'}}
                                    onClick={() => {
                                      setMovimentoSelecionado(movBancario);
                                      setModalDetalheOpen(true);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faInfoCircle} className="mr-1" /> Informação
                                  </button>
                                  <button
                                    className="w-full px-4 py-2 hover:bg-red-100 text-left text-red-600"
                                    onClick={() => handleDelete(movBancario.id)}
                                  >
                                    <FontAwesomeIcon icon={faTrash} className="mr-1" /> Excluir
                                  </button>
                                </div>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2"></td>
                            <td className="p-2"></td>
                            <td className={`p-2 text-center font-semibold capitalize ${movBancario.saldo >= 0 ? "text-green-600" : "text-red-600"}`}>{formatarMoeda(movBancario.saldo)}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
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
        dataInicio={dataInicio}
        dataFim={dataFim}
        status={statusFiltro}
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

      <DialogModal
        isOpen={confirmDeleteParcelaModalOpen}
        onClose={() => setConfirmDeleteParcelaModalOpen(false)}
        onConfirm={async () => {
          
          if (deleteMovimentoId !== null) {
            const temParcelas = await verificarParcelasAssociadas(deleteMovimentoId);
            
           
            if (temParcelas) {
              
              const parcelas = await listarParcelaFinanciamentos();
              for (const parcela of parcelas.filter(p => p.idMovimentoBancario === deleteMovimentoId)) {
                await excluirParcelaFinanciamento(parcela.id);
              }
            }

            await excluirMovimentoBancario(deleteMovimentoId);
            
            setMovimentos((prev) => prev.filter((movimento) => movimento.id !== deleteMovimentoId));
            setConfirmDeleteParcelaModalOpen(false);
          }
        }}
        title="Atenção"
        type="warn"
        message="Este movimento possui parcelas associadas. Se continuar, as parcelas também serão excluídas. Deseja continuar?"
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

      <DetalhamentoMovimento
        isOpen={modalDetalheOpen}
        onClose={() => setModalDetalheOpen(false)}
        movimento={movimentoSelecionado}
      />

      <ConciliarPlano
        isOpen={modalConciliaIsOpen}
        onClose={() => setModalConciliaIsOpen(false)}
        movimento={movimentoParaConciliar || {} as MovimentoBancario}
        planos={planos}
        handleConcilia={handleConcilia}
      />


    </div>
  );
};

export default MovimentoBancarioTable;
