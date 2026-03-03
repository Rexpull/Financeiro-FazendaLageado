import React, { lazy, Suspense } from "react";
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
import PieChartIcon from '@mui/icons-material/PieChart';
import ListIcon from '@mui/icons-material/List';
import * as XLSX from 'xlsx';

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

interface ReceitasDespesasTabProps {
  dashboardData: DashboardData;
  anoSelecionado: number;
  mesSelecionado: string;
  loadingDetalhamento: boolean;
  tipoAgrupamentoDetalhamento: 'planos' | 'centros';
  tipoVisualizacaoDetalhamento: 'lista' | 'pizza';
  onTipoAgrupamentoChange: (value: 'planos' | 'centros') => void;
  onTipoVisualizacaoChange: () => void;
}

const ReceitasDespesasTab: React.FC<ReceitasDespesasTabProps> = ({
  dashboardData,
  anoSelecionado,
  mesSelecionado,
  loadingDetalhamento,
  tipoAgrupamentoDetalhamento,
  tipoVisualizacaoDetalhamento,
  onTipoAgrupamentoChange,
  onTipoVisualizacaoChange,
}) => {
  const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;

  const totalReceitasAno = dashboardData?.receitasDespesasPorMes.receitas.reduce((a: number, b: number) => a + (b || 0), 0) || 0;
  const totalDespesasAno = dashboardData?.receitasDespesasPorMes.despesas.reduce((a: number, b: number) => a + (b || 0), 0) || 0;
  // Garantir que investimentos sejam sempre positivos
  const totalInvestimentosAno = Math.abs(dashboardData?.investimentosPorMes.values.reduce((a: number, b: number) => a + (Math.abs(b) || 0), 0) || 0);

  const totalReceitasMes = mesIdx >= 0 ? (dashboardData?.receitasDespesasPorMes.receitas[mesIdx] || 0) : totalReceitasAno;
  const totalDespesasMes = mesIdx >= 0 ? Math.abs(dashboardData?.receitasDespesasPorMes.despesas[mesIdx] || 0) : Math.abs(totalDespesasAno);
  // Garantir que investimentos sejam sempre positivos
  const totalInvestimentosMes = mesIdx >= 0 ? Math.abs(dashboardData?.investimentosPorMes.values[mesIdx] || 0) : totalInvestimentosAno;
  
  // Calcular despesas operacionais (despesas totais - investimentos)
  // Garantir que ambos sejam positivos para o cálculo
  const despesasOperacionaisMes = Math.max(0, totalDespesasMes - totalInvestimentosMes);
  const despesasOperacionaisAno = Math.max(0, Math.abs(totalDespesasAno) - totalInvestimentosAno);

  const receitasDespesasOptions = {
    chart: { type: "bar", height: 350, stacked: true, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: "55%", endingShape: "rounded" } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: { categories: dashboardData?.receitasDespesasPorMes?.labels || [] },
    yaxis: {
      title: { text: "Valor (R$)" },
      labels: {
        formatter: (val: number) => formatCurrency(val),
        style: { fontSize: '13px' }
      }
    },
    fill: { opacity: 1 },
    tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
    colors: ["#4caf50", "#f44336"],
    legend: { position: 'top' }
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <>
      {/* Cards de Totais */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2, mb: 4 }}>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2">Receitas</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
              {formatCurrency(totalReceitasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalReceitasAno)})</span></Typography>
            </Typography>
          </Box>
          <TrendingUpIcon color="success" sx={{ fontSize: 48 }} />
        </Paper>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2">Despesas</Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
              {formatCurrency(totalDespesasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalDespesasAno)})</span></Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
              Custeio: {formatCurrency(despesasOperacionaisMes)} | Invest.: {formatCurrency(totalInvestimentosMes)}
            </Typography>
          </Box>
          <TrendingDownIcon color="error" sx={{ fontSize: 48 }} />
        </Paper>
        <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
          <Box>
            <Typography variant="subtitle2">Saldo</Typography>
            <Typography variant="h5" fontWeight="bold" color={(totalReceitasMes - totalDespesasMes) >= 0 ? 'success.main' : 'error.main'} sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
              {formatCurrency(totalReceitasMes - totalDespesasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Anual: {formatCurrency(totalReceitasAno - Math.abs(totalDespesasAno))})</span></Typography>
            </Typography>
          </Box>
          <SavingsIcon sx={{ fontSize: 48, color: (totalReceitasMes - totalDespesasMes) >= 0 ? '#4caf50' : '#f44336' }} />
        </Paper>
      </Box>

      

      {/* Nova Seção: Análise Comparativa Receitas vs Despesas */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Análise Comparativa - Receitas e Despesas
        </Typography>
        <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
        
        {/* Layout lado a lado */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
          {/* Lado Esquerdo: Receitas - destaque visual + pizza composição */}
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'success.main', fontSize: '1.35rem' }}>
              Receitas
            </Typography>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {formatCurrency(totalReceitasMes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mesSelecionado ? `Total de ${mesSelecionado}/${anoSelecionado}` : `Total Anual de ${anoSelecionado}`}
                </Typography>
              </Box>
              {totalReceitasMes > 0 && (
                <Box sx={{ textAlign: 'right', borderLeft: '2px solid', borderColor: 'divider', pl: 2, minWidth: '140px' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                    Investimentos sobre Receita
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="info.main">
                    {(totalInvestimentosMes / totalReceitasMes * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                    {formatCurrency(totalInvestimentosMes)}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
              {dashboardData?.receitasDespesas?.agrupadoPor && (() => {
                const receitasAgrupado = dashboardData.receitasDespesas.agrupadoPor.filter((item: any) => item.tipoMovimento === 'C');
                const totalR = receitasAgrupado.reduce((s: number, i: any) => s + i.valor, 0);
                const dadosOrdenados = [...receitasAgrupado].map((item: any) => ({ ...item, percentual: totalR > 0 ? (item.valor / totalR) * 100 : 0 })).sort((a: any, b: any) => b.valor - a.valor);
                if (dadosOrdenados.length === 0) return <NoData message="Nenhum dado de receitas disponível." />;
                return (
                  <Suspense fallback={<CircularProgress />}>
                    <Chart
                      options={{
                        chart: { type: 'pie' },
                        labels: dadosOrdenados.map((item: any) => `${item.percentual.toFixed(1)}% - ${item.descricao}`),
                        legend: { position: 'right', fontSize: '12px' },
                        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                        dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(1)}%` },
                        plotOptions: { pie: { expandOnClick: false } },
                        colors: dadosOrdenados.map(() => '#4caf50'),
                      }}
                      series={dadosOrdenados.map((item: any) => item.valor)}
                      type="pie"
                      height={280}
                      width={380}
                      style={{ maxWidth: '100%' }}
                    />
                  </Suspense>
                );
              })()}
              {!dashboardData?.receitasDespesas?.agrupadoPor?.length && <NoData message="Nenhum dado de receitas disponível." />}
            </Box>
          </Paper>

          {/* Lado Direito: Despesas - destaque visual + pizza composição */}
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'error.main', fontSize: '1.35rem' }}>
              Despesas
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="h4" fontWeight="bold" color="error.main">
                {formatCurrency(totalDespesasMes)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mesSelecionado ? `Total de ${mesSelecionado}/${anoSelecionado}` : `Total Anual de ${anoSelecionado}`}
              </Typography>
            </Box>

            {/* Seção secundária: Custeio e Investimento (menor prioridade visual) */}
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
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Custeio: <strong>{formatCurrency(despesasOperacionaisMes)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>+</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Investimento: <strong>{formatCurrency(totalInvestimentosMes)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>=</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Total: <strong>{formatCurrency(despesasOperacionaisMes + totalInvestimentosMes)}</strong>
              </Typography>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
              {dashboardData?.receitasDespesas?.agrupadoPor && (() => {
                const despesasAgrupado = dashboardData.receitasDespesas.agrupadoPor.filter((item: any) => item.tipoMovimento === 'D');
                const totalD = despesasAgrupado.reduce((s: number, i: any) => s + Math.abs(i.valor), 0);
                const dadosOrdenados = [...despesasAgrupado].map((item: any) => ({ ...item, valorAbs: Math.abs(item.valor), percentual: totalD > 0 ? (Math.abs(item.valor) / totalD) * 100 : 0 })).sort((a: any, b: any) => b.valorAbs - a.valorAbs);
                if (dadosOrdenados.length === 0) return <NoData message="Nenhum dado de despesas disponível." />;
                return (
                  <Suspense fallback={<CircularProgress />}>
                    <Chart
                      options={{
                        chart: { type: 'pie' },
                        labels: dadosOrdenados.map((item: any) => `${item.percentual.toFixed(1)}% - ${item.descricao}`),
                        legend: { position: 'right', fontSize: '12px' },
                        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                        dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(1)}%` },
                        plotOptions: { pie: { expandOnClick: false } },
                        colors: dadosOrdenados.map(() => '#f44336'),
                      }}
                      series={dadosOrdenados.map((item: any) => item.valorAbs)}
                      type="pie"
                      height={280}
                      width={380}
                      style={{ maxWidth: '100%' }}
                    />
                  </Suspense>
                );
              })()}
              {!dashboardData?.receitasDespesas?.agrupadoPor?.length && <NoData message="Nenhum dado de despesas disponível." />}
            </Box>
          </Paper>
        </Box>

        {/* Card único: Saldo Líquido */}
        <Paper elevation={3} sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 3 }}>
          {/* Cálculo do Saldo Líquido */}
          <Box sx={{ 
            p: 2, 
            border: '1px solid #e0e0e0', 
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1
          }}>
            {/* Receitas */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '120px' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                Receitas
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="success.main">
                {formatCurrency(totalReceitasMes)}
              </Typography>
            </Box>

            {/* Ícone de Menos */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>-</Typography>
            </Box>

            {/* Despesas */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '120px' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                Despesas
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="error.main">
                {formatCurrency(totalDespesasMes)}
              </Typography>
              {totalReceitasMes > 0 && (
                <Typography variant="caption" fontWeight="bold" color="error.main" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                  {(totalDespesasMes / totalReceitasMes * 100).toFixed(1)}% sobre receita
                </Typography>
              )}
            </Box>

            {/* Divisor */}
            <Box sx={{ 
              height: '55px', 
              width: '2px', 
              bgcolor: '#bdbdbd', 
              mx: 1,
              display: { xs: 'none', sm: 'block' }
            }} />

            {/* Ícone de Igual */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>=</Typography>
            </Box>

            {/* Saldo Líquido */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '120px' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                Saldo Líquido
              </Typography>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                color={(totalReceitasMes - totalDespesasMes) >= 0 ? 'success.main' : 'error.main'}
                sx={{
                  textDecoration: 'underline',
                  textDecorationThickness: '3px',
                  textDecorationColor: (totalReceitasMes - totalDespesasMes) >= 0 ? '#4caf50' : '#f44336',
                  textUnderlineOffset: '4px',
                }}
              >
                {formatCurrency(totalReceitasMes - totalDespesasMes)}
              </Typography>
              {/* Percentual de Aproveitamento (o que sobrou) */}
              {totalReceitasMes > 0 && (
                <Typography 
                  variant="caption" 
                  fontWeight="bold" 
                  color={(totalReceitasMes - totalDespesasMes) >= 0 ? 'success.main' : 'error.main'}
                  sx={{ fontSize: '0.75rem', mt: 0.5 }}
                >
                  {((totalReceitasMes - totalDespesasMes) / totalReceitasMes * 100).toFixed(1)}% de aproveitamento
                </Typography>
              )}
            </Box>
          </Box>

          
        </Paper>

        {/* Seção de Receitas e Despesas */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Análise de Receitas e Despesas - {anoSelecionado}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => exportToExcel(dashboardData?.receitasDespesas?.detalhamento || [], 'receitas_despesas')}
            disabled={!dashboardData?.receitasDespesas?.detalhamento?.length}
            title="Exporta os dados detalhados para Excel. Para relatórios completos, acesse a seção Relatórios."
          >
            Exportar Excel
          </Button>
        </Box>
        <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={receitasDespesasOptions}
                series={[
                  { name: "Receitas", data: dashboardData?.receitasDespesasPorMes?.receitas || [] },
                  { name: "Despesas", data: (dashboardData?.receitasDespesasPorMes?.despesas || []).map(v => Math.abs(v)) },
                ]}
                type="bar"
                height={350}
                style={{width: '100%'}}
              />
            </Suspense>
          </Paper>
          <TableContainer component={Paper} sx={{ minHeight: 350, maxHeight:400, display: 'flex', flexDirection: 'column', justifyContent: 'start', position: 'relative' }}>
            {loadingDetalhamento && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <CircularProgress />
              </Box>
            )}
            <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {mesSelecionado
                    ? `Detalhamento de ${mesSelecionado}/${anoSelecionado}`
                    : `Detalhamento de ${anoSelecionado}`}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onTipoVisualizacaoChange}
                    sx={{ minWidth: 'auto', height: '40px', px: 1, mr: 1 }}
                    title={tipoVisualizacaoDetalhamento === 'pizza' ? 'Ver como lista' : 'Ver como gráfico'}
                  >
                    {tipoVisualizacaoDetalhamento === 'pizza' ? <ListIcon /> : <PieChartIcon />}
                  </Button>
                  <FormControl size="small" sx={{ minWidth: { xs: 140, sm: 150 } }}>
                    <InputLabel>Agrupamento</InputLabel>
                    <Select 
                      value={tipoAgrupamentoDetalhamento} 
                      label="Agrupamento"
                      onChange={(e) => onTipoAgrupamentoChange(e.target.value as 'planos' | 'centros')}
                    >
                      <MenuItem value="planos">Plano de Contas</MenuItem>
                      <MenuItem value="centros">Centro de Custos</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }} className="detalhamentoDashboard">
              {tipoVisualizacaoDetalhamento === 'lista' ? (
                dashboardData?.receitasDespesas?.agrupadoPor && dashboardData.receitasDespesas.agrupadoPor.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Descrição</TableCell>
                        <TableCell>Valor</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...(dashboardData?.receitasDespesas?.agrupadoPor || [])]
                        .sort((a, b) => b.valor - a.valor)
                        .map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                color: item.tipoMovimento === 'C' ? 'success.main' : 'error.main',
                                fontWeight: 'bold'
                              }}
                            >
                              {formatCurrency(item.tipoMovimento === 'C' ? item.valor : -item.valor)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <NoData message={
                    mesSelecionado
                      ? `Nenhum dado agrupado encontrado para ${mesSelecionado}/${anoSelecionado}.`
                      : `Nenhum dado agrupado encontrado para ${anoSelecionado}.`
                  } />
                )
              ) : (
                dashboardData?.receitasDespesas?.agrupadoPor && dashboardData.receitasDespesas.agrupadoPor.length > 0 ? (
                  <Box sx={{ p: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'center', flex: 1, minHeight: 0 }}>
                    <Suspense fallback={<CircularProgress />}>
                      {(() => {
                        const dadosFiltrados = dashboardData.receitasDespesas.agrupadoPor;
                        const total = dadosFiltrados.reduce((sum, item) => sum + item.valor, 0);
                        
                        // Ordenar por valor (maior primeiro) e calcular percentuais
                        const dadosOrdenados = [...dadosFiltrados]
                          .map(item => ({
                            ...item,
                            percentual: total > 0 ? ((item.valor / total) * 100) : 0
                          }))
                          .sort((a, b) => b.valor - a.valor);
                        
                        return (
                          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Chart
                              key={`pie-chart-${tipoAgrupamentoDetalhamento}-${dadosOrdenados.length}-${total}`}
                              options={{
                                chart: { 
                                  type: 'pie',
                                  width: '100%',
                                  height: '100%'
                                },
                                labels: dadosOrdenados.map(item => {
                                  return `${item.percentual.toFixed(1)}% - ${item.descricao}`;
                                }),
                              
                                legend: {
                                  position: 'right',
                                  fontSize: '12px',
                                  fontFamily: 'inherit',
                                  itemMargin: {
                                    horizontal: 8,
                                    vertical: 3
                                  },

                                  formatter: (seriesName: string) => {
                                    return seriesName;
                                  },
                                  offsetY: 0,
                                  offsetX: 0
                                },
                                
                                tooltip: {
                                  y: {
                                    formatter: (val: number, { seriesIndex }: any) => {
                                      return `${formatCurrency(val)}`;
                                    }
                                  }
                                },
                                dataLabels: {
                                  enabled: true,
                                  formatter: (val: number) => {
                                    return `${val.toFixed(1)}%`;
                                  },
                                  style: {
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    colors: ['#fff']
                                  },
                                  dropShadow: {
                                    enabled: true,
                                    color: '#000',
                                    blur: 3,
                                    opacity: 0.3
                                  }
                                },
                                plotOptions: {
                                  pie: {
                                    expandOnClick: false,
                                    donut: {
                                      size: '0%'
                                    },
                                    customScale: 1
                                  }
                                },
                                colors: dadosOrdenados.map(item => item.tipoMovimento === 'C' ? '#4caf50' : '#f44336')
                              }}
                              series={dadosOrdenados.map(item => item.valor)}
                              type="pie"
                              height={450}
                              width={450}
                            />
                          </Box>
                        );
                      })()}
                    </Suspense>
                  </Box>
                ) : (
                  <NoData message={
                    mesSelecionado
                      ? `Nenhum dado agrupado encontrado para ${mesSelecionado}/${anoSelecionado}.`
                      : `Nenhum dado agrupado encontrado para ${anoSelecionado}.`
                  } />
                )
              )}
            </Box>
            {/* Totalizadores no rodapé */}
            {dashboardData?.receitasDespesas?.agrupadoPor && dashboardData.receitasDespesas.agrupadoPor.length > 0 && (
              <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary" fontSize={'13px'} className="flex items-center justify-between">
                  <span><strong className="text-green-500">Conciliado:</strong> {formatCurrency(Math.abs(dashboardData?.receitasDespesas?.totalConciliado || 0))}</span>
                  <span className="text-gray-500">|</span>
                  <span><strong className="text-orange-500">Sem Conciliar:</strong> {formatCurrency(Math.abs(dashboardData?.receitasDespesas?.totalSemConciliar || 0))}</span>
                </Typography>
              </Box>
            )}
          </TableContainer>
        </Box>
      </Box>
      </Box>
    </>
  );
};

export default ReceitasDespesasTab;

