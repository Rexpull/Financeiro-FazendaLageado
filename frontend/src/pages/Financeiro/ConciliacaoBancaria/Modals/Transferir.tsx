import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faTimes } from "@fortawesome/free-solid-svg-icons";
import CurrencyInput from "react-currency-input-field";
import { listarContas } from "../../../../services/contaCorrenteService";
import { hojeISO } from "../../../../Utils/dataSemFuso";
import { diaDoValor } from "../../../../Utils/dataMovimento";
import { PROPS_MOEDA_BRL, valorMonetarioPositivo } from "../../../../Utils/valorMonetario";

Modal.setAppElement("#root");

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Must throw on failure: the modal stays open (the service already shows the error toast). */
  onTransferir: (data: any) => Promise<void> | void;
}

// Local calendar day (toISOString() is UTC: after 21h in UTC-3 it already said "tomorrow")
const formularioInicial = () => ({
  idContaDestino: "",
  valor: "0,00",
  data: hojeISO(),
  descricao: "",
});

const TransferenciaBancariaModal: React.FC<Props> = ({ isOpen, onClose, onTransferir }) => {
  const [contaOrigem, setContaOrigem] = useState<any>(null);
  const [contas, setContas] = useState<any[]>([]);
  const [formData, setFormData] = useState(formularioInicial);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  // Blocks a second click while the first transfer is being saved (a double click created two transfers)
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const fetchContas = async () => {
      const lista = await listarContas();
      setContas(lista);
    };

    if (isOpen) {
      const stored = localStorage.getItem("contaSelecionada");
      setContaOrigem(stored ? JSON.parse(stored) : null);
      // Fresh form on every opening: today's date and no value left over from the previous transfer
      setFormData(formularioInicial());
      setErrors({});
      setSalvando(false);
      fetchContas();
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validarFormulario = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.idContaDestino) newErrors.idContaDestino = "Selecione a conta de destino.";
    if (valorMonetarioPositivo(formData.valor) === null) newErrors.valor = "Informe um valor maior que zero.";
    if (!diaDoValor(formData.data)) newErrors.data = "Informe a data.";
    if (!formData.descricao.trim()) newErrors.descricao = "Informe o histórico.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (salvando || !validarFormulario()) return;
    setSalvando(true);
    try {
      await onTransferir({
        contaOrigem,
        contas,
        ...formData,
        // "1.234,56" / "1234,56" / "1234.56" all mean R$ 1.234,56 (never R$ 123.456,00)
        valor: valorMonetarioPositivo(formData.valor),
      });
    } catch {
      // Error already shown (toast); the form stays filled so the user can try again
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={salvando ? undefined : onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[650px] p-5 my-auto"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center overflow-y-auto p-2 z-50"
    >
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <h2 className="text-xl font-semibold">Transferência entre contas</h2>
        <button onClick={onClose} disabled={salvando} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
          <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Conta Origem */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conta Corrente Origem</label>
          <input
            type="text"
            value={contaOrigem ? `${contaOrigem.bancoNome} | ${contaOrigem.numConta} | ${contaOrigem.responsavel}` : ""}
            disabled
            className="w-full p-2 bg-gray-100 border border-gray-300 rounded cursor-not-allowed"
          />
        </div>

        {/* Conta Destino */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conta Corrente Destino <span className="text-red-500">*</span>
          </label>
          <select
            name="idContaDestino"
            value={formData.idContaDestino}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${errors.idContaDestino ? "border-red-500" : "border-gray-300"}`}
          >
            <option value="">Selecione a Conta Corrente</option>
            {contas
              .filter((c) => c.id !== contaOrigem?.id)
              .map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.bancoNome} | {conta.numConta} | {conta.responsavel}
                </option>
              ))}
          </select>
          {errors.idContaDestino && <p className="text-red-500 text-xs mt-1">{errors.idContaDestino}</p>}
        </div>
      </div>

      {/* Valor e Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor R$ <span className="text-red-500">*</span></label>
          <CurrencyInput
            name="valor"
            className={`w-full p-2 border rounded ${errors.valor ? "border-red-500" : "border-gray-300"}`}
            placeholder="R$ 0,00"
            {...PROPS_MOEDA_BRL}
            prefix="R$ "
            value={formData.valor}
            onValueChange={(value) => handleInputChange({ target: { name: "valor", value: value ?? "" } } as any)}
          />
          {errors.valor && <p className="text-red-500 text-xs">{errors.valor}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data <span className="text-red-500">*</span></label>
          {/* Calendar day only: stored as 'YYYY-MM-DDT00:00:00.000Z' like OFX rows */}
          <input
            type="date"
            name="data"
            value={formData.data}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${errors.data ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.data && <p className="text-red-500 text-xs">{errors.data}</p>}
        </div>
      </div>

      {/* Descrição */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Histórico <span className="text-red-500">*</span></label>
        <input
          type="text"
          name="descricao"
          value={formData.descricao}
          onChange={handleInputChange}
          className={`w-full p-2 border rounded ${errors.descricao ? "border-red-500" : "border-gray-300"}`}
          placeholder="Ex.: Reforço de caixa"
        />
        <p className="text-xs text-gray-500 mt-1">Aparece no histórico do lançamento nas duas contas.</p>
        {errors.descricao && <p className="text-red-500 text-xs">{errors.descricao}</p>}
      </div>

      {/* Botão de Ação */}
      <div className="flex justify-end border-t pt-4">
        <button
          className="bg-green-600 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-green-700"
          onClick={handleSubmit}
          disabled={salvando}
        >
          {salvando ? (
            <>
              <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full"></div>
              Transferindo…
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faSave} />
              Transferir
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

export default TransferenciaBancariaModal;
