import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Typography,
  Box,
  Paper,
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
import { anosFiltroFluxo } from '../Financeiro/FluxoDeCaixa/fluxoMensalRegras';
import { brl } from '../../Utils/formatos';

/** Account as returned by GET /api/contas (only the fields the filter shows). */
type ContaFiltro = { id: number; responsavel?: string; bancoNome?: string; numConta?: string; numCartao?: string; ativo?: boolean | number };

type AbaDashboard = 'receitas-despesas' | 'financiamentos' | 'resultado' | 'caixa';

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Default filters (page open and "Limpar filtros"): current year and current month. */
const anoAtual = () => new Date().getFullYear();
const mesAtual = () => MESES[new Date().getMonth()];

/** Same name the Fluxo de Caixa shows for an account (responsável, e.g. "BB GFS"), with a fallback. */
const nomeConta = (c: ContaFiltro) =>
  c.responsavel?.trim() || [c.bancoNome, c.numConta || c.numCartao].filter(Boolean).join(' ') || `Conta ${c.id}`;

/** Response of /api/dashboard plus the full-year breakdown used by "Resultado consolidado". */
function comAcumuladoDoAno(d: DashboardData): DashboardData {
  const rd = d.receitasDespesas;
  return {
    ...d,
    receitasDespesasAno: {
      ...rd,
      agrupadoPor: rd.agrupadoPorAno ?? rd.agrupadoPor,
      receitasAgrupadoPorCentros: rd.receitasAgrupadoPorCentrosAno ?? rd.receitasAgrupadoPorCentros,
    },
  };
}

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

const Dashboard = () => {
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtual);
  const [activeDashboardTab, setActiveDashboardTab] = useState<AbaDashboard>('receitas-despesas');
  const [tipoDetalhamento, setTipoDetalhamento] = useState<'receitas' | 'despesas'>('despesas');
  const [resumoSaldoDevedor, setResumoSaldoDevedor] = useState<ResumoSaldoDevedorMes[] | null>(null);
  const [erroResumo, setErroResumo] = useState(false);
  const [tentativaResumo, setTentativaResumo] = useState(0);
  // Dashboard query result / error, tagged with the filters they belong to (see chaveDashboard)
  const [dados, setDados] = useState<{ chave: string; data: DashboardData } | null>(null);
  const [erro, setErro] = useState<{ chave: string; msg: string } | null>(null);
  const [contasDisponiveis, setContasDisponiveis] = useState<ContaFiltro[]>([]);
  // "" = Todas; otherwise the id (as string) of the single account selected in the "Conta" filter
  const [contaSelecionada, setContaSelecionada] = useState<string>("");
  const [contasReady, setContasReady] = useState(false);
  const [erroContas, setErroContas] = useState(false);

  // Accounts sent to getDashboardData: the selected one, or all of them ("Todas").
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

  // The heavy dashboard query feeds only "Receitas e Despesas" and "Resultado consolidado":
  // Financiamentos and Caixa have their own requests and never wait for it.
  const precisaDashboard = activeDashboardTab === 'receitas-despesas' || activeDashboardTab === 'resultado';
  const chaveDashboard = `${anoSelecionado}|${mesSelecionado}|${contasSelecionadas.join(',')}`;
  const dashboardData = dados?.chave === chaveDashboard ? dados.data : null;
  const erroDashboard = erro?.chave === chaveDashboard ? erro.msg : null;

  useEffect(() => {
    if (!contasReady || !precisaDashboard) return;
    // Already loaded (or failed) for these filters: retry clears `erro`
    if (dados?.chave === chaveDashboard || erro?.chave === chaveDashboard) return;

    let ativo = true;
    const chave = chaveDashboard;
    const mesIdx = MESES.indexOf(mesSelecionado);
    // Single request: year charts + month detail + full-year centro captions (agrupadoPorAno).
    getDashboardData(anoSelecionado, mesIdx >= 0 ? mesIdx + 1 : undefined, contasSelecionadas, 'planos')
      .then((d) => {
        if (ativo) setDados({ chave, data: comAcumuladoDoAno(d) });
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErro({ chave, msg: err instanceof Error && err.message ? err.message : 'Erro ao carregar dados do dashboard' });
      });
    return () => { ativo = false; };
  }, [contasReady, precisaDashboard, chaveDashboard, dados, erro, anoSelecionado, mesSelecionado, contasSelecionadas]);

  // Saldo devedor mês a mês (tela Financiamentos e quadro de financiamentos do Resultado consolidado)
  useEffect(() => {
    let ativo = true;
    setResumoSaldoDevedor(null);
    setErroResumo(false);
    getResumoSaldoDevedor(anoSelecionado)
      .then((r) => { if (ativo) setResumoSaldoDevedor(r); })
      .catch((err) => {
        console.error('Erro ao carregar saldo devedor:', err);
        if (ativo) setErroResumo(true);
      });
    return () => { ativo = false; };
  }, [anoSelecionado, tentativaResumo]);

  // Financiamentos and Caixa tabs don't depend on accounts.
  const filtroContaNaoSeAplica = activeDashboardTab === 'financiamentos' || activeDashboardTab === 'caixa';
  // Resultado consolidado is always the year to date
  const filtroMesNaoSeAplica = activeDashboardTab === 'resultado';

  const handleDashboardTabChange = (_event: React.SyntheticEvent, newValue: AbaDashboard) => {
    setActiveDashboardTab(newValue);
  };

  const limparFiltros = () => {
    setAnoSelecionado(anoAtual());
    setMesSelecionado(mesAtual());
    setContaSelecionada("");
  };

  const erroResumoAlert = (
    <Alert
      severity="error"
      action={<Button color="inherit" size="small" onClick={() => setTentativaResumo((t) => t + 1)}>Tentar novamente</Button>}
    >
      Não foi possível carregar os financiamentos de {anoSelecionado}.
    </Alert>
  );

  /** Loading / error of the dashboard query, shown inside the content area. */
  const estadoDashboard = (conteudo: () => React.ReactNode) => {
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
    return dashboardData ? conteudo() : <ConteudoCarregando />;
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
            <Tab label="Financiamentos" value="financiamentos" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Resultado Consolidado" value="resultado" sx={{ fontWeight: 'bold !important' }}/>
            <Tab label="Caixa" value="caixa" sx={{ fontWeight: 'bold !important' }}/>
          </Tabs>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel id="dashboard-filtro-ano">Ano</InputLabel>
              <Select
                labelId="dashboard-filtro-ano"
                value={anoSelecionado}
                sx={{backgroundColor: 'white'}}
                label="Ano"
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              >
                {/* Same years as the Fluxo de Caixa */}
                {anosFiltroFluxo().map(Number).map(ano => (
                  <MenuItem key={ano} value={ano}>{ano}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip arrow title={filtroMesNaoSeAplica ? 'Esta aba mostra o acumulado do ano' : ''}>
              {/* span wrapper: a disabled control does not fire the events the Tooltip needs */}
              <Box component="span" sx={{ display: 'inline-flex' }}>
                <FormControl sx={{ minWidth: 120 }} size="small" disabled={filtroMesNaoSeAplica}>
                  <InputLabel id="dashboard-filtro-mes" shrink>Mês</InputLabel>
                  <Select
                    labelId="dashboard-filtro-mes"
                    value={mesSelecionado}
                    label="Mês"
                    notched
                    displayEmpty
                    sx={{backgroundColor: 'white'}}
                    onChange={e => setMesSelecionado(e.target.value)}
                    renderValue={v => (filtroMesNaoSeAplica ? 'Ano todo' : v || 'Todos')}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {MESES.map(mes => (
                      <MenuItem key={mes} value={mes}>{mes}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Tooltip>
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
              title="Volta para o ano e o mês atuais e todas as contas. Não apaga dados do sistema."
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
        {activeDashboardTab === 'receitas-despesas' && estadoDashboard(() => (
          <ReceitasDespesasTab
            dashboardData={dashboardData!}
            anoSelecionado={anoSelecionado}
            mesSelecionado={mesSelecionado}
            tipoDetalhamento={tipoDetalhamento}
            onTipoDetalhamentoChange={setTipoDetalhamento}
          />
        ))}

        {activeDashboardTab === 'financiamentos' && (
          erroResumo ? erroResumoAlert : (
            <FinanciamentosTab
              anoSelecionado={anoSelecionado}
              mesSelecionado={mesSelecionado}
              resumo={resumoSaldoDevedor}
            />
          )
        )}

        {activeDashboardTab === 'caixa' && (
          <CaixaTab anoSelecionado={anoSelecionado} mesSelecionado={mesSelecionado} />
        )}

        {activeDashboardTab === 'resultado' && estadoDashboard(() => {
          const data = dashboardData!;
          // Acumulado do ano: centros de custo (custeio = operacionais; investimento inclui aplicações financeiras)
          const t = totaisPorCentros(data.receitasDespesasAno ?? data.receitasDespesas);
          const saldoOperacional = t.receitas - t.custeio;
          const saldoAposInvestimentos = t.receitas - t.despesas;
          const fin = saldoDevedorPeriodo(resumoSaldoDevedor ?? [], -1);
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

                <Paper elevation={0} sx={cardSx(saldoAposInvestimentos >= 0 ? 'success' : 'error')}>
                  <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700, mb: 1.25 }}>Saldos</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Tooltip arrow title="Receitas menos despesas operacionais (custeio): capacidade da atividade de gerar recursos para sustentar suas operações.">
                      <Box><Linha rotulo="(A) Saldo operacional" valor={brl(saldoOperacional)} cor={saldoOperacional >= 0 ? 'success.dark' : 'error.dark'} /></Box>
                    </Tooltip>
                    <Tooltip arrow title="Receitas menos todas as despesas, incluindo investimentos e aplicações financeiras. Financiamentos ficam de fora (tela própria).">
                      <Box sx={{ pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Linha rotulo="(C) Saldo após investimentos" valor={brl(saldoAposInvestimentos)} cor={saldoAposInvestimentos >= 0 ? 'success.dark' : 'error.dark'} forte />
                      </Box>
                    </Tooltip>
                  </Box>
                </Paper>

                <Paper elevation={0} sx={cardSx('info')}>
                  <Typography variant="subtitle2" sx={{ color: 'info.dark', fontWeight: 700, mb: 1.25 }}>Financiamentos</Typography>
                  {fin ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Tooltip arrow title="Parcelas dos contratos assinados no período">
                        <Box><Linha rotulo="Créditos novos" valor={brl(fin.creditosNovos)} cor="info.dark" /></Box>
                      </Tooltip>
                      <Tooltip arrow title="Parcelas amortizadas e liquidadas no período">
                        <Box><Linha rotulo="Quitados" valor={brl(fin.quitados)} cor="success.dark" /></Box>
                      </Tooltip>
                      {fin.contratosNovos > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {fin.contratosNovos} contrato(s) novo(s), valor contratado {brl(fin.valorContratadoNovos)}
                        </Typography>
                      )}
                    </Box>
                  ) : erroResumo ? (
                    <Typography variant="body2" color="error.main">
                      Não foi possível carregar.{' '}
                      <Button size="small" onClick={() => setTentativaResumo((n) => n + 1)} sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
                        Tentar novamente
                      </Button>
                    </Typography>
                  ) : resumoSaldoDevedor ? (
                    <Typography variant="body2" color="text.secondary">Nenhum financiamento em {anoSelecionado}.</Typography>
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
        })}
      </Box>
    </div>
  );
};

export default Dashboard;
