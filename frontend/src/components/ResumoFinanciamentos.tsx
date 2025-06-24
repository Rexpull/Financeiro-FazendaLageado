import React from 'react';
import { Financiamento } from '../../../../backend/src/models/Financiamento';
import { formatarMoeda } from '../Utils/formataMoeda';

type Props = {
  financiamentos: Financiamento[];
  getBancoNome: (idBanco: number | null) => string;
  getPessoaNome: (idPessoa: number | null) => string;
};

const agruparPorCredor = (financiamentos: Financiamento[], getBancoNome: any, getPessoaNome: any) => {
  const grupos: Record<string, { quantidade: number; valorTotal: number; valorPendente: number }> = {};
  financiamentos.forEach(f => {
    const credor = f.idBanco ? getBancoNome(f.idBanco) : getPessoaNome(f.idPessoa);
    if (!grupos[credor]) {
      grupos[credor] = { quantidade: 0, valorTotal: 0, valorPendente: 0 };
    }
    grupos[credor].quantidade += 1;
    grupos[credor].valorTotal += f.valor;
    grupos[credor].valorPendente += f.parcelasList
      .filter(p => p.status !== 'Liquidado')
      .reduce((soma, p) => soma + p.valor, 0);
  });
  return grupos;
};

const ResumoFinanciamentos: React.FC<Props> = ({ financiamentos, getBancoNome, getPessoaNome }) => {
  const grupos = agruparPorCredor(financiamentos, getBancoNome, getPessoaNome);
  const totalQuantidade = financiamentos.length;
  const totalValor = financiamentos.reduce((soma, f) => soma + f.valor, 0);
  const totalPendente = financiamentos.reduce((soma, f) =>
    soma + f.parcelasList.filter(p => p.status !== 'Liquidado').reduce((s, p) => s + p.valor, 0), 0);

  return (
    <div className="bg-white rounded-lg p-4 shadow w-full max-w-1/3">
      <h2 className="font-bold text-lg mb-2">Resumo dos Financiamentos</h2>
      <div className="flex justify-between mb-2">
        <div>
          <div className="text-xs text-gray-500">Quantidade</div>
          <div className="font-bold text-lg">{totalQuantidade}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Valor Total</div>
          <div className="font-bold text-lg">{formatarMoeda(totalValor)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Valor Pendente</div>
          <div className="font-bold text-lg text-orange-500">{formatarMoeda(totalPendente)}</div>
        </div>
      </div>
      <div className="mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Credor</th>
              <th className="p-2 text-right">Quantidade</th>
              <th className="p-2 text-right">Valor Total</th>
              <th className="p-2 text-right">Valor Pendente</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grupos).map(([credor, dados]) => (
              <tr key={credor}>
                <td className="p-2">{credor}</td>
                <td className="p-2 text-right">{dados.quantidade}</td>
                <td className="p-2 text-right">{formatarMoeda(dados.valorTotal)}</td>
                <td className="p-2 text-right text-orange-500">{formatarMoeda(dados.valorPendente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResumoFinanciamentos; 