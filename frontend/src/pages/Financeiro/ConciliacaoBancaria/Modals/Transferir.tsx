import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave, faTimes } from "@fortawesome/free-solid-svg-icons";
import CurrencyInput from "react-currency-input-field";
import { listarContas } from "../../../../services/contaCorrenteService";

Modal.setAppElement("#root");

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTransferir: (data: any) => void;
}

const TransferenciaBancariaModal: React.FC<Props> = ({ isOpen, onClose, onTransferir }) => {
  const [contaOrigem, setContaOrigem] = useState<any>(null);
  const [contas, setContas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    idContaDestino: "",
    valor: "0,00",
    data: new Date().toISOString().slice(0, 16),
    descricao: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchContas = async () => {
      const lista = await listarContas();
      setContas(lista);
    };

    if (isOpen) {
      const stored = localStorage.getItem("contaSelecionada");
      setContaOrigem(stored ? JSON.parse(stored) : null);
      fetchContas();
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validarFormulario = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.idContaDestino) newErrors.idContaDestino = "Selecione a conta destino!";
    if (!formData.valor || formData.valor === "0,00") newErrors.valor = "Informe um valor!";
    if (!formData.data) newErrors.data = "Informe a data!";
    if (!formData.descricao.trim()) newErrors.descricao = "A descrição é obrigatória!";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validarFormulario()) {
      onTransferir({
        contaOrigem,
        contas,
        ...formData,
        valor: parseFloat(formData.valor.replace(".", "").replace(",", ".")),
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[650px] p-5"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <h2 className="text-xl font-semibold">Transferência para Banco</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
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
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor R$ <span className="text-red-500">*</span></label>
          <CurrencyInput
            name="valor"
            className={`w-full p-2 border rounded ${errors.valor ? "border-red-500" : "border-gray-300"}`}
            placeholder="R$ 0,00"
            decimalsLimit={2}
            prefix="R$ "
            value={formData.valor}
            onValueChange={(value) => handleInputChange({ target: { name: "valor", value } } as any)}
          />
          {errors.valor && <p className="text-red-500 text-xs">{errors.valor}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data <span className="text-red-500">*</span></label>
          <input
            type="datetime-local"
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Observação <span className="text-red-500">*</span></label>
        <input
          type="text"
          name="descricao"
          value={formData.descricao}
          onChange={handleInputChange}
          className={`w-full p-2 border rounded ${errors.descricao ? "border-red-500" : "border-gray-300"}`}
          placeholder="Descrição da transferência"
        />
        {errors.descricao && <p className="text-red-500 text-xs">{errors.descricao}</p>}
      </div>

      {/* Botão de Ação */}
      <div className="flex justify-end border-t pt-4">
        <button
          className="bg-red-500 text-white font-semibold px-5 py-2 rounded flex items-center gap-2 hover:bg-red-600"
          onClick={handleSubmit}
        >
          <FontAwesomeIcon icon={faSave} />
          Transferir
        </button>
      </div>
    </Modal>
  );
};

export default TransferenciaBancariaModal;
