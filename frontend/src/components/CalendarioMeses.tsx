import React from 'react';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

type Props = {
  ano: number;
  mesSelecionado: number;
  setAno: (ano: number) => void;
  setMesSelecionado: (mes: number) => void;
};

const CalendarioMeses: React.FC<Props> = ({ ano, mesSelecionado, setAno, setMesSelecionado }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow flex flex-col items-center w-full max-w-lg mx-auto">
      <div className="flex items-center justify-between w-full mb-2">
        <button onClick={() => setAno(ano - 1)} className="text-2xl px-2">{'<'}</button>
        <span className="font-bold text-lg">{meses[mesSelecionado]} / {ano}</span>
        <button onClick={() => setAno(ano + 1)} className="text-2xl px-2">{'>'}</button>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full">
        {meses.map((mes, idx) => (
          <button
            key={mes}
            className={`p-2 rounded transition font-semibold ${mesSelecionado === idx ? 'bg-orange-400 text-white' : 'bg-gray-100 hover:bg-orange-100'}`}
            onClick={() => setMesSelecionado(idx)}
          >
            {mes}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarioMeses; 