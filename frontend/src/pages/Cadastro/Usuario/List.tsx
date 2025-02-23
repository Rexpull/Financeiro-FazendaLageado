import React, { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faEllipsisV, faTimes, faUser, faTrash, faEdit } from "@fortawesome/free-solid-svg-icons";
import { listarUsuarios, excluirUsuario, atualizarStatusUsuario, salvarUsuario } from "../../../services/usuarioService";
import UsuarioModal from "./UsuarioModal";
import DialogModal from "../../../components/DialogModal";
import { Usuario } from "../../../../../backend/src/models/Usuario";

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
  const [filtrosAtivos, setFiltrosAtivos] = useState<{ status: string[] }>({
    status: ["Ativo", "Inativo"],
  });
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteUsuarioId, setDeleteUsuarioId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsuarios();
  }, []);

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

  useEffect(() => {
    let filtered = usuarios.filter((usuario) => {
      const matchSearch =
        usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.telefone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.cpf_cnpj?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        filtrosAtivos.status.length === 0 || filtrosAtivos.status.includes(usuario.ativo ? "Ativo" : "Inativo");

      return matchSearch && matchStatus;
    });

    setFilteredUsuarios(filtered);
  }, [searchTerm, filtrosAtivos, usuarios]);

  const openModal = (usuario?: Usuario) => {
    setUsuarioData(
      usuario || { id: 0, nome: "", usuario: "", email: "", senha: "", ativo: true, foto_Perfil: "", dt_Cadastro: new Date().toISOString() }
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
    
      // 🔹 Criando objeto correto para evitar envio de campos desnecessários
    const usuarioEnviado: Partial<Usuario> = {
        
        id: usuarioData.id,
        nome: usuarioData.nome,
        cpf_cnpj: usuarioData.cpf_cnpj ? usuarioData.cpf_cnpj.replace(/\D/g, "") : "",
        telefone: usuarioData.telefone ? usuarioData.telefone.replace(/\D/g, "") : "",
        usuario: usuarioData.usuario,
        email: usuarioData.email,
        senha: usuarioData.senha,
        ativo: usuarioData.ativo,
        foto_Perfil: usuarioData.foto_Perfil,
        dt_Cadastro: usuarioData.dt_Cadastro ? usuarioData.dt_Cadastro : new Date().toISOString(),
    };
      
      try {
          await salvarUsuario(usuarioEnviado as Usuario);
          fetchUsuarios();
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
      <div className="flex justify-between items-center gap-5 mb-4 border-b pb-4">
        <div className="flex items-center justify-start gap-5">
          <div className="border bg-orange-100 shadow-sm rounded p-3">
              <span>Total</span> <br/>
              <span className="text-2xl font-bold text-orange-500">{usuarios.length}</span>

              
          </div>

        </div>
        <div className="flex items-center gap-5 w-full">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
              <FontAwesomeIcon icon={faSearch} />
            </span>
            <input
              type="text"
              className="border border-gray-400 h-10 py-2 pl-10 pr-4 rounded w-auto min-w-max placeholder-shown:w-full hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-all"
              placeholder="Pesquisar por Nome, Email, Telefone ou CPF"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="bg-primary text-white font-bold h-10 px-6 flex items-center rounded hover:bg-orange-400" onClick={() => openModal()}>
            Novo Usuário <FontAwesomeIcon icon={faPlus} className="ml-3" />
          </button>
        </div>
      </div>

      {/* 🔹 Lista de Usuários */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredUsuarios.length === 0 ? (
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
                    <button className="block w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => openModal(usuario)}>
                      <FontAwesomeIcon icon={faEdit} className="mr-2" />
                      Editar
                    </button>
                    <button className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100" onClick={() => handleDelete(usuario.id)}>
                      <FontAwesomeIcon icon={faTrash} className="mr-2" />
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              {/* 🔹 Nome e Avatar */}
              <div className="flex flex-col items-center mt-6">
                <img className="w-12 h-12 rounded-full object-cover" src={usuario.foto_Perfil || "/default-avatar.png"} alt="Foto de perfil" />
                <span className="text-lg font-bold mt-2">{usuario.nome}</span>
                <p className="text-sm text-gray-600">{usuario.email || "Sem Email"}</p>
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
