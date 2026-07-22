import React, { lazy, Suspense, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DashboardData } from "../../services/dashboardService";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SavingsIcon from '@mui/icons-material/Savings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import * as XLSX from 'xlsx';

const Chart = lazy(() => import("react-apexcharts"));

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/** Short labels for horizontal bar value axis (bottom) — avoids overlap on large totals */
function formatAxisCurrencyShort(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} Mi`;
  }
  if (abs >= 100_000) {
    return `${sign}${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return formatCurrency(n);
}

const truncateCat = (s: string, max = 36) =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

/**
 * Build chart series from sorted categories. Percentages use `totalBase` (full total).
 * Does not aggregate residual categories into "Outros" — show every slice.
 */
function limitCompositionSlices<T extends { descricao: string; valorNum: number }>(
  sortedDesc: T[],
  totalBase: number
): { categorias: string[]; valores: number[]; percentuais: number[] } {
  const valores = sortedDesc.map((r) => r.valorNum);
  const percentuais = sortedDesc.map((r) => (totalBase > 0 ? (r.valorNum / totalBase) * 100 : 0));
  const categorias = sortedDesc.map((r) => truncateCat(r.descricao));
  return { categorias, valores, percentuais };
}

const isOutrosLabel = (descricao: string) => {
  const n = descricao.trim().toLowerCase();
  return n === 'outros' || n === 'outros planos';
};

/** Drop synthetic "Outros" buckets before charting / ranking. */
function withoutOutrosRows<T extends { descricao: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isOutrosLabel(r.descricao || ''));
}

/** Horizontal bars (many categories readable vs pie). */
function buildHorizontalCompositionOptions(opts: {
  categories: string[];
  hexColor: string;
  distributed?: boolean;
  colors?: string[];
  valueSeries: number[];
  percentSeries: number[];
}) {
  const { categories, hexColor, distributed, colors, valueSeries, percentSeries } = opts;
  return {
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 380 },
      zoom: { enabled: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '70%',
        ...(distributed ? { distributed: true } : {}),
      },
    },
    colors: distributed && colors?.length ? colors : [hexColor],
    legend: { show: false },
    stroke: { show: false },
    dataLabels: {
      enabled: true,
      offsetX: 6,
      textAnchor: 'start' as const,
      formatter: (_v: number, ctx: any) =>
        `${(percentSeries[ctx?.dataPointIndex] ?? 0).toFixed(1)}%`,
      style: { fontSize: '13px', fontWeight: 600, colors: ['#424242'] },
    },
    tooltip: {
      custom: ({
        dataPointIndex,
      }: {
        series: number[][];
        dataPointIndex: number;
        w?: unknown;
      }) => {
        const i = typeof dataPointIndex === 'number' ? dataPointIndex : 0;
        const v = Math.abs(valueSeries[i] ?? 0);
        const pct = percentSeries[i] ?? 0;
        const cat = categories[i] ?? '';
        return `<div style="padding:10px;line-height:1.5"><div style="max-width:320px">${cat}</div><strong>${formatCurrency(v)}</strong> <span style="opacity:.8">(${pct.toFixed(1)}%)</span></div>`;
      },
    },
    grid: {
      padding: { left: 4, right: 40, top: 4, bottom: 8 },
      xaxis: { lines: { show: true } },
    },
    // Horizontal bars: numerical scale along the horizontal (reading) axis
    xaxis: {
      categories,
      labels: {
        formatter: (val: string | number) => formatAxisCurrencyShort(Number(val)),
        style: { fontSize: '12px' },
        rotate: 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
        trim: true,
      },
      tickAmount: 4,
      axisTicks: { show: true },
      axisBorder: { show: true },
    },
    yaxis: {
      labels: {
        maxWidth: 160,
        style: { fontSize: '12px' },
        trim: true,
      },
    },
  };
}

const NoData = ({ icon, message }: { icon?: React.ReactNode, message: string }) => (
  <Box sx={{ textAlign: 'center', py: 6, color: 'grey.500' }}>
    {icon || <InsertChartOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />}
    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
      {message}
    </Typography>
  </Box>
);

interface ReceitasDespesasTabProps {
  dashboardData: DashboardData;
  anoSelecionado: number;
  mesSelecionado: string;
  tipoDetalhamento: 'receitas' | 'despesas';
  onTipoDetalhamentoChange: (value: 'receitas' | 'despesas') => void;
}

const ReceitasDespesasTab: React.FC<ReceitasDespesasTabProps> = ({
  dashboardData,
  anoSelecionado,
  mesSelecionado,
  tipoDetalhamento,
  onTipoDetalhamentoChange,
}) => {
  const [despesasChartTipo, setDespesasChartTipo] = useState<'custeio' | 'investimento'>('custeio');

  // Period breakdown (month when selected, else year) — single source for cards, charts, and Detalhamento
  const receitasPorCentros = withoutOutrosRows(
    dashboardData?.receitasDespesas?.receitasAgrupadoPorCentros ?? []
  );
  const despesasAgrupado = withoutOutrosRows(
    (dashboardData?.receitasDespesas?.agrupadoPor ?? []).filter((item) => item.tipoMovimento === 'D')
  );
  const despesasCusteioBreakdown = despesasAgrupado.filter(
    (item) => item.subtipoDespesa === 'custeio'
  );
  const despesasInvestimentoBreakdown = despesasAgrupado.filter(
    (item) => item.subtipoDespesa === 'investimento'
  );

  const yearRd = dashboardData?.receitasDespesasAno ?? dashboardData?.receitasDespesas;
  const receitasAnoCentros = withoutOutrosRows(yearRd?.receitasAgrupadoPorCentros ?? []);
  const despesasAnoAgrupado = withoutOutrosRows(
    (yearRd?.agrupadoPor ?? []).filter((item) => item.tipoMovimento === 'D')
  );
  const despesasAnoCusteio = despesasAnoAgrupado.filter(
    (item) => item.subtipoDespesa === 'custeio'
  );
  const despesasAnoInvest = despesasAnoAgrupado.filter(
    (item) => item.subtipoDespesa === 'investimento'
  );

  const totalReceitasPeriodo = receitasPorCentros.reduce(
    (s, r) => s + Math.abs(Number(r.valor) || 0),
    0
  );
  const despesasOperacionaisPeriodo = despesasCusteioBreakdown.reduce(
    (s, r) => s + Math.abs(Number(r.valor) || 0),
    0
  );
  const totalInvestimentosPeriodo = despesasInvestimentoBreakdown.reduce(
    (s, r) => s + Math.abs(Number(r.valor) || 0),
    0
  );
  const totalDespesasConsolidadasPeriodo = despesasOperacionaisPeriodo + totalInvestimentosPeriodo;

  const totalReceitasAno = receitasAnoCentros.reduce(
    (s, r) => s + Math.abs(Number(r.valor) || 0),
    0
  );
  const totalDespesasConsolidadasAno =
    despesasAnoCusteio.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0) +
    despesasAnoInvest.reduce((s, r) => s + Math.abs(Number(r.valor) || 0), 0);

  const totalReceitasMes = totalReceitasPeriodo;
  const despesasOperacionaisMes = despesasOperacionaisPeriodo;
  const totalInvestimentosMes = totalInvestimentosPeriodo;
  const totalDespesasConsolidadasMes = totalDespesasConsolidadasPeriodo;
  const saldoMes = totalReceitasMes - totalDespesasConsolidadasMes;
  const pctInvestSobreReceita =
    totalReceitasMes > 0 ? (totalInvestimentosMes / totalReceitasMes) * 100 : null;
  const pctDespesasSobreReceita =
    totalReceitasMes > 0 ? (totalDespesasConsolidadasMes / totalReceitasMes) * 100 : null;
  const pctAproveitamento =
    totalReceitasMes > 0 ? (saldoMes / totalReceitasMes) * 100 : null;

  const exportReceitasDespesasExcel = () => {
    const totalRec = Math.max(totalReceitasMes, 1e-9);
    const totalDesp = Math.max(totalDespesasConsolidadasMes, 1e-9);

    const receitasRows = [...receitasPorCentros]
      .map((item) => {
        const valor = Math.abs(Number(item.valor) || 0);
        return {
          Nome: item.descricao,
          Valor: valor,
          '%': Number(((valor / totalRec) * 100).toFixed(2)),
          Conciliado: item.conciliado ? 'Sim' : 'Não',
        };
      })
      .sort((a, b) => b.Valor - a.Valor);

    const despesasRows = [...despesasAgrupado]
      .map((item) => {
        const valor = Math.abs(Number(item.valor) || 0);
        return {
          Nome: item.descricao,
          Subtipo: item.subtipoDespesa === 'investimento' ? 'Investimento' : item.subtipoDespesa === 'custeio' ? 'Custeio' : '',
          Valor: valor,
          '%': Number(((valor / totalDesp) * 100).toFixed(2)),
          Conciliado: item.conciliado ? 'Sim' : 'Não',
        };
      })
      .sort((a, b) => b.Valor - a.Valor);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receitasRows), 'Receitas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasRows), 'Despesas');
    const periodo = mesSelecionado
      ? `${mesSelecionado}_${anoSelecionado}`
      : `${anoSelecionado}`;
    XLSX.writeFile(wb, `receitas_despesas_${periodo}.xlsx`);
  };

  const canExport =
    receitasPorCentros.length > 0 || despesasAgrupado.length > 0;

  return (
    <>
      {/* Cards de Totais */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2, mb: 4 }}>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontSize: '0.95rem' }}>Receitas</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start', fontSize: { xs: '1.35rem', md: '1.5rem' }}}>
              {formatCurrency(totalReceitasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '13px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalReceitasAno)})</span></Typography>
            </Typography>
            {pctInvestSobreReceita != null && (
              <Typography variant="caption" color="info.main" sx={{ fontSize: '0.8rem', display: 'block', mt: 0.5, fontWeight: 600 }}>
                Invest. sobre receita: {pctInvestSobreReceita.toFixed(1)}% ({formatCurrency(totalInvestimentosMes)})
              </Typography>
            )}
          </Box>
          <TrendingUpIcon color="success" sx={{ fontSize: 48 }} />
        </Paper>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontSize: '0.95rem' }}>Despesas</Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start', fontSize: { xs: '1.35rem', md: '1.5rem' }}}>
              {formatCurrency(totalDespesasConsolidadasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '13px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalDespesasConsolidadasAno)})</span></Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block', mt: 0.25 }}>
              Custeio: {formatCurrency(despesasOperacionaisMes)} | Invest.: {formatCurrency(totalInvestimentosMes)}
            </Typography>
            {pctDespesasSobreReceita != null && (
              <Typography variant="caption" color="error.main" sx={{ fontSize: '0.8rem', display: 'block', mt: 0.25, fontWeight: 600 }}>
                {pctDespesasSobreReceita.toFixed(1)}% sobre receita
              </Typography>
            )}
          </Box>
          <TrendingDownIcon color="error" sx={{ fontSize: 48 }} />
        </Paper>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontSize: '0.95rem' }}>Saldo</Typography>
            <Typography variant="h5" fontWeight="bold" color={saldoMes >= 0 ? 'success.main' : 'error.main'} sx={{display: 'flex', flexDirection: 'column', alignItems: 'start', fontSize: { xs: '1.35rem', md: '1.5rem' }}}>
              {formatCurrency(saldoMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '13px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalReceitasAno - totalDespesasConsolidadasAno)})</span></Typography>
            </Typography>
            {pctAproveitamento != null && (
              <Typography
                variant="caption"
                sx={{ fontSize: '0.8rem', display: 'block', mt: 0.5, fontWeight: 600 }}
                color={saldoMes >= 0 ? 'success.main' : 'error.main'}
              >
                {pctAproveitamento.toFixed(1)}% de aproveitamento
              </Typography>
            )}
          </Box>
          <SavingsIcon sx={{ fontSize: 48, color: saldoMes >= 0 ? '#4caf50' : '#f44336' }} />
        </Paper>
      </Box>

      

      {/* Nova Seção: Análise Comparativa Receitas vs Despesas */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: '1.25rem' }}>
          Análise Comparativa - Receitas e Despesas
        </Typography>
        <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
        
        {/* Layout lado a lado */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2, mb: 3 }}>
          {/* Lado Esquerdo: Receitas - destaque visual + barras */}
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'success.main', fontSize: '1.5rem' }}>
              Receitas
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1.75rem', md: '2rem' } }}>
                {formatCurrency(totalReceitasMes)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                {mesSelecionado ? `Total de ${mesSelecionado}/${anoSelecionado}` : `Total Anual de ${anoSelecionado}`}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: '0.8rem' }}>
                Composição por centro de custos (mesmo critério do Fluxo)
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                width: '100%',
                minWidth: 0,
                minHeight: 280,
                maxHeight: 560,
                overflowX: 'hidden',
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
              }}
            >
              {(() => {
                const fromCentros = receitasPorCentros.map((item) => ({
                  descricao: item.descricao,
                  valorNum: Math.abs(Number(item.valor) || 0),
                }));

                const dadosOrdenados = [...fromCentros].sort(
                  (a, b) => b.valorNum - a.valorNum
                );
                const totalBasePct = Math.max(Number(totalReceitasMes) || 0, 1e-9);
                if (dadosOrdenados.length === 0) {
                  return (
                    <NoData
                      message={
                        mesSelecionado
                          ? `Nenhuma receita no período ${mesSelecionado}/${anoSelecionado}.`
                          : `Nenhuma receita em ${anoSelecionado}.`
                      }
                    />
                  );
                }
                const { categorias: cats, valores, percentuais } = limitCompositionSlices(
                  dadosOrdenados,
                  totalBasePct
                );
                const h = Math.min(720, Math.max(300, valores.length * 36));
                return (
                  <Box sx={{ width: '100%', minWidth: 0, alignSelf: 'flex-start' }}>
                    <Suspense fallback={<CircularProgress />}>
                      <Chart
                        options={buildHorizontalCompositionOptions({
                          categories: cats,
                          hexColor: '#4caf50',
                          valueSeries: valores,
                          percentSeries: percentuais,
                        })}
                        series={[{ name: 'Receitas', data: valores }]}
                        type="bar"
                        height={h}
                        width="100%"
                      />
                    </Suspense>
                  </Box>
                );
              })()}
            </Box>
          </Paper>

          {/* Lado Direito: Despesas - custeio e investimento separados */}
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'error.main', fontSize: '1.5rem' }}>
              Despesas
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="h4" fontWeight="bold" color="error.main" sx={{ fontSize: { xs: '1.75rem', md: '2rem' } }}>
                {formatCurrency(totalDespesasConsolidadasMes)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                {mesSelecionado ? `Total de ${mesSelecionado}/${anoSelecionado}` : `Total Anual de ${anoSelecionado}`}
              </Typography>
            </Box>

            {/* Seção secundária: Custeio e Investimento */}
            <Box sx={{ 
              mb: 2, 
              py: 1, 
              px: 1.5, 
              bgcolor: 'grey.50', 
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              flexWrap: 'wrap'
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Custeio: <strong>{formatCurrency(despesasOperacionaisMes)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>+</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Investimento: <strong>{formatCurrency(totalInvestimentosMes)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>=</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Total: <strong>{formatCurrency(totalDespesasConsolidadasMes)}</strong>
              </Typography>
            </Box>

            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                maxHeight: 560,
                overflowX: 'hidden',
                overflowY: 'auto',
              }}
            >
              {(() => {
                const items =
                  despesasChartTipo === 'custeio'
                    ? despesasCusteioBreakdown
                    : despesasInvestimentoBreakdown;
                const cor = despesasChartTipo === 'custeio' ? '#ef5350' : '#fb8c00';
                const emptyMsg =
                  despesasChartTipo === 'custeio'
                    ? 'Sem despesas de custeio no período.'
                    : 'Sem despesas de investimento no período.';
                const total = items.reduce((s, i) => s + Math.abs(i.valor), 0);
                const dadosOrdenados = [...items]
                  .map((item) => ({ descricao: item.descricao, valorNum: Math.abs(item.valor) }))
                  .sort((a, b) => b.valorNum - a.valorNum);
                const { categorias, valores, percentuais } = limitCompositionSlices(
                  dadosOrdenados,
                  total
                );

                return (
                  <Box sx={{ minWidth: 0, width: '100%', overflowX: 'hidden' }}>
                    <Box
                      sx={{
                        mb: 1.5,
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 0.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: despesasChartTipo === 'custeio' ? 'error.main' : 'warning.dark',
                        }}
                      >
                        Despesas de
                      </Typography>
                      <Select
                        value={despesasChartTipo}
                        onChange={(e) =>
                          setDespesasChartTipo(e.target.value as 'custeio' | 'investimento')
                        }
                        variant="standard"
                        disableUnderline
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: despesasChartTipo === 'custeio' ? 'error.main' : 'warning.dark',
                          '& .MuiSelect-select': {
                            py: 0,
                            pr: '22px !important',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px',
                            textDecorationThickness: '1.5px',
                          },
                          '& .MuiSvgIcon-root': {
                            color: despesasChartTipo === 'custeio' ? 'error.main' : 'warning.dark',
                          },
                        }}
                      >
                        <MenuItem value="custeio">Custeio</MenuItem>
                        <MenuItem value="investimento">Investimento</MenuItem>
                      </Select>
                    </Box>
                    {dadosOrdenados.length === 0 ? (
                      <NoData message={emptyMsg} />
                    ) : (
                      <Box sx={{ width: '100%', minWidth: 0, overflowX: 'hidden' }}>
                        <Suspense fallback={<CircularProgress />}>
                          <Chart
                            options={buildHorizontalCompositionOptions({
                              categories: categorias,
                              hexColor: cor,
                              valueSeries: valores,
                              percentSeries: percentuais,
                            })}
                            series={[
                              {
                                name:
                                  despesasChartTipo === 'custeio'
                                    ? 'Despesas de Custeio'
                                    : 'Despesas de Investimento',
                                data: valores,
                              },
                            ]}
                            type="bar"
                            height={Math.min(520, Math.max(220, valores.length * 34))}
                            width="100%"
                          />
                        </Suspense>
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>
          </Paper>
        </Box>

        {/* Seção de Receitas e Despesas */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Análise de Receitas e Despesas - {anoSelecionado}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={exportReceitasDespesasExcel}
            disabled={!canExport}
            title="Exporta Receitas e Despesas agrupadas em abas separadas."
          >
            Exportar Excel
          </Button>
        </Box>
        <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <Paper sx={{ p: 2, minHeight: 350 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, height: '100%' }}>
              {[
                {
                  title: mesSelecionado ? `Comparativo Mensal (${mesSelecionado}/${anoSelecionado})` : `Comparativo do mês atual`,
                  categoria: mesSelecionado || 'Mês',
                  receitas: totalReceitasMes,
                  despesas: totalDespesasConsolidadasMes,
                },
                {
                  title: `Comparativo Acumulado (${anoSelecionado})`,
                  categoria: `Ano ${anoSelecionado}`,
                  receitas: totalReceitasAno,
                  despesas: totalDespesasConsolidadasAno,
                },
              ].map((bloco) => (
                <Box key={bloco.title} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {bloco.title}
                  </Typography>
                  <Suspense fallback={<CircularProgress />}>
                    <Chart
                      options={{
                        chart: { type: 'bar', toolbar: { show: false } },
                        plotOptions: { bar: { horizontal: false, columnWidth: '48%', borderRadius: 4 } },
                        xaxis: { categories: [bloco.categoria] },
                        yaxis: {
                          title: { text: 'Valor (R$)' },
                          labels: { formatter: (val: number) => formatCurrency(val) },
                        },
                        dataLabels: { enabled: false },
                        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                        colors: ['#4caf50', '#f44336'],
                        legend: { position: 'top' },
                      }}
                      series={[
                        { name: 'Receitas', data: [bloco.receitas] },
                        { name: 'Despesas (custeio + investimento)', data: [bloco.despesas] },
                      ]}
                      type="bar"
                      height={300}
                      width="100%"
                    />
                  </Suspense>
                </Box>
              ))}
            </Box>
          </Paper>
          <TableContainer
            component={Paper}
            sx={{
              minHeight: 280,
              maxHeight: 420,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ flexShrink: 0, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {mesSelecionado
                    ? `Detalhamento de ${mesSelecionado}/${anoSelecionado}`
                    : `Detalhamento de ${anoSelecionado}`}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: { xs: 110, sm: 120 } }}>
                    <InputLabel sx={{ fontSize: '0.8rem' }}>Tipo</InputLabel>
                    <Select
                      label="Tipo"
                      value={tipoDetalhamento}
                      onChange={(e) => onTipoDetalhamentoChange(e.target.value as 'receitas' | 'despesas')}
                      sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.75 } }}
                    >
                      <MenuItem value="receitas" sx={{ fontSize: '0.8rem' }}>Receitas</MenuItem>
                      <MenuItem value="despesas" sx={{ fontSize: '0.8rem' }}>Despesas</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              className="detalhamentoDashboard"
            >
              {tipoDetalhamento === 'receitas'
                ? (() => {
                    const porCentros = receitasPorCentros;
                    const baseRows = [...porCentros].map((item) => ({
                      descricao: item.descricao,
                      valorAbs: Math.abs(Number(item.valor) || 0),
                      conciliado: !!item.conciliado,
                      tipoMovimento: 'C' as const,
                    }));
                    const ordenado = [...baseRows].sort((a, b) => b.valorAbs - a.valorAbs);
                    const totalBasePct = Math.max(Number(totalReceitasMes) || 0, 1e-9);
                    if ((Number(totalReceitasMes) || 0) <= 0 && ordenado.length === 0) {
                      return (
                        <NoData
                          message={
                            mesSelecionado
                              ? `Nenhuma receita no período ${mesSelecionado}/${anoSelecionado}.`
                              : `Nenhuma receita em ${anoSelecionado}.`
                          }
                        />
                      );
                    }
                    const concFoot = ordenado.filter((r) => r.conciliado).reduce((s, r) => s + r.valorAbs, 0);
                    const semFoot = ordenado.filter((r) => !r.conciliado).reduce((s, r) => s + r.valorAbs, 0);
                    return (
                      <>
                        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                          <Table
                            stickyHeader
                            size="small"
                            sx={{
                              minWidth: 320,
                              '& .MuiTableCell-root': {
                                py: 0.4,
                                px: 1,
                                fontSize: '0.75rem',
                                lineHeight: 1.25,
                              },
                              '& .MuiTableCell-head': {
                                py: 0.5,
                                fontSize: '0.72rem',
                              },
                            }}
                          >
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, width: 48 }}>Ranking</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Nome</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, width: 64 }}>
                                  %
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>
                                  Valor
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {ordenado.map((item, idx) => (
                                <TableRow key={`rec-${tipoDetalhamento}-${idx}-${item.descricao}`} hover>
                                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{idx + 1}</TableCell>
                                  <TableCell
                                    title={item.descricao}
                                    sx={{
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: { xs: 140, sm: 200 },
                                    }}
                                  >
                                    {item.descricao}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {totalBasePct > 0 ? ((item.valorAbs / totalBasePct) * 100).toFixed(1) : '0.0'}%
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'success.main' }}>
                                    {formatCurrency(item.valorAbs)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                        {ordenado.length > 0 && (
                          <Box
                            sx={{
                              flexShrink: 0,
                              px: 1.5,
                              py: 0.75,
                              borderTop: 1,
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                              boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
                              textAlign: 'center',
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
                            >
                              <span><strong className="text-green-500">Conciliado:</strong> {formatCurrency(concFoot)}</span>
                              <span className="text-gray-500">|</span>
                              <span><strong className="text-orange-500">Sem Conciliar:</strong> {formatCurrency(semFoot)}</span>
                            </Typography>
                          </Box>
                        )}
                      </>
                    );
                  })()
                : despesasAgrupado.length > 0
                  ? (() => {
                      const totalBasePct = Math.max(Number(totalDespesasConsolidadasMes) || 0, 1e-9);
                      const ordenado = [...despesasAgrupado]
                        .map((item) => ({
                          descricao: item.descricao,
                          valorAbs: Math.abs(Number(item.valor) || 0),
                          pct: totalBasePct > 0 ? (Math.abs(Number(item.valor)) / totalBasePct) * 100 : 0,
                          conciliado: !!item.conciliado,
                          tipoMovimento: item.tipoMovimento,
                        }))
                        .sort((a, b) => b.valorAbs - a.valorAbs);
                      const concFoot = ordenado.filter((r) => r.conciliado).reduce((s, r) => s + r.valorAbs, 0);
                      const semFoot = ordenado.filter((r) => !r.conciliado).reduce((s, r) => s + r.valorAbs, 0);
                      return (
                        <>
                          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                            <Table
                              stickyHeader
                              size="small"
                              sx={{
                                minWidth: 320,
                                '& .MuiTableCell-root': {
                                  py: 0.4,
                                  px: 1,
                                  fontSize: '0.75rem',
                                  lineHeight: 1.25,
                                },
                                '& .MuiTableCell-head': {
                                  py: 0.5,
                                  fontSize: '0.72rem',
                                },
                              }}
                            >
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700, width: 48 }}>Ranking</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Nome</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, width: 64 }}>
                                    %
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, minWidth: 100 }}>
                                    Valor
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {ordenado.map((item, idx) => (
                                  <TableRow key={`desp-${idx}-${item.descricao}`} hover>
                                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{idx + 1}</TableCell>
                                    <TableCell
                                      title={item.descricao}
                                      sx={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: { xs: 140, sm: 200 },
                                      }}
                                    >
                                      {item.descricao}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                      {item.pct.toFixed(1)}%
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>
                                      {formatCurrency(-item.valorAbs)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                          {ordenado.length > 0 && (
                            <Box
                              sx={{
                                flexShrink: 0,
                                px: 1.5,
                                py: 0.75,
                                borderTop: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
                                textAlign: 'center',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
                              >
                                <span><strong className="text-green-500">Conciliado:</strong> {formatCurrency(concFoot)}</span>
                                <span className="text-gray-500">|</span>
                                <span><strong className="text-orange-500">Sem Conciliar:</strong> {formatCurrency(semFoot)}</span>
                              </Typography>
                            </Box>
                          )}
                        </>
                      );
                    })()
                  : (
                      <NoData
                        message={
                          mesSelecionado
                            ? `Nenhuma despesa agrupada para ${mesSelecionado}/${anoSelecionado}.`
                            : `Nenhuma despesa agrupada para ${anoSelecionado}.`
                        }
                      />
                    )}
            </Box>
          </TableContainer>
        </Box>
      </Box>
      </Box>
    </>
  );
};

export default ReceitasDespesasTab;

