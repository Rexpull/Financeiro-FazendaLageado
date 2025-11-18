import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus, faChevronLeft, faChevronRight, faTrash, faPencil, faChevronDown, faFilter } from '@fortawesome/free-solid-svg-icons';
import { listarCentroCustos, salvarCentroCustos, excluirCentroCustos, listarMovimentosPorCentroCustos } from "../../../services/centroCustosService";
import CentroCustosModal from "./CentroCustosModal";
import { CentroCustos } from "../../../../../backend/src/models/CentroCustos";

Modal.setAppElement("#root");

const CentroCustosTable: React.FC = () => {
  const [centroCustos, setCentroCustos] = useState<CentroCustos[]>([]);
  const [filteredCentroCustos, setFilteredCentroCustos] = useState<CentroCustos[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [centroCustosData, setCentroCustosData] = useState<CentroCustos>({ id: 0, descricao: "", tipo: "CUSTEIO" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteCentroCustosId, setDeleteCentroCustosId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // 🔹 Tabs
  const [activeTab, setActiveTab] = useState<'cadastro' | 'movimentos'>('cadastro');
  
  // 🔹 Movimentos
  const [movimentosAgrupados, setMovimentosAgrupados] = useState<any[]>([]);
  const [isLoadingMovimentos, setIsLoadingMovimentos] = useState(false);
  const [expandedCentros, setExpandedCentros] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroModalOpen, setFiltroModalOpen] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

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

  const fetchMovimentosPorCentroCustos = async () => {
    setIsLoadingMovimentos(true);
    try {
      const filters: any = {};
      if (dataInicio) filters.dataInicio = dataInicio;
      if (dataFim) filters.dataFim = dataFim;
      
      const data = await listarMovimentosPorCentroCustos(filters);
      setMovimentosAgrupados(data);
    } catch (error) {
      console.error("Erro ao buscar movimentos por centro de custos:", error);
    } finally {
      setIsLoadingMovimentos(false);
    }
  };

  const getMesAtual = () => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const inicio = primeiroDia.toISOString().split('T')[0];
    const fim = ultimoDia.toISOString().split('T')[0];
    
    return { inicio, fim };
  };

  const handleAplicarFiltro = () => {
    setDataInicio(filtroDataInicio);
    setDataFim(filtroDataFim);
    setFiltroModalOpen(false);
  };

  const handleFecharFiltro = () => {
    setFiltroModalOpen(false);
  };

  const toggleExpand = (centroId: string) => {
    setExpandedCentros(prev => 
      prev.includes(centroId) 
        ? prev.filter(id => id !== centroId)
        : [...prev, centroId]
    );
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
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

  useEffect(() => {
    if (activeTab === 'movimentos') {
      // Buscar mês atual quando abrir a tab pela primeira vez
      if (dataInicio === '' && dataFim === '') {
        const mesAtual = getMesAtual();
        setDataInicio(mesAtual.inicio);
        setDataFim(mesAtual.fim);
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dataInicio && dataFim) {
      fetchMovimentosPorCentroCustos();
    }
  }, [dataInicio, dataFim]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (centroCustos?: CentroCustos) => {
    setCentroCustosData(centroCustos || { id: 0, descricao: "", tipo: "CUSTEIO" });
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-5 mb-4" style={{ maxWidth: '100%', width: '100%' }}>
        <div className="flex border-b border-gray-300">
          <button
            className={`px-3 sm:px-4 py-2 font-bold text-xs sm:text-sm text-nowrap whitespace-nowrap ${
              activeTab === 'cadastro' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('cadastro')}
          >
            CADASTRO
          </button>
          <button
            className={`px-3 sm:px-4 py-2 font-bold text-xs sm:text-sm text-nowrap whitespace-nowrap ${
              activeTab === 'movimentos' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('movimentos')}
          >
            MOVIMENTOS POR CENTRO DE CUSTOS
          </button>
        </div>

        <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 w-full">
          {activeTab === 'cadastro' ? (
            <>
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
                className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400 text-sm lg:text-base"
                onClick={() => openModal()}
              >
                <span className="hidden sm:inline">Adicionar Centro de Custos</span>
                <span className="sm:hidden">Adicionar</span>
                <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
              </button>
            </>
          ) : (
            <button
              className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400 text-sm lg:text-base"
              onClick={() => {
                setFiltroDataInicio(dataInicio);
                setFiltroDataFim(dataFim);
                setFiltroModalOpen(true);
              }}
            >
              <FontAwesomeIcon icon={faFilter} className="mr-2" />
              Filtrar Período
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200">
        {activeTab === 'cadastro' ? (
          isLoading ? (
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
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 pr-11 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                        Nenhum centro de custos encontrado!
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((centro) => (
                      <tr key={centro.id} className="border-b">
                        <td className="p-2 text-center">{centro.id}</td>
                        <td className="p-2 text-left">{centro.descricao}</td>
                        <td className="p-2 text-left">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            centro.tipo === 'INVESTIMENTO' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {centro.tipo === 'INVESTIMENTO' ? 'Investimento' : 'Custeio'}
                          </span>
                        </td>
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
          )
        ) : (
          <div className="p-4">
     
            {/* Tabela de movimentos */}
            {isLoadingMovimentos ? (
              <div className="flex justify-center items-center h-64">
                <div className="loader"></div>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 text-left">Centro de Custos</th>
                    <th className="p-2 text-right">Total Receitas</th>
                    <th className="p-2 text-right">Total Despesas</th>
                    <th className="p-2 text-right">Saldo Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentosAgrupados.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                        Nenhum movimento encontrado!
                      </td>
                    </tr>
                  ) : (
                    <>
                      {movimentosAgrupados.map((grupo: any) => {
                        const centroId = grupo.idCentroCustos?.toString();
                        const isExpanded = expandedCentros.includes(centroId);
                        return (
                          <React.Fragment key={centroId}>
                            <tr 
                              className="border-b hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleExpand(centroId)}
                            >
                              <td className="p-2">
                                <FontAwesomeIcon 
                                  icon={isExpanded ? faChevronDown : faChevronRight} 
                                  className="mr-2" 
                                />
                                {grupo.descricao}
                              </td>
                              <td className="p-2 text-right text-green-600 font-semibold">
                                {formatarMoeda(grupo.totalReceitas)}
                              </td>
                              <td className="p-2 text-right text-red-600 font-semibold">
                                {formatarMoeda(grupo.totalDespesas)}
                              </td>
                              <td className={`p-2 text-right font-bold ${
                                grupo.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatarMoeda(grupo.saldoLiquido)}
                              </td>
                            </tr>
                            {isExpanded && grupo.movimentos.map((mov: any) => (
                              <tr key={mov.id} className="bg-gray-50 border-b">
                                <td className="p-2 pl-8 text-sm" colSpan={4}>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">{mov.historico}</span>
                                    <div className="flex gap-3 text-xs text-gray-500">
                                      <span>{formatarData(mov.data)}</span>
                                      <span>•</span>
                                      <span>{mov.contaBancaria}</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {/* Linha de totais */}
                      {movimentosAgrupados.length > 0 && (
                        <tr className="bg-gray-200 border-t-2 border-gray-400 font-bold">
                          <td className="p-2">TOTAL GERAL</td>
                          <td className="p-2 text-right text-green-600">
                            {formatarMoeda(movimentosAgrupados.reduce((sum, g) => sum + g.totalReceitas, 0))}
                          </td>
                          <td className="p-2 text-right text-red-600">
                            {formatarMoeda(movimentosAgrupados.reduce((sum, g) => sum + g.totalDespesas, 0))}
                          </td>
                          <td className={`p-2 text-right ${
                            movimentosAgrupados.reduce((sum, g) => sum + g.saldoLiquido, 0) >= 0 
                              ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatarMoeda(movimentosAgrupados.reduce((sum, g) => sum + g.saldoLiquido, 0))}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <CentroCustosModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        centroCustosData={centroCustosData}
        handleInputChange={(e) => {
          const value = e.target.name === 'tipo' 
            ? (e.target.value as 'CUSTEIO' | 'INVESTIMENTO')
            : e.target.value;
          setCentroCustosData({ ...centroCustosData, [e.target.name]: value });
        }}
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

      {/* Modal de Filtro de Período */}
      <Modal
        isOpen={filtroModalOpen}
        onRequestClose={() => setFiltroModalOpen(false)}
        shouldCloseOnOverlayClick={false}
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtrar Período</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              onClick={handleFecharFiltro}
            >
              Fechar
            </button>
            <button
              className="px-4 py-2 bg-primary text-white rounded hover:bg-orange-600"
              onClick={handleAplicarFiltro}
            >
              Aplicar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CentroCustosTable;
