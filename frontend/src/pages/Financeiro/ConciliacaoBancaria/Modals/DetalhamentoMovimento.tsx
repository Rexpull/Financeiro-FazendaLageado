import React, { useEffect, useState } from "react";
import { MovimentoBancario } from "../../../../../../backend/src/models/MovimentoBancario";
import { ParcelaFinanciamento } from "../../../../../../backend/src/models/ParcelaFinanciamento";
import { CentroCustos } from "../../../../../../backend/src/models/CentroCustos";
import { listarParcelaFinanciamentos } from "../../../../services/financiamentoParcelasService";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { formatarDataISO } from "../../../../Utils/dataSemFuso";

interface DetalhamentoMovimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimento: MovimentoBancario | null;
  planos?: Array<{ id: number; descricao: string }>;
  centros?: CentroCustos[];
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const MODALIDADES: Record<string, string> = {
  padrao: "Receita/Despesa",
  financiamento: "Financiamento",
  transferencia: "Movimentação sem efeito (transferência)",
};

/** Manual entries and transfers get a random UUID as identificador; OFX rows get fitid|data|valor. */
function origemMovimento(identificador: string | undefined): string {
  const id = String(identificador ?? "");
  if (/\|(saida|entrada)$/.test(id)) return "Transferência entre contas";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return "Lançamento manual";
  return id ? "Extrato bancário (OFX)" : "-";
}

const Campo: React.FC<{ rotulo: string; children: React.ReactNode; inteiro?: boolean }> = ({ rotulo, children, inteiro }) => (
  <div className={inteiro ? "col-span-2" : undefined}>
    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{rotulo}</span>
    <div className="mt-0.5 text-gray-900">{children}</div>
  </div>
);

type LinhaClassificacao = { nome: string; valor: number | null };

const Lista: React.FC<{ linhas: LinhaClassificacao[]; vazio: string }> = ({ linhas, vazio }) =>
  linhas.every((l) => !l.nome) ? (
    <span className="text-gray-500">{vazio}</span>
  ) : (
    <ul className="space-y-0.5">
      {linhas.map((l, i) => (
        <li key={i} className="flex justify-between gap-3">
          <span>{l.nome}</span>
          {l.valor != null && <span className="tabular-nums text-gray-600">{brl(l.valor)}</span>}
        </li>
      ))}
    </ul>
  );

const DetalhamentoMovimentoModal: React.FC<DetalhamentoMovimentoModalProps> = ({
  isOpen,
  onClose,
  movimento,
  planos = [],
  centros = [],
}) => {
  const [parcelas, setParcelas] = useState<ParcelaFinanciamento[]>([]);

  useEffect(() => {
    let cancelado = false;
    const fetchParcelas = async () => {
      setParcelas([]);
      if (movimento && movimento.id && movimento.modalidadeMovimento === "financiamento") {
        try {
          // Only this movement's contract (or, without a contract, the parcelas it paid) — never all of them.
          const data = await listarParcelaFinanciamentos(
            movimento.idFinanciamento
              ? { idFinanciamento: movimento.idFinanciamento }
              : { idMovimentoBancario: movimento.id },
          );
          if (!cancelado) setParcelas(data);
        } catch (error) {
          console.error("Erro ao buscar parcelas:", error);
        }
      }
    };

    fetchParcelas();
    return () => {
      cancelado = true;
    };
  }, [movimento]);

  if (!movimento) return null;

  const credito = movimento.tipoMovimento === "C" || (movimento.tipoMovimento == null && movimento.valor > 0);
  const nomePlano = (id?: number | null) => planos.find((p) => p.id === id)?.descricao ?? (id ? `Plano ${id}` : "");
  const nomeCentro = (id?: number | null) => {
    const c = centros.find((x) => x.id === id);
    if (!c) return id ? `Centro ${id}` : "";
    return c.tipoReceitaDespesa === "DESPESA" && c.tipo ? `${c.descricao} · ${c.tipo === "INVESTIMENTO" ? "Investimento" : "Custeio"}` : c.descricao;
  };

  // Rateio (several lines, with values) or the single plan / centre of the movement
  const linhasPlano: LinhaClassificacao[] =
    (movimento.resultadoList?.length ?? 0) > 1
      ? movimento.resultadoList!.map((r) => ({ nome: nomePlano(r.idPlanoContas), valor: Math.abs(Number(r.valor)) }))
      : [{ nome: nomePlano(movimento.idPlanoContas ?? movimento.resultadoList?.[0]?.idPlanoContas), valor: null }];
  const linhasCentro: LinhaClassificacao[] =
    (movimento.centroCustosList?.length ?? 0) > 1
      ? movimento.centroCustosList!.map((c) => ({ nome: nomeCentro(c.idCentroCustos), valor: Math.abs(Number(c.valor)) }))
      : [{ nome: nomeCentro(movimento.idCentroCustos ?? movimento.centroCustosList?.[0]?.idCentroCustos), valor: null }];

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="bg-white rounded-lg shadow-lg w-full max-w-[600px] h-[95vh] flex flex-col z-50 mx-2 sm:mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
      <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold">Informações do movimento</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
          <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
      </div>
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
          <Campo rotulo="Data">{formatarDataISO(movimento.dtMovimento)}</Campo>
          <Campo rotulo="Valor">
            <span className={`font-semibold tabular-nums ${credito ? "text-green-700" : "text-red-600"}`}>
              {credito ? "" : "-"}
              {brl(Math.abs(movimento.valor))} ({credito ? "crédito" : "débito"})
            </span>
          </Campo>
          <Campo rotulo="Histórico" inteiro>
            {movimento.historico}
          </Campo>
          <Campo rotulo="Plano de contas" inteiro>
            <Lista linhas={linhasPlano} vazio={credito ? "Receitas não usam plano de contas" : "Sem plano (pendente)"} />
          </Campo>
          <Campo rotulo="Centro de custos" inteiro>
            <Lista linhas={linhasCentro} vazio="Sem centro de custos (pendente)" />
          </Campo>
          <Campo rotulo="Modalidade">{MODALIDADES[movimento.modalidadeMovimento ?? "padrao"] ?? movimento.modalidadeMovimento}</Campo>
          <Campo rotulo="Origem">{origemMovimento(movimento.identificadorOfx)}</Campo>
          <Campo rotulo="Nº documento">{movimento.numeroDocumento || "-"}</Campo>
          <Campo rotulo="Descrição">{movimento.descricao || "-"}</Campo>
          <Campo rotulo="Código interno">
            <span className="text-gray-500">#{movimento.id}</span>
          </Campo>
        </div>

        {movimento.modalidadeMovimento === "financiamento" && (
          <div className="mt-6 pt-5 border-t">
            <h4 className="font-semibold mb-3 text-gray-900">Parcelas do financiamento</h4>
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Parcela</th>
                  <th className="p-2 border">Vencimento</th>
                  <th className="p-2 border">Situação</th>
                  <th className="p-2 border">Valor</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.length > 0 ? (
                  parcelas.map((parcela) => (
                    <tr key={parcela.id} className="hover:bg-gray-50">
                      <td className="p-2 border text-center">{parcela.numParcela}</td>
                      <td className="p-2 border text-center">{formatarDataISO(parcela.dt_vencimento)}</td>
                      <td className="p-2 border text-center">{parcela.status}</td>
                      <td className="p-2 border text-right tabular-nums">{brl(parcela.valor)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-5 text-gray-600 border-b">
                      Nenhuma parcela vinculada a este movimento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DetalhamentoMovimentoModal;
