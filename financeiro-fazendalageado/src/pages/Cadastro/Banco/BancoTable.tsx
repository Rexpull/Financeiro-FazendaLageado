import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import DialogModal from "../../../components/DialogModal"

interface Banco {
  id: number;
  nome: string;
  codigo: string;
}

Modal.setAppElement("#root"); // 🔹 Corrige o erro de acessibilidade do modal

const BancoTable: React.FC = () => {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [bancoData, setBancoData] = useState<Banco>({ id: 0, nome: "", codigo: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteBancoId, setDeleteBancoId] = useState<number | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

  // 🔹 Busca todos os bancos ao carregar a página ou após salvar/excluir
  const fetchBancos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bancos`);
      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
      const data = (await res.json()) as Banco[];
      setBancos(data);
    } catch (error) {
      console.error("Erro ao buscar bancos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBancos();
  }, []);

  // 🔹 Abrir modal para criar ou editar banco
  const openModal = (banco?: Banco) => {
    setBancoData(banco || { id: 0, nome: "", codigo: "" });
    setModalIsOpen(true);
  };

  // 🔹 Atualizar os inputs do modal
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBancoData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 🔹 Criar ou editar banco
  const handleSave = async () => {
    if (!bancoData.nome || !bancoData.codigo) return;

    setIsSaving(true); // 🔹 Inicia loading no botão

    const isEditing = bancoData.id !== 0;
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `${API_URL}/api/bancos/${bancoData.id}` : `${API_URL}/api/bancos`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bancoData),
      });

      if (!res.ok) throw new Error("Erro ao salvar banco");

      closeModal();
      await fetchBancos(); // 🔹 Atualiza lista após salvar
    } catch (error) {
      console.error("Erro ao salvar banco:", error);
    } finally {
      setIsSaving(false); // 🔹 Finaliza loading no botão
    }
  };

   // 🔹 Excluir banco com modal de confirmação
   const handleDeleteConfirm = async () => {
    if (deleteBancoId === null) return;

    try {
      const res = await fetch(`${API_URL}/api/bancos/${deleteBancoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir banco");

      setConfirmModalOpen(false);
      await fetchBancos();
    } catch (error) {
      console.error("Erro ao excluir banco:", error);
    }
  };

  // 🔹 Abrir modal de confirmação antes de excluir
  const handleDelete = (id: number) => {
    setDeleteBancoId(id);
    setConfirmModalOpen(true);
  };


  // 🔹 Fechar modal
  const closeModal = () => {
    setModalIsOpen(false);
    setBancoData({ id: 0, nome: "", codigo: "" });
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Lista de Bancos</h1>
        <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700" onClick={() => openModal()}>
          Adicionar Banco
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loader"></div>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">ID</th>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2">Código</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {bancos.map((banco) => (
              <tr key={banco.id} className="border-b">
                <td className="p-2 text-center">{banco.id}</td>
                <td className="p-2 text-left">{banco.nome}</td>
                <td className="p-2 text-center">{banco.codigo}</td>
                <td className="p-2 text-right">
                  <button className="bg-blue-500 text-white px-3 py-1 rounded mr-2" onClick={() => openModal(banco)}>
                    Editar
                  </button>
                  <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={() => handleDelete(banco.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal para Criar/Editar Banco */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="bg-white p-5 rounded shadow-lg max-w-md mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50"
      >
        <h2 className="text-xl font-bold mb-4">{bancoData.id ? "Editar Banco" : "Adicionar Banco"}</h2>

        <input
          type="text"
          name="nome"
          className="w-full p-2 border rounded mb-3"
          placeholder="Nome do Banco"
          value={bancoData.nome}
          onChange={handleInputChange}
          disabled={isSaving} // 🔹 Desativa enquanto salva
        />
        <input
          type="text"
          name="codigo"
          className="w-full p-2 border rounded mb-3"
          placeholder="Código do Banco"
          value={bancoData.codigo}
          onChange={handleInputChange}
          disabled={isSaving} // 🔹 Desativa enquanto salva
        />

        <div className="flex justify-end gap-2">
          <button className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-700" onClick={closeModal} disabled={isSaving}>
            Cancelar
          </button>
          <button className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="animate-spin h-4 w-4 border-t-2 border-white border-solid rounded-full mr-2"></div> 
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </Modal>

      <DialogModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Atenção"
        type="warn"
        message="Tem certeza que deseja excluir este banco?"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
};

export default BancoTable;
