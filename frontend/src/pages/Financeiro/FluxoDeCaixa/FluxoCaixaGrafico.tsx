import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS,
  BarController,
  LineController,
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
import { FluxoMesCentrosInput } from './fluxoMensalRegras';
import { CentroInfo, compararAnos, resumoAnoFluxo, topCentros } from './fluxoGraficoRegras';
import { brl, brlCompacto, pct } from '../../../Utils/formatos';

// <Chart type="bar"> with line datasets needs both controllers registered: the production build
// tree-shakes everything not registered and the tab crashed ("bar" is not a registered controller).
ChartJS.register(
  BarController,
  LineController,
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
  dadosAtual: FluxoMesCentrosInput[];
  dadosAnterior: FluxoMesCentrosInput[];
  /** When true, show skeleton. Parent should pass the real loading flag (not inverted). */
  isLoading: boolean;
  /** Centros de custos (Top 10 labels; type tells apart same-name centros). */
  centros: CentroInfo[];
}

const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Green for positive, red for negative (a "best month" can still be negative). */
const corSinal = (v: number) => (v < 0 ? 'text-red-600' : 'text-green-600');
/** "+R$ 1.234,56" / "-R$ 1.234,56" */
const brlComSinal = (v: number) => `${v >= 0 ? '+' : '-'}${brl(Math.abs(v))}`;
/** "+2,5 p.p." */
const pontosPercentuais = (v: number) =>
  `${v >= 0 ? '+' : '-'}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;

const FluxoCaixaGrafico: React.FC<Props> = ({ anoSelecionado, dadosAtual, dadosAnterior, isLoading, centros }) => {
  const [tipoTop, setTipoTop] = React.useState<'receitas' | 'despesas'>('receitas');

  // Same rules as the table (montarFluxoMensal): C = R − D, lucratividade = C ÷ R, financing left out
  const atual = useMemo(() => resumoAnoFluxo(dadosAtual), [dadosAtual]);
  const anterior = useMemo(() => resumoAnoFluxo(dadosAnterior), [dadosAnterior]);

  // Skeleton only while loading (it used to stay forever when there was no data)
  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-4 animate-pulse" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 bg-white rounded-lg p-4 shadow border h-64 flex flex-col gap-2">
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

  if (!dadosAtual.length) {
    return (
      <div className="bg-white rounded-lg border p-10 text-center text-gray-500">
        Nenhum dado para o filtro selecionado. Use "Pesquisar Fluxo de Caixa" para escolher o ano e as contas.
      </div>
    );
  }

  const anoAnterior = String(Number(anoSelecionado) - 1);
  const { diferencaAcumulado, diferencaLucratividade } = compararAnos(atual, anterior);
  const top10 = topCentros(atual.total, tipoTop, centros);
  const nomeMes = (idx: number) => `${mesesNomes[idx]}/${anoSelecionado}`;
  const comparacao = (diferenca: number) => (diferenca >= 0 ? `Melhor que ${anoAnterior}` : `Pior que ${anoAnterior}`);

  return (
    <div className="w-full flex flex-col gap-4">
      {!atual.temDados && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Nenhuma receita ou despesa classificada em {anoSelecionado} nas contas selecionadas.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card (C) saldo após investimentos do ano */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-row items-center justify-between min-h-[140px]">
          <div className="flex-1 flex flex-col justify-between h-full min-w-0">
            <div className="font-bold text-gray-700 text-sm">(C) Saldo após investimentos</div>
            <div className={`text-2xl font-bold ${corSinal(atual.acumulado)}`}>{brl(atual.acumulado)}</div>
            <div className="text-gray-500 text-sm" title="Receitas − despesas operacionais − investimentos (financiamentos ficam de fora)">
              Receitas − despesas (C = R − D), acumulado de {anoSelecionado}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              (A) Saldo operacional: <strong>{brl(atual.total.saldoOperacional)}</strong> · (B) Investimentos:{' '}
              <strong>{brl(atual.total.investimentosRealizados)}</strong>
            </div>
            <hr className="my-2" />
            {diferencaAcumulado == null ? (
              <div className="mt-2 text-sm text-gray-500">Sem dados de {anoAnterior} para comparar</div>
            ) : (
              <>
                <div className="mt-2 text-sm text-gray-500">
                  {comparacao(diferencaAcumulado)} ({anoAnterior}: {brl(anterior.acumulado)})
                </div>
                <div className={`font-bold ${corSinal(diferencaAcumulado)} text-base`}>{brlComSinal(diferencaAcumulado)}</div>
              </>
            )}
          </div>
          <img src={CoinsImg} alt="" className="hidden sm:block object-contain ml-4" style={{ width: '9rem' }} />
        </div>
        {/* Card Lucratividade: C ÷ R */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-row items-center justify-between min-h-[140px]">
          <div className="flex-1 flex flex-col justify-between h-full min-w-0">
            <div className="font-bold text-gray-700 text-sm">Lucratividade</div>
            <div className={`text-2xl font-bold ${corSinal(atual.lucratividade ?? 0)}`}>{pct(atual.lucratividade)}</div>
            <div className="text-gray-500 text-sm">Saldo após investimentos ÷ receitas em {anoSelecionado}</div>
            <hr className="my-2" />
            {diferencaLucratividade == null ? (
              <div className="mt-2 text-sm text-gray-500">Sem dados de {anoAnterior} para comparar</div>
            ) : (
              <>
                <div className="mt-2 text-sm text-gray-500">
                  {comparacao(diferencaLucratividade)} ({anoAnterior}: {pct(anterior.lucratividade)})
                </div>
                <div className={`font-bold ${corSinal(diferencaLucratividade)} text-base`}>{pontosPercentuais(diferencaLucratividade)}</div>
              </>
            )}
          </div>
          <img src={AccountantImg} alt="" className="hidden sm:block object-contain ml-4" style={{ width: '9rem' }} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Analítico anual */}
        <div className="lg:col-span-2 bg-white rounded-lg p-4 pt-3 shadow border min-w-0">
          <div className="font-bold text-gray-700 mb-2 text-base">Analítico anual</div>
          <div className="flex flex-wrap justify-around gap-4 mb-2">
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-start">
                <div className="font-bold text-xl text-gray-800">{atual.melhorMes ? nomeMes(atual.melhorMes.idx) : '—'}</div>
                <div className={`${atual.melhorMes ? corSinal(atual.melhorMes.valor) : 'text-gray-500'} flex items-center gap-1 text-lg font-bold`}>
                  {atual.melhorMes ? brl(atual.melhorMes.valor) : '—'}
                </div>
                <div className="text-xs text-gray-500">Melhor mês do ano (saldo após investimentos)</div>
              </div>
              <FontAwesomeIcon icon={faCaretUp} className={`${atual.melhorMes ? corSinal(atual.melhorMes.valor) : 'text-gray-400'} text-3xl`} />
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-start">
                <div className="font-bold text-xl text-gray-800">{atual.piorMes ? nomeMes(atual.piorMes.idx) : '—'}</div>
                <div className={`${atual.piorMes ? corSinal(atual.piorMes.valor) : 'text-gray-500'} flex items-center gap-1 text-lg font-bold`}>
                  {atual.piorMes ? brl(atual.piorMes.valor) : '—'}
                </div>
                <div className="text-xs text-gray-500">Pior mês do ano (saldo após investimentos)</div>
              </div>
              <FontAwesomeIcon icon={faCaretDown} className={`${atual.piorMes ? corSinal(atual.piorMes.valor) : 'text-gray-400'} text-3xl`} />
            </div>
          </div>
          <div className="h-64 mt-2 w-full">
            <Chart
              style={{ width: '100%' }}
              type="bar"
              data={{
                labels: mesesNomes.map((_, idx) => nomeMes(idx)),
                datasets: [
                  {
                    label: 'Receitas',
                    data: atual.series.receitas,
                    backgroundColor: '#4f8cff',
                    order: 1,
                  },
                  {
                    label: 'Despesas operacionais',
                    data: atual.series.operacionais,
                    backgroundColor: '#ff7e4f',
                    order: 1,
                  },
                  {
                    label: '(B) Investimentos',
                    data: atual.series.investimentos,
                    backgroundColor: '#f2c94c',
                    order: 1,
                  },
                  {
                    type: 'line',
                    label: '(A) Saldo operacional',
                    data: atual.series.saldoOperacional,
                    borderColor: '#0f766e',
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    borderDash: [6, 4],
                    fill: false,
                    yAxisID: 'y',
                    order: 0,
                    borderWidth: 2,
                    pointRadius: 2,
                    pointBackgroundColor: '#0f766e',
                    pointBorderColor: '#0f766e',
                  },
                  {
                    type: 'line',
                    label: '(C) Saldo após investimentos',
                    data: atual.series.saldoAposInvestimentos,
                    borderColor: '#222',
                    backgroundColor: 'rgba(37, 37, 37, 0.1)',
                    fill: false,
                    yAxisID: 'y',
                    order: 0,
                    borderWidth: 3,
                    pointRadius: 3,
                    pointBackgroundColor: '#222',
                    pointBorderColor: '#222',
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' },
                  title: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: ${brl(Number(ctx.parsed.y) || 0)}`,
                    },
                  },
                },
                scales: {
                  // Short money on the axis ("R$ 1,5 mi"), full value in the tooltip
                  y: { beginAtZero: true, ticks: { callback: (v) => brlCompacto(Number(v)) } },
                },
              }}
            />
          </div>
        </div>
        {/* Top 10 Centros de Custos (by id: same-name centros stay apart) */}
        <div className="bg-white rounded-lg p-4 pt-3 shadow border flex flex-col min-h-[350px]">
          <div className="font-bold text-gray-700 mb-2 flex flex-wrap justify-between items-center gap-2 text-base">
            Top 10 centros de custos
            <select className="ml-2 border-b border-blue-500 text-blue-500 cursor-pointer px-2 py-1 " value={tipoTop} onChange={e => setTipoTop((e.target as HTMLSelectElement).value as 'receitas' | 'despesas')}>
              <option value="receitas">Receitas</option>
              <option value="despesas">Despesas</option>
            </select>
          </div>
          <ul className="mt-2">
            {top10.length === 0 && <li className="text-gray-400">Nenhum dado para exibir.</li>}
            {top10.map((item) => (
              <li key={item.key} className="flex justify-between items-center border-b py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <FontAwesomeIcon icon={tipoTop === 'receitas' ? faArrowUp : faArrowDown} className={`${tipoTop === 'receitas' ? 'text-green-500' : 'text-red-500'}`} />
                  <span className="font-bold text-gray-700 break-words">{item.descricao}</span>
                </span>
                <span className="font-bold text-gray-800 whitespace-nowrap ml-2">{brl(item.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FluxoCaixaGrafico;
