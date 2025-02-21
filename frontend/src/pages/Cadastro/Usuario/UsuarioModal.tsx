import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCamera } from "@fortawesome/free-solid-svg-icons";
import { Usuario } from "../../../../../backend/src/models/Usuario";

Modal.setAppElement("#root");

interface UsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuarioData: Usuario;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleSave: () => void;
  isSaving: boolean;
}

const UsuarioModal: React.FC<UsuarioModalProps> = ({
  isOpen,
  onClose,
  usuarioData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [fotoPreview, setFotoPreview] = useState<string | null>(
    usuarioData.foto_Perfil || null
  );

  // Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { [key: string]: string } = {};
    if (!usuarioData.nome) newErrors.nome = "O nome é obrigatório!";
    if (!usuarioData.usuario) newErrors.usuario = "Usuário é obrigatório!";
    
    if (!usuarioData.email && (!usuarioData.email.includes(".com") || !usuarioData.email.includes("@"))) {
      newErrors.email = "E-mail inválido!";
    }

    if (!usuarioData.senha) newErrors.senha = "Senha é obrigatória!";

    console.log("erros: " + newErrors.length);

    setErrors(newErrors);
    if (Object.keys(newErrors).length == 0) {
        console.log("Salvando...");
        
      handleSave();
    }
  };

  // Função para manipular upload de foto
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
        handleInputChange({
          target: { name: "foto_Perfil", value: reader.result },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      };
      reader.readAsDataURL(file);
    }
  };

// 🔹 Função para formatar telefone automaticamente
const formatarTelefone = (value: string) => {  
    value = value.replace(/\D/g, ""); // Remove tudo que não for número

    if (value.length <= 10) {
      return value.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    } else {
      return value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }
  };

  // 🔹 Máscara de CPF/CNPJ conforme tipo de pessoa
  const formatarDocumento = (value: string) => {
    value = value.replace(/\D/g, "");

   
    return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    
  };

  const handleInputChangeWithLimit = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
  
      if (name === "telefone" && value.replace(/\D/g, "").length > 11) {
        return; // Não permite mais de 11 dígitos
      }
  
      if (name === "cpf_cnpj" && value.replace(/\D/g, "").length > 11) {
        return; // Não permite mais de 14 dígitos
      }
  
      handleInputChange(e); // Chama a função original para atualizar o estado
    };
    

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-[600px] h-[95vh] flex flex-col z-50 mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold">
          {usuarioData.id ? "Editar Usuário" : "Cadastro de Usuário"}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* Formulário */}
      <div className="p-4 flex-1 overflow-y-auto">
        {/* Dados Gerais */}
        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 pb-2 border-b cursor-default">
          Dados Gerais {usuarioData.id}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="nome"
              className="w-full p-2 border rounded"
              value={usuarioData.nome}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.nome && <p className="text-red-500 text-xs">{errors.nome}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CPF/CNPJ</label>
            <input
              type="text"
              name="cgcpf"
              className={`w-full p-2 border rounded ${errors.cgcpf ? "border-red-500" : "border-gray-300"}`}
              placeholder= "000.000.000-00"
              value={formatarDocumento(usuarioData.cpf_cnpj || "")}
              onChange={handleInputChangeWithLimit}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Dados Login */}
        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 mt-4 pb-2 border-b cursor-default">
          Dados Login
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Usuário <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="usuario"
              className="w-full p-2 border rounded"
              value={usuarioData.usuario}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.usuario && <p className="text-red-500 text-xs">{errors.usuario}</p>}

          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha <span className="text-red-500">*</span></label>
            <input
              type="password"
              name="senha"
              className="w-full p-2 border rounded"
              value={usuarioData.senha}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.senha && <p className="text-red-500 text-xs">{errors.senha}</p>}

          </div>
        </div>

        {/* Foto do Perfil */}
        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 mt-4 pb-2 border-b cursor-default">
          Foto de Perfil
        </p>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFotoChange} />
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <FontAwesomeIcon icon={faCamera} size="2x" className="text-gray-500" />
              )}
            </div>
          </label>
        </div>


        <p className="text-xs uppercase font-semibold text-gray-500 mt-10 py-2 border-y cursor-default">INFORMAÇÕES ADICIONAIS</p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div >
            <label className="block text-sm font-medium mb-1">Telefone</label>
            <input
              type="text"
              name="telefone"
              className={`w-full p-2 border rounded ${errors.telefone ? "border-red-500" : "border-gray-300"}`}
              placeholder="(00) 00000-0000"
              value={formatarTelefone(usuarioData.telefone || "")}
              onChange={handleInputChangeWithLimit}
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              name="email"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="email@gmail.com"
              value={usuarioData.email || ""}
              onChange={handleInputChange}
              disabled={isSaving}
            />            
            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
          </div>
        </div>
      </div>



      {/* Botões */}
      <div className="p-4 border-t bg-white flex justify-end gap-3">
        <button
          className="bg-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-400 transition-all duration-200"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          className="bg-red-500 text-white px-5 py-2 rounded flex items-center gap-2 transition-all duration-200 hover:bg-red-600"
          onClick={validateAndSave}
          disabled={isSaving}
        >
          {isSaving ? "Salvando..." : "Salvar"}
          <FontAwesomeIcon icon={faSave} />
        </button>
      </div>
    </Modal>
  );
};

export default UsuarioModal;
