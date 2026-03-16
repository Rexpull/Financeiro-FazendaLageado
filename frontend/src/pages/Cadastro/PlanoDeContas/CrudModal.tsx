import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faExclamationCircle, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PlanoConta } from "../../../../../backend/src/models/PlanoConta";

Modal.setAppElement("#root"); // 🔹 Corrige o erro de acessibilidade do modal

interface PlanoContaModalProps {
  isOpen: boolean;
  onClose: () => void;
  planoData: PlanoConta;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  isSaving: boolean;
  planos: PlanoConta[];
}

const BancoModal: React.FC<PlanoContaModalProps> = ({
  isOpen,
  onClose,
  planoData,
  handleInputChange,
  handleSave,
  isSaving,
  planos
}) => {
  const [errors, setErrors] = useState<{ descricao?: string; nivel?: string; tipo?: string; idReferente?: string }>({});
  const [searchReferente, setSearchReferente] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // 🔹 Controle automático de "Referente" apenas para NOVOS planos
  useEffect(() => {
    if (!isOpen) return;
    if (planoData.id) return; // não mexe automaticamente quando está editando

    if (planoData.nivel == 1) {
      handleInputChange({ target: { name: "idReferente", value: "" } } as any);
      setSearchReferente("");
    } else {
      handleInputChange({ target: { name: "idReferente", value: null } } as any);
      setSearchReferente(""); // 🔹 Limpa o campo de pesquisa
    }
  }, [planoData.nivel, planoData.id, isOpen]);

  // 🔹 Limpa o referente quando o tipo for alterado (apenas para nível 3) – só em novos
  useEffect(() => {
    if (!isOpen) return;
    if (planoData.id) return;

    if (planoData.nivel === 3) {
      handleInputChange({ target: { name: "idReferente", value: null } } as any);
      setSearchReferente("");
    }
  }, [planoData.tipo, planoData.nivel, planoData.id, isOpen]);

  // 🔹 Quando editar, preencher o texto do campo "Referente" com o plano já salvo
  useEffect(() => {
    if (!isOpen) return;
    if (!planoData.idReferente) {
      // Se não tiver referente salvo, não força nada
      if (planoData.nivel === 1) {
        setSearchReferente("");
      }
      return;
    }

    const planoRef = planos.find((p) => p.id === planoData.idReferente);
    if (planoRef) {
      setSearchReferente(`${planoRef.hierarquia} | ${planoRef.descricao}`);
    }
  }, [isOpen, planoData.idReferente, planos, planoData.nivel]);

  // 🔹 Filtragem de planos de conta para pesquisa no campo "Referente"
  const filteredPlanos = planos
    .filter((plano) => {
      const nivelAtual = Number(planoData.nivel);

      // 🔹 Filtra pelo nível anterior
      if (plano.nivel !== nivelAtual - 1) return false;
  
      // 🔹 Se for nível 3, filtra também pelo tipo
      if (nivelAtual === 3 && plano.tipo !== planoData.tipo) return false;
      
      // 🔹 Filtra pela busca
      return `${plano.hierarquia} | ${plano.descricao}`.toLowerCase().includes(searchReferente.toLowerCase());
    })
    .slice(0, 10);

  console.log('🔍 Debug - Filtragem de Planos:', {
    nivelAtual: planoData.nivel,
    tipoAtual: planoData.tipo,
    planosFiltrados: filteredPlanos.map(p => ({
      id: p.id,
      nivel: p.nivel,
      tipo: p.tipo,
      descricao: p.descricao
    }))
  });

  // 🔹 Seleção do plano de conta referente
  const handleSelectReferente = (plano: PlanoConta) => {
    handleInputChange({ target: { name: "idReferente", value: plano.id } } as any);
    setSearchReferente(`${plano.hierarquia} | ${plano.descricao}`);
    setShowSuggestions(false);
  };

  // 🔹 Validação antes de salvar
  const validateAndSave = () => {
    const newErrors: { descricao?: string; nivel?: string; tipo?: string; idReferente?: string } = {};

    if (!planoData.descricao.trim()) {
      newErrors.descricao = "A descrição é obrigatória!";
    }
    if (!planoData.nivel) {
      newErrors.nivel = "O nível é obrigatório!";
    }
    if (!planoData.tipo) {
      newErrors.tipo = "O tipo é obrigatório!";
    }
    if (planoData.nivel != 1 && !planoData.idReferente){
      newErrors.idReferente = "O referente é obrigatório!";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length == 0) {
      console.log("📤 Enviando para API:", planoData);       
      handleSave();

    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}} 
      shouldCloseOnOverlayClick={false} 
      className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold text-gray-800">
          {planoData.id ? "Editar Plano de Contas" : "Cadastro de Plano de Contas"}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

       {/* 🔹 Formulário */}
       <div className="p-4">
        <p className="text-xs uppercase font-semibold text-gray-500 mb-3">Dados Gerais</p>

        <div className="grid grid-cols-2 gap-4">
          {/* 🔹 Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="descricao"
              className={`w-full p-2 bg-gray-50 border ${errors.descricao ? "border-red-500" : "border-gray-300"} rounded`}
              placeholder="Ex: Investimento Variável"
              value={planoData.descricao}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.descricao && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.descricao}
              </p>
            )}
          </div>

          {/* 🔹 Nível */}
          <div className="relative">
            <div >
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nível <span className="text-red-500">*</span>
              </label>
        
            </div>
            
            <div className="flex items-center">
              <select
                name="nivel"
                className={`w-full p-2 pr-5 bg-gray-50 border ${errors.nivel ? "border-red-500" : "border-gray-300"} rounded `}
                value={planoData.nivel}
                onChange={handleInputChange}
                disabled={isSaving}
              >
                <option value="1">Nível 1</option>
                <option value="2">Nível 2</option>
                <option value="3">Nível 3</option>
              </select>
            </div>
            {errors.nivel && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.nivel}
              </p>
            )}
          </div>

          {/* 🔹 Tipo (Investimento / Custeio) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo"
              className={`w-full p-2 bg-gray-50 border ${errors.tipo ? "border-red-500" : "border-gray-300"} rounded`}
              value={planoData.tipo}
              onChange={handleInputChange}
              disabled={isSaving}
            >
              <option value="custeio">Custeio</option>
              <option value="investimento">Investimento</option>
            </select>
            {errors.tipo && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faExclamationCircle} /> {errors.tipo}
              </p>
            )}
          </div>

          {/* 🔹 Referente */}
          <div className={`transition-opacity ${planoData.nivel == 1 ? "opacity-50" : "opacity-100"}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referente {planoData.nivel !== 1 && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                className={`w-full p-2 bg-gray-50 border ${errors.idReferente ? "border-red-500" : "border-gray-300"} rounded`}
                placeholder="Pesquisar o plano referente"
                value={searchReferente}
                onChange={(e) => {
                  setSearchReferente(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                disabled={planoData.nivel == 1}
              />
              {showSuggestions && filteredPlanos.length > 0 && (
                <ul className="absolute bg-white border w-full shadow-lg rounded mt-1">
                  {filteredPlanos.map((plano) => (
                    <li
                      key={plano.id}
                      className="p-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSelectReferente(plano)}
                    >
                      {plano.hierarquia} | {plano.descricao}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🔹 Botões */}
      <div className="flex justify-end gap-3 p-4 mt-5 border-t">
        <button
          className="bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded hover:bg-gray-200 transition"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancelar
        </button>

        <button
          className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600 transition"
          onClick={validateAndSave}
          disabled={isSaving}
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

export default BancoModal;
