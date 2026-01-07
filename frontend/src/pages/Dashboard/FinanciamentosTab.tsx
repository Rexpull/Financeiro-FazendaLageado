import React, { lazy, Suspense } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Divider,
} from "@mui/material";
import { DashboardData, ParcelasAVencer, ContratosLiquidados, ContratosNovos } from "../../services/dashboardService";
import PaidIcon from '@mui/icons-material/Paid';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const Chart = lazy(() => import("react-apexcharts"));

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const NoData = ({ icon, message }: { icon?: React.ReactNode, message: string }) => (
  <Box sx={{ textAlign: 'center', py: 6, color: 'grey.500' }}>
    {icon || <InsertChartOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />}
    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
      {message}
    </Typography>
  </Box>
);

interface FinanciamentosTabProps {
  dashboardData: DashboardData;
  anoSelecionado: number;
  mesSelecionado: string;
  activeTab: 'parcelas-vencer' | 'contratos-liquidados' | 'contratos-novos';
  parcelasAVencer: ParcelasAVencer | null;
  contratosLiquidados: ContratosLiquidados | null;
  contratosNovos: ContratosNovos | null;
  onActiveTabChange: (tab: 'parcelas-vencer' | 'contratos-liquidados' | 'contratos-novos') => void;
}

const FinanciamentosTab: React.FC<FinanciamentosTabProps> = ({
  dashboardData,
  anoSelecionado,
  mesSelecionado,
  activeTab,
  parcelasAVencer,
  contratosLiquidados,
  contratosNovos,
  onActiveTabChange,
}) => {
  const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;


  return (
    <>
      {/* Indicadores-Chave de Financiamentos */}
      <Box sx={{ mb: 4 }}>

        {/* Cards de indicadores - apenas os 4 essenciais */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
          {/* Saldo Atual da Dívida */}
          <Paper 
            elevation={3} 
            sx={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: 3, 
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                Saldo Atual da Dívida
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {formatCurrency(dashboardData?.totaisAno?.financiamentos?.totalEmAberto || 0)}
              </Typography>
            </Box>
            <PaidIcon color="warning" sx={{ fontSize: 48 }} />
          </Paper>

          {/* Financiamentos Novos no Mês */}
          <Paper 
            elevation={3} 
            sx={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: 3, 
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                Financiamentos Contratados (Mês)
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">
                {formatCurrency(
                  -(mesSelecionado && contratosNovos?.detalhes
                    ? contratosNovos.detalhes.find(d => {
                        const mesDetalhe = d.mes.split('/')[0];
                        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                        return meses.indexOf(mesDetalhe) === mesIdx;
                      })?.valor || 0
                    : contratosNovos?.totalNovos || 0)
                )}
              </Typography>
            </Box>
            <RemoveIcon color="error" sx={{ fontSize: 48 }} />
          </Paper>

          {/* Valor Liquidado no Mês */}
          <Paper 
            elevation={3} 
            sx={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: 3, 
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 2
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                Valor Liquidado (Mês)
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {formatCurrency(
                  Math.abs(mesSelecionado && contratosLiquidados?.detalhes
                    ? contratosLiquidados.detalhes.find(d => {
                        const mesDetalhe = d.mes.split('/')[0];
                        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                        return meses.indexOf(mesDetalhe) === mesIdx;
                      })?.valor || 0
                    : contratosLiquidados?.totalLiquidado || 0)
                )}
              </Typography>
            </Box>
            <RemoveIcon color="success" sx={{ fontSize: 48 }} />
          </Paper>

          {/* Variação do Saldo */}
          <Paper 
            elevation={3} 
            sx={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: 3, 
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)', 
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              minHeight: '100px'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                Variação do Saldo
              </Typography>
            </Box>
            {(() => {
              if (!dashboardData?.financiamentosPorMes?.emAberto?.length) {
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Sem dados</Typography>
                    <InsertChartOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
                  </Box>
                );
              }
              
              const saldoAtual = mesIdx >= 0 
                ? (dashboardData.financiamentosPorMes.emAberto[mesIdx] || 0)
                : (dashboardData.financiamentosPorMes.emAberto[dashboardData.financiamentosPorMes.emAberto.length - 1] || 0);
              
              const indiceAnterior = mesIdx > 0 ? mesIdx - 1 : (mesIdx >= 0 ? 0 : dashboardData.financiamentosPorMes.emAberto.length - 2);
              const saldoAnterior = indiceAnterior >= 0 
                ? (dashboardData.financiamentosPorMes.emAberto[indiceAnterior] || 0)
                : saldoAtual;
              
              const variacao = saldoAtual - saldoAnterior;
              const percentualVariacao = saldoAnterior > 0 ? (variacao / saldoAnterior * 100) : 0;
              const isAumento = variacao > 0;
              
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold" 
                      color={isAumento ? 'error.main' : 'success.main'}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
                    >
                      {isAumento ? <TrendingUpIcon /> : <TrendingDownIcon />}
                      {formatCurrency(Math.abs(variacao))}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {percentualVariacao > 0 ? '+' : ''}{percentualVariacao.toFixed(1)}%
                    </Typography>
                  </Box>
                  {isAumento ? (
                    <TrendingUpIcon color="error" sx={{ fontSize: 48 }} />
                  ) : (
                    <TrendingDownIcon color="success" sx={{ fontSize: 48 }} />
                  )}
                </Box>
              );
            })()}
          </Paper>
        </Box>

        {/* Gráficos */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* Gráfico de Colunas: Novos x Liquidados */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Contratados x Liquidados por Mês
            </Typography>
            {contratosNovos?.labels?.length && contratosLiquidados?.labels?.length ? (
              <Suspense fallback={<CircularProgress />}>
                {(() => {
                  // Alinhar os dados por mês
                  const todosMeses = Array.from(new Set([...contratosNovos.labels, ...contratosLiquidados.labels])).sort();
                  const novosAlinhados = todosMeses.map(mes => {
                    const idx = contratosNovos.labels.indexOf(mes);
                    return idx >= 0 ? contratosNovos.valores[idx] : 0;
                  });
                  const liquidadosAlinhados = todosMeses.map(mes => {
                    const idx = contratosLiquidados.labels.indexOf(mes);
                    return idx >= 0 ? contratosLiquidados.valores[idx] : 0;
                  });

                  return (
                    <Chart
                      options={{
                        chart: { type: 'bar', height: 350, toolbar: { show: false } },
                        plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
                        xaxis: { categories: todosMeses },
                        yaxis: {
                          title: { text: "Valor (R$)" },
                          labels: { formatter: (val: number) => formatCurrency(val) }
                        },
                        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                        colors: ['#2196f3', '#4caf50'],
                        legend: { position: 'top' },
                        dataLabels: { enabled: false }
                      }}
                      series={[
                        { name: "Contratados", data: novosAlinhados.map(v => -v) },
                        { name: "Liquidados", data: liquidadosAlinhados }
                      ]}
                      type="bar"
                      height={350}
                      style={{width: '100%'}}
                    />
                  );
                })()}
              </Suspense>
            ) : (
              <NoData message="Nenhum dado disponível para comparar contratados e liquidados." />
            )}
          </Paper>

          {/* Gráfico de Linha: Saldo ao Longo do Tempo */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Saldo da Dívida ao Longo do Tempo
            </Typography>
            {dashboardData?.financiamentosPorMes?.labels?.length ? (
              <Suspense fallback={<CircularProgress />}>
                <Chart
                  options={{
                    chart: { type: 'line', height: 350, toolbar: { show: false }, zoom: { enabled: false } },
                    stroke: { curve: 'smooth', width: 3 },
                    xaxis: { categories: dashboardData.financiamentosPorMes.labels },
                    yaxis: {
                      title: { text: "Valor (R$)" },
                      labels: { formatter: (val: number) => formatCurrency(val) }
                    },
                    tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                    colors: ['#ff9800'],
                    markers: { size: 5 },
                    dataLabels: { enabled: false }
                  }}
                  series={[
                    { 
                      name: "Saldo da Dívida", 
                      data: dashboardData.financiamentosPorMes.emAberto || [] 
                    }
                  ]}
                  type="line"
                  height={350}
                  style={{width: '100%'}}
                />
              </Suspense>
            ) : (
              <NoData message="Nenhum dado de saldo disponível." />
            )}
          </Paper>
        </Box>
      </Box>
    </>
  );
};

export default FinanciamentosTab;

