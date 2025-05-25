import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCheck, faSearch, faPlus } from "@fortawesome/free-solid-svg-icons";
import { MovimentoBancario } from "../../../../../../backend/src/models/MovimentoBancario";
import CurrencyInput from "react-currency-input-field";
import { PlanoConta } from "../../../../../../backend/src/models/PlanoConta";
import { listarPlanoContas } from "../../../../services/planoContasService";
import { listarBancos } from "../../../../services/bancoService";
import { listarPessoas } from "../../../../services/pessoaService";
import { listarParametros } from "../../../../services/parametroService";
import { listarFinanciamentos } from "../../../../services/financiamentoService";
import { Financiamento } from "../../../../../../backend/src/models/Financiamento";
import { toast } from "react-toastify";

Modal.setAppElement("#root"); 

const cache = {
  parametros: null,
  bancos: null,
  pessoas: null
};

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
  const [modalidadeMovimento, setModalidadeMovimento] = useState<"padrao" | "financiamento" >("padrao");
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  const [bancos, setBancos] = useState<{id: number; nome: string}[]>([]);
  const [pessoas, setPessoas] = useState<{id: number; nome: string}[]>([]);
  const [parametros, setParametros] = useState<{ idPlanoEntradaFinanciamentos: number; idPlanoPagamentoFinanciamentos: number }>({
    idPlanoEntradaFinanciamentos: 0,
    idPlanoPagamentoFinanciamentos: 0,
  });

  const conta = JSON.parse(localStorage.getItem("contaSelecionada") || "{}");
  const [formData, setFormData] = useState<{
    idPlanoContas: string;
    valor: string;
    saldo: number;
    dtMovimento: string;
    numeroDocumento: string;
    descricao: string;
    transfOrigem: null;
    transfDestino: null;
    pessoaSelecionada: null;
    bancoSelecionado: null;
    idContaCorrente: number;
    historico: string;
    ideagro: boolean;
    idBanco: number | null;
    idPessoa: number | null;
    parcelado: boolean;
    idFinanciamento: number | null;
  }>({
    idPlanoContas: "",
    valor: "0,00",
    saldo: 0,
    dtMovimento: new Date().toISOString().slice(0, 16),
    numeroDocumento: "",
    descricao: "",
    transfOrigem: null,
    transfDestino: null,
    pessoaSelecionada: null,
    bancoSelecionado: null,
    idContaCorrente: conta?.id || 0,
    historico: "",
    ideagro: false,
    idBanco: null,
    idPessoa: null,
    parcelado: false,
    idFinanciamento: null,
  });
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<{ numParcela: number; dt_vencimento: string; valor: string }[]>([]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [searchPlano, setSearchPlano] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const planoRef = useRef<HTMLDivElement>(null);

  const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
  const [buscaFinanciamento, setBuscaFinanciamento] = useState('');
  const [financiamentoSelecionado, setFinanciamentoSelecionado] = useState<Financiamento | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!cache.parametros) cache.parametros = await listarParametros().then((data) => data[0] || { idPlanoEntradaFinanciamentos: 0, idPlanoPagamentoFinanciamentos: 0 });
        if (!cache.planos) cache.planos = await listarPlanoContas();
        if (!cache.bancos) cache.bancos = await listarBancos();
        if (!cache.pessoas) cache.pessoas = await listarPessoas();

        setParametros(cache.parametros);
        setPlanos(cache.planos);
        setBancos(cache.bancos);
        setPessoas(cache.pessoas);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };

    fetchData();
  }, []);

	useEffect(() => {
    gerarParcelas();
  }, [parcelado, numParcelas, formData.valor]);

  useEffect(() => {
    if (isOpen && modalidadeMovimento === "financiamento") {

      const idPlano =
        tipoMovimento === "credito"
          ? parametros.idPlanoEntradaFinanciamentos
          : parametros.idPlanoPagamentoFinanciamentos;

      setFormData((prev) => ({ ...prev, idPlanoContas: idPlano.toString() }));

      const planoSelecionado = planos.find((plano) => plano.id === idPlano);
      setSearchPlano(planoSelecionado ? `${planoSelecionado.descricao}` : "");
    }
  }, [isOpen, modalidadeMovimento, tipoMovimento, parametros, planos]);

  useEffect(() => {
    if (isOpen) {
      carregarFinanciamentos();
    }
  }, [isOpen]);

	const gerarParcelas = () => {
    if (!parcelado || parseFloat(formData.valor.replace(",", ".")) <= 0) {
      setParcelas([]);
      return;
    }

    const valorParcela = (parseFloat(formData.valor.replace(",", ".")) / numParcelas).toFixed(2);
    const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
      numParcela: i + 1,
      dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
      valor: valorParcela,
    }));

    setParcelas(novasParcelas);
  };

	const planosFiltrados = planos
  .filter((plano) => plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()) &&
    (tipoMovimento === 'debito' ? plano.hierarquia.startsWith('002') : plano.hierarquia.startsWith('001')) 
    && plano.nivel === 3)
  .slice(0, 10);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
  
    if (name === "bancoSelecionado") {
      setFormData((prev) => ({
        ...prev,
        bancoSelecionado: value || null,
        pessoaSelecionada: null,
        idBanco: value ? parseInt(value) : null,
        idPessoa: null,
      }));
    } else if (name === "pessoaSelecionada") {
      setFormData((prev) => ({
        ...prev,
        pessoaSelecionada: value || null,
        bancoSelecionado: null,
        idPessoa: value ? parseInt(value) : null,
        idBanco: null,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };
  
  useEffect(() => {
		if(modalidadeMovimento == "padrao"){
			setFormData((prev) => ({ ...prev, idPlanoContas: "", descricao: "" }));
			setSearchPlano("");
		}

  }, [modalidadeMovimento]);

  const validarFormulario = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.idPlanoContas) newErrors.idPlanoContas = "Selecione um plano de contas!";
    if (!formData.valor || formData.valor === "0,00") newErrors.valor = "Informe um valor!";
    if (!formData.dtMovimento) newErrors.dtMovimento = "Selecione uma data!";
    if (!formData.historico.trim()) newErrors.historico = "A descrição é obrigatória!";

    if (modalidadeMovimento === "financiamento") {
      if (!formData.idFinanciamento) newErrors.idFinanciamento = "Selecione um financiamento!";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validarFormulario()) {
      const dataToSend = {
        ...formData,
        tipoMovimento: tipoMovimento === "credito" ? "C" : "D",
        modalidadeMovimento,
        idBanco: formData.idBanco ? parseInt(formData.idBanco) : null,
        idPessoa: formData.idPessoa ? parseInt(formData.idPessoa) : null,
        parcelado,
        parcelas,
        idFinanciamento: formData.idFinanciamento
      };
      handleSave(dataToSend);
    }
  };
  

  const handleSearchPlano = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchPlano(e.target.value);
    setShowSuggestions(true);
  };

  const selectPlano = (plano: { id: number; descricao: string }) => {
    setSearchPlano(plano.descricao);
    setFormData((prev) => ({ ...prev, idPlanoContas: plano.id.toString() }));
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (parcelado && parseFloat(formData.valor.replace(",", ".")) > 0) {
      const valorParcela = (parseFloat(formData.valor.replace(",", ".")) / numParcelas).toFixed(2);
      const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
        numParcela: i + 1,
        dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
        valor: valorParcela,
      }));
      setParcelas(novasParcelas);
    }
  }, [parcelado, numParcelas, formData.valor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (planoRef.current && !planoRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

	const alterarModalidadeMovimento = (modalidadeMovimento: string) => {
    if (modalidadeMovimento === "padrao" || modalidadeMovimento === "financiamento") {
      setModalidadeMovimento(modalidadeMovimento);
    }
		if(modalidadeMovimento == "padrao"){
			setParcelado(false);
		}
    setFinanciamentoSelecionado(null);
    setBuscaFinanciamento('');
	}

  const handleChangeTipoMovimento = (tipoMovimento: string) => {
    setTipoMovimento(tipoMovimento as "credito" | "debito");
    setFormData((prev) => ({ ...prev, idPlanoContas: "", descricao: "" }));
    setSearchPlano("");
  }

  const carregarFinanciamentos = async () => {
    try {
      const financiamentosList = await listarFinanciamentos();
      setFinanciamentos(financiamentosList);
    } catch (error) {
      console.error('Erro ao carregar financiamentos:', error);
    }
  };

  const financiamentosFiltrados = financiamentos.filter(f => 
    f.responsavel.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
    f.numeroContrato.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
    (bancos.find(b => b.id === f.idBanco)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
    (pessoas.find(p => p.id === f.idPessoa)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase())
  );

  return (
    <Modal
    isOpen={isOpen}
    onRequestClose={() => {}}
    shouldCloseOnOverlayClick={false}
    className={`bg-white rounded-lg shadow-lg w-full max-w-[${parcelado? "1000px" : "700px"}]`}
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
            : "text-gray-800 bg-white border-gray-300 hover:bg-green-100 "
        }`}
        onClick={() => handleChangeTipoMovimento("credito") }
      >
        Crédito <span className="text-xs">(Depósito)</span>
      </button>
      <button
        className={`flex-1 text-center text-lg py-2 font-semibold border-b ${
          tipoMovimento === "debito"
            ? "text-white bg-red-800 border-red-800"
            : "text-gray-800 bg-white border-gray-300 hover:bg-red-100"
        }`}
        onClick={() => handleChangeTipoMovimento("debito")}
      >
        Débito <span className="text-xs">(Saque)</span>
      </button>
    </div>


    {/* 🔹 Formulário */}
    <div className="flex align-center justify-center  ">
      <div className={`p-4 grid grid-cols-1 gap-4 ${parcelado ? "w-2/3" : "w-full"}`}>
        <div className="flex mb-3 w-full items-center justify-center ">
          <div className="flex w-2/3 justify-center rounded-lg border overflow-hidden">
            <button
              className={`flex-1 text-center text-lg py-1 font-semibold  ${
                modalidadeMovimento === "padrao"
                  ? "text-white bg-orange-600 border-orange-600"
                  : "text-gray-800 bg-white border-gray-300 hover:bg-orange-100 "
              }`}
              onClick={() => alterarModalidadeMovimento("padrao")}
            >
              Padrão
            </button>
            <button
              className={`flex-1 text-center text-lg py-1 font-semibold border-x ${
                modalidadeMovimento === "financiamento"
                  ? "text-white bg-orange-600 border-orange-600"
                  : "text-gray-800 bg-white border-gray-300 hover:bg-orange-100"
              }`}
              onClick={() => alterarModalidadeMovimento("financiamento")}
            >
              Financiamento
            </button>
          </div>
        </div>

        {modalidadeMovimento === "financiamento" && (
          <div className="grid grid-cols-2 gap-4 border-b border-gray-300 pb-4" style={{position: 'relative'}}>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Associar Financiamento <span className="text-red-500">*</span>
              </label>
              <div className="flex w-full">
                <input
                  type="text"
                  className="w-full p-2 border rounded-l"
                  placeholder="Buscar por responsável, credor ou contrato"
                  value={financiamentoSelecionado ? `${financiamentoSelecionado.numeroContrato} - ${financiamentoSelecionado.responsavel} (${bancos.find(b=>b.id===financiamentoSelecionado.idBanco)?.nome || pessoas.find(p=>p.id===financiamentoSelecionado.idPessoa)?.nome})` : buscaFinanciamento}
                  onChange={e => setBuscaFinanciamento(e.target.value)}
                  disabled={!!financiamentoSelecionado}
                />
                <button
                  type="button"
                  style={{height: 'auto'}}
                  className={`text-white text-lg px-4 ${financiamentoSelecionado ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'} rounded-r `} 
                  onClick={() => {
                    if (financiamentoSelecionado) {
                      setFinanciamentoSelecionado(null);
                      setBuscaFinanciamento('');
                      setFormData(prev => ({ ...prev, idFinanciamento: null }));
                    }
                  }}
                  title={financiamentoSelecionado ? "Desvincular Financiamento" : "Novo Financiamento"}
                >
                  <FontAwesomeIcon icon={financiamentoSelecionado ? faTimes : faPlus} />
                </button>
              </div>
              {errors.idFinanciamento && <p className="text-red-500 text-xs">{errors.idFinanciamento}</p>}
              {buscaFinanciamento && !financiamentoSelecionado && (
                <ul className="absolute z-10 border rounded mt-1 bg-white max-h-40 overflow-y-auto w-full shadow-lg">
                  {financiamentosFiltrados.map(f => (
                    <li
                      key={f.id}
                      className={`p-2 cursor-pointer hover:bg-orange-100 ${financiamentoSelecionado?.id === f.id ? 'bg-orange-200' : ''}`}
                      onClick={() => {
                        setFinanciamentoSelecionado(f);
                        setFormData(prev => ({ ...prev, idFinanciamento: f.id }));
                      }}
                    >
                      <strong>{f.numeroContrato}</strong> - {f.responsavel} - {bancos.find(b=>b.id===f.idBanco)?.nome || pessoas.find(p=>p.id===f.idPessoa)?.nome}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Conta Corrente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conta Corrente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full p-2 bg-gray-200 border border-gray-300 rounded cursor-not-allowed"
              value={`${conta?.bancoNome} | ${conta?.numConta} | ${conta?.responsavel}`}
              disabled
            />
          </div>

          {/* Plano de Contas */}
          <div ref={planoRef} className="relative ">
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano de Contas <span className="text-red-500">*</span></label>
						<div className="relative">
							<input
								type="text"
								className="w-full p-2 border rounded"
								placeholder="Pesquisar plano de contas..."
								value={searchPlano}
								onChange={handleSearchPlano}
								disabled={modalidadeMovimento === "financiamento"}
							/>
							<FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400"/>
						</div>
            {showSuggestions && modalidadeMovimento === "padrao" && (
              <ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10">
                {planosFiltrados
								.filter((plano) => plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()))
								.slice(0,5)
								.map((plano) => (
									<li key={plano.id} className="p-2 hover:bg-gray-200 text-sm cursor-pointer" onClick={() => selectPlano(plano)}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name="dtMovimento"
                className={`w-full p-2 bg-white border ${errors.dtMovimento ? "border-red-500" : "border-gray-300"} rounded`}
                value={formData.dtMovimento}
                onChange={handleInputChange}
                disabled={isSaving}
              />
              {errors.dtMovimento && <p className="text-red-500 text-xs">{errors.dtMovimento}</p>}
            </div>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição do Movimento <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="historico"
            className="w-full p-2 bg-white border border-gray-300 rounded"
            placeholder="Digite uma descrição"
            value={formData.historico}
            onChange={handleInputChange}
            disabled={isSaving}
          />
          {errors.historico && <p className="text-red-500 text-xs">{errors.historico}</p>}

        </div>

        
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
