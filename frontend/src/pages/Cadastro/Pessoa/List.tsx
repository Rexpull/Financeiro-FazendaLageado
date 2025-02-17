import React, { useEffect, useState, useRef  } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV, faUniversity, faChevronCircleDown, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { listarPessoas, excluirPessoa, salvarPessoa, atualizarStatusPessoa } from "../../../services/pessoaService";
import PessoaModal from "./PessoaModal";
import DialogModal from "../../../components/DialogModal"

import { Pessoa } from "../../../../../backend/src/models/Pessoa";

const ListConta: React.FC = () => {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [filteredPessoas, setFilteredPessoas] = useState<Pessoa[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Estado para controlar o modal
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [pessoaData, setPessoaData] = useState<Pessoa | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletePessoaId, setDeletePessoaId] = useState<number | null>(null);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    setIsLoading(true);

    try {
      const data = await listarPessoas();

      setPessoas(data);
      setFilteredPessoas(data);
    } catch (error) {
      console.error("Erro ao buscar contas:", error);
    }
    setIsLoading(false);

  };

  useEffect(() => {
    let filtered = pessoas.filter((pessoa) =>
      pessoa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.cgcpf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pessoa.telefone?.toLowerCase().includes(searchTerm.toLowerCase())
    );


    setFilteredPessoas(filtered);
  }, [searchTerm, pessoas]);


  // Abrir o modal para adicionar ou editar conta
  const openModal = (pessoa?: Pessoa) => {
    setPessoaData(pessoa || { id: 0, nome: "", tipo: "fisica", observacao: "", ativo: true, cgcpf: "", email: "", telefone: "", idReceita: null, idDespesa: null, dtCadastro: new Date().toISOString(), fornecedor: false, cliente: false });
    setModalIsOpen(true);
  };

  const handleStatusChange = async (id: number, novoStatus: boolean) => {
    try {
      await atualizarStatusPessoa(id, novoStatus);
      setPessoas((prev) =>
        prev.map((pessoa) =>
          pessoa.id === id ? { ...pessoa, ativo: novoStatus } : pessoa
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status da pessoa:", error);
    }
  };

  // 🔹 Função para abrir o modal de confirmação antes de excluir
  const handleDelete = (id: number) => {
    setDeletePessoaId(id);
    setConfirmModalOpen(true);
  };

  // 🔹 Função para confirmar a exclusão
  const handleDeleteConfirm = async () => {
    if (deletePessoaId  === null) return;
    try {
      await excluirPessoa(deletePessoaId );
      setPessoas((prev) => prev.filter((pessoa) => pessoa.id !== deletePessoaId ));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
    }
  };
  // Fechar modal
  const closeModal = () => {
    setModalIsOpen(false);
    setPessoaData(null);
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
    if (!pessoaData) return;
    setIsSaving(true);


    console.log("📤 Enviando para API:", pessoaData);

    // 🔹 Criando objeto correto para evitar envio de campos desnecessários
    const pessoaEnviada: Partial<Pessoa> = {
        id: pessoaData.id,
        nome: pessoaData.nome,
        cgcpf: pessoaData.cgcpf,
        tipo: pessoaData.tipo,
        idReceita: pessoaData.idReceita ?? null,
        idDespesa: pessoaData.idDespesa ?? null,
        dtCadastro: pessoaData.dtCadastro ? pessoaData.dtCadastro : new Date().toISOString(),
        telefone: pessoaData.telefone,
        email: pessoaData.email,
        observacao: pessoaData.observacao,
        ativo: pessoaData.ativo,
        fornecedor: pessoaData.fornecedor,
        cliente: pessoaData.cliente,
    };
    
    try {
        await salvarPessoa(pessoaEnviada as Pessoa);
        fetchContas();
        closeModal();
    } catch (error) {
        console.error("❌ Erro ao salvar conta:", error);
    }

    setIsSaving(false);
  };


  const formatarTelefone = (value: string) => {
    value = value.replace(/\D/g, ""); // Remove tudo que não for número


    if (value.length <= 10) {
    return value.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    } else {
    return value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }
  };

  const formatarDocumento = (tipo: string, value: string) => {

    if (tipo === "fisica") {
      return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    } else {
      return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
  };


  return (
    <div>
      {/* 🔹 Barra de busca e botão de adicionar */}
        <div className="flex justify-between items-end gap-5 mb-4 border-b pb-4">
            <div className="relative w-auto whitespace-nowrap">
                <button 
                className="bg-gray-200 font-bold h-11 px-4 pt-0 pb-0 flex items-center rounded hover:bg-gray-300"
                >
                Adicionar Filtro <FontAwesomeIcon icon={faPlus} className="ml-3" />
                </button>
            </div>

            <div className="flex justify-end items-center gap-5 w-full">
                <div className=" relative w-full max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
                        <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <input
                        type="text"
                        className="border border-gray-400 p-2 pl-10 pr-4 rounded w-auto min-w-max placeholder-shown:w-full hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Pesquisar por Nome, CPF/CNPJ, Email ou Telefone"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                className="bg-primary text-white font-bold h-11 px-4 pt-0 pb-0 flex items-center rounded hover:bg-orange-400"
                onClick={() => openModal()}
                >
                Nova Pessoa <FontAwesomeIcon icon={faPlus} className="ml-3" />
                </button>
            </div>
        </div>

      {isLoading && 
        <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
        </div>
      }

      {/* 🔹 Listagem de Pessoas no Formato de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredPessoas.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-2">
                <img 
                src="/frontend/src/assets/img/noData.svg"
                alt="Sem dados"
                className="object-contain" style={{width:"25em", height:"25em"}}/> 
                <p className="text-gray-900 font-bold text-center col-span-full " style={{fontSize:"1.2em", marginTop: "-40px", marginBottom: "150px"}}>Nenhuma pessoa encontrada!</p>
            </div>
        ) : (
          filteredPessoas.map((pessoa) => (
            <div key={pessoa.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200 relative hover:bg-gray-100">
              {/* 🔹 Status ativo (Switch) */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={pessoa.ativo}
                    onChange={() => handleStatusChange(pessoa.id, !pessoa.ativo)}
                  />
                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
                <span className="text-xs font-semibold text-gray-600">{pessoa.ativo ? "Ativo" : "Inativo"}</span>
              </div>

              {/* 🔹 Nome e Avatar */}
              <div className="flex flex-col items-center mt-6">
                <div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
                  {pessoa.nome[0].toUpperCase()}
                </div>
                <span className="text-lg font-bold mt-2">{pessoa.nome}</span>
                <p className="text-sm text-gray-600">{formatarDocumento(pessoa.tipo, pessoa.cgcpf ?? "") || "Sem CPF/CNPJ"}</p>
                <p className="text-sm text-gray-600">{pessoa.email || "Sem Email"}</p>
                <p className="text-sm text-gray-600">{formatarTelefone(pessoa.telefone ?? "") || "Sem Telefone"} {pessoa.telefone?.length}</p>
              </div>
            </div>
          ))
        )}
      </div>
    
      {/* 🔹 Modal para Criar/Editar Pessoa */}
      {modalIsOpen && pessoaData && (
        <PessoaModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          pessoaData={pessoaData}
          handleInputChange={(e) => setPessoaData({ ...pessoaData, [e.target.name]: e.target.value })}
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
        message="Tem certeza que deseja excluir esta pessoa?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default ListConta;
