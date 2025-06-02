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
  Card,
  CardContent,
} from "@mui/material";
import BreadCrumb from "../../components/BreadCrumb";
import { getDashboardData, DashboardData } from "../../services/dashboardService";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SavingsIcon from '@mui/icons-material/Savings';
import PaidIcon from '@mui/icons-material/Paid';

// Importação dinâmica do ApexCharts para evitar problemas de SSR
const Chart = lazy(() => import("react-apexcharts"));

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getDashboardData(anoSelecionado);
        setDashboardData(data);
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [anoSelecionado]);

  // Configuração do gráfico de Receitas e Despesas
  const receitasDespesasOptions = {
    chart: {
      type: "bar",
      height: 350,
      stacked: false,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        endingShape: "rounded",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    },
    yaxis: {
      title: {
        text: "Valor (R$)",
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
    },
  };

  // Configuração do gráfico de Investimentos
  const investimentosOptions = {
    chart: {
      type: "area",
      height: 350,
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
    },
    xaxis: {
      categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    },
    yaxis: {
      title: {
        text: "Valor Investido (R$)",
      },
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
    },
  };

  // Configuração do gráfico de Financiamentos
  const financiamentosOptions = {
    chart: {
      type: "bar",
      height: 350,
      stacked: true,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        endingShape: "rounded",
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    },
    yaxis: {
      title: {
        text: "Valor (R$)",
      },
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
    },
  };

  // Configuração do gráfico de Financiamentos por Credor
  const financiamentosCredorOptions = {
    chart: {
      type: "pie",
    },
    labels: dashboardData?.financiamentosPorCredor.labels || [],
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          position: "bottom"
        }
      }
    }],
    tooltip: {
      y: {
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
    },
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <BreadCrumb pagina="Dashboard" />
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <BreadCrumb pagina="Dashboard" />
      
      <Box sx={{ flexGrow: 1, mt: 3 }}>
        {/* Filtro de Ano */}
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Ano</InputLabel>
            <Select
              value={anoSelecionado}
              label="Ano"
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
            >
              {[2020, 2021, 2022, 2023, 2024, 2025].map((ano) => (
                <MenuItem key={ano} value={ano}>
                  {ano}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Cards de Totais */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 4 }}>
          <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography variant="subtitle2">Total de Receitas</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{formatCurrency(dashboardData?.totais.receitas || 0)}</Typography>
            </Box>
            <TrendingUpIcon color="success" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography variant="subtitle2">Total de Despesas</Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">{formatCurrency(dashboardData?.totais.despesas || 0)}</Typography>
            </Box>
            <TrendingDownIcon color="error" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography variant="subtitle2">Total Investido</Typography>
              <Typography variant="h5" fontWeight="bold" color="info.main">{formatCurrency(dashboardData?.totais.investimentos || 0)}</Typography>
            </Box>
            <SavingsIcon color="info" sx={{ fontSize: 48 }} />
          </Paper>
          <Paper elevation={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography variant="subtitle2">Contratos Ativos</Typography>
              <Typography variant="h5" fontWeight="bold">{dashboardData?.totais.financiamentos.contratosAtivos || 0}</Typography>
            </Box>
            <PaidIcon color="warning" sx={{ fontSize: 48 }} />
          </Paper>
        </Box>

        {/* Seção de Receitas e Despesas */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Análise Anual de Receitas e Despesas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Melhor mês: {/* lógica para melhor mês */}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Paper sx={{ p: 2 }}>
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={{
                  ...receitasDespesasOptions,
                  xaxis: { categories: dashboardData?.receitasDespesas.labels || [] },
                }}
                series={[
                  {
                    name: "Receitas",
                    data: dashboardData?.receitasDespesas.receitas || [],
                  },
                  {
                    name: "Despesas",
                    data: dashboardData?.receitasDespesas.despesas || [],
                  },
                ]}
                type="bar"
                height={350}
              />
            </Suspense>
          </Paper>
        </Box>

        {/* Seção de Investimentos */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Investimentos Mensais
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Acumulado: {formatCurrency((dashboardData?.investimentos.values || []).reduce((a, b) => a + b, 0))}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Paper sx={{ p: 2 }}>
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={{
                  ...investimentosOptions,
                  xaxis: { categories: dashboardData?.investimentos.labels || [] },
                }}
                series={[{
                  name: "Investimentos",
                  data: dashboardData?.investimentos.values || [],
                }]}
                type="area"
                height={350}
              />
            </Suspense>
          </Paper>
        </Box>

        {/* Seção de Financiamentos */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Financiamentos Mensais
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Quitado: {formatCurrency((dashboardData?.financiamentos.quitado || []).reduce((a, b) => a + b, 0))} | Em Aberto: {formatCurrency((dashboardData?.financiamentos.emAberto || []).reduce((a, b) => a + b, 0))}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Quitado vs Em Aberto
              </Typography>
              <Suspense fallback={<CircularProgress />}>
                <Chart
                  options={{
                    ...financiamentosOptions,
                    xaxis: { categories: dashboardData?.financiamentos.labels || [] },
                  }}
                  series={[
                    {
                      name: "Quitado",
                      data: dashboardData?.financiamentos.quitado || [],
                    },
                    {
                      name: "Em Aberto",
                      data: dashboardData?.financiamentos.emAberto || [],
                    },
                  ]}
                  type="bar"
                  height={350}
                />
              </Suspense>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Por Credor
              </Typography>
              <Suspense fallback={<CircularProgress />}>
                <Chart
                  options={{
                    ...financiamentosCredorOptions,
                    labels: dashboardData?.financiamentosPorCredor.labels || [],
                  }}
                  series={dashboardData?.financiamentosPorCredor.values || []}
                  type="pie"
                  height={350}
                />
              </Suspense>
              {/* Legenda customizada ao lado do gráfico de pizza */}
              <Box sx={{ mt: 2 }}>
                {(dashboardData?.financiamentosPorCredor.labels || []).map((credor, idx) => (
                  <Box key={credor} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'primary.main', borderRadius: '50%', mr: 1 }} />
                    <Typography variant="body2">{credor}: {formatCurrency(dashboardData?.financiamentosPorCredor.values[idx] || 0)}</Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;
