import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Button,
  Tabs,
  Tab,
  Tooltip,
  Alert,
  ListSubheader,
} from "@mui/material";
import BreadCrumb from "../../components/BreadCrumb";
import {
  getDashboardData,
  DashboardData,
  getResumoSaldoDevedor,
  ResumoSaldoDevedorMes,
  getReceitasDespesasPeriodo,
  ReceitasDespesasPeriodo,
} from "../../services/dashboardService";
import { getContasCorrentes } from '../../services/contaCorrenteService';
import ReceitasDespesasTab from './ReceitasDespesasTab';
import ResultadoConsolidadoTab from './ResultadoConsolidadoTab';
import FinanciamentosTab from './FinanciamentosTab';
import { CaixaTab } from './CaixaTab';
import { anosDashboard, intervaloPeriodo, MESES_CURTOS, OPCOES_MES_PERIODO, OPCOES_PERIODO, type TipoPeriodo } from './periodoDashboard';

/** Account as returned by GET /api/contas (only the fields the filter shows). */
type ContaFiltro = { id: number; responsavel?: string; bancoNome?: string; numConta?: string; numCartao?: string; ativo?: boolean | number };

type AbaDashboard = 'receitas-despesas' | 'resultado' | 'financiamentos' | 'caixa';

const MESES = MESES_CURTOS;

/** Default filters (page open and "Limpar filtros"): current year and current month. */
const anoAtual = () => new Date().getFullYear();
const mesAtual = () => MESES[new Date().getMonth()];

/** Same name the Fluxo de Caixa shows for an account (responsável, e.g. "BB GFS"), with a fallback. */
const nomeConta = (c: ContaFiltro) =>
  c.responsavel?.trim() || [c.bancoNome, c.numConta || c.numCartao].filter(Boolean).join(' ') || `Conta ${c.id}`;

/** Placeholder of the content area while the dashboard query runs (header and filters stay on screen). */
const ConteudoCarregando = () => (
  <Box aria-busy="true" aria-label="Carregando dados do dashboard">
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
      {[...Array(3)].map((_, i) => <Skeleton key={i} variant="rectangular" height={110} sx={{ borderRadius: 3 }} />)}
    </Box>
    <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 3, mb: 3 }} />
    <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3, mb: 3 }} />
  </Box>
);

/** Query result / error tagged with the filters it belongs to (a late answer for old filters is ignored). */
type Marcado<T> = { chave: string; data: T };

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtual);
  // Period of "Resultado consolidado" and "Financiamentos" (ano inteiro, trimestre, semestre, últimos 12 meses, um mês)
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('ano');
  const [activeDashboardTab, setActiveDashboardTab] = useState<AbaDashboard>('receitas-despesas');
  const [tipoDetalhamento, setTipoDetalhamento] = useState<'receitas' | 'despesas'>('despesas');
  const [resumo, setResumo] = useState<Marcado<ResumoSaldoDevedorMes[]> | null>(null);
  const [erroResumo, setErroResumo] = useState<string | null>(null);
  const [dados, setDados] = useState<Marcado<DashboardData> | null>(null);
  const [dadosPeriodo, setDadosPeriodo] = useState<Marcado<ReceitasDespesasPeriodo> | null>(null);
  const [erro, setErro] = useState<{ chave: string; msg: string } | null>(null);
  const [contasDisponiveis, setContasDisponiveis] = useState<ContaFiltro[]>([]);
  // "" = Todas; otherwise the id (as string) of the single account selected in the "Conta" filter
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [contasReady, setContasReady] = useState(false);
  const [erroContas, setErroContas] = useState(false);

  // Accounts sent to the API: the selected one, or all of them ("Todas").
  const contasSelecionadas = useMemo(
    () => (contaSelecionada ? [Number(contaSelecionada)] : contasDisponiveis.map(c => c.id)),
    [contaSelecionada, contasDisponiveis]
  );

  const carregarContas = useCallback(async () => {
    setErroContas(false);
    try {
      const contasData = (await getContasCorrentes()) as ContaFiltro[];
      setContasDisponiveis(contasData);
    } catch (err) {
      // Not fatal: without the list the dashboard still loads every account ("Todas")
      setErroContas(true);
      console.error(err);
    } finally {
      setContasReady(true);
    }
  }, []);

  useEffect(() => {
    carregarContas();
  }, [carregarContas]);

  const usaPeriodo = activeDashboardTab === 'resultado' || activeDashboardTab === 'financiamentos';
  const intervalo = useMemo(() => intervaloPeriodo(anoSelecionado, tipoPeriodo), [anoSelecionado, tipoPeriodo]);

  // "Receitas e despesas": month (or whole year) of the heavy /api/dashboard query
  const chaveDashboard = `rd|${anoSelecionado}|${mesSelecionado}|${contasSelecionadas.join(',')}`;
  // "Resultado consolidado": any date range (/api/dashboard/periodo)
  const chavePeriodo = `rc|${intervalo.inicio}|${intervalo.fim}|${contasSelecionadas.join(',')}`;
  const chaveAtual = activeDashboardTab === 'resultado' ? chavePeriodo : chaveDashboard;
  const dashboardData = dados?.chave === chaveDashboard ? dados.data : null;
  const periodoData = dadosPeriodo?.chave === chavePeriodo ? dadosPeriodo.data : null;
  const erroDashboard = erro?.chave === chaveAtual ? erro.msg : null;

  useEffect(() => {
    if (!contasReady || activeDashboardTab !== 'receitas-despesas') return;
    // Already loaded (or failed) for these filters: retry clears `erro`
    if (dados?.chave === chaveDashboard || erro?.chave === chaveDashboard) return;

    let ativo = true;
    const chave = chaveDashboard;
    const mesIdx = MESES.indexOf(mesSelecionado);
    getDashboardData(anoSelecionado, mesIdx >= 0 ? mesIdx + 1 : undefined, contasSelecionadas, 'planos')
      .then((d) => {
        if (ativo) setDados({ chave, data: d });
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErro({ chave, msg: err instanceof Error && err.message ? err.message : 'Erro ao carregar dados do dashboard' });
      });
    return () => { ativo = false; };
  }, [contasReady, activeDashboardTab, chaveDashboard, dados, erro, anoSelecionado, mesSelecionado, contasSelecionadas]);

  useEffect(() => {
    if (!contasReady || activeDashboardTab !== 'resultado') return;
    if (dadosPeriodo?.chave === chavePeriodo || erro?.chave === chavePeriodo) return;

    let ativo = true;
    const chave = chavePeriodo;
    getReceitasDespesasPeriodo({ inicio: intervalo.inicio, fim: intervalo.fim }, contasSelecionadas)
      .then((d) => {
        if (ativo) setDadosPeriodo({ chave, data: d });
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErro({ chave, msg: err instanceof Error && err.message ? err.message : 'Erro ao carregar o resultado do período' });
      });
    return () => { ativo = false; };
  }, [contasReady, activeDashboardTab, chavePeriodo, dadosPeriodo, erro, intervalo, contasSelecionadas]);

  // Saldo devedor mês a mês of the period (tela Financiamentos e quadro de financiamentos do Resultado consolidado)
  const chaveResumo = `${intervalo.inicio}|${intervalo.fim}`;
  const resumoSaldoDevedor = resumo?.chave === chaveResumo ? resumo.data : null;
  const resumoComErro = erroResumo === chaveResumo;
  useEffect(() => {
    if (!usaPeriodo || resumo?.chave === chaveResumo || erroResumo === chaveResumo) return;
    let ativo = true;
    const chave = chaveResumo;
    getResumoSaldoDevedor({ inicio: intervalo.inicio, fim: intervalo.fim })
      .then((r) => { if (ativo) setResumo({ chave, data: r }); })
      .catch((err) => {
        console.error('Erro ao carregar saldo devedor:', err);
        if (ativo) setErroResumo(chave);
      });
    return () => { ativo = false; };
  }, [usaPeriodo, chaveResumo, resumo, erroResumo, intervalo]);

  // Financiamentos and Caixa tabs don't depend on accounts.
  const filtroContaNaoSeAplica = activeDashboardTab === 'financiamentos' || activeDashboardTab === 'caixa';
  // "Últimos 12 meses" ends with the current month, whatever the year
  const filtroAnoNaoSeAplica = usaPeriodo && tipoPeriodo === '12m';

  const handleDashboardTabChange = (_event: React.SyntheticEvent, newValue: AbaDashboard) => {
    setActiveDashboardTab(newValue);
  };

  const limparFiltros = () => {
    setAnoSelecionado(anoAtual());
    setMesSelecionado(mesAtual());
    setTipoPeriodo('ano');
    setContaSelecionada("");
  };

  const erroResumoAlert = (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={() => setErroResumo(null)}>Tentar novamente</Button>}
    >
      Não foi possível carregar os financiamentos de {intervalo.rotulo}.
    </Alert>
  );

  /** Loading / error of the dashboard query, shown inside the content area. */
  const estadoDashboard = (carregado: boolean, conteudo: () => React.ReactNode) => {
    if (erroDashboard) {
      return (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => setErro(null)}>Tentar novamente</Button>}
        >
          Não foi possível carregar os dados do dashboard. {erroDashboard}
        </Alert>
      );
    }
    return carregado ? conteudo() : <ConteudoCarregando />;
  };

  return (
    <div style={{width: '100%'}}>
      <BreadCrumb pagina="Dashboard" />
      <Box sx={{ flexGrow: 1, mt: 3 }}>
        {/* Abas e filtros: the tabs keep their full width; the filters wrap to the next row when both don't fit */}
        <Box sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          columnGap: 2,
          rowGap: 1.5,
        }}>
          <Tabs
            value={activeDashboardTab}
            onChange={handleDashboardTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ flex: '1 1 auto', minWidth: 0, maxWidth: '100%', borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Receitas e Despesas" value="receitas-despesas" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Resultado Consolidado" value="resultado" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Financiamentos" value="financiamentos" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Caixa" value="caixa" sx={{ fontWeight: 'bold !important' }}/>
          </Tabs>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tooltip arrow title={filtroAnoNaoSeAplica ? 'Os últimos 12 meses terminam no mês atual' : ''}>
              {/* span wrapper: a disabled control does not fire the events the Tooltip needs */}
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <FormControl sx={{ minWidth: 110 }} size="small" disabled={filtroAnoNaoSeAplica}>
                  <InputLabel id="dashboard-filtro-ano">Ano</InputLabel>
                  <Select
                    labelId="dashboard-filtro-ano"
                    value={anoSelecionado}
                    sx={{backgroundColor: 'white'}}
                    label="Ano"
                    onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                  >
                    {/* 2024 up to 5 years ahead: future years show the parcelas already registered */}
                    {anosDashboard(new Date(), anoSelecionado).map(ano => (
                      <MenuItem key={ano} value={ano}>{ano}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Tooltip>
            {usaPeriodo ? (
              <FormControl sx={{ minWidth: 170 }} size="small">
                <InputLabel id="dashboard-filtro-periodo">Período</InputLabel>
                <Select
                  labelId="dashboard-filtro-periodo"
                  value={tipoPeriodo}
                  label="Período"
                  sx={{backgroundColor: 'white'}}
                  onChange={e => setTipoPeriodo(e.target.value as TipoPeriodo)}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
                >
                  {OPCOES_PERIODO.map(o => (
                    <MenuItem key={o.valor} value={o.valor}>{o.rotulo}</MenuItem>
                  ))}
                  {/* One month of the chosen year: what was contracted and paid month by month */}
                  <ListSubheader sx={{ lineHeight: '32px', fontWeight: 700 }}>Mês de {anoSelecionado}</ListSubheader>
                  {OPCOES_MES_PERIODO.map(o => (
                    <MenuItem key={o.valor} value={o.valor}>{o.rotulo}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl sx={{ minWidth: 120 }} size="small">
                <InputLabel id="dashboard-filtro-mes" shrink>Mês</InputLabel>
                <Select
                  labelId="dashboard-filtro-mes"
                  value={mesSelecionado}
                  label="Mês"
                  notched
                  displayEmpty
                  sx={{backgroundColor: 'white'}}
                  onChange={e => setMesSelecionado(e.target.value)}
                  renderValue={v => v || 'Todos'}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {MESES.map(mes => (
                    <MenuItem key={mes} value={mes}>{mes}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Tooltip arrow title={filtroContaNaoSeAplica ? 'O filtro de conta não se aplica a esta aba' : ''}>
              {/* span wrapper: a disabled control does not fire the events the Tooltip needs */}
              <Box component="span" sx={{ display: 'inline-flex' }}>
              <FormControl sx={{ minWidth: 160 }} size="small" disabled={filtroContaNaoSeAplica || !contasDisponiveis.length}>
                <InputLabel id="dashboard-filtro-conta" shrink>Conta</InputLabel>
                <Select
                  labelId="dashboard-filtro-conta"
                  value={contaSelecionada}
                  label="Conta"
                  notched
                  displayEmpty
                  sx={{backgroundColor: 'white'}}
                  onChange={e => setContaSelecionada(String(e.target.value))}
                  renderValue={v => {
                    const conta = contasDisponiveis.find(c => String(c.id) === v);
                    return conta ? nomeConta(conta) : 'Todas';
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {contasDisponiveis.map(c => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {nomeConta(c)}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {[c.bancoNome, c.numConta || c.numCartao].filter(Boolean).join(' · ')}
                        {(c.ativo === false || c.ativo === 0) && ' (inativa)'}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              </Box>
            </Tooltip>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={limparFiltros}
              title="Volta para o ano e o mês atuais, o ano inteiro e todas as contas. Não apaga dados do sistema."
            >
              Limpar filtros
            </Button>
          </Box>
        </Box>

        {erroContas && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={carregarContas}>Tentar novamente</Button>}
          >
            Não foi possível carregar a lista de contas. Os valores abaixo consideram todas as contas.
          </Alert>
        )}

        {/* Conteúdo das Abas */}
        {activeDashboardTab === 'receitas-despesas' && estadoDashboard(!!dashboardData, () => (
          <ReceitasDespesasTab
            dashboardData={dashboardData!}
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            contas={contasSelecionadas}
            tipoDetalhamento={tipoDetalhamento}
            onTipoDetalhamentoChange={setTipoDetalhamento}
          />
        ))}

        {activeDashboardTab === 'resultado' && estadoDashboard(!!periodoData, () => (
          <ResultadoConsolidadoTab
            dados={periodoData!}
            intervalo={intervalo}
            resumo={resumoSaldoDevedor}
            erroResumo={resumoComErro}
            onTentarResumoNovamente={() => setErroResumo(null)}
          />
        ))}

        {activeDashboardTab === 'financiamentos' && (
          resumoComErro ? erroResumoAlert : (
            <FinanciamentosTab intervalo={intervalo} resumo={resumoSaldoDevedor} />
          )
        )}

        {activeDashboardTab === 'caixa' && (
          <CaixaTab anoSelecionado={anoSelecionado} mesSelecionado={mesSelecionado} />
        )}
      </Box>
    </div>
  );
};

export default Dashboard;
