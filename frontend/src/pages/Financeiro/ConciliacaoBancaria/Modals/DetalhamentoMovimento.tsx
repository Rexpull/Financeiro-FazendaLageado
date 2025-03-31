import React, { useEffect, useState } from "react";
import DialogModal from "../../../../components/DialogModal";
import { MovimentoBancario } from "../../../../../../backend/src/models/MovimentoBancario";
import { ParcelaFinanciamento } from "../../../../../../backend/src/models/ParcelaFinanciamento";
import { listarParcelaFinanciamentos } from "../../../../services/financiamentoParcelasService";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

interface DetalhamentoMovimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimento: MovimentoBancario | null;
}

const DetalhamentoMovimentoModal: React.FC<DetalhamentoMovimentoModalProps> = ({
  isOpen,
  onClose,
  movimento,
}) => {
  const [parcelas, setParcelas] = useState<ParcelaFinanciamento[]>([]);

  useEffect(() => {
    const fetchParcelas = async () => {
      if (movimento && movimento.id && movimento.modalidadeMovimento === "financiamento") {
        try {
          const data = await listarParcelaFinanciamentos(movimento.id);
          setParcelas(data);
        } catch (error) {
          console.error("Erro ao buscar parcelas:", error);
        }
      } else {
        setParcelas([]);
      }
    };

    fetchParcelas();
  }, [movimento]);

  if (!movimento) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="bg-white rounded-lg shadow-lg w-[600px] h-[95vh] flex flex-col z-50 mr-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-end items-center z-50"
    >
    <div className="flex justify-between items-center bg-gray-200 px-4 py-3 rounded-t-lg border-b">
        <h2 className="text-xl font-semibold">Informações do Movimento: {movimento.id}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FontAwesomeIcon icon={faTimes} size="xl" />
        </button>
    </div>
    <div className="p-5 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-gray-800 text-md">
          <div>
            <span className="font-semibold">Data do Movimento:</span>
            <p>{new Date(movimento.dtMovimento).toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <span className="font-semibold">Histórico:</span>
            <p>{movimento.historico}</p>
          </div>
          <div>
            <span className="font-semibold">Plano de Contas:</span>
            <p>{movimento.idPlanoContas}</p>
          </div>
          <div>
            <span className="font-semibold">Valor:</span>
            <p>R$ {movimento.valor.toFixed(2)}</p>
          </div>
          <div>
            <span className="font-semibold">Saldo:</span>
            <p>R$ {movimento.saldo.toFixed(2)}</p>
          </div>
          <div>
            <span className="font-semibold">IdeAgro:</span>
            <p>{movimento.ideagro ? "Sim" : "Não"}</p>
          </div>
          <div>
            <span className="font-semibold">Descrição:</span>
            <p>{movimento.descricao || "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Nº Documento:</span>
            <p>{movimento.numeroDocumento || "-"}</p>
          </div>
          <div>
            <span className="font-semibold">Identificador OFX:</span>
            <p className="break-all">{movimento.identificadorOfx}</p>
          </div>
          <div>
            <span className="font-semibold">Modalidade:</span>
            <p>{movimento.modalidadeMovimento}</p>
          </div>
          <div>
            <span className={`font-semibold`}>Tipo do Movimento:</span>
            <p className={`font-semibold ${movimento.tipoMovimento === "C" ? 'text-green-600' : 'text-red-600'}`}>{movimento.tipoMovimento === "C" ? "Crédito" : "Débito"}</p>
          </div>
        </div>

        
          <div className="mt-6 pt-5 border-t">
            <h4 className="font-semibold mb-3 text-gray-900">Parcelas do Financiamento</h4>
            <table className="w-full text-sm border rounded-md overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Parcela</th>
                  <th className="p-2 border">Vencimento</th>
                  <th className="p-2 border">Valor R$</th>
                </tr>
              </thead>
              {parcelas.length > 0 ? (
                <tbody>
                    {parcelas.map((parcela) => (
                    <tr key={parcela.id} className="hover:bg-gray-50">
                        <td className="p-2 border text-center">{parcela.numParcela}</td>
                        <td className="p-2 border text-center">
                        {new Date(parcela.dt_vencimento).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-2 border text-center">R$ {parcela.valor.toFixed(2)}</td>
                    </tr>
                    ))}
                </tbody>
              ) : (
                <tbody>
                  <tr>
                    <td colSpan={3} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                      Nenhum movimento encontrado!
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        
      </div>
    </Modal>
  );
};

export default DetalhamentoMovimentoModal;
