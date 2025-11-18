import React, { useEffect, useState } from 'react';
import { buscarFluxoCaixa, buscarFluxoCaixaAnoAnterior } from '../../../services/fluxoCaixaService';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import { Chart } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faMinus, faPlus, faAngleDown, faAngleUp, faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import AccountantImg from '../../../assets/img/Accountant-amico.svg';
import CoinsImg from '../../../assets/img/Coins-pana.svg';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  anoSelecionado: string;
  dadosAtual: any[];
  dadosAnterior: any[];
  isLoading: boolean;
  tipoAgrupamento?: 'planos' | 'centros';
}

const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const FluxoCaixaGrafico: React.FC<Props> = ({ anoSelecionado, dadosAtual, dadosAnterior, isLoading, tipoAgrupamento = 'planos' }) => {
  const [tipoTop, setTipoTop] = useState<'receitas' | 'despesas'>('receitas');

  // Skeletons para loading e para mock
  if (isLoading || !dadosAtual.length) {
    return (
      <div className="w-full flex flex-col gap-4 animate-pulse">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 pt-2 shadow border flex flex-row items-center justify-between min-h-[140px]">
            <div className="flex flex-col gap-2 w-full">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
            <div className="w-28 h-28 bg-gray-100 rounded ml-4" />
          </div>
          <div className="bg-white rounded-lg p-4 pt-2 shadow border flex flex-row items-center justify-between min-h-[140px]">
            <div className="flex flex-col gap-2 w-full">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
            <div className="w-28 h-28 bg-gray-100 rounded ml-4" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="col-span-2 bg-white rounded-lg p-4 shadow border h-64 flex flex-col gap-2">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-1/6" />
              <div className="h-4 bg-gray-200 rounded w-1/6" />
            </div>
            <div className="flex-1 bg-gray-100 rounded" />
          </div>
          <div className="bg-white rounded-lg p-4 shadow border flex flex-col min-h-[350px]">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
            <ul className="flex-1 flex flex-col gap-2 mt-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <li key={idx} className="h-6 bg-gray-100 rounded" />
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Funções de cálculo
  function getAcumuladoAno(dados: any[]): number {
    if (!dados.length) return 0;
    return (dados[dados.length - 1]?.saldoFinal ?? 0) - (dados[0]?.saldoInicial ?? 0);
  }
  function getLucratividade(dados: any[]): number {
    if (!dados.length) return 0;
    const inicial = dados[0]?.saldoInicial ?? 0;
    const final = dados[dados.length - 1]?.saldoFinal ?? 0;
    if (inicial === 0) return final > 0 ? 100 : final < 0 ? -100 : 0;
    return Number((((final - inicial) / Math.abs(inicial)) * 100).toFixed(2));
  }
  function getTop10(dados: any[], tipo: 'receitas' | 'despesas') {
    const somaPorPlano: Record<string, number> = {};
    dados.forEach(mes => {
      Object.entries(mes?.[tipo] || {}).forEach(([id, { descricao, filhos }]: any) => {
        Object.entries(filhos || {}).forEach(([idFilho, valor]: any) => {
          const key = descricao;
          somaPorPlano[key] = (somaPorPlano[key] || 0) + (valor || 0);
        });
      });
    });
    return Object.entries(somaPorPlano)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 10)
      .map(([descricao, valor]) => ({ descricao, valor }));
  }
  function getMelhorPiorMes(dados: any[]) {
    let melhor = { idx: 0, valor: -Infinity };
    let pior = { idx: 0, valor: Infinity };
    dados.forEach((mes, idx) => {
      const saldo = (mes.saldoFinal ?? 0) - (mes.saldoInicial ?? 0);
      if (saldo > melhor.valor) melhor = { idx, valor: saldo };
      if (saldo < pior.valor) pior = { idx, valor: saldo };
    });
    return {
      melhor: { mes: mesesNomes[melhor.idx] + '/' + anoSelecionado, valor: melhor.valor },
      pior: { mes: mesesNomes[pior.idx] + '/' + anoSelecionado, valor: pior.valor }
    };
  }
  function getGraficoData(dados: any[]) {
    const receitas = dados.map(mes => {
      return Object.values(mes?.receitas || {}).reduce((soma: number, cat: any) => soma + Object.values(cat.filhos || {}).reduce((a: number, b: any) => a + (b || 0), 0), 0);
    });
    const despesas = dados.map(mes => {
      return Object.values(mes?.despesas || {}).reduce((soma: number, cat: any) => soma + Object.values(cat.filhos || {}).reduce((a: number, b: any) => a + (b || 0), 0), 0);
    });
    const saldo = dados.map((mes, idx) => (receitas[idx] || 0) - (despesas[idx] || 0));
    return { receitas, despesas, saldo };
  }

  // Cálculos reais
  const acumuladoAtual = getAcumuladoAno(dadosAtual);
  const acumuladoAnterior = getAcumuladoAno(dadosAnterior);
  const melhorQueAnoPassado = acumuladoAtual - acumuladoAnterior;
  const lucratividadeAtual = getLucratividade(dadosAtual);
  const lucratividadeAnterior = getLucratividade(dadosAnterior);
  const melhorQueAnoPassadoLucro = lucratividadeAtual - lucratividadeAnterior;
  const top10 = getTop10(dadosAtual, tipoTop);
  const { melhor, pior } = getMelhorPiorMes(dadosAtual);
  const grafico = getGraficoData(dadosAtual);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Card Total Acumulado */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-row items-center justify-between min-h-[140px]">
          <div className="flex-1 flex flex-col justify-between h-full">
            <div className="font-bold text-gray-700 text-sm">TOTAL ACUMULADO</div>
            <div className={`text-2xl font-bold ${acumuladoAtual < 0 ? 'text-red-600' : 'text-green-600'}`}>{acumuladoAtual < 0 ? '-' : ''}R$ {formatarMoeda(Math.abs(acumuladoAtual))}</div>
            <div className="text-gray-500 text-sm">Acumulado no ano de {anoSelecionado}</div>
            <hr className="my-2" />
            <div className="mt-2 text-sm text-gray-500">Melhor que o ano passado</div>
            <div className={`font-bold ${melhorQueAnoPassado >= 0 ? 'text-green-600' : 'text-red-600'} text-base`}>R$ {formatarMoeda(Math.abs(melhorQueAnoPassado))}</div>
          </div>
          <img src={CoinsImg} alt="Acumulado" className="object-contain ml-4" style={{ width: '9rem' }} />
        </div>
        {/* Card Lucratividade */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-row items-center justify-between min-h-[140px]">
          <div className="flex-1 flex flex-col justify-between h-full">
            <div className="font-bold text-gray-700 text-sm">LUCRATIVIDADE</div>
            <div className={`text-2xl font-bold ${lucratividadeAtual < 0 ? 'text-red-600' : 'text-green-600'}`}>{lucratividadeAtual < 0 ? '-' : ''}{Math.abs(lucratividadeAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} %</div>
            <div className="text-gray-500 text-sm">Lucratividade no ano de {anoSelecionado}</div>
            <hr className="my-2" />
            <div className="mt-2 text-sm text-gray-500">Melhor que o ano passado</div>
            <div className={`font-bold ${melhorQueAnoPassadoLucro >= 0 ? 'text-green-600' : 'text-red-600'} text-base`}>{melhorQueAnoPassadoLucro >= 0 ? '+' : '-'}{Math.abs(melhorQueAnoPassadoLucro).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} %</div>
          </div>
          <img src={AccountantImg} alt="Lucratividade" className="object-contain ml-4" style={{ width: '9rem' }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* Analítico Anual */}
        <div className="col-span-2 bg-white rounded-lg p-4 pt-3 shadow border">
          <div className="font-bold text-gray-700 mb-2 text-base">ANALÍTICO ANUAL</div>
          <div className="flex justify-around mb-2">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-start">
                <div className="font-bold text-xl text-gray-800">{melhor.mes}</div>
                <div className="text-green-600 flex items-center gap-1 text-lg font-bold">R$ {formatarMoeda(melhor.valor)} </div>
                <div className="text-xs text-gray-500">Melhor mês do ano</div>
              </div>
              <FontAwesomeIcon icon={faCaretUp} className="text-green-600 text-3xl" />
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-start">
                <div className="font-bold text-xl text-gray-800">{pior.mes}</div>
                <div className="text-red-600 flex items-center gap-1 text-lg font-bold">R$ {formatarMoeda(pior.valor)} </div>
                <div className="text-xs text-gray-500">Pior mês do ano</div>
                
              </div>
              <FontAwesomeIcon icon={faCaretDown} className="text-red-600 text-3xl" />
            </div>
            
          </div>
          <div className="h-64 mt-2 w-full">
            <Chart
              style={{ width: '100%' }}
              type="bar"
              data={{
                labels: mesesNomes.map(m => m + '/' + anoSelecionado),
                datasets: [
                  {
                    label: 'Receitas',
                    data: grafico.receitas,
                    backgroundColor: '#4f8cff',
                    order: 1,
                  },
                  {
                    label: 'Despesas',
                    data: grafico.despesas,
                    backgroundColor: '#ff7e4f',
                    order: 1,
                  },
                  {
                    type: 'line',
                    label: 'Saldo',
                    data: grafico.saldo,
                    borderColor: '#222',
                    backgroundColor: 'rgba(37, 37, 37, 0.1)',
                    fill: false,
                    yAxisID: 'y',
                    order: 0,
                    borderWidth: 3,
                    pointRadius: 3,
                    pointBackgroundColor: '#222',
                    pointBorderColor: '#222',
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: false }
                },
                scales: {
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>
        {/* Top 10 Planos de Contas / Centros de Custos */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-col min-h-[350px]">
          <div className="font-bold text-gray-700 mb-2 flex justify-between items-center text-base">
            {tipoAgrupamento === 'centros' ? 'TOP 10 CENTROS DE CUSTOS' : 'TOP 10 PLANOS DE CONTAS'}
            <select className="ml-2 border-b border-blue-500 text-blue-500 cursor-pointer px-2 py-1 " value={tipoTop} onChange={e => setTipoTop((e.target as HTMLSelectElement).value as any)}>
              <option value="receitas">Receitas</option>
              <option value="despesas">Despesas</option>
            </select>
          </div>
          <ul className="mt-2">
            {top10.length === 0 && <li className="text-gray-400">Nenhum dado para exibir.</li>}
            {top10.map((item, idx) => (
              <li key={item.descricao} className="flex justify-between items-center border-b py-2">
                <span className="flex items-center gap-2">
                  <FontAwesomeIcon icon={tipoTop === 'receitas' ? faArrowUp : faArrowDown} className={`${tipoTop === 'receitas' ? 'text-green-500' : 'text-red-500'}`} />
                  <span className="font-bold text-gray-700">{item.descricao}</span>
                </span>
                <span className="font-bold text-gray-800">R$ {formatarMoeda(item.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FluxoCaixaGrafico; 