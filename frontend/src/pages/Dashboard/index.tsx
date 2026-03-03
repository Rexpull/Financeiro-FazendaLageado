import React, { useEffect, useState } from "react";
import {
  Typography,
  Box,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Autocomplete,
  TextField,
  Button,
  Tabs,
  Tab,
} from "@mui/material";
import BreadCrumb from "../../components/BreadCrumb";
import { getDashboardData, DashboardData, getParcelasAVencer, getContratosLiquidados, getContratosNovos, ParcelasAVencer, ContratosLiquidados, ContratosNovos } from "../../services/dashboardService";
import { getContasCorrentes } from '../../services/contaCorrenteService';
import ReceitasDespesasTab from './ReceitasDespesasTab';
import FinanciamentosTab from './FinanciamentosTab';

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const mesAtual = new Date().getMonth();
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mesAtual];
  });
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingDetalhamento, setLoadingDetalhamento] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'receitas-despesas' | 'financiamentos' | 'resultado'>('receitas-despesas');
  const [activeTab, setActiveTab] = useState<'parcelas-vencer' | 'contratos-liquidados' | 'contratos-novos'>('parcelas-vencer');
  const [tipoAgrupamentoDetalhamento, setTipoAgrupamentoDetalhamento] = useState<'planos' | 'centros'>('planos');
  const [tipoVisualizacaoDetalhamento, setTipoVisualizacaoDetalhamento] = useState<'lista' | 'pizza'>('pizza');
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
  const [contasSelecionadas, setContasSelecionadas] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContas = async () => {
      try {
        const contasData = await getContasCorrentes();
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
        const dashboardDataAno = await getDashboardData(anoSelecionado, undefined, contasSelecionadas);
        // Busca detalhamento filtrando mês se houver
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;
        const dashboardDataDetalhe = await getDashboardData(anoSelecionado, mesParam, contasSelecionadas, tipoAgrupamentoDetalhamento);

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
  }, [anoSelecionado, mesSelecionado, contasSelecionadas]);

  // useEffect separado para atualizar apenas o detalhamento quando mudar o agrupamento
  useEffect(() => {
    const fetchDetalhamento = async () => {
      // Não executa no primeiro carregamento (já é feito no useEffect principal)
      if (loading) {
        return;
      }

      setLoadingDetalhamento(true);
      try {
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;
        const dashboardDataDetalhe = await getDashboardData(anoSelecionado, mesParam, contasSelecionadas, tipoAgrupamentoDetalhamento);

        setDashboardData(prev => ({
          ...prev,
          receitasDespesas: dashboardDataDetalhe.receitasDespesas
        }));
      } catch (err) {
        console.error('Erro ao carregar detalhamento:', err);
      } finally {
        setLoadingDetalhamento(false);
      }
    };

    fetchDetalhamento();
  }, [tipoAgrupamentoDetalhamento]);

  // Carregar dados de financiamentos: quando aba Financiamentos está ativa, carregar as três fontes em paralelo para os cards terem dados
  useEffect(() => {
    if (activeDashboardTab !== 'financiamentos') return;

    const fetchFiltrosRapidos = async () => {
      try {
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;

        const [parcelasData, liquidadosData, novosData] = await Promise.all([
          getParcelasAVencer(anoSelecionado, mesParam),
          getContratosLiquidados(anoSelecionado, mesParam),
          getContratosNovos(anoSelecionado, mesParam),
        ]);
        setParcelasAVencer(parcelasData);
        setContratosLiquidados(liquidadosData);
        setContratosNovos(novosData);
      } catch (err) {
        console.error('Erro ao carregar filtros rápidos:', err);
      }
    };

    fetchFiltrosRapidos();
  }, [activeDashboardTab, anoSelecionado, mesSelecionado]);

  // Filtros inteligentes
  const bancosDisponiveis: any[] = [];

  const handleAnoChange = (event: any) => {
    setAnoSelecionado(Number(event.target.value));
  };

  const handleDashboardTabChange = (event: React.SyntheticEvent, newValue: 'receitas-despesas' | 'financiamentos' | 'resultado') => {
    setActiveDashboardTab(newValue);
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

  return (
    <div style={{width: '100%'}}>
      <BreadCrumb pagina="Dashboard" />
      <Box sx={{ flexGrow: 1, mt: 3 }}>
        {/* Sistema de Abas e Filtros */}
        <Box sx={{ 
          mb: 3, 
          display: 'flex',
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: 1, 
          borderColor: 'divider',
          
        }}>
          <Tabs value={activeDashboardTab} onChange={handleDashboardTabChange} sx={{ borderBottom: 'none' }}>
            <Tab label="Receitas e Despesas" value="receitas-despesas" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Financiamentos" value="financiamentos" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Resultado Consolidado" value="resultado" sx={{ fontWeight: 'bold !important' }}/>
          </Tabs>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', pb: 1 }}>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Ano</InputLabel>
            <Select value={anoSelecionado} sx={{backgroundColor: 'white'}} label="Ano" onChange={handleAnoChange}>
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(ano => (
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
            <Button variant="outlined" color="inherit" size="small" onClick={() => {
            setAnoSelecionado(new Date().getFullYear());
            setMesSelecionado("");
            setBancoSelecionado("");
          }} title="Zera apenas os filtros da tela (ano, mês, banco). Não apaga dados do sistema.">
            Limpar filtros
          </Button>
        </Box>
        </Box>

        {/* Conteúdo das Abas */}
        {activeDashboardTab === 'receitas-despesas' && (
          <ReceitasDespesasTab
            dashboardData={dashboardData}
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            loadingDetalhamento={loadingDetalhamento}
            tipoAgrupamentoDetalhamento={tipoAgrupamentoDetalhamento}
            tipoVisualizacaoDetalhamento={tipoVisualizacaoDetalhamento}
            onTipoAgrupamentoChange={setTipoAgrupamentoDetalhamento}
            onTipoVisualizacaoChange={() => setTipoVisualizacaoDetalhamento(tipoVisualizacaoDetalhamento === 'pizza' ? 'lista' : 'pizza')}
          />
        )}

        {activeDashboardTab === 'financiamentos' && (
          <FinanciamentosTab
            dashboardData={dashboardData}
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            activeTab={activeTab}
            parcelasAVencer={parcelasAVencer}
            contratosLiquidados={contratosLiquidados}
            contratosNovos={contratosNovos}
            onActiveTabChange={setActiveTab}
          />
        )}

        {activeDashboardTab === 'resultado' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Resultado consolidado - {anoSelecionado}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Receitas (ano)</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.receitas)}
                </Typography>
              </Paper>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Despesas (ano)</Typography>
                <Typography variant="h5" fontWeight="bold" color="error.main">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(dashboardData.totaisAno.despesas))}
                </Typography>
              </Paper>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Saldo operação (R - D)</Typography>
                <Typography variant="h5" fontWeight="bold" color={(dashboardData.totaisAno.receitas + dashboardData.totaisAno.despesas) >= 0 ? 'success.main' : 'error.main'}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.receitas + dashboardData.totaisAno.despesas)}
                </Typography>
              </Paper>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Financiamentos (ano)</Typography>
                <Typography variant="body2">Contratado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.financiamentos.totalFinanciado)}</Typography>
                <Typography variant="body2">Quitado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.financiamentos.totalQuitado)}</Typography>
                <Typography variant="body2" fontWeight="bold">Em aberto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.financiamentos.totalEmAberto)}</Typography>
              </Paper>
            </Box>
            <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>Resumo</Typography>
              <Typography variant="body2">
                Resultado operacional (receitas menos despesas) no ano: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.receitas + dashboardData.totaisAno.despesas)}.
                Financiamentos: {dashboardData.totaisAno.financiamentos.contratosAtivos} contrato(s) ativo(s), valor em aberto {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardData.totaisAno.financiamentos.totalEmAberto)}.
              </Typography>
            </Paper>
          </Box>
        )}
      </Box>
    </div>
  );
};

export default Dashboard;
