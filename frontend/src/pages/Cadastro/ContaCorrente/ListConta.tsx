import React, { useEffect, useState, useRef  } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV, faUniversity, faChevronCircleDown, faChevronDown, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { listarContas, salvarConta, atualizarStatusConta } from "../../../services/contaCorrenteService";
import { excluirContaCadastro } from "../../../services/excluirCadastroService";
import ContaCorrenteModal from "./ContaCorrenteModal"; // Importando o Modal
import DialogModal from "../../../components/DialogModal"
import { ContaCorrente } from "../../../../../backend/src/models/ContaCorrente";
import noData from "/frontend/src/assets/img/noData.svg"

// Importando as imagens dos bancos
import bancoBrasil from "../../../assets/img/icon-Bancos/banco-brasil.svg";
import santander from "../../../assets/img/icon-Bancos/santander.svg";
import caixa from "../../../assets/img/icon-Bancos/caixa.svg";
import bradesco from "../../../assets/img/icon-Bancos/bradesco.svg";
import itau from "../../../assets/img/icon-Bancos/itau.svg";
import inter from "../../../assets/img/icon-Bancos/inter.svg";
import sicredi from "../../../assets/img/icon-Bancos/sicredi.svg";
import sicoob from "../../../assets/img/icon-Bancos/sicoob.svg";
import safra from "../../../assets/img/icon-Bancos/safra.svg";
import nubank from "../../../assets/img/icon-Bancos/nubank.svg";
import original from "../../../assets/img/icon-Bancos/original.svg";
import bancoBrasilia from "../../../assets/img/icon-Bancos/banco-brasilia.svg";
import banrisul from "../../../assets/img/icon-Bancos/banrisul.svg";
import citiBank from "../../../assets/img/icon-Bancos/citi-bank.svg";
import hsbc from "../../../assets/img/icon-Bancos/hsbc.svg";
import banestes from "../../../assets/img/icon-Bancos/banestes.svg";
import bancoAmazonia from "../../../assets/img/icon-Bancos/banco-amazonia.svg";
import bancoNordeste from "../../../assets/img/icon-Bancos/banco-nordeste.svg";
import bankBoston from "../../../assets/img/icon-Bancos/bank-boston.svg";
import defaultIcon from "../../../assets/img/icon-Bancos/default.png";


const ListConta: React.FC = () => {
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [filteredContas, setFilteredContas] = useState<ContaCorrente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] = useState("padrao");

  // Estado para controlar o modal
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [contaData, setContaData] = useState<ContaCorrente | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteContaId, setDeleteContaId] = useState<number | null>(null);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    setIsLoading(true);

    try {
      const data = await listarContas();
      console.log("Contas:", data);

      setContas(data);
      setFilteredContas(data);
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    }
    setIsLoading(false);

  };

  useEffect(() => {
    console.log("searchTerm: " + searchTerm);
  
    let filtered = contas.filter((conta) =>
      (conta.bancoNome?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (conta.agencia?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (conta.numConta?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (conta.numCartao?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (conta.responsavel?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );
  
    switch (sortOption) {
      case "banco":
        filtered = filtered.sort((a, b) => (a.bancoNome || "").localeCompare(b.bancoNome || ""));
        break;
      case "responsavel":
        filtered = filtered.sort((a, b) => (a.responsavel || "").localeCompare(b.responsavel || ""));
        break;
      case "tipo":
        filtered = filtered.sort((a, b) => (a.tipo || "").localeCompare(b.tipo || ""));
        break;
      default:
        break;
    }
  
    setFilteredContas(filtered);
  }, [searchTerm, contas, sortOption]);
  

  const BancoLogos: { [key: string]: string } = {
    "001": bancoBrasil,
    "033": santander,
    "104": caixa,
    "237": bradesco,
    "341": itau,
    "077": inter,
    "748": sicredi,
    "756": sicoob,
    "422": safra,
    "260": nubank,
    "212": original,
    "070": bancoBrasilia,
    "389": banrisul,
    "745": citiBank,
    "399": hsbc,
    "021": banestes,
    "085": bancoAmazonia,
    "003": bancoNordeste,
    "318": bankBoston,
  };

  

  // Abrir o modal para adicionar ou editar conta
  const openModal = (conta?: ContaCorrente) => {
    setContaData(conta || { id: 0, tipo: "contaCorrente", idBanco: 0, agencia: "", numConta: "", numCartao: "", dtValidadeCartao: "", responsavel: "", observacao: "", ativo: true });
    setModalIsOpen(true);
  };

  // Função para obter a URL do logotipo do banco
  const getBancoLogo = (codigo: string): string => {
    return BancoLogos[codigo] || defaultIcon; // Se não encontrar, usa um ícone padrão
  };

  const handleStatusChange = async (id: number, novoStatus: boolean) => {
    try {
      await atualizarStatusConta(id, novoStatus);
      setContas((prev) =>
        prev.map((conta) =>
          conta.id === id ? { ...conta, ativo: novoStatus } : conta
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status da conta:", error);
    }
  };

  // 🔹 Função para abrir o modal de confirmação antes de excluir
  const handleDelete = (id: number) => {
    setDeleteContaId(id);
    setConfirmModalOpen(true);
  };

  // 🔹 Função para confirmar a exclusão
  const handleDeleteConfirm = async () => {
    if (deleteContaId === null) return;
    try {
      await excluirContaCadastro(deleteContaId); // toasts the API message (409 when in use)
      setContas((prev) => prev.filter((conta) => conta.id !== deleteContaId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      setConfirmModalOpen(false);
    }
  };
  // Fechar modal
  const closeModal = () => {
    setModalIsOpen(false);
    setContaData(null);
  };
  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeMenu !== null &&
        menuRefs.current[activeMenu] &&
        !menuRefs.current[activeMenu]?.contains(event.target as Node)
      ) {
        setActiveMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenu]);

  const handleSave = async () => {
    if (!contaData) return;
    setIsSaving(true);


    console.log("📤 Enviando para API:", contaData);

    // 🔹 Criando objeto correto para evitar envio de campos desnecessários
    const contaEnviada: Partial<ContaCorrente> = {
        id: contaData.id,
        tipo: contaData.tipo,
        idBanco: contaData.idBanco,
        responsavel: contaData.responsavel,
        observacao: contaData.observacao,
        ativo: contaData.ativo,
    };

    if (contaData.tipo === "contaCorrente") {
        contaEnviada.agencia = contaData.agencia;
        contaEnviada.numConta = contaData.numConta;
    } else if (contaData.tipo === "cartao") {
        contaEnviada.numCartao = contaData.numCartao;
        contaEnviada.dtValidadeCartao = contaData.dtValidadeCartao;
    }

    try {
        await salvarConta(contaEnviada as ContaCorrente);
        fetchContas();
        closeModal();
    } catch (error) {
        console.error("❌ Erro ao salvar conta:", error);
    }

    setIsSaving(false);
  };

  const formatarNumeroCartao = (numCartao?: string): string => {
    if (!numCartao) return "Número não disponível";
  
    return numCartao.replace(/\D/g, "") // Remove qualquer caractere que não seja número
      .replace(/(\d{4})/g, "$1 ") // Insere espaço a cada 4 números
      .trim(); // Remove espaço final extra
  };
  

  return (
    <div>
      {/* 🔹 Barra de busca e botão de adicionar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 lg:gap-5 mb-4 border-b pb-4">
            <div className="relative w-auto whitespace-nowrap">
                <span className="text-gray-600 font-medium mr-2 text-sm lg:text-base">Ordenar por:</span>

                <select
                className="bg-transparent text-black font-semibold text-sm lg:text-lg focus:outline-none appearance-none pr-6 border-b border-gray-400"
                
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                >
                <option value="padrao">Padrão</option>
                <option value="banco">Banco</option>
                <option value="responsavel">Responsável</option>
                <option value="tipo">Tipo</option>
                </select>

                {/* 🔹 Ícone da seta personalizada */}
                <span className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <FontAwesomeIcon icon={faChevronDown} />
                </span>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 w-full">
                <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
                        <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <input
                        type="text"
                        className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-all text-sm"
                        placeholder="Pesquisar por Banco, Agência, Conta ou Responsável"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                className="bg-primary text-white font-bold h-10 px-4 flex items-center justify-center rounded hover:bg-orange-400 text-sm lg:text-base"
                onClick={() => openModal()}
                >
                <span className="hidden sm:inline">Nova Conta Corrente</span>
                <span className="sm:hidden">Nova Conta</span>
                <FontAwesomeIcon icon={faPlus} className="ml-2" />
                </button>
            </div>
        </div>

      {isLoading && 
        <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
        </div>
      }

      {/* 🔹 Listagem de Contas no Formato de Cards */}
      {!isLoading && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {filteredContas.length === 0 ? (
        <div className="col-span-full flex flex-col items-center gap-2">
          <img 
          src={noData}
          alt="Sem dados"
          className="object-contain w-48 h-48 sm:w-80 sm:h-80 lg:w-96 lg:h-96"/> 
          <p className="text-gray-900 font-bold text-center col-span-full text-lg sm:text-xl lg:text-2xl mt-4 mb-8">Nenhuma conta encontrada!</p>
      </div>

          
        ) : (
          filteredContas.map((conta) => (
            <div 
              key={conta.id} 
              className="bg-white rounded-lg shadow-md p-4 border border-gray-200 relative hover:bg-gray-100"
            >
               {/* 🔹 Status ativo (Switch) */}
               <div className="absolute top-3 left-3 flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={conta.ativo}
                      onChange={() => handleStatusChange(conta.id, !conta.ativo)}
                    />
                    <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                  <span className="text-xs font-semibold text-gray-600">
                    {conta.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>


               {/* 🔹 Menu de ações */}
               <div className="absolute top-3 right-0 cursor-pointer" ref={(el) => { menuRefs.current[conta.id] = el; }}>
                  <FontAwesomeIcon
                    icon={faEllipsisV}
                    className="text-gray-600 w-8 mr-1 text-lg"
                    onClick={() => setActiveMenu(activeMenu === conta.id ? null : conta.id)}
                  />
                  {activeMenu === conta.id && (
                    <div 
                      className="absolute font-medium right-0 bg-white shadow-md rounded-md w-28 mt-2 z-10"
                      onClick={(e) => e.stopPropagation()} 
                    >
                      <button
                        className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(null);
                          setModalIsOpen(true);
                          setContaData(conta);
                        }}
                      >
                        <FontAwesomeIcon icon={faEdit} className="mr-2" />
                        Editar
                      </button>
                      <button
                        className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(null);
                          handleDelete(conta.id);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

              {/* Logo do banco */}
              <div className="flex flex-col items-center mt-6 pointer-events-none">
                <img 
                    src={getBancoLogo(conta.bancoCodigo)}
                    alt={conta.bancoNome}
                    className="w-12 h-12 mb-2 object-contain"
                    onError={(e) => (e.currentTarget.src = defaultIcon)} 
                />

                <span className="text-lg font-bold">{conta.bancoNome.toUpperCase()}</span>
                <p className="text-sm text-gray-600">{conta.agencia ? conta.agencia + " - "  : ""} {conta.responsavel}</p>
                {/* Nome do tipo (Destaque) */}
                <p className="text-sm font-semibold">
                {conta.numConta ? (
                    <>
                    Número da <span className="text-blue-600">Conta</span>
                    </>
                ) : (
                    <>
                    Número do <span className="text-red-600">Cartão</span>
                    </>
                )}
                </p>
                <p className="text-sm text-gray-600">{conta.numConta || formatarNumeroCartao(conta.numCartao) || "Número não disponível"}</p>
                </div>
            </div>
          ))
        )}
      </div>
    )}
      {/* 🔹 Modal para Criar/Editar Conta */}
      {modalIsOpen && contaData && (
        <ContaCorrenteModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          contaData={contaData}
          handleInputChange={(e) => setContaData({ ...contaData, [e.target.name]: e.target.value })}
          handleSave={handleSave}
          isSaving={isSaving}
        />
      )}

       {/* 🔹 Modal de Confirmação para Excluir */}
       <DialogModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Atenção"
        type="warn"
        message="Tem certeza que deseja excluir esta conta?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default ListConta;
