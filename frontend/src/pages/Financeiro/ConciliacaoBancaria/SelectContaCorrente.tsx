import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { listarContas } from "../../../services/contaCorrenteService";

// Importando os ícones dos bancos
import bancoBrasil from "../../../assets/img/icon-Bancos/banco-brasil.svg";
import santander from "../../../assets/img/icon-Bancos/santander.svg";
import caixa from "../../../assets/img/icon-Bancos/caixa.svg";
import bradesco from "../../../assets/img/icon-Bancos/bradesco.svg";
import itau from "../../../assets/img/icon-Bancos/itau.svg";
import inter from "../../../assets/img/icon-Bancos/inter.svg";
import sicredi from "../../../assets/img/icon-Bancos/sicredi.svg";
import sicoob from "../../../assets/img/icon-Bancos/sicoob.svg";
import safra from "../../../assets/img/icon-Bancos/safra.svg";
import nubank from "../../../assets/img/icon-Bancos/nubank.svg";
import original from "../../../assets/img/icon-Bancos/original.svg";
import bancoBrasilia from "../../../assets/img/icon-Bancos/banco-brasilia.svg";
import banrisul from "../../../assets/img/icon-Bancos/banrisul.svg";
import citiBank from "../../../assets/img/icon-Bancos/citi-bank.svg";
import hsbc from "../../../assets/img/icon-Bancos/hsbc.svg";
import banestes from "../../../assets/img/icon-Bancos/banestes.svg";
import bancoAmazonia from "../../../assets/img/icon-Bancos/banco-amazonia.svg";
import bancoNordeste from "../../../assets/img/icon-Bancos/banco-nordeste.svg";
import bankBoston from "../../../assets/img/icon-Bancos/bank-boston.svg";
import defaultIcon from "../../../assets/img/icon-Bancos/default.png";

Modal.setAppElement("#root");


const BancoLogos: { [key: string]: string } = {
    "001": bancoBrasil,
    "033": santander,
    "104": caixa,
    "237": bradesco,
    "341": itau,
    "077": inter,
    "748": sicredi,
    "756": sicoob,
    "422": safra,
    "260": nubank,
    "212": original,
    "070": bancoBrasilia,
    "389": banrisul,
    "745": citiBank,
    "399": hsbc,
    "021": banestes,
    "085": bancoAmazonia,
    "003": bancoNordeste,
    "318": bankBoston,
  };



interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (conta: any) => void;
}

const SelecionarContaModal: React.FC<ModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [contas, setContas] = useState([]);
  const [filteredContas, setFilteredContas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchContas = async () => {
      const data = await listarContas();
      setContas(data);
      setFilteredContas(data);
    };
    if (isOpen) fetchContas();
  }, [isOpen]);

  useEffect(() => {
    const filtered = contas.filter(
      (conta) =>
        conta.bancoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.numConta.includes(searchTerm) ||
		conta.responsavel.includes(searchTerm)
    );
    setFilteredContas(filtered);
  }, [searchTerm, contas]);

  const handleSelectConta = (conta: any) => {
    onSelect(conta);
    onClose();
  };

  const getBancoLogo = (codigo: string): string => {
    return BancoLogos[codigo] || defaultIcon;
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {}}
      shouldCloseOnOverlayClick={false}
      className="bg-white rounded-lg shadow-lg w-full max-w-[600px] mx-auto p-5 z-50 "
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 "
    >
      {/* 🔹 Cabeçalho */}
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-lg font-bold">Selecione a Conta Corrente</h2>

      </div>

      {/* 🔹 Campo de Busca */}
      <input
        type="text"
        placeholder="Buscar conta..."
        className="w-full p-2 mt-3 border border-gray-300 rounded"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* 🔹 Lista de Contas */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        {filteredContas.map((conta) => (
          <div
            key={conta.id}
            className="flex flex-col items-center bg-gray-100 rounded-lg p-3 border cursor-pointer hover:bg-gray-200 transition"
            onClick={() => handleSelectConta(conta)}
          >
            <img src={getBancoLogo(conta.bancoCodigo)} alt="Banco" className="w-10 h-10 mb-2" />
            <p className="text-sm font-bold">{conta.bancoNome}</p>
            <p className="text-xs text-gray-600">{conta.numConta} - {conta.responsavel}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SelecionarContaModal;
