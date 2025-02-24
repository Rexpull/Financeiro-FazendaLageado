import React, { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV, faTimes, faUser, faTrash, faEdit, faCalendar, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import { listarUsuarios, excluirUsuario, atualizarStatusUsuario, salvarUsuario } from "../../../services/usuarioService";
import UsuarioModal from "./UsuarioModal";
import DialogModal from "../../../components/DialogModal";
import { Usuario } from "../../../../../backend/src/models/Usuario";

import defaultAvatar from "../../../assets/img/default-avatar.jpg";
import allUsers from "../../../assets/img/allUsers.svg";
import activeUsers from "../../../assets/img/activeUsers.svg";
import inactiveUsers from "../../../assets/img/inactiveUsers.svg";


const ListUsuario: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState<Usuario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
 const [isSaving, setIsSaving] = useState(false);


  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [usuarioData, setUsuarioData] = useState<Usuario | null>(null);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [selectedFilter, setSelectedFilter] = useState<"todos" | "ativos" | "inativos">("todos");


  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteUsuarioId, setDeleteUsuarioId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsuarios();

  }, []);

  
  useEffect(() => {
    filterUsuarios();
  }, [selectedFilter, usuarios]);


  const fetchUsuarios = async () => {
    setIsLoading(true);
    try {
      const data = await listarUsuarios();
      setUsuarios(data);
      setFilteredUsuarios(data);      
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
    setIsLoading(false);
  };


  const filterUsuarios = () => {
    if (selectedFilter === "ativos") {
      setFilteredUsuarios(usuarios.filter((usuario) => usuario.ativo));
    } else if (selectedFilter === "inativos") {
      setFilteredUsuarios(usuarios.filter((usuario) => !usuario.ativo));
    } else {
      setFilteredUsuarios(usuarios); // Todos os usuários
    }

  };

  const handleFilterClick = (filter: "todos" | "ativos" | "inativos") => {
    if (
      (filter === "ativos" && activeCount === 0) ||
      (filter === "inativos" && inactiveCount === 0)
    ) {
      return; // Evita mudança se não houver usuários no filtro
    }
    setSelectedFilter(filter);
  };

  const formatarData = (data: string) => {
    return new Date(data);
  };

  const totalCount = usuarios.length;
  const activeCount = usuarios.filter((usuario) => usuario.ativo).length;
  const inactiveCount = usuarios.filter((usuario) => !usuario.ativo).length;

  useEffect(() => {
    let filtered = usuarios.filter((usuario) => {
      const matchSearch =
        usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.telefone?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchSearch ;
    });

    setFilteredUsuarios(filtered);
  }, [searchTerm, usuarios]);

  const openModal = (usuario?: Usuario) => {
    setUsuarioData(
      usuario || { id: 0, nome: "", usuario: "", email: "", senha: "", ativo: true, foto_perfil: "", dt_cadastro: new Date().toISOString() }
    );
    setModalIsOpen(true);
  };

  const handleStatusChange = async (id: number, novoStatus: boolean) => {
    try {
      await atualizarStatusUsuario(id, novoStatus);
      setUsuarios((prev) => prev.map((usuario) => (usuario.id === id ? { ...usuario, ativo: novoStatus } : usuario)));
    } catch (error) {
      console.error("Erro ao atualizar status do usuário:", error);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteUsuarioId(id);
    setConfirmModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteUsuarioId === null) return;
    try {
      await excluirUsuario(deleteUsuarioId);
      setUsuarios((prev) => prev.filter((usuario) => usuario.id !== deleteUsuarioId));
      setConfirmModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setUsuarioData(null);
  };

  const handleSave = async () => {
    if (!usuarioData) return;
    setIsSaving(true);
    const usuarioEnviado: Partial<Usuario> = {
        id: usuarioData.id,
        nome: usuarioData.nome,
        cpf_cnpj: usuarioData.cpf_cnpj ? usuarioData.cpf_cnpj.replace(/\D/g, "") : "",
        telefone: usuarioData.telefone ? usuarioData.telefone.replace(/\D/g, "") : "",
        usuario: usuarioData.usuario,
        email: usuarioData.email,
        senha: usuarioData.senha,
        ativo: usuarioData.ativo,
        foto_perfil: usuarioData.foto_perfil,
        dt_cadastro: usuarioData.dt_cadastro ? usuarioData.dt_cadastro : new Date().toISOString(),
    };

    try {
        await salvarUsuario(usuarioEnviado as Usuario);

      

        fetchUsuarios();
        closeModal();
    }  catch (error: any) {
      console.error("❌ Erro ao salvar usuario:", error);
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

  return (
    <div>
      {/* 🔹 Barra de busca e botão de adicionar */}
      <div className="flex justify-between items-center mb-4 border-b pb-4 w-full">
        <div className="flex items-center justify-start gap-5">
          <div className={`border rounded pt-1 p-3 overflow-hidden relative transition-all duration-200
            ${selectedFilter === "todos" ? "border-orange-300 shadow-md" : "border-gray-300 bg-white"} 
            ${totalCount === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`} 
            style={{width: "10rem", background: '#FFF5F3'}} 
            onClick={() => handleFilterClick("todos")}>
              <span className="font-medium text-xl" style={{pointerEvents:'none'}}>Total</span> <br/>
              <span className="text-xl font-bold text-orange-500" style={{pointerEvents:'none'}}>{totalCount}</span>
              <img src={allUsers} alt="Usuários" className="absolute w-15 ml-2 right-0 bottom-0 " style={{pointerEvents:'none'}}/>
          </div>

          <div className={`border rounded pt-1 p-3 overflow-hidden relative transition-all duration-200
            ${selectedFilter === "ativos" ? "border-orange-300 shadow-md" : "border-gray-300 bg-white"}
            ${activeCount === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            style={{width: "10rem", background: '#FFF5F3'}}
            onClick={() => handleFilterClick("ativos")}>
              <span className="font-medium text-xl" style={{pointerEvents:'none'}}>Ativos</span> <br/>
              <span className="text-xl font-bold text-orange-500" style={{pointerEvents:'none'}}>{activeCount}</span>
              <img src={activeUsers} alt="Usuários" className="absolute w-20 ml-2 right-0 bottom-0 " style={{pointerEvents:'none'}}/>
          </div>

          <div className={`border rounded pt-1 p-3 overflow-hidden relative transition-all duration-200
            ${selectedFilter === "inativos" ? "border-orange-300 shadow-md" : "border-gray-300 bg-white"}
            ${inactiveCount === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            style={{width: "10rem", background: '#FFF5F3'}}
            onClick={() => handleFilterClick("inativos")}>
              <span className="font-medium text-xl" style={{pointerEvents:'none'}}>Inativos</span> <br/>
              <span className="text-xl font-bold text-orange-500" style={{pointerEvents:'none'}}>{inactiveCount}</span>
              <img src={inactiveUsers} alt="Usuários" className="absolute w-15 ml-2 right-0 bottom-0 " style={{pointerEvents:'none'}}/>
          </div>
        </div>

        <div className="flex items-center justify-end gap-5 w-full">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
              <FontAwesomeIcon icon={faSearch} />
            </span>
            <input
              type="text"
              className="border border-gray-400 h-10 py-2 pl-10 pr-4 rounded w-full min-w-max placeholder-shown:w-full hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Pesquisar por Nome, Email, Telefone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="bg-primary text-white font-bold h-10 px-6 flex items-center rounded hover:bg-orange-400" onClick={() => openModal()}>
            Novo Usuário <FontAwesomeIcon icon={faPlus} className="ml-3" />
          </button>
        </div>
      </div>

      {isLoading && 
        <div className="flex justify-center items-center h-64">
            <div className="loader"></div>
        </div>
      }

      {/* 🔹 Lista de Usuários */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {!isLoading && filteredUsuarios.length === 0 ? (
          <div className="col-span-full flex flex-col items-center gap-2">
            <img 
            src="/frontend/src/assets/img/noData.svg"
            alt="Sem dados"
            className="object-contain" style={{width:"25em", height:"25em"}}/> 
            <p className="text-gray-900 font-bold text-center col-span-full " style={{fontSize:"1.2em", marginTop: "-40px", marginBottom: "150px"}}>Nenhum usuário encontrado!</p>
        </div>
        ) : (
          filteredUsuarios.map((usuario) => (
            <div key={usuario.id} className="bg-white rounded-lg shadow-md p-4 pb-3 border border-gray-200 relative hover:bg-gray-100">
              {/* 🔹 Status ativo (Switch) */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={usuario.ativo} onChange={() => handleStatusChange(usuario.id, !usuario.ativo)} />
                  <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
                <span className="text-xs font-semibold text-gray-600">{usuario.ativo ? "Ativo" : "Inativo"}</span>
              </div>

              {/* 🔹 Menu de ações */}
              <div className="absolute top-3 right-0 cursor-pointer" ref={(el) => (menuRefs.current[usuario.id] = el)}>
                <FontAwesomeIcon
                  icon={faEllipsisV}
                  className="text-gray-600 w-8 mr-1 text-lg"
                  onClick={() => setActiveMenu(activeMenu === usuario.id ? null : usuario.id)}
                />
                {activeMenu === usuario.id && (
                  <div className="absolute right-0 bg-white shadow-md rounded-md w-28 mt-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <button className="block w-full text-left px-3 py-2 hover:bg-gray-100" onClick={(e) => {
                    e.stopPropagation();
                    openModal(usuario);
                    setActiveMenu(null);
                    }}>
                      <FontAwesomeIcon icon={faEdit} className="mr-2" />
                      Editar
                    </button>
                    <button className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(usuario.id);
                      setActiveMenu(null);
                      }}>
                      <FontAwesomeIcon icon={faTrash} className="mr-2" />
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              {/* 🔹 Nome e Avatar */}
              <div className="flex flex-col items-center mt-6">
                <img className="w-20 h-20 rounded-full object-cover" src={usuario.foto_perfil || defaultAvatar} alt="Foto de perfil" />
                
                <span className="text-lg font-bold mt-1 mb-1">{usuario.nome}</span>
                <p className="text-sm text-gray-600">{usuario.email || "Sem Email"}</p>
                <p className="text-sm text-gray-600">{formatarTelefone(usuario.telefone ?? "") || "Sem Telefone"}</p>

                <hr className="w-full my-2"/>
                
                  <div className="flex justify-center gap-3 items-center mt-1">
                    <div className="flex items-center gap-2 text-red-400 py-1 px-2 font-bold bg-red-50 border rounded" style={{fontSize:"0.8em"}}>
                      <FontAwesomeIcon icon={faCalendarDays} />
                       Cadastrado desde: {formatarData(usuario.dt_cadastro).toLocaleDateString()}
                    </div>
                  </div> 
              </div>
            </div>
          ))
        )}
      </div>

      {modalIsOpen && usuarioData && (
        <UsuarioModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          usuarioData={usuarioData}
          handleInputChange={(e) => setUsuarioData({ ...usuarioData, [e.target.name]: e.target.value })}
          handleSave={handleSave}
          isSaving={isSaving}
        />
      )}

      <DialogModal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} onConfirm={handleDeleteConfirm} title="Atenção" type="warn" message="Tem certeza que deseja excluir este usuário?" confirmLabel="Excluir" cancelLabel="Cancelar" />
    </div>
  );
};

export default ListUsuario;
