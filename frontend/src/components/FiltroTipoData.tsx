import React from 'react';

type Props = {
  tipoData: 'competencia' | 'vencimento';
  setTipoData: (tipo: 'competencia' | 'vencimento') => void;
};

const FiltroTipoData: React.FC<Props> = ({ tipoData, setTipoData }) => {
  return (
    <div className="flex bg-white rounded-lg overflow-hidden w-full max-w-lg">
      <button
        className={`flex-1 py-2 font-bold text-lg transition ${tipoData === 'competencia' ? 'bg-sky-400 text-white' : 'bg-gray-100 text-gray-700'}`}
        onClick={() => setTipoData('competencia')}
      >
        Competência
      </button>
      <button
        className={`flex-1 py-2 font-bold text-lg transition ${tipoData === 'vencimento' ? 'bg-sky-400 text-white' : 'bg-gray-100 text-gray-700'}`}
        onClick={() => setTipoData('vencimento')}
      >
        Vencimento
      </button>
    </div>
  );
};

export default FiltroTipoData; 