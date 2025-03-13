import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCheck, faSearch } from "@fortawesome/free-solid-svg-icons";
import { MovimentoBancario } from "../../../../../backend/src/models/MovimentoBancario";
import CurrencyInput from "react-currency-input-field";
import { PlanoConta } from "../../../../../backend/src/models/PlanoConta";
import { listarPlanoContas } from "../../../services/planoContasService";
import { listarBancos } from "../../../services/bancoService";
import { listarPessoas } from "../../../services/pessoaService";
import { listarParametros } from "../../../services/parametroService";
import { log } from "console";


Modal.setAppElement("#root"); // Evita erro de acessibilidade no modal

const cache = {
  parametros: null,
  planos: null,
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
  const [formData, setFormData] = useState({
    idPlanoContas: "",
    valor: "0,00",
    dataMovimento: new Date().toISOString().slice(0, 16),
    descricao: "",
    numeroDocumento: "",
    bancoSelecionado: null,
    pessoaSelecionada: null,
  });
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<{ parcela: number; vencimento: string; valor: string }[]>([]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [searchPlano, setSearchPlano] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const planoRef = useRef<HTMLDivElement>(null);

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


	const gerarParcelas = () => {
    if (!parcelado || parseFloat(formData.valor.replace(",", ".")) <= 0) {
      setParcelas([]);
      return;
    }

    const valorParcela = (parseFloat(formData.valor.replace(",", ".")) / numParcelas).toFixed(2);
    const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
      parcela: i + 1,
      vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
      valor: valorParcela,
    }));

    setParcelas(novasParcelas);
  };

	const handleParcelaChange = (index: number, field: string, value: string) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = { ...novasParcelas[index], [field]: value };
    setParcelas(novasParcelas);
  };


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
		if(modalidadeMovimento == "padrao"){
			setFormData((prev) => ({ ...prev, idPlanoContas: "", descricao: "" }));
			setSearchPlano("");
		}

  }, [modalidadeMovimento]);


  // 🔹 Validação dos campos antes de salvar
  const validarFormulario = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.idPlanoContas) newErrors.idPlanoContas = "Selecione um plano de contas!";
    if (!formData.valor || formData.valor === "0,00") newErrors.valor = "Informe um valor!";
    if (!formData.dataMovimento) newErrors.dataMovimento = "Selecione uma data!";
    if (!formData.descricao.trim()) newErrors.descricao = "A descrição é obrigatória!";

    if (modalidadeMovimento === "financiamento") {
      if (!formData.numeroDocumento.trim()) newErrors.numeroDocumento = "Informe o número do documento!";
      if (!formData.bancoSelecionado && !formData.pessoaSelecionada) {
        newErrors.bancoPessoa = "Escolha um banco ou uma pessoa!";
      }
      if (formData.bancoSelecionado && formData.pessoaSelecionada) {
        newErrors.bancoPessoa = "Escolha apenas um: Banco ou Pessoa!";
      }
    }
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
		console.log("planosFiltrados" + planosFiltrados);
		console.log("planos" + planos);

  };

  // 🔹 Seleciona um plano da lista de sugestões
  const selectPlano = (plano: PlanoConta) => {
    setSearchPlano(`${plano.hierarquia} | ${plano.descricao}`);
    setFormData((prev) => ({ ...prev, idPlanoContas: plano.id.toString() }));
    setShowSuggestions(false);
  };

  const handleNumParcelasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value >= 1) {
      setNumParcelas(value);
    }
  };

  useEffect(() => {
    if (parcelado && parseFloat(formData.valor.replace(",", ".")) > 0) {
      const valorParcela = (parseFloat(formData.valor.replace(",", ".")) / numParcelas).toFixed(2);
      const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
        parcela: i + 1,
        vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
        valor: valorParcela,
      }));
      setParcelas(novasParcelas);
    }
  }, [parcelado, numParcelas, formData.valor]);

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

	const alterarModalidadeMovimento = (modalidadeMovimento: string | ((prevState: "padrao" | "financiamento") => "padrao" | "financiamento")) => {
		setModalidadeMovimento(modalidadeMovimento);
		if(modalidadeMovimento == "padrao"){
			setParcelado(false);
		}
	}


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
        onClick={() => setTipoMovimento("credito") }
      >
        Crédito <span className="text-xs">(Depósito)</span>
      </button>
      <button
        className={`flex-1 text-center text-lg py-2 font-semibold border-b ${
          tipoMovimento === "debito"
            ? "text-white bg-red-800 border-red-800"
            : "text-gray-800 bg-white border-gray-300 hover:bg-red-100"
        }`}
        onClick={() => setTipoMovimento("debito")}
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
          <>
            {/* Número do Documento */}
            <div className="pt-1 grid grid-cols-2 gap-4 ">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número do Documento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="numeroDocumento"
                  className={`w-full p-2 border ${
                    errors.numeroDocumento ? "border-red-500" : "border-gray-300"
                  } rounded`}
                  placeholder="Informe o número do documento"
                  value={formData.numeroDocumento}
                  onChange={handleInputChange}
                />
                {errors.numeroDocumento && <p className="text-red-500 text-xs">{errors.numeroDocumento}</p>}
              </div>
              {/* Switch Parcelado */}
              <div className="flex items-start flex-col gap-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Este movimento é parcelado?
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={parcelado} onChange={() => setParcelado(!parcelado)} />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
            </div>
            <div className="pt-1 grid grid-cols-2 gap-4 pb-5 border-b">

              {/* Banco */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco <span className="text-gray-500">(opcional)</span>
                </label>
                <select
                  name="bancoSelecionado"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.bancoSelecionado}
                  onChange={handleInputChange}
                  disabled={!!formData.pessoaSelecionada}
                >
                  <option value="">Selecione um banco</option>
                  {bancos.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {banco.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pessoa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pessoa <span className="text-gray-500">(opcional)</span>
                </label>
                <select
                  name="pessoaSelecionada"
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.pessoaSelecionada}
                  onChange={handleInputChange}
                  disabled={!!formData.bancoSelecionado}
                >
                  <option value="">Selecione uma pessoa</option>
                  {pessoas.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validação de Banco/Pessoa */}
              {errors.bancoPessoa && <p className="text-red-500 text-xs col-span-2">{errors.bancoPessoa}</p>}
            </div>
          </>
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
              value="SICOOB | 107964 | Ronaldo"
              disabled
            />
          </div>

          {/* Plano de Contas */}
          <div ref={planoRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano de Contas <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type="text"
                className={`w-full p-2 border ${errors.idPlanoContas ? "border-red-500" : "border-gray-300"} rounded`}
                placeholder="Pesquisar plano de contas..."
                value={searchPlano}
                onChange={handleSearchPlano}
                disabled={modalidadeMovimento === "financiamento"}
              />
              <FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
            </div>
            {showSuggestions && modalidadeMovimento === "padrao" && (
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          {errors.descricao && <p className="text-red-500 text-xs">{errors.descricao}</p>}

        </div>
      </div>

      {/* 🔹 Parcelamento */}
      {parcelado && modalidadeMovimento == "financiamento" && (
        <div className={`p-4 border-l mt-3 min-w-[400px] ${parcelado ? "w-1/3" : "w-full"}`}>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Parcelamento</h3>
          <label>Número de Parcelas</label>
          <input
            type="number"
            min="1"
            value={numParcelas}
            onChange={handleNumParcelasChange}
            className="w-full p-2 border border-gray-300 rounded mb-3"
          />
					{parcelado && parseFloat(formData.valor.replace(",", ".")) <= 0 && (
            <p className="text-red-500 text-sm mt-1 text-center">Informe o valor do movimento para gerar a parcela!</p>
          )}
          {/* Lista de Parcelas */}
					{parcelado && parcelas.length > 0 && (
						<div className=" overflow-y-auto border border-gray-200 rounded-md">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-gray-200">
										<th className="p-2">Parcela</th>
										<th className="p-2">Vencimento</th>
										<th className="p-2">Valor R$</th>
									</tr>
								</thead>
								<tbody>
									{parcelas.map((parcela, index) => (
										<tr key={parcela.parcela} className="border-b">
											<td className="p-2">{parcela.parcela}/{numParcelas}</td>
											<td className="p-2">
												<input
													type="date"
													value={parcela.vencimento}
													onChange={(e) => handleParcelaChange(index, "vencimento", e.target.value)}
													className="w-full p-1 border border-gray-300 rounded m-w-[125px]"
												/>
											</td>
											<td className="p-2">
												<CurrencyInput
													className="w-full p-1 border border-gray-300 rounded"
													value={parcela.valor}
													decimalsLimit={2}
													prefix="R$ "
													onValueChange={(value) => handleParcelaChange(index, "valor", value || "0.00")}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
        </div>
      )}
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
