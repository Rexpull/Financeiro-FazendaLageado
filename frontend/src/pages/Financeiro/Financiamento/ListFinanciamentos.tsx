// frontend/src/pages/financeiro/financiamentos/ListFinanciamentos.tsx

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch, faChevronDown, faMoneyCheckAlt } from '@fortawesome/free-solid-svg-icons';
import defaultIcon from '../../../assets/img/icon-Bancos/default.png';
import noData from "/frontend/src/assets/img/noData.svg";
import ModalFinanciamento from "./ModalFinanciamento";

const ListFinanciamentos: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalFinanciamento, setModalFinanciamento] = useState(false);
  const financiamentos = [
    {
      id: 1,
      responsavel: 'João Silva',
      banco: 'Banco do Brasil',
      codigoBanco: '001',
      valor: 120000,
      numeroContrato: 'FIN123456',
      dataContrato: '2024-02-01',
      totalJuros: 9500,
      taxaAnual: '12%',
      taxaMensal: '0.95%',
      parcelas: 24
    },
    // ... outros financiamentos
  ];

  const handleSave = () => {
    console.log("salvando")
  }

  const filtered = financiamentos.filter((f) =>
    f.responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.numeroContrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.banco.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-end gap-5 mb-4 border-b pb-4">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full"
            placeholder="Pesquisar por responsável, banco ou contrato"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className="bg-primary text-white font-bold h-11 px-4 flex items-center rounded hover:bg-orange-400"
          onClick={ () => setModalFinanciamento(true)}
        >
          Novo Financiamento <FontAwesomeIcon icon={faPlus} className="ml-3" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="col-span-full flex flex-col items-center gap-2">
          <img src={noData} alt="Sem dados" className="w-64 h-64 object-contain" />
          <p className="text-gray-700 font-bold text-lg">Nenhum financiamento encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((fin) => (
            <div key={fin.id} className="bg-white border rounded-lg p-4 shadow-md hover:bg-gray-100 transition">
              <div className="flex items-center gap-3">
                <img src={defaultIcon} alt={fin.banco} className="w-12 h-12 object-contain" />
                <div>
                  <p className="font-bold text-lg">{fin.responsavel}</p>
                  <p className="text-sm text-gray-600">{fin.banco}</p>
                  <p className="text-xs text-gray-500">Contrato: {fin.numeroContrato}</p>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-700">
                <p><strong>Valor:</strong> R$ {fin.valor.toLocaleString()}</p>
                <p><strong>Juros Total:</strong> R$ {fin.totalJuros.toLocaleString()}</p>
                <p><strong>Taxa Anual:</strong> {fin.taxaAnual}</p>
                <p><strong>Parcelas:</strong> {fin.parcelas}x</p>
              </div>
              <button className="mt-4 w-full text-orange-600 hover:underline text-sm font-semibold">
                Ver parcelas
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalFinanciamento isOpen={modalFinanciamento} onClose={() => setModalFinanciamento(false)} onSave={handleSave}/>
    </div>
  );
};

export default ListFinanciamentos;
