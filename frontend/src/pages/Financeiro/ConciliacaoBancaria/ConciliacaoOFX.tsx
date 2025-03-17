import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import SelectContaCorrente from "./SelectContaCorrente";

Modal.setAppElement("#root");

const ConciliacaoOFXModal = ({ isOpen, onClose, movimentos, totalizadores }) => {
  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        className="bg-white rounded-lg shadow-lg w-full mx-auto h-full"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-t-lg border-b">
          <h2 className="text-xl font-semibold text-gray-800">Conciliação de Movimentos OFX</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FontAwesomeIcon icon={faTimes} size="xl" />
          </button>
        </div>

        {/* Totalizadores */}
        <div className="p-4 grid grid-cols-4 gap-4 text-center text-lg font-bold">
          <div className="text-green-600">Receitas: R$ {totalizadores.receitas.toFixed(2)}</div>
          <div className="text-red-600">Despesas: R$ {totalizadores.despesas.toFixed(2)}</div>
          <div className="text-gray-900">Líquido: R$ {totalizadores.liquido.toFixed(2)}</div>
          <div className="text-blue-600">Saldo Final: R$ {totalizadores.saldoFinal.toFixed(2)}</div>
        </div>

        {/* Tabela de Movimentos */}
        <div className="p-4 overflow-auto max-h-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Histórico</th>
                <th className="p-2 text-center">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
                    Nenhum movimento encontrado!
                  </td>
                </tr>
              ) : (
                movimentos.map((mov, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 text-left">{mov.dtMovimento}</td>
                    <td className="p-2 text-left">{mov.historico}</td>
                    <td className={`p-2 text-center ${mov.valor >= 0 ? "text-green-600" : "text-red-600"}`}>R$ {mov.valor.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé */}
        <div className="p-4 flex justify-end border-t">
          <button
            className="bg-red-500 text-white font-semibold px-5 py-2 rounded hover:bg-red-600"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
};

export default ConciliacaoOFXModal;
