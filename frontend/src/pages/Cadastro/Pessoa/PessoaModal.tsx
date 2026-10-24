import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faSearch  } from "@fortawesome/free-solid-svg-icons";
import { listarPlanoContas } from "../../../services/planoContasService";
import { PlanoConta } from "../../../../../backend/src/models/PlanoConta";
import { Pessoa } from "../../../../../backend/src/models/Pessoa";

Modal.setAppElement("#root");

interface PessoaModalProps {
    isOpen: boolean;
    onClose: () => void;
    pessoaData: Pessoa;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleSave: () => void;
    isSaving: boolean;
}
  
const PessoaModal: React.FC<PessoaModalProps> = ({
  isOpen,
  onClose,
  pessoaData,
  handleInputChange,
  handleSave,
  isSaving,
}) => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [search, setSearch] = useState({ receita: "", despesa: "" });
  const [showSuggestions, setShowSuggestions] = useState({ receita: false, despesa: false });

  // 🔹 Criando referência para os campos
  const receitaRef = useRef<HTMLDivElement>(null);
  const despesaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      listarPlanoContas().then(setPlanos);
    }
  }, [isOpen]);

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
  const formatarDocumento = (tipo: string, value: string) => {
    value = value.replace(/\D/g, "");

    if (tipo === "fisica") {
      return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    } else {
      return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
  };

  const handleInputChangeWithLimit = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "telefone" && value.replace(/\D/g, "").length > 11) {
      return; // Não permite mais de 11 dígitos
    }

    if (name === "cgcpf" && pessoaData.tipo == "fisica" && value.replace(/\D/g, "").length > 11) {
      return; // Não permite mais de 14 dígitos
    }

    if (name === "cgcpf" && pessoaData.tipo == "juridica" && value.replace(/\D/g, "").length > 14) {
      return; // Não permite mais de 14 dígitos
    }


    handleInputChange(e); // Chama a função original para atualizar o estado
  };
  
  // 🔹 Filtrar planos de contas conforme busca
  const filterPlanos = (tipo: string, searchTerm: string) => {
    return planos
      .filter((plano) => plano.nivel === 3 && plano.hierarquia.startsWith(tipo))
      .filter((plano) => plano.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
  };

   // 🔹 Atualiza o campo com a seleção do usuário e esconde as sugestões
   const selectPlano = (tipo: "receita" | "despesa", plano: PlanoConta) => {
    setSearch({ ...search, [tipo]: plano.descricao });
    setShowSuggestions({ ...showSuggestions, [tipo]: false });

    // Atualiza os valores do formulário
    const event = {
      target: { name: tipo === "receita" ? "idReceita" : "idDespesa", value: plano.id }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleInputChange(event);
  };

  // 🔹 Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (receitaRef.current && !receitaRef.current.contains(event.target as Node)) {
        setShowSuggestions((prev) => ({ ...prev, receita: false }));
      }
      if (despesaRef.current && !despesaRef.current.contains(event.target as Node)) {
        setShowSuggestions((prev) => ({ ...prev, despesa: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { [key: string]: string } = {};

    if (!pessoaData.nome) newErrors.nome = "O nome é obrigatório!";
    if (pessoaData.cgcpf && pessoaData.cgcpf.trim().replace(/\D/g, "").length !== (pessoaData.tipo === "fisica" ? 11 : 14)) {
      newErrors.cgcpf = pessoaData.tipo === "fisica" ? "CPF inválido!" : "CNPJ inválido!";
    }
    if (pessoaData.telefone && pessoaData.telefone.trim().replace(/\D/g, "").length < 10) {
      newErrors.telefone = "Telefone incompleto!";
    }
    if (pessoaData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pessoaData.email)) {
      newErrors.email = "E-mail inválido!";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      handleSave();
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}} 
      shouldCloseOnOverlayClick={false} 
      className="bg-white rounded-lg shadow-lg w-[600px] h-[95vh] flex flex-col z-50 mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold">{pessoaData.id ? "Editar Pessoa" : "Cadastro de Pessoa"}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      {/* 🔹 Alternar entre Conta e Cartão */}
      

      {/* 🔹 Formulário */}
      <div className="mt-2 p-4 relative flex-1 overflow-y-auto">
        <div className="flex justify-center mt-4 absolute right-4" style={{ top: '-15px' }}>
          {/* 🔹 Tipo de Pessoa */}
          <div>
            <select
              name="tipo"
              className="w-full px-2 py-1 border border-gray-300 rounded"
              value={pessoaData.tipo}
              onChange={handleInputChange}
              disabled={isSaving}
            >
              <option value="fisica">Pessoa Física</option>
              <option value="juridica">Pessoa Jurídica</option>
            </select>
          </div>
        </div>



        <p className="text-xs uppercase font-semibold text-gray-500 mb-2 pb-2 border-b cursor-default">DADOS GERAIS</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="nome"
              className={`w-full p-2 border rounded ${errors.nome ? "border-red-500" : "border-gray-300"}`}
              placeholder="Nome completo"
              value={pessoaData.nome}
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
              placeholder={pessoaData.tipo === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
              value={formatarDocumento(pessoaData.tipo ,pessoaData.cgcpf || "")}
              onChange={handleInputChangeWithLimit}
              disabled={isSaving}
            />
            {errors.cgcpf && <p className="text-red-500 text-xs">{errors.cgcpf}</p>}
          </div>
        </div>

        

        {/* 🔹 Planos de Contas */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div ref={receitaRef} className="relative">
            <label className="block text-sm font-medium mb-1">Plano de Receita</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Plano de Receita (opcional)"
              value={search.receita}
              onChange={(e) => {
                setSearch({ ...search, receita: e.target.value });
                setShowSuggestions({ ...showSuggestions, receita: true });
              }}
              onFocus={() => setShowSuggestions({ ...showSuggestions, receita: true })}
            />
            {showSuggestions.receita && (
              <ul className="absolute bg-white rounded w-full shadow-lg mt-1 z-10">
                {filterPlanos("001", search.receita).map((plano) => (
                  <li
                    key={plano.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => selectPlano("receita", plano)}
                  >
                    {plano.hierarquia} | {plano.descricao}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div ref={despesaRef} className="relative">
            <label className="block text-sm font-medium mb-1">Plano de Despesa</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Plano de Despesa (opcional)"
                value={search.despesa}
                onChange={(e) => {
                  setSearch({ ...search, despesa: e.target.value });
                  setShowSuggestions({ ...showSuggestions, despesa: true });
                }}
                onFocus={() => setShowSuggestions({ ...showSuggestions, despesa: true })}
              />
              {showSuggestions.despesa && (
                <ul className="absolute bg-white rounded w-full shadow-lg mt-1 z-10">
                  {filterPlanos("002", search.despesa).map((plano) => (
                    <li
                      key={plano.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => selectPlano("despesa", plano)}
                    >
                      {plano.hierarquia} | {plano.descricao}
                    </li>
                  ))}
                </ul>
              )}
          </div>
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
              value={formatarTelefone(pessoaData.telefone || "")}
              onChange={handleInputChangeWithLimit}
              disabled={isSaving}
            />
            {errors.telefone && <p className="text-red-500 text-xs">{errors.telefone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="email@gmail.com"
              value={pessoaData.email || ""}
              onChange={handleInputChange}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* 🔹 Observação */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Observação</label>
          <textarea
            name="observacao"
            className="w-full p-2 border border-gray-300 rounded"
            rows={3}
            placeholder="Informações adicionais"
            value={pessoaData.observacao || ""}
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

export default PessoaModal;
