import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCheck, faSearch } from "@fortawesome/free-solid-svg-icons";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";
import CurrencyInput from "react-currency-input-field"; 
import { PlanoConta } from "../../../../../backend/src/models/PlanoConta";
import { listarPlanoContas } from "../../../services/planoContasService";

Modal.setAppElement("#root"); // Evita erro de acessibilidade no modal

interface LancamentoManualProps {
  isOpen: boolean;
  onClose: () => void;
  handleSave: (formData: any) => void;
  isSaving: boolean;
}

const LancamentoManual: React.FC<LancamentoManualProps> = ({
  isOpen,
  onClose,
  handleSave,
  isSaving
}) => {
  const [tipoMovimento, setTipoMovimento] = useState<"credito" | "debito">("credito");
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [formData, setFormData] = useState({
    idPlanoContas: "",
    valor: "0,00",
    dataMovimento: new Date().toISOString().slice(0, 16),
    descricao: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [searchPlano, setSearchPlano] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const planoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      listarPlanoContas().then(setPlanos);
    }
  }, [isOpen]);

  // 🔹 Filtrar apenas nível 3 e separar por tipo (Receita ou Despesa)
  const planosFiltrados = planos.filter((plano) =>
    plano.nivel === 3 && (tipoMovimento === "credito" ? plano.tipo === "Receita" : plano.tipo === "Despesa")
  );

  // 🔹 Atualiza os campos do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Resetar plano de contas ao mudar o tipo de movimento
  useEffect(() => {
    setFormData((prev) => ({ ...prev, idPlanoContas: "", descricao: "" }));
    setSearchPlano("");
  }, [tipoMovimento]);

  // 🔹 Validação dos campos antes de salvar
  const validarFormulario = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.idPlanoContas) newErrors.idPlanoContas = "Selecione um plano de contas!";
    if (!formData.valor || formData.valor === "0,00") newErrors.valor = "Informe um valor!";
    if (!formData.dataMovimento) newErrors.dataMovimento = "Selecione uma data!";
    if (!formData.descricao.trim()) newErrors.descricao = "A descrição é obrigatória!";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validarFormulario()) {
      handleSave(formData);
    }
  };

  // 🔹 Atualiza o campo de pesquisa de Plano de Contas e exibe sugestões
  const handleSearchPlano = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchPlano(e.target.value);
    setShowSuggestions(true);
  };

  // 🔹 Seleciona um plano da lista de sugestões
  const selectPlano = (plano: PlanoConta) => {
    setSearchPlano(`${plano.hierarquia} | ${plano.descricao}`);
    setFormData((prev) => ({ ...prev, idPlanoContas: plano.id.toString() }));
    setShowSuggestions(false);
  };

  // 🔹 Fecha a lista de sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (planoRef.current && !planoRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  

  return (
    <Modal
    isOpen={isOpen}
    onRequestClose={() => {}} 
    shouldCloseOnOverlayClick={false} 
    className="bg-white rounded-lg shadow-lg w-full max-w-[700px] mx-auto"
    overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    {/* 🔹 Cabeçalho */}
    <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
      <h2 className="text-xl font-semibold text-gray-800">Lançamento Manual</h2>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
        <FontAwesomeIcon icon={faTimes} size="xl" />
      </button>
    </div>

    {/* 🔹 Tipo de Movimento */}
    <div className="flex mb-3">
      <button
        className={`flex-1 text-center text-lg py-2 font-semibold border-b ${
          tipoMovimento === "credito"
            ? "text-white bg-green-700 border-green-700"
            : "text-gray-800 bg-white border-gray-300"
        }`}
        onClick={() => setTipoMovimento("credito")}
      >
        Crédito <span className="text-xs">(Depósito)</span>
      </button>
      <button
        className={`flex-1 text-center text-lg py-2 font-semibold border-b ${
          tipoMovimento === "debito"
            ? "text-white bg-red-800 border-red-800"
            : "text-gray-800 bg-white border-gray-300"
        }`}
        onClick={() => setTipoMovimento("debito")}
      >
        Débito <span className="text-xs">(Saque)</span>
      </button>
    </div>

    {/* 🔹 Formulário */}
    <div className="p-4 grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Conta Corrente */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Conta Corrente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full p-2 bg-gray-200 border border-gray-300 rounded cursor-not-allowed"
            value="SICOOB | 107964 | Ronaldo"
            disabled
          />
        </div>

        {/* Plano de Contas */}
        <div ref={planoRef} className="relative">
          <label className="block text-sm font-medium text-gray-700">Plano de Contas <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type="text"
              className={`w-full p-2 border ${errors.idPlanoContas ? "border-red-500" : "border-gray-300"} rounded`}
              placeholder="Pesquisar plano de contas..."
              value={searchPlano}
              onChange={handleSearchPlano}
            />
            <FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
          </div>
          {showSuggestions && (
            <ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10">
              {planosFiltrados
                .filter((plano) => plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()))
                .slice(0, 10)
                .map((plano) => (
                  <li key={plano.id} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => selectPlano(plano)}>
                    {plano.hierarquia} | {plano.descricao}
                  </li>
                ))}
            </ul>
          )}
          {errors.idPlanoContas && <p className="text-red-500 text-xs">{errors.idPlanoContas}</p>}
        </div>
      </div>

      {/* Valor e Data */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Valor {tipoMovimento === "credito" ? "do Crédito" : "do Débito"} R$ <span className="text-red-500">*</span>
          </label>
          <CurrencyInput
            name="valor"
            className="w-full p-2 bg-white border border-gray-300 rounded"
            placeholder="R$ 0,00"
            decimalsLimit={2}
            prefix="R$ "
            value={formData.valor}
            onValueChange={(value) => handleInputChange({ target: { name: "valor", value } } as any)}
            disabled={isSaving}
          />
          {errors.valor && <p className="text-red-500 text-xs">{errors.valor}</p>}
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">
              Data <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="dataMovimento"
              className={`w-full p-2 bg-white border ${errors.dataMovimento ? "border-red-500" : "border-gray-300"} rounded`}
              value={formData.dataMovimento}
              onChange={handleInputChange}
              disabled={isSaving}
            />
            {errors.dataMovimento && <p className="text-red-500 text-xs">{errors.dataMovimento}</p>}
          </div>
      </div>

      {/* Observação */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Descrição do Movimento <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="descricao"
          className="w-full p-2 bg-white border border-gray-300 rounded"
          placeholder="Digite uma descrição"
          value={formData.descricao}
          onChange={handleInputChange}
          disabled={isSaving}
        />
      </div>
    </div>

    {/* 🔹 Botão de Confirmar */}
    <div className="p-3 flex justify-end border-t mt-3">
      <button
        className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600 transition"
        onClick={handleSubmit}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full"></div>
            Salvando...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faSave} />
            Confirmar
          </>
        )}
      </button>
    </div>
  </Modal>
  );
};

export default LancamentoManual;
