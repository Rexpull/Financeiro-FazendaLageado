import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSave, faCheck, faInfoCircle, faUsers, faMoneyBillTransfer } from "@fortawesome/free-solid-svg-icons";
import { MovimentoBancario } from "../../../../../../backend/src/models/MovimentoBancario";
import { listarPlanoContas } from "../../../../services/planoContasService";
import { listarBancos } from "../../../../services/bancoService";
import { listarPessoas } from "../../../../services/pessoaService";
import { PlanoConta } from "../../../../../../backend/src/models/PlanoConta";


Modal.setAppElement("#root");

interface ConciliaPlanoContasModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimento: MovimentoBancario;
  planos: { id: number; descricao: string }[];
  handleConcilia: (data: any) => void;
}

const ConciliaPlanoContasModal: React.FC<ConciliaPlanoContasModalProps> = ({
  isOpen,
  onClose,
  movimento,
  planos,
  handleConcilia
}) => {
  const [modalidade, setModalidade] = useState("padrao");
  const [idPlanoContas, setIdPlanoContas] = useState<number | null>(null);
  const [idPessoa, setIdPessoa] = useState<number | null>(null);
  const [idBanco, setIdBanco] = useState<number | null>(null);
  const [numDocumento, setNumDocumento] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [planosFetch, setPlanosFetch] = useState<PlanoConta[]>([]);
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<{ id: number; nome: string }[]>([]);
  const [numParcelas, setNumParcelas] = useState(1);


  useEffect(() => {
    if (isOpen) {
      setModalidade("padrao");
      setIdPlanoContas(null);
      setIdPessoa(null);
      setIdBanco(null);
      setNumDocumento("");
      setParcelado(false);
      setParcelas([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const planosResult = await listarPlanoContas();
        const bancosResult = await listarBancos();
        const pessoasResult = await listarPessoas();

        setPlanosFetch(planosResult.filter(p => p.nivel === 3)); // apenas nível 3 igual ao manual
        setBancos(bancosResult);
        setPessoas(pessoasResult);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Filtro Plano Contas
  const [searchPlano, setSearchPlano] = useState("");
  const filteredPlanos = planosFetch.filter(p =>
    p.descricao.toLowerCase().includes(searchPlano.toLowerCase())
  ).slice(0, 10);

  // Filtro Pessoa
  const [searchPessoa, setSearchPessoa] = useState("");
  const filteredPessoas = pessoas.filter(p =>
    p.nome.toLowerCase().includes(searchPessoa.toLowerCase())
  ).slice(0, 10);

  // Filtro Banco
  const [searchBanco, setSearchBanco] = useState("");
  const filteredBancos = bancos.filter(b =>
    b.nome.toLowerCase().includes(searchBanco.toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    gerarParcelas();
  }, [parcelado, numParcelas, movimento.valor]);

  const gerarParcelas = () => {
    if (!parcelado || movimento.valor <= 0) {
      setParcelas([]);
      return;
    }
    const valorParcela = (movimento.valor / numParcelas).toFixed(2);
    const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
      numParcela: i + 1,
      dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
      valor: valorParcela,
    }));
    setParcelas(novasParcelas);
  };



  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };


  const handleSalvar = () => {
    handleConcilia({
      modalidade,
      idPlanoContas,
      idPessoa,
      idBanco,
      numDocumento,
      parcelado,
      parcelas
    });
    onClose();
  };

  const renderCampos = () => {
    if (modalidade === "padrao") {
      return (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label>Plano de Contas *</label>
              <input
                type="text"
                placeholder="Buscar Plano de Contas..."
                value={searchPlano}
                onChange={(e) => setSearchPlano(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <ul className="bg-white border rounded mt-1 max-h-40 overflow-y-auto">
                {filteredPlanos.map((plano) => (
                  <li
                    key={plano.id}
                    onClick={() => {
                      setIdPlanoContas(plano.id);
                      setSearchPlano(plano.descricao);
                    }}
                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  >
                    {plano.hierarquia} | {plano.descricao}
                  </li>
                ))}
              </ul>

            </div>
            <div>
              <label>Pessoa (opcional)</label>
              <input
                type="text"
                placeholder="ID Pessoa"
                value={idPessoa || ""}
                onChange={(e) => setIdPessoa(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>
        </>
      );
    }

    if (modalidade === "financiamento") {
      return (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label>Plano de Contas</label>
              <input
                type="text"
                value="Financiamentos"
                readOnly
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label>Nº Documento (opcional)</label>
              <input
                type="text"
                value={numDocumento}
                onChange={(e) => setNumDocumento(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label>Banco (opcional)</label>
              <input
                type="text"
                placeholder="ID Banco"
                value={idBanco || ""}
                onChange={(e) => setIdBanco(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label>Pessoa (opcional)</label>
              <input
                type="text"
                placeholder="ID Pessoa"
                value={idPessoa || ""}
                onChange={(e) => setIdPessoa(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={parcelado}
                onChange={() => setParcelado(!parcelado)}
              />
              <label>Movimento Parcelado</label>
            </div>

            {parcelado && (
              <div className="mt-2 pt-2 border-t">
                <label>Número de Parcelas</label>
                <input
                  type="number"
                  min="1"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
                {parcelas.length > 0 && (
                  <table className="w-full text-left border-collapse mt-2">
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="p-2">Parcela</th>
                        <th className="p-2">Vencimento</th>
                        <th className="p-2">Valor R$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((parcela, index) => (
                        <tr key={index}>
                          <td className="p-2">{parcela.numParcela}/{numParcelas}</td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={parcela.dt_vencimento}
                              onChange={(e) => {
                                const novasParcelas = [...parcelas];
                                novasParcelas[index].dt_vencimento = e.target.value;
                                setParcelas(novasParcelas);
                              }}
                              className="w-full p-1 border rounded"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={parcela.valor}
                              onChange={(e) => {
                                const novasParcelas = [...parcelas];
                                novasParcelas[index].valor = e.target.value;
                                setParcelas(novasParcelas);
                              }}
                              className="w-full p-1 border rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        </>
      );
    }

    if (modalidade === "transferencia") {
      return (
        <div className="flex flex-col items-center text-center text-yellow-600 mt-4">
          <FontAwesomeIcon icon={faMoneyBillTransfer} size="3x" />
          <p className="mt-2 font-medium">
            Mera transferência entre contas próprias da Fazenda <br />
            na qual será ignorada no Fluxo de Caixa!
          </p>
        </div>
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold text-gray-800">Associação de Plano de Contas</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>

      <div className="p-4">
        {movimento && movimento.valor && (
          <div className="flex items-center justify-between border-gray-200 border text-gray-800 p-3 rounded-lg mb-4 shadow-sm text-sm">
            <span className="flex items-center gap-2 overflow-hidden">
              <span >{formatarData(movimento.dtMovimento)}</span>
              <span>|</span>
              <span className="truncate max-w-[350px]"
                title={movimento.historico}>
                {movimento.historico}
              </span>
            </span>
            <strong className="text-green-600">{formatarMoeda(movimento.valor)}</strong>
          </div>
        )}

        <div className="flex items-center justify-center mb-6 flex w-full justify-center rounded-lg border overflow-hidden">
          {["padrao", "financiamento", "transferencia"].map((tipo) => (
            <button
              key={tipo}
              onClick={() => setModalidade(tipo)}
              className={`px-4 flex-1 text-center text-lg py-1 font-semibold ${modalidade === tipo ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700"
                }`}
            >
              {tipo === "padrao" && "Padrão"}
              {tipo === "financiamento" && "Financiamento"}
              {tipo === "transferencia" && "Transferência"}
            </button>
          ))}
        </div>

        {renderCampos()}

        <div className="flex justify-end mt-8 border-t pt-4">
          <button
            className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600"
            onClick={handleSalvar}
          >
            <FontAwesomeIcon icon={faSave} />
            Associar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConciliaPlanoContasModal;
