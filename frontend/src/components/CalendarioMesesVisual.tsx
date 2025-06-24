import React from 'react';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

type DadoMes = {
  valorTotal: number;
  valorPendente: number;
};

type Props = {
  ano: number;
  setAno: (ano: number) => void;
  mesSelecionado: number;
  setMesSelecionado: (mes: number) => void;
  dadosMes: DadoMes[]; // Array de 12 posições, uma para cada mês
};

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CalendarioMesesVisual: React.FC<Props> = ({ ano, setAno, mesSelecionado, setMesSelecionado, dadosMes }) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow flex flex-col items-center w-full max-w-2/3 border border-gray-100">
      <div className="flex items-center justify-center gap-6 mb-6 w-full">
        <button onClick={() => setAno(ano - 1)} className="text-2xl px-3 py-1 rounded hover:bg-gray-200">{'<'}</button>
        <span className="font-bold text-2xl tracking-wide">{ano}</span>
        <button onClick={() => setAno(ano + 1)} className="text-2xl px-3 py-1 rounded hover:bg-gray-200">{'>'}</button>
      </div>
      <div className="grid grid-cols-4 gap-6 w-full">
        {meses.map((mes, idx) => {
          const { valorTotal, valorPendente } = dadosMes[idx] || { valorTotal: 0, valorPendente: 0 };
          const selecionado = mesSelecionado === idx;
          return (
            <button
              key={mes}
              className={`rounded-xl border flex flex-col items-center justify-center p-4 h-32 transition relative shadow-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400 font-medium text-base
                ${selecionado ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300' : 'border-gray-200 bg-gray-50 hover:bg-orange-100'}`}
              onClick={() => setMesSelecionado(idx)}
              tabIndex={0}
            >
              <span className={`font-bold text-lg mb-1 ${selecionado ? 'text-orange-600' : 'text-gray-700'}`}>{mes}</span>
              <span className="text-xs text-gray-500">Total</span>
              <span className="font-semibold text-gray-800">{formatarMoeda(valorTotal)}</span>
              {valorPendente > 0 ? (
                <div className="mt-1 text-xs font-bold text-orange-500">Pendente {formatarMoeda(valorPendente)}</div>
              ) : (
                <div className="mt-1 text-xs font-bold text-green-600">Feito</div>
              )}
              {selecionado && <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-orange-400"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarioMesesVisual; 