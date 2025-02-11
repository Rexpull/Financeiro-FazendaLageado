import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faSearch  } from "@fortawesome/free-solid-svg-icons";
import { Banco } from "../../../../../backend/src/models/Banco";
import { listarBancos } from "../../../services/bancoService";

Modal.setAppElement("#root");

interface ContaCorrenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  contaData: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSave: () => void;
  isSaving: boolean;
}

const ContaCorrenteModal: React.FC<ContaCorrenteModalProps> = ({
  isOpen,
  onClose,
  contaData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [tipo, setTipo] = useState<"contaCorrente" | "cartao">(contaData.tipo || "contaCorrente");
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [searchBanco, setSearchBanco] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);


  // 🔹 Buscar os bancos cadastrados quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchBancos();
      setSearchBanco(contaData.bancoNome || "");      
    }
  }, [isOpen]);

  const fetchBancos = async () => {
    try {
      const data = await listarBancos();
      setBancos(data);
    } catch (error) {
      console.error("Erro ao buscar bancos:", error);
    }
  };

  // 🔹 Filtragem dos bancos de acordo com a pesquisa
  const filteredBancos = bancos
    .filter((banco) => banco.nome.toLowerCase().includes(searchBanco.toLowerCase()))
    .slice(0, 10);

  // 🔹 Seleção do banco
  const handleSelectBanco = (banco: Banco) => {
    const event = {
      target: { name: "idBanco", value: banco.id },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleInputChange(event);
    setSearchBanco(banco.nome); // Mostra o nome do banco no input
    setShowSuggestions(false); // Esconde a lista de sugestões
  };

  // Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { [key: string]: string } = {};

    if (!contaData.idBanco) newErrors.idBanco = "O banco é obrigatório!";
    if (!contaData.responsavel) newErrors.responsavel = "O responsável é obrigatório!";
    
    if (tipo === "contaCorrente") {
      if (!contaData.agencia) newErrors.agencia = "A agência é obrigatória!";
      if (!contaData.numConta) newErrors.numConta = "O número da conta é obrigatório!";
    } else {
      if (!contaData.numCartao) newErrors.numCartao = "O número do cartão é obrigatório!";
      if (!contaData.dtValidadeCartao) newErrors.dtValidadeCartao = "A validade é obrigatória!";
    }

    setErrors(newErrors);
    console.log("newErrors ", newErrors);

    if (Object.keys(newErrors).length === 0) {
      console.log("📤 Enviando para API:", contaData);       
      handleSave();
    }

  };

  const formatarNumeroCartao = (numCartao?: string): string => {
    if (!numCartao) return "Número não disponível";
  
    return numCartao.replace(/\D/g, "") // Remove qualquer caractere que não seja número
      .replace(/(\d{4})/g, "$1 ") // Insere espaço a cada 4 números
      .trim(); // Remove espaço final extra
  };
  

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}} 
      shouldCloseOnOverlayClick={false} 
      className="bg-white rounded-lg shadow-lg w-[500px] h-[95vh] flex flex-col z-50 mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold">{tipo === "contaCorrente" ? "Cadastro de Conta Corrente" : "Cadastro de Cartão"}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Alternar entre Conta e Cartão */}
      

      {/* 🔹 Formulário */}
      <div className="mt-3 p-4 relative flex-1 overflow-y-auto">
        <div className="flex justify-center mt-4 absolute right-4" style={{ top: '-15px' }}>
          <button
              className={`px-6 font-bold text-sm rounded-l ${tipo === "contaCorrente" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
              style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem' }}
              onClick={() => {
                  setTipo("contaCorrente");
                  handleInputChange({ target: { name: "tipo", value: "contaCorrente" } } as any);
              }}
          >
              Conta
          </button>
          <button
              className={`px-6 font-bold text-sm rounded-r ${tipo === "cartao" ? "bg-orange-500 text-white" : "bg-gray-200"}`}
              style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem' }}
              onClick={() => {
                  setTipo("cartao");
                  handleInputChange({ target: { name: "tipo", value: "cartao" } } as any);
              }}
          >
              Cartão
          </button>
        </div>



        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 pb-2 border-b cursor-default">DADOS GERAIS</p>


        <div className="mb-4 relative">
          <label className="block text-sm font-medium mb-1">Banco <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-500">
              <FontAwesomeIcon icon={faSearch} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar banco..."
              className={`w-full p-2 pl-8 border border-gray-300 ${errors.idBanco ? "border-red-500" : "border-gray-300"} rounded`}
              value={searchBanco}
              onChange={(e) => {
                setSearchBanco(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
          </div>

          

          {showSuggestions && filteredBancos.length > 0 && (
            <ul className="absolute z-50 bg-white border border-gray-300 rounded w-full mt-1 max-h-40 overflow-y-auto shadow-lg">
              {filteredBancos.map((banco) => (
                <li
                  key={banco.id}
                  className="p-2 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSelectBanco(banco)}
                >
                  {banco.nome}
                </li>
              ))}
            </ul>
          )}

          {errors.idBanco && <p className="text-red-500 text-xs mt-1">{errors.idBanco}</p>}
        </div>

        {tipo === "contaCorrente" ? (
          <>
            {/* 🔹 Campos para Conta Corrente */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Agência <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="agencia"
                  className={`w-full p-2 border ${errors.agencia ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Agência"
                  value={contaData.agencia}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.agencia && <p className="text-red-500 text-xs mt-1">{errors.agencia}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">N° Conta <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="numConta"
                  className={`w-full p-2 border ${errors.numConta ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Número da Conta"
                  value={contaData.numConta}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
                {errors.numConta && <p className="text-red-500 text-xs mt-1">{errors.numConta}</p>}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 🔹 Campos para Cartão */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Número do Cartão <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="numCartao"
                  className={`w-full p-2 border ${errors.numCartao ? "border-red-500" : "border-gray-300"} rounded`}
                  placeholder="Número do Cartão"
                  value={formatarNumeroCartao(contaData.numCartao)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, ""); // Remove os espaços e mantém só números
                      handleInputChange({ target: { name: "numCartao", value: rawValue } } as any);
                    }}
                  disabled={isSaving}
                />
                {errors.numCartao && <p className="text-red-500 text-xs mt-1">{errors.numCartao}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data de Validade <span className="text-red-500">*</span></label>
                <input
                  type="month"
                  name="validade"
                  className={`w-full p-2 border ${errors.dtValidadeCartao ? "border-red-500" : "border-gray-300"} rounded`}
                  value={contaData.dtValidadeCartao?.substring(0, 7) || ""} // 🔹 Mostra apenas AAAA-MM
                  onChange={(e) => {
                    const fullDate = `${e.target.value}-01`; // 🔹 Converte para "YYYY-MM-01"
                    handleInputChange({
                      target: { name: "dtValidadeCartao", value: fullDate },
                    } as unknown as React.ChangeEvent<HTMLInputElement>);
                  }}
                  disabled={isSaving}
                />
                {errors.dtValidadeCartao && <p className="text-red-500 text-xs mt-1">{errors.dtValidadeCartao}</p>}
              </div>
            </div>
          </>
        )}

        {/* 🔹 Responsável */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Responsável <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="responsavel"
            className={`w-full p-2 border ${errors.responsavel ? "border-red-500" : "border-gray-300"} rounded`}
            placeholder="Responsável"
            value={contaData.responsavel}
            onChange={handleInputChange}
            disabled={isSaving}
          />
          {errors.responsavel && <p className="text-red-500 text-xs mt-1">{errors.responsavel}</p>}
        </div>

        <p className="text-xs uppercase font-semibold text-gray-500 mt-7 py-2 border-y cursor-default">INFORMAÇÕES ADICIONAIS</p>

        {/* 🔹 Observação */}
        <div className="mt-2 ">
          <label className="block text-sm font-medium mb-1">Observação</label>
          <textarea
            name="observacao"
            className="w-full p-2 border border-gray-300 rounded"
            rows={3}
            placeholder="Observações..."
            value={contaData.observacao}
            onChange={handleInputChange}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* 🔹 Botões */}
      <div className="p-4 border-t bg-white flex justify-end gap-3">
        <button className="bg-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-400 transition-all duration-200" onClick={onClose} disabled={isSaving}>
          Cancelar
        </button>
        <button
      className={`bg-red-500 text-white px-5 py-2 rounded flex items-center gap-2 
                  transition-all duration-200 ${isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"}`}
      onClick={validateAndSave}
      disabled={isSaving} // Desativa enquanto está salvando
    >
      {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    Salvar
                    <FontAwesomeIcon icon={faSave} />
                  </>
                )}
    </button>
      </div>
    </Modal>
  );
};

export default ContaCorrenteModal;
