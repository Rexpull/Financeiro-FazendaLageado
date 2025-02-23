import React, { useEffect, useState, useRef  } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV, faUniversity, faTimes, faUser, faQuestionCircle, faUserCheck, faUsers, faPencil, faEdit, faDeleteLeft, faTrash } from "@fortawesome/free-solid-svg-icons";
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
  const [filtroMenu, setFiltroMenu] = useState(false);
  const [pessoaData, setPessoaData] = useState<Pessoa | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [filtrosAtivos, setFiltrosAtivos] = useState<{ tipo: string[]; status: string[] }>({
    tipo: [ "Cliente", "Fornecedor", "Sem Registro"],
    status: [ "Ativo", "Inativo"],
  });

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletePessoaId, setDeletePessoaId] = useState<number | null>(null);

  useEffect(() => {
    fetchPessoas();
  }, []);

  const fetchPessoas = async () => {
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
    let filtered = pessoas.filter((pessoa) => {
      const matchSearch =
        pessoa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pessoa.cgcpf?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pessoa.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pessoa.telefone?.toLowerCase().includes(searchTerm.toLowerCase());

      
      const matchTipo =
        filtrosAtivos.tipo.length === 0 ||
        filtrosAtivos.tipo.includes(
          pessoa.cliente ? "Cliente" : pessoa.fornecedor ? "Fornecedor" : "Sem Registro"
        );

      const matchStatus =
        filtrosAtivos.status.length === 0 || filtrosAtivos.status.includes(pessoa.ativo ? "Ativo" : "Inativo");

      return matchSearch && matchTipo && matchStatus;
    });

    setFilteredPessoas(filtered);
  }, [searchTerm, filtrosAtivos, pessoas]);

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
        fetchPessoas();
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

  const toggleFiltro = (categoria: "tipo" | "status", valor: string) => {
    setFiltrosAtivos((prev) => {
      const atualizado = prev[categoria].includes(valor)
        ? prev[categoria].filter((item) => item !== valor)
        : [...prev[categoria], valor];
      return { ...prev, [categoria]: atualizado };
    });
  };

  const removerFiltro = (categoria: "tipo" | "status", valor: string) => {
    setFiltrosAtivos((prev) => ({
      ...prev,
      [categoria]: prev[categoria].filter((item) => item !== valor),
    }));
  };

  return (
    <div>
        <div className="flex justify-between items-end gap-5 mb-4 border-b pb-4">
          <div className="relative">
              <div className="relative w-auto whitespace-nowrap">
                <button 
                className="bg-gray-200 font-bold h-10 px-4 pt-0 pb-0 flex items-center rounded hover:bg-gray-300"
                onClick={() => setFiltroMenu(!filtroMenu)}
                >
                Adicionar Filtro <FontAwesomeIcon icon={faPlus} className="ml-3" />
                </button>
              </div>
              {filtroMenu && (
                <div className="absolute bg-white shadow-md font-medium rounded-md border mt-2 pb-1  z-10" style={{width: "11rem"}}>
                  <p className="font-bold text-sm text-gray-800 mb-1 px-2 py-1 bg-gray-200"> <FontAwesomeIcon icon={faUsers}/>  Tipo</p>
                  <label className="flex ml-3 items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filtrosAtivos.tipo.includes("Cliente")} onChange={() => toggleFiltro("tipo", "Cliente")} /> Cliente
                  </label>
                  <label className="flex ml-3 items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filtrosAtivos.tipo.includes("Fornecedor")} onChange={() => toggleFiltro("tipo", "Fornecedor")} /> Fornecedor
                  </label>
                  <label className="flex ml-3 items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filtrosAtivos.tipo.includes("Sem Registro")} onChange={() => toggleFiltro("tipo", "Sem Registro")} /> Sem Registro
                  </label>
    
                  <p className="font-bold text-sm text-gray-800 mb-1 mt-1 px-2 py-1 bg-gray-200"><FontAwesomeIcon icon={faUserCheck}/> Status</p>
                  <label className="flex ml-3 items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filtrosAtivos.status.includes("Ativo")} onChange={() => toggleFiltro("status", "Ativo")} /> Ativo
                  </label>
                  <label className="flex ml-3 items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filtrosAtivos.status.includes("Inativo")} onChange={() => toggleFiltro("status", "Inativo")} /> Inativo
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end items-center gap-5 w-full">
                <div className=" relative w-full max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
                        <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <input
                        type="text"
                        className="border border-gray-400 h-10 py-2 pl-10 pr-4 rounded w-auto min-w-max placeholder-shown:w-full hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Pesquisar por Nome, CPF/CNPJ, Email ou Telefone"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                className="bg-primary text-white font-bold h-10 px-6 pt-0 pb-0 flex items-center rounded hover:bg-orange-400"
                onClick={() => openModal()}
                >
                Nova Pessoa <FontAwesomeIcon icon={faPlus} className="ml-3" />
                </button>
            </div>
        </div>

        <div className="flex justify-between items-start w-full">
          <div id="filtersActiveDiv"className="flex w-full justify-start items-center">
            <div className="flex flex-wrap gap-2 mb-4">
              {filtrosAtivos.tipo.map((tipo) => (
                <div key={tipo} className="bg-white text-gray-800 px-3 py-1 font-medium border gap-2 rounded-md flex items-center">
                  <span className="text-gray-500"> Tipo: </span> 
                  <span className="font-bold"> {tipo} </span> 
                  <FontAwesomeIcon icon={faTimes} className="ml-2 cursor-pointer" onClick={() => removerFiltro("tipo", tipo)} />
                </div>
              ))}
              {filtrosAtivos.status.map((status) => (
                <div key={status} className="bg-white text-gray-800 px-3 py-1 font-medium border gap-2 rounded-md flex items-center">
                  <span className="text-gray-500"> Status: </span> 
                  <span className="font-bold"> {status} </span> 
                  <FontAwesomeIcon icon={faTimes} className="ml-2 cursor-pointer" onClick={() => removerFiltro("status", status)} />
                </div>
              ))}
              {filtrosAtivos.tipo.length === 0 && filtrosAtivos.status.length === 0 && (  
                <div className="bg-white text-gray-800 px-3 py-1 font-medium  gap-2 rounded-md flex items-center">
                  <span className="text-gray-500"> Sem Filtros Ativos </span> 
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center text-gray-600 whitespace-nowrap">
            <span className="text-gray-500 font-medium">{filteredPessoas.length} Resultado(s)</span>
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
            <div key={pessoa.id} className="bg-white rounded-lg shadow-md p-4 pb-3 border border-gray-200 relative hover:bg-gray-100">
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


          {/* 🔹 Menu de ações */}
               <div className="absolute top-3 right-0 cursor-pointer" ref={(el) => (menuRefs.current[pessoa.id] = el)}>
                  <FontAwesomeIcon
                    icon={faEllipsisV}
                    className="text-gray-600 w-8 mr-1 text-lg"
                    onClick={() => setActiveMenu(activeMenu === pessoa.id ? null : pessoa.id)}
                  />
                  {activeMenu === pessoa.id && (
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
                          setPessoaData(pessoa);
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
                          handleDelete(pessoa.id);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

              {/* 🔹 Nome e Avatar */}
              <div className="flex flex-col items-center mt-6">
                <div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
                  {pessoa.nome[0].toUpperCase()}
                </div>
                <span className="text-lg font-bold mt-2 " style={{textTransform: 'capitalize'}}>{pessoa.nome.toLowerCase()}</span>
                <p className="text-sm text-gray-600">{formatarDocumento(pessoa.tipo, pessoa.cgcpf ?? "") || "Sem CPF/CNPJ"}</p>
                <p className="text-sm text-gray-600">{pessoa.email || "Sem Email"}</p>
                <p className="text-sm text-gray-600">{formatarTelefone(pessoa.telefone ?? "") || "Sem Telefone"}</p>

                <hr className="w-full my-2"/>

                <div className="flex justify-center gap-3 items-center mt-1">
                  {pessoa.fornecedor == true &&(
                    <div className="flex items-center gap-2 text-sm text-orange-400 py-1 px-2 font-bold bg-gray-50 border rounded">
                      <FontAwesomeIcon icon={faUniversity} />
                      Fornecedor
                    </div>
                  )}
                  {pessoa.cliente == true &&(
                    <div className="flex items-center gap-2 text-sm text-orange-400 py-1 px-2 font-bold bg-gray-50 border rounded">
                      <FontAwesomeIcon icon={faUser} />
                      Cliente
                    </div>
                  )}

                  {pessoa.cliente == false && pessoa.fornecedor == false &&(
                      <div className="flex items-center gap-2 text-sm text-gray-400 py-1 px-2 font-bold bg-gray-50 border rounded">
                        <FontAwesomeIcon icon={faQuestionCircle} />
                        Sem Registros
                      </div>
                  )}
                </div>    
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
