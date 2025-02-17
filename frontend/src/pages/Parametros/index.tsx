import React, { useEffect, useState } from "react";
import { listarParametros, atualizarParametros } from "../../services/ParametroService";
import { listarPlanoContas } from "../../services/planoContasService";
import { Parametro } from "../../../../backend/src/models/Parametro";
import { PlanoConta } from "../../../../backend/src/models/PlanoConta";
import BreadCrumb from "../../components/BreadCrumb";

const ParametroPage = () => {
    const [parametros, setParametros] = useState<Parametro | null>(null);
    const [planos, setPlanos] = useState<PlanoConta[]>([]);
    const [search, setSearch] = useState({ transferencia: "", entrada: "", pagamento: "" });
    const [showSuggestions, setShowSuggestions] = useState({ transferencia: false, entrada: false, pagamento: false });

    useEffect(() => {
      // 🔹 Primeiro, carrega os planos de contas
      listarPlanoContas().then(setPlanos);

      // 🔹 Em seguida, carrega os parâmetros
      listarParametros().then((data) => {
          const parametrosData = data[0] || null;
          setParametros(parametrosData);
      });
    }, []);

    // 🔹 Atualiza os campos de busca quando os planos de contas forem carregados
    useEffect(() => {
        if (parametros && planos.length > 0) {
            setSearch({
                transferencia: getPlanoDescricao(parametros.idPlanoTransferenciaEntreContas),
                entrada: getPlanoDescricao(parametros.idPlanoEntradaFinanciamentos),
                pagamento: getPlanoDescricao(parametros.idPlanoPagamentoFinanciamentos),
            });
        }
    }, [planos, parametros]);

    // 🔹 Retorna a descrição do plano com base no ID
    const getPlanoDescricao = (id?: number) => {
        if (!id || planos.length === 0) return "";
        const plano = planos.find((p) => p.id === id);
        return plano ? `${plano.descricao}` : "";
    };
    
    // 🔹 Atualiza os parâmetros automaticamente no banco de dados
    const updateParametro = async (field: keyof Parametro, value: number) => {
        if (!parametros) return;
        const updatedParametros = { ...parametros, [field]: value };
        setParametros(updatedParametros);
        await atualizarParametros(updatedParametros);
    };

    // 🔹 Filtra planos de contas nível 3 conforme tipo e busca
    const filterPlanos = (tipo: string, searchTerm: string) =>{

        if(searchTerm && searchTerm === "R"){
          searchTerm = "001"; // Receita
        } else if (searchTerm && searchTerm === "D"){
          searchTerm = "002";  // Despesa
        } else if (searchTerm && searchTerm === "T"){
          searchTerm = "003";  // Transferência
        } else {
          searchTerm = "003"; // Transferência
        }

        return planos
            .filter((plano) => plano.nivel === 3 && plano.tipo === tipo)
            .filter((plano) => plano.hierarquia.toLowerCase().startsWith(searchTerm.toLowerCase()))
            .slice(0, 10);
    };

    return (
        <div>
            <BreadCrumb grupo="Cadastro" pagina="Parâmetros" />
            <div className="flex flex-col justify-between items-start gap-5 mb-4">
                {/* 🔹 Transferência entre Contas */}
                <div className="flex flex-col gap-5 w-full">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Plano de Contas Transferência entre Contas <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full max-w-md p-2 border border-gray-300 rounded"
                                placeholder="Pesquisar plano..."
                                value={search.transferencia}
                                onChange={(e) => {
                                    setSearch({ ...search, transferencia: e.target.value });
                                    setShowSuggestions({ ...showSuggestions, transferencia: true });
                                }}
                                onFocus={() => setShowSuggestions({ ...showSuggestions, transferencia: true })}
                            />
                            {showSuggestions.transferencia && (
                                <ul className="absolute bg-white  rounded w-full shadow-lg max-w-md mt-1 z-10">
                                    {filterPlanos("custeio", "T").map((plano) => (
                                        <li
                                            key={plano.id}
                                            className="p-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => {
                                                updateParametro("idPlanoTransferenciaEntreContas", plano.id);
                                                setSearch({ ...search, transferencia: `${plano.hierarquia} | ${plano.descricao}` });
                                                setShowSuggestions({ ...showSuggestions, transferencia: false });
                                            }}
                                        >
                                            {plano.hierarquia} | {plano.descricao}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <hr className="w-full max-w-md" />

                {/* 🔹 Entrada de Financiamentos */}
                <div className="flex flex-col gap-5 w-full">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Plano de Contas Entradas de Financiamentos <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full max-w-md p-2 border border-gray-300 rounded"
                                placeholder="Pesquisar plano..."
                                value={search.entrada}
                                onChange={(e) => {
                                    setSearch({ ...search, entrada: e.target.value });
                                    setShowSuggestions({ ...showSuggestions, entrada: true });
                                }}
                                onFocus={() => setShowSuggestions({ ...showSuggestions, entrada: true })}
                            />
                            {showSuggestions.entrada && (
                                <ul className="absolute bg-white rounded w-full shadow-lg max-w-md mt-1 z-10">
                                    {filterPlanos("custeio", "R").map((plano) => (
                                        <li
                                            key={plano.id}
                                            className="p-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => {
                                                updateParametro("idPlanoEntradaFinanciamentos", plano.id);
                                                setSearch({ ...search, entrada: `${plano.hierarquia} | ${plano.descricao}` });
                                                setShowSuggestions({ ...showSuggestions, entrada: false });
                                            }}
                                        >
                                            {plano.hierarquia} | {plano.descricao}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* 🔹 Pagamentos de Financiamentos */}
                <div className="flex flex-col gap-5 w-full">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Plano de Contas Pagamentos de Financiamentos <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full max-w-md p-2 border border-gray-300 rounded"
                                placeholder="Pesquisar plano..."
                                value={search.pagamento}
                                onChange={(e) => {
                                    setSearch({ ...search, pagamento: e.target.value });
                                    setShowSuggestions({ ...showSuggestions, pagamento: true });
                                }}
                                onFocus={() => setShowSuggestions({ ...showSuggestions, pagamento: true })}
                            />
                            {showSuggestions.pagamento && (
                                <ul className="absolute bg-white rounded w-full shadow-lg max-w-md mt-1 z-10">
                                    {filterPlanos("custeio", "D").map((plano) => (
                                        <li
                                            key={plano.id}
                                            className="p-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => {
                                                updateParametro("idPlanoPagamentoFinanciamentos", plano.id);
                                                setSearch({ ...search, pagamento: `${plano.hierarquia} | ${plano.descricao}` });
                                                setShowSuggestions({ ...showSuggestions, pagamento: false });
                                            }}
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
        </div>
    );
};

export default ParametroPage;
