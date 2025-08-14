import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Skeleton,
  Autocomplete,
  TextField
} from "@mui/material";
import BreadCrumb from "../../components/BreadCrumb";
import { getDashboardData, DashboardData, getParcelasAVencer, getContratosLiquidados, getContratosNovos, ParcelasAVencer, ContratosLiquidados, ContratosNovos } from "../../services/dashboardService";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SavingsIcon from '@mui/icons-material/Savings';
import PaidIcon from '@mui/icons-material/Paid';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import * as XLSX from 'xlsx';
import { getContasCorrentes, ContaCorrente } from '../../services/contaCorrenteService';

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

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const mesAtual = new Date().getMonth();
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mesAtual];
  });
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("");
  const [tomadorSelecionado, setTomadorSelecionado] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'parcelas-vencer' | 'contratos-liquidados' | 'contratos-novos'>('parcelas-vencer');
  const [parcelasAVencer, setParcelasAVencer] = useState<ParcelasAVencer | null>(null);
  const [contratosLiquidados, setContratosLiquidados] = useState<ContratosLiquidados | null>(null);
  const [contratosNovos, setContratosNovos] = useState<ContratosNovos | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totaisAno: {
      receitas: 0,
      despesas: 0,
      investimentos: 0,
      financiamentos: {
        contratosAtivos: 0,
        totalFinanciado: 0,
        totalQuitado: 0,
        totalEmAberto: 0
      }
    },
    receitasDespesasPorMes: {
      labels: [],
      receitas: [],
      despesas: []
    },
    investimentosPorMes: {
      labels: [],
      values: []
    },
    financiamentosPorMes: {
      labels: [],
      quitado: [],
      emAberto: []
    },
    financiamentosPorCredor: {
      labels: [],
      values: [],
      quitados: [],
      emAberto: [],
      detalhamento: []
    },
    financiamentos: {
      porFaixaJuros: [],
      porBanco: []
    },
    parcelasFinanciamento: {
      labels: [],
      pagas: [],
      vencidas: [],
      totalPagas: 0,
      totalVencidas: 0,
      detalhes: []
    },
    receitasDespesas: {
      receitas: [],
      despesas: [],
      detalhamento: []
    }
  });
  const [contas, setContas] = useState<ContaCorrente[]>([]);
  const [contasSelecionadas, setContasSelecionadas] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContas = async () => {
      try {
        const contasData = await getContasCorrentes();
        setContas(contasData);
        if (contasData.length > 0) {
          setContasSelecionadas(contasData.map(c => c.id));
        }
      } catch (err) {
        setError('Erro ao carregar contas correntes');
        console.error(err);
      }
    };

    fetchContas();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Busca dados do ano para o gráfico
        const dashboardDataAno = await getDashboardData(anoSelecionado);
        // Busca detalhamento filtrando mês se houver
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;
        const dashboardDataDetalhe = await getDashboardData(anoSelecionado, mesParam);

        // Junta os dados: gráfico do ano, detalhamento do mês/ano
        setDashboardData({
          ...dashboardDataAno,
          receitasDespesas: dashboardDataDetalhe.receitasDespesas
        });
      } catch (err) {
        setError('Erro ao carregar dados do dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [anoSelecionado, mesSelecionado]);

  // Novo useEffect para carregar dados dos filtros rápidos
  useEffect(() => {
    const fetchFiltrosRapidos = async () => {
      try {
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;

        // Carregar dados baseado na aba ativa
        switch (activeTab) {
          case 'parcelas-vencer':
            const parcelasData = await getParcelasAVencer(anoSelecionado, mesParam);
            setParcelasAVencer(parcelasData);
            break;
          case 'contratos-liquidados':
            const liquidadosData = await getContratosLiquidados(anoSelecionado, mesParam);
            setContratosLiquidados(liquidadosData);
            break;
          case 'contratos-novos':
            const novosData = await getContratosNovos(anoSelecionado, mesParam);
            setContratosNovos(novosData);
            break;
        }
      } catch (err) {
        console.error('Erro ao carregar filtros rápidos:', err);
      }
    };

    fetchFiltrosRapidos();
  }, [activeTab, anoSelecionado, mesSelecionado]);

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // Filtros inteligentes
  const bancosDisponiveis: any[] = [];

  const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;

  const totalReceitasAno = dashboardData?.receitasDespesasPorMes.receitas.reduce((a: number, b: number) => a + (b || 0), 0) || 0;
  const totalDespesasAno = dashboardData?.receitasDespesasPorMes.despesas.reduce((a: number, b: number) => a + (b || 0), 0) || 0;
  const totalInvestimentosAno = dashboardData?.investimentosPorMes.values.reduce((a: number, b: number) => a + (b || 0), 0) || 0;
  const totalFinanciamentosAno = dashboardData?.totaisAno?.financiamentos?.totalFinanciado || 0;

  const totalReceitasMes = mesIdx >= 0 ? (dashboardData?.receitasDespesasPorMes.receitas[mesIdx] || 0) : totalReceitasAno;
  const totalDespesasMes = mesIdx >= 0 ? (dashboardData?.receitasDespesasPorMes.despesas[mesIdx] || 0) : totalDespesasAno;
  const totalInvestimentosMes = mesIdx >= 0 ? (dashboardData?.investimentosPorMes.values[mesIdx] || 0) : totalInvestimentosAno;
  const totalFinanciamentosMes = mesIdx >= 0 ? (dashboardData?.financiamentosPorMes?.emAberto?.[mesIdx] || 0) : totalFinanciamentosAno;

  // Gráficos
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
  const financiamentosJurosOptions = {
    chart: { type: "pie" },
    labels: dashboardData?.financiamentos?.porFaixaJuros?.map(f => f.faixa) || [],
    responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: "bottom" } } }],
    tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
  };
  const parcelasFinanciamentoOptions = {
    chart: { type: 'bar', stacked: true },
    xaxis: { categories: dashboardData?.parcelasFinanciamento?.labels || [] },
    yaxis: { title: { text: "Valor (R$)" } },
    tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
  };

  const handleAnoChange = (event: any) => {
    setAnoSelecionado(Number(event.target.value));
  };

  if (loading) {
    return (
      <div style={{width: '100%'}}>
        <BreadCrumb pagina="Dashboard" />
        <Box sx={{ mt: 4 }}>
          <Skeleton variant="rectangular" height={60} sx={{ mb: 3, borderRadius: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={90} sx={{ borderRadius: 3 }} />)}
          </Box>
          <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 3, mb: 3 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3, mb: 3 }} />
        </Box>
      </div>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const receitasDespesasData = dashboardData?.receitasDespesasPorMes?.labels?.map((label, index) => ({
    mes: label,
    receitas: dashboardData?.receitasDespesasPorMes?.receitas?.[index] || 0,
    despesas: dashboardData?.receitasDespesasPorMes?.despesas?.[index] || 0,
  })) || [];

  const investimentosData = dashboardData?.investimentosPorMes?.labels?.map((label, index) => ({
    mes: label,
    valor: dashboardData?.investimentosPorMes?.values?.[index] || 0,
  })) || [];

  const financiamentosData = dashboardData?.financiamentosPorMes?.labels?.map((label, index) => ({
    mes: label,
    quitado: dashboardData?.financiamentosPorMes?.quitado?.[index] || 0,
    emAberto: dashboardData?.financiamentosPorMes?.emAberto?.[index] || 0,
  })) || [];

  return (
    <div style={{width: '100%'}}>
      <BreadCrumb pagina="Dashboard" />
      <Box sx={{ flexGrow: 1, mt: 3 }}>
        {/* Filtros Modernos */}
        <Box component={Paper} elevation={2} sx={{
          px: 2,
          py: 1,
          mb: 4,
          borderRadius: 3,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          position: 'sticky',
          top: 16,
          zIndex: 10,
          background: '#f9f9f9',
        }}>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Ano</InputLabel>
            <Select value={anoSelecionado} sx={{backgroundColor: 'white'}} label="Ano" onChange={handleAnoChange}>
              {[2020, 2021, 2022, 2023, 2024, 2025].map(ano => (
                <MenuItem key={ano} value={ano}>{ano}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Mês</InputLabel>
            <Select value={mesSelecionado} label="Mês" sx={{backgroundColor: 'white'}} onChange={e => setMesSelecionado(e.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map(mes => (
                <MenuItem key={mes} value={mes}>{mes}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Autocomplete
            options={bancosDisponiveis}
            getOptionLabel={option => option.nome}
            value={bancosDisponiveis.find(b => b.nome === bancoSelecionado) || null}
            onChange={(_, newValue) => setBancoSelecionado(newValue ? newValue.nome : "")}
            renderInput={params => <TextField {...params} label="Banco" size="small" sx={{backgroundColor: 'white'}} />}
            sx={{ minWidth: 180 }}
            disabled={!bancosDisponiveis.length}
            clearOnEscape
          />
          <Button variant="outlined" color="inherit" onClick={() => {
            setAnoSelecionado(new Date().getFullYear());
            setMesSelecionado("");
            setBancoSelecionado("");
          }}>
            Limpar filtros
          </Button>
        </Box>

        {/* Cards de Totais */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 4 }}>
          <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
            <Box >
              <Typography variant="subtitle2">Total de Receitas</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
                {formatCurrency(totalReceitasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Total Anual: {formatCurrency(totalReceitasAno)})</span></Typography>
              </Typography>
            </Box>
            <TrendingUpIcon color="success" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
            <Box>
              <Typography variant="subtitle2">Total de Despesas</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
                {formatCurrency(totalDespesasMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Total Anual: {formatCurrency(totalDespesasAno)})</span></Typography>
              </Typography>
            </Box>
            <TrendingDownIcon color="error" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
            <Box>
              <Typography variant="subtitle2">Total Investido</Typography>
              <Typography variant="h5" fontWeight="bold" color="info.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
                {formatCurrency(totalInvestimentosMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Total Anual: {formatCurrency(totalInvestimentosAno)})</span></Typography>
              </Typography>
            </Box>
            <SavingsIcon color="info" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={3} sx={{ border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } }}>
            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'start', height: '100%', gap:1}}>
              <Typography variant="subtitle2">Total Financiado</Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main" sx={{display: 'flex', flexDirection: 'column', alignItems: 'start'}}>
                {formatCurrency(totalFinanciamentosMes)} <Typography variant="caption" color="text.secondary"> <span style={{fontSize: '12px', marginLeft: '4px'}}> (Total Anual: {formatCurrency(totalFinanciamentosAno)})</span></Typography>
              </Typography>
            </Box>
            <PaidIcon color="warning" sx={{ fontSize: 48 }} />
          </Paper>
        </Box>

        {/* Seção de Receitas e Despesas */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Análise de Receitas e Despesas - {anoSelecionado}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportToExcel(dashboardData?.receitasDespesas?.detalhamento || [], 'receitas_despesas')}
              disabled={!dashboardData?.receitasDespesas?.detalhamento?.length}
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
            <TableContainer component={Paper} sx={{ minHeight: 350, maxHeight:400, display: 'flex', flexDirection: 'column', justifyContent: 'start' }}>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {mesSelecionado
                    ? `Detalhamento de ${mesSelecionado}/${anoSelecionado}`
                    : `Detalhamento de ${anoSelecionado}`}
                </Typography>
              </Box>
              {dashboardData?.receitasDespesas?.detalhamento?.length ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Descrição</TableCell>
                      <TableCell>Valor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData?.receitasDespesas?.detalhamento?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              color: item.valor >= 0 ? 'success.main' : 'error.main',
                              fontWeight: 'bold'
                            }}
                          >
                            {formatCurrency(item.valor)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <NoData message={
                  mesSelecionado
                    ? `Nenhum movimento encontrado para ${mesSelecionado}/${anoSelecionado}.`
                    : `Nenhum movimento encontrado para ${anoSelecionado}.`
                } />
              )}
            </TableContainer>
          </Box>
        </Box>

        {/* Nova Seção: Parcelas de Financiamento */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Parcelas de Financiamentos (Pagas x Vencidas)</Typography>
          <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
            <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {dashboardData?.parcelasFinanciamento?.labels?.length ? (
                <Suspense fallback={<CircularProgress />}>
                  <Chart
                    options={parcelasFinanciamentoOptions}
                    series={[
                      { name: "Pagas", data: dashboardData?.parcelasFinanciamento?.pagas || [] },
                      { name: "Vencidas", data: dashboardData?.parcelasFinanciamento?.vencidas || [] }
                    ]}
                    type="bar"
                    height={350}
                    style={{width: '100%'}}
                  />
                </Suspense>
              ) : (
                <NoData message="Nenhuma parcela encontrada para o filtro selecionado." />
              )}
            </Paper>
            <Paper sx={{ p: 2, minHeight: 350, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <Typography variant="subtitle1" color="success.main" sx={{ mb: 2 }}>
                Total Pago: {formatCurrency(dashboardData?.parcelasFinanciamento?.totalPagas || 0)}
              </Typography>
              <Typography variant="subtitle1" color="error.main">
                Total Pendente: {formatCurrency(dashboardData?.parcelasFinanciamento?.totalVencidas || 0)}
              </Typography>
            </Paper>
          </Box>
          {/* Tabela detalhada de parcelas */}
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            {dashboardData?.parcelasFinanciamento?.detalhes?.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mês</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboardData?.parcelasFinanciamento?.detalhes?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.mes}</TableCell>
                      <TableCell>{formatCurrency(item.valor)}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <NoData message="Nenhum detalhamento de parcela encontrado." />
            )}
          </TableContainer>
        </Box>

        {/* Seção de Financiamentos */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Financiamentos</Typography>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportToExcel(dashboardData?.financiamentosPorCredor?.detalhamento || [], 'financiamentos')}
              disabled={!dashboardData?.financiamentosPorCredor?.detalhamento?.length}
            >
              Exportar Excel
            </Button>
          </Box>
          <Divider sx={{ mb: 2, bgcolor: 'grey.200', height: 2, border: 'none' }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'start', justifyContent: 'start' }}>
              {dashboardData?.financiamentos?.porFaixaJuros?.length ? (
                <Suspense fallback={<CircularProgress />}>
                  <Chart
                    options={financiamentosJurosOptions}
                    series={dashboardData?.financiamentos?.porFaixaJuros?.map(f => f.valor) || []}
                    type="pie"
                    height={350}
                    style={{width: '100%'}}
                  />
                </Suspense>
              ) : (
                <NoData icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />} message="Nenhum financiamento por faixa de juros encontrado." />
              )}
            </Paper>
            <Paper sx={{ p: 2, minHeight: 350, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {dashboardData?.financiamentos?.porBanco?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Banco</TableCell>
                        <TableCell>Total</TableCell>
                        <TableCell>Com Garantia</TableCell>
                        <TableCell>Sem Garantia</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboardData?.financiamentos?.porBanco?.map((banco, index) => (
                        <TableRow key={index}>
                          <TableCell>{banco.nome}</TableCell>
                          <TableCell>{formatCurrency(banco.total)}</TableCell>
                          <TableCell>{formatCurrency(banco.comGarantia)}</TableCell>
                          <TableCell>{formatCurrency(banco.semGarantia)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <NoData icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />} message="Nenhum financiamento por banco encontrado." />
              )}
            </Paper>
          </Box>
        </Box>

        {/* Nova Seção: Filtros Rápidos de Financiamentos */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Filtros Rápidos de Financiamentos</Typography>
          
          {/* Abas para os diferentes filtros */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant={activeTab === 'parcelas-vencer' ? 'contained' : 'outlined'}
                onClick={() => setActiveTab('parcelas-vencer')}
                startIcon={<TrendingUpIcon />}
              >
                Parcelas a Vencer
              </Button>
              <Button 
                variant={activeTab === 'contratos-liquidados' ? 'contained' : 'outlined'}
                onClick={() => setActiveTab('contratos-liquidados')}
                startIcon={<PaidIcon />}
              >
                Contratos Liquidados
              </Button>
              <Button 
                variant={activeTab === 'contratos-novos' ? 'contained' : 'outlined'}
                onClick={() => setActiveTab('contratos-novos')}
                startIcon={<InsertChartOutlinedIcon />}
              >
                Contratos Novos
              </Button>
            </Box>
          </Box>

          {/* Conteúdo das abas */}
          {activeTab === 'parcelas-vencer' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Parcelas a Vencer - Total: {formatCurrency(parcelasAVencer?.totalVencimento || 0)}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={() => {
                    const dadosParaExportar = parcelasAVencer?.detalhes?.flatMap(item => 
                      item.financiamentos.map(fin => ({
                        'Mês/Ano': item.mes,
                        'Contrato': fin.contrato,
                        'Tomador': fin.tomador,
                        'Banco': fin.banco,
                        'Valor': fin.valor,
                        'Vencimento': fin.vencimento,
                        'Modalidade': fin.modalidade,
                        'Taxa de Juros (%)': fin.taxaJuros,
                        'Garantia': fin.garantia
                      }))
                    ) || [];
                    exportToExcel(dadosParaExportar, 'parcelas_a_vencer');
                  }}
                  disabled={!parcelasAVencer?.detalhes?.length}
                >
                  Exportar Excel
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
                <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {parcelasAVencer?.labels?.length ? (
                    <Suspense fallback={<CircularProgress />}>
                      <Chart
                        options={{
                          chart: { type: 'bar', height: 350 },
                          xaxis: { categories: parcelasAVencer.labels },
                          yaxis: { title: { text: "Valor (R$)" } },
                          tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                          colors: ['#ff9800']
                        }}
                        series={[{ name: "Valor a Vencer", data: parcelasAVencer.valores }]}
                        type="bar"
                        height={350}
                        style={{width: '100%'}}
                      />
                    </Suspense>
                  ) : (
                    <NoData message="Nenhuma parcela a vencer encontrada." />
                  )}
                </Paper>
                <TableContainer component={Paper} sx={{ minHeight: 350, maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mês/Ano</TableCell>
                        <TableCell>Valor</TableCell>
                        <TableCell>Qtd</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parcelasAVencer?.detalhes?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.mes}</TableCell>
                          <TableCell>{formatCurrency(item.valor)}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}

          {activeTab === 'contratos-liquidados' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Contratos Liquidados - Total: {formatCurrency(contratosLiquidados?.totalLiquidado || 0)}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={() => {
                    const dadosParaExportar = contratosLiquidados?.detalhes?.flatMap(item => 
                      item.contratos.map(contr => ({
                        'Mês/Ano': item.mes,
                        'Contrato': contr.numero,
                        'Tomador': contr.tomador,
                        'Banco': contr.banco,
                        'Valor': contr.valor,
                        'Data Liquidação': contr.dataLiquidacao,
                        'Modalidade': contr.modalidade,
                        'Taxa de Juros (%)': contr.taxaJuros,
                        'Garantia': contr.garantia
                      }))
                    ) || [];
                    exportToExcel(dadosParaExportar, 'contratos_liquidados');
                  }}
                  disabled={!contratosLiquidados?.detalhes?.length}
                >
                  Exportar Excel
                </Button>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
                <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {contratosLiquidados?.labels?.length ? (
                    <Suspense fallback={<CircularProgress />}>
                      <Chart
                        options={{
                          chart: { type: 'bar', height: 350 },
                          xaxis: { categories: contratosLiquidados.labels },
                          yaxis: { title: { text: "Valor (R$)" } },
                          tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                          colors: ['#4caf50']
                        }}
                        series={[{ name: "Valor Liquidado", data: contratosLiquidados.valores }]}
                        type="bar"
                        height={350}
                        style={{width: '100%'}}
                      />
                    </Suspense>
                  ) : (
                    <NoData message="Nenhum contrato liquidado encontrado." />
                  )}
                </Paper>
                <TableContainer component={Paper} sx={{ minHeight: 350, maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mês/Ano</TableCell>
                        <TableCell>Valor</TableCell>
                        <TableCell>Qtd</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contratosLiquidados?.detalhes?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.mes}</TableCell>
                          <TableCell>{formatCurrency(item.valor)}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}

          {activeTab === 'contratos-novos' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Contratos Novos - Total: {formatCurrency(contratosNovos?.totalNovos || 0)}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={() => {
                    const dadosParaExportar = contratosNovos?.detalhes?.flatMap(item => 
                      item.contratos.map(contr => ({
                        'Mês/Ano': item.mes,
                        'Contrato': contr.numero,
                        'Tomador': contr.tomador,
                        'Banco': contr.banco,
                        'Valor': contr.valor,
                        'Data Contrato': contr.dataContrato,
                        'Modalidade': contr.modalidade,
                        'Taxa de Juros (%)': contr.taxaJuros,
                        'Garantia': contr.garantia,
                        'Número de Parcelas': contr.numeroParcelas
                      }))
                    ) || [];
                    exportToExcel(dadosParaExportar, 'contratos_novos');
                  }}
                  disabled={!contratosNovos?.detalhes?.length}
                >
                  Exportar Excel
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
                <Paper sx={{ p: 2, minHeight: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {contratosNovos?.labels?.length ? (
                    <Suspense fallback={<CircularProgress />}>
                      <Chart
                        options={{
                          chart: { type: 'bar', height: 350 },
                          xaxis: { categories: contratosNovos.labels },
                          yaxis: { title: { text: "Valor (R$)" } },
                          tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                          colors: ['#2196f3']
                        }}
                        series={[{ name: "Valor dos Contratos", data: contratosNovos.valores }]}
                        type="bar"
                        height={350}
                        style={{width: '100%'}}
                      />
                    </Suspense>
                  ) : (
                    <NoData message="Nenhum contrato novo encontrado." />
                  )}
                </Paper>
                <TableContainer component={Paper} sx={{ minHeight: 350, maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mês/Ano</TableCell>
                        <TableCell>Valor</TableCell>
                        <TableCell>Qtd</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contratosNovos?.detalhes?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.mes}</TableCell>
                          <TableCell>{formatCurrency(item.valor)}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </div>
  );
};

export default Dashboard;
