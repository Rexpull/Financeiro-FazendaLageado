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
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BreadCrumb from "../../components/BreadCrumb";
import { getDashboardData, DashboardData, getResumoSaldoDevedor, ResumoSaldoDevedorMes } from "../../services/dashboardService";
import { getContasCorrentes } from '../../services/contaCorrenteService';
import ReceitasDespesasTab from './ReceitasDespesasTab';
import FinanciamentosTab from './FinanciamentosTab';
import { CaixaTab } from './CaixaTab';
import ComparativoReceitasDespesasChart from './ComparativoReceitasDespesasChart';
import { totaisPorCentros } from './totaisPorCentros';
import { saldoDevedorPeriodo } from './saldoDevedorPeriodo';

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const mesAtual = new Date().getMonth();
    return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mesAtual];
  });
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'receitas-despesas' | 'financiamentos' | 'resultado' | 'caixa'>('receitas-despesas');
  const [tipoDetalhamento, setTipoDetalhamento] = useState<'receitas' | 'despesas'>('despesas');
  const [resumoSaldoDevedor, setResumoSaldoDevedor] = useState<ResumoSaldoDevedorMes[] | null>(null);
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
      detalhamento: [],
      receitasAgrupadoPorCentros: [],
    }
  });
  const [contasSelecionadas, setContasSelecionadas] = useState<number[]>([]);
  const [contasReady, setContasReady] = useState(false);
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
      } finally {
        setContasReady(true);
      }
    };

    fetchContas();
  }, []);

  useEffect(() => {
    if (!contasReady) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const mesIdx = mesSelecionado ? ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].indexOf(mesSelecionado) : -1;
        const mesParam = mesIdx >= 0 ? mesIdx + 1 : undefined;
        // Single request: year charts + month detail + full-year centro captions (agrupadoPorAno).
        const dashboardDataDetalhe = await getDashboardData(anoSelecionado, mesParam, contasSelecionadas, 'planos');
        const rd = dashboardDataDetalhe.receitasDespesas;

        setDashboardData({
          ...dashboardDataDetalhe,
          receitasDespesas: rd,
          receitasDespesasAno: {
            ...rd,
            agrupadoPor: rd.agrupadoPorAno ?? rd.agrupadoPor,
            receitasAgrupadoPorCentros: rd.receitasAgrupadoPorCentrosAno ?? rd.receitasAgrupadoPorCentros,
          },
        });
      } catch (err) {
        setError('Erro ao carregar dados do dashboard');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [anoSelecionado, mesSelecionado, contasSelecionadas, contasReady]);

  // Saldo devedor mês a mês (tela Financiamentos e quadro de financiamentos do Resultado consolidado)
  useEffect(() => {
    let ativo = true;
    setResumoSaldoDevedor(null);
    getResumoSaldoDevedor(anoSelecionado)
      .then((r) => { if (ativo) setResumoSaldoDevedor(r); })
      .catch((err) => {
        console.error('Erro ao carregar saldo devedor:', err);
        if (ativo) setResumoSaldoDevedor([]);
      });
    return () => { ativo = false; };
  }, [anoSelecionado]);

  // Filtros inteligentes
  const bancosDisponiveis: any[] = [];

  const handleAnoChange = (event: any) => {
    setAnoSelecionado(Number(event.target.value));
  };

  const handleDashboardTabChange = (event: React.SyntheticEvent, newValue: 'receitas-despesas' | 'financiamentos' | 'resultado' | 'caixa') => {
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
          flexWrap: 'wrap',
          gap: 1,
          borderBottom: 1, 
          borderColor: 'divider',
          
        }}>
          <Tabs
            value={activeDashboardTab}
            onChange={handleDashboardTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 'none', minWidth: 0, flex: '1 1 420px' }}
          >
            <Tab label="Receitas e Despesas" value="receitas-despesas" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Financiamentos" value="financiamentos" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Resultado Consolidado" value="resultado" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Caixa" value="caixa" sx={{ fontWeight: 'bold !important' }}/>
          </Tabs>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', pb: 1 }}>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Ano</InputLabel>
            <Select value={anoSelecionado} sx={{backgroundColor: 'white'}} label="Ano" onChange={handleAnoChange}>
              {Array.from({ length: new Date().getFullYear() + 2 - 2020 }, (_, i) => 2020 + i).map(ano => (
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
            tipoDetalhamento={tipoDetalhamento}
            onTipoDetalhamentoChange={setTipoDetalhamento}
          />
        )}

        {activeDashboardTab === 'financiamentos' && (
          <FinanciamentosTab
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            resumo={resumoSaldoDevedor}
          />
        )}

        {activeDashboardTab === 'caixa' && (
          <CaixaTab anoSelecionado={anoSelecionado} mesSelecionado={mesSelecionado} />
        )}

        {activeDashboardTab === 'resultado' && (() => {
          // Acumulado do ano: centros de custo (custeio = operacionais; investimento inclui aplicações financeiras)
          const t = totaisPorCentros(dashboardData.receitasDespesasAno ?? dashboardData.receitasDespesas);
          const saldoOperacional = t.receitas - t.custeio;
          const saldoFinanceiro = t.receitas - t.despesas;
          const fin = saldoDevedorPeriodo(resumoSaldoDevedor ?? [], -1);
          const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
          const cardSx = (cor: 'success' | 'error' | 'info' | 'warning') => (theme: any) => ({
            p: 2.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: `${cor}.main`,
            bgcolor: alpha(theme.palette[cor].main, 0.08),
          });
          const Linha = ({ rotulo, valor, cor, forte }: { rotulo: string; valor: string; cor: string; forte?: boolean }) => (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" fontWeight={forte ? 700 : 400}>{rotulo}</Typography>
              <Typography variant={forte ? 'h6' : 'subtitle1'} fontWeight={forte ? 'bold' : 600} color={cor}>{valor}</Typography>
            </Box>
          );
          return (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
                Resultado consolidado — acumulado de {anoSelecionado}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2.5 }}>
                <Paper elevation={0} sx={cardSx('success')}>
                  <Typography variant="subtitle2" sx={{ color: 'success.dark', fontWeight: 700 }}>Receitas</Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.dark" sx={{ mt: 0.5 }}>{brl(t.receitas)}</Typography>
                </Paper>

                <Paper elevation={0} sx={cardSx('error')}>
                  <Typography variant="subtitle2" sx={{ color: 'error.dark', fontWeight: 700, mb: 1.25 }}>Despesas</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Linha rotulo="Operacionais (custeio)" valor={brl(t.custeio)} cor="error.dark" />
                    <Linha rotulo="Investimentos e aplicações financeiras" valor={brl(t.investimento)} cor="warning.dark" />
                    <Box sx={{ pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Linha rotulo="Total" valor={brl(t.despesas)} cor="error.dark" forte />
                    </Box>
                  </Box>
                </Paper>

                <Paper elevation={0} sx={cardSx(saldoFinanceiro >= 0 ? 'success' : 'error')}>
                  <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700, mb: 1.25 }}>Saldo</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Tooltip arrow title="Receitas menos despesas operacionais: capacidade da atividade de gerar recursos para sustentar suas operações.">
                      <Box><Linha rotulo="Operacional" valor={brl(saldoOperacional)} cor={saldoOperacional >= 0 ? 'success.dark' : 'error.dark'} /></Box>
                    </Tooltip>
                    <Tooltip arrow title="Receitas menos todas as despesas, incluindo investimentos e aplicações financeiras. Financiamentos ficam de fora (tela própria).">
                      <Box sx={{ pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Linha rotulo="Financeiro" valor={brl(saldoFinanceiro)} cor={saldoFinanceiro >= 0 ? 'success.dark' : 'error.dark'} forte />
                      </Box>
                    </Tooltip>
                  </Box>
                </Paper>

                <Paper elevation={0} sx={cardSx('info')}>
                  <Typography variant="subtitle2" sx={{ color: 'info.dark', fontWeight: 700, mb: 1.25 }}>Financiamentos</Typography>
                  {fin ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Linha rotulo="Créditos novos" valor={brl(fin.creditosNovos)} cor="info.dark" />
                      <Linha rotulo="Amortizações e liquidações" valor={brl(fin.quitados)} cor="success.dark" />
                      {fin.contratosNovos > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {fin.contratosNovos} contrato(s) novo(s), valor contratado {brl(fin.valorContratadoNovos)}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Carregando…</Typography>
                  )}
                </Paper>
              </Box>

              {/* Acumulado do ano por centros de custo (mesma regra da tela Receitas e Despesas) */}
              <Paper elevation={0} sx={{ p: 2, mt: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <ComparativoReceitasDespesasChart
                  title={`Comparativo Acumulado (${anoSelecionado})`}
                  categoria={`Ano ${anoSelecionado}`}
                  totais={t}
                  height={320}
                />
              </Paper>
            </Box>
          );
        })()}
      </Box>
    </div>
  );
};

export default Dashboard;
