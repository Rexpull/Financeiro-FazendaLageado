import React, { useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCamera, faKey, faCheck, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { Usuario } from "../../../../../backend/src/models/Usuario";
import { enviarEmail } from "../../../services/EmailService"; // Implemente esta função
import { FaRegCheckCircle } from "react-icons/fa";
import defaultAvatar from "../../../assets/img/default-avatar.jpg";

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
    usuarioData.foto_perfil || null
  );

  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");

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
          target: { name: "foto_perfil", value: reader.result },
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

  const salvarNovaSenha = async () => {
    if (novaSenha.length < 6) {
      setErroSenha("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmacaoSenha) {
      setErroSenha("As senhas digitadas não coincidem.");
      return;
    }

    // Atualizar a senha no estado do usuário
    handleInputChange({
      target: { name: "senha", value: novaSenha },
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    // Fechar modal de senha
    setModalSenhaAberto(false);
    setNovaSenha("");
    setConfirmacaoSenha("");
    setErroSenha("");
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
          Dados Gerais
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
          <div >
            <label className="block text-sm font-medium mb-3">Senha {usuarioData.senha && (<FontAwesomeIcon icon={faCheck} className="text-green-700 ml-2" />)}</label>
            <button
              className="text-blue-500 text-md underline flex items-center "
              onClick={() => setModalSenhaAberto(true)}
            >
              <FontAwesomeIcon icon={faKey} className="mr-2" />
              {usuarioData.senha ? "Editar Senha existente" : "Criar nova Senha"}
            </button>
            {errors.senha && <p className="text-red-500 text-xs">{errors.senha}</p>}

          </div>

          {/* Modal para criação/edição de senha */}
          <Modal
            isOpen={modalSenhaAberto}
            onRequestClose={() => setModalSenhaAberto(false)} 
            className="bg-white rounded-lg shadow-lg w-[400px] p-6 flex flex-col z-100 absolute"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-100"

            style={{ overlay: { backgroundColor: "rgba(0, 0, 0, 0.5)" } }}
          >
            <h3 className="text-lg font-semibold mb-4">Criar/Alterar Senha</h3>
            <label className="block text-sm font-medium">Nova Senha</label>
            <input
              type="password"
              className="w-full p-2 border rounded mt-1"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
            />
            <label className="block text-sm font-medium mt-3">Confirmar Senha</label>
            <input
              type="password"
              className="w-full p-2 border rounded mt-1"
              value={confirmacaoSenha}
              onChange={(e) => setConfirmacaoSenha(e.target.value)}
            />
            {erroSenha && <p className="text-red-500 text-sm mt-2">{erroSenha}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 bg-gray-300 rounded" onClick={() => setModalSenhaAberto(false)}>Cancelar</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={salvarNovaSenha}>Salvar</button>
            </div>
          </Modal>

        </div>

        {/* Foto do Perfil */}
        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 mt-4 pb-2 border-b cursor-default">
          Foto de Perfil
        </p>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleFotoChange} />
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden hover:shadow-lg">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <img src={defaultAvatar} alt="Perfil" className="w-full h-full object-cover border rounded-full" />

              )}
            </div>
          </label>
        </div>


        <p className="text-xs uppercase font-semibold text-gray-500 mt-5 py-2 border-y cursor-default">INFORMAÇÕES ADICIONAIS</p>

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
