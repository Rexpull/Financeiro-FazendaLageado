import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputBase,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { NumericFormat } from "react-number-format";
import { toast } from "react-toastify";
import {
  atualizarLancamentoCaixa,
  CaixaLancamento,
  CaixaMes,
  CaixaParcela,
  criarLancamentoCaixa,
  excluirLancamentoCaixa,
  getCaixa,
  NaturezaCaixa,
  salvarBoletosDia,
  salvarParcelaConsiderada,
  salvarSaldoInicial,
} from "../../services/caixaService";
import { brl } from "../../Utils/formatos";
import { formatarDataISO, hojeISO } from "../../Utils/dataSemFuso";
import {
  ANO_MAX_CAIXA,
  anosCaixa,
  dataCaixaValida,
  interpretarValorDia,
  MESES_CAIXA,
  mesmoValor,
  navegarMes,
  PeriodoCaixa,
  periodoInicialCaixa,
  previsoesDoDia,
  resumoParcelas,
  textoValorEditavel,
} from "./caixaRegras";

const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const formatSinal = (value: number) => `${value > 0 ? "+" : "−"} ${brl(Math.abs(value))}`;

// Datas sempre como 'YYYY-MM-DD' (string); dia da semana via UTC para não depender do fuso.
const partes = (data: string) => data.split("-").map(Number) as [number, number, number];
const diaSemana = (data: string) => {
  const [a, m, d] = partes(data);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
};
const rotuloDia = (data: string) => {
  const [, m, d] = partes(data);
  return `${String(d).padStart(2, "0")}/${MESES_CAIXA[m - 1].toLowerCase()}`;
};
/** CURRENT_TIMESTAMP do SQLite é UTC 'YYYY-MM-DD HH:MM:SS'. */
const formatarAtualizadoEm = (s: string | null) => {
  if (!s) return "";
  const dt = new Date(`${s.replace(" ", "T")}${/Z|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z"}`);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const nomeDoMes = ({ ano, mes }: PeriodoCaixa) =>
  `${MESES_EXTENSO[mes - 1].charAt(0).toUpperCase()}${MESES_EXTENSO[mes - 1].slice(1)} de ${ano}`;

const NUMERO_SX = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

const CARD_SX = {
  border: "1px solid #e0e0e0",
  borderRadius: 3,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  px: 2.5,
  py: 2,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  minWidth: 0,
} as const;

const DATA_MAX = `${ANO_MAX_CAIXA}-12-31`;

interface FormState {
  lancamento: CaixaLancamento | null;
  data: string;
}

interface CaixaTabProps {
  anoSelecionado: number;
  /** '' (todos) ou "Jan".."Dez" */
  mesSelecionado: string;
}

/**
 * Caixa diário do mês: saldo inicial digitado − boletos (total por dia) − parcelas de financiamento
 * marcadas (Saldo), mais as movimentações previstas de entrada/saída (Saldo final). Acumulados dia a dia.
 * O mês abre pelo filtro do Dashboard e pode ser navegado aqui até dez/2040.
 */
export const CaixaTab: React.FC<CaixaTabProps> = ({ anoSelecionado, mesSelecionado }) => {
  const [periodo, setPeriodo] = useState<PeriodoCaixa>(() => periodoInicialCaixa(anoSelecionado, mesSelecionado));
  const { ano, mes } = periodo;
  const [dados, setDados] = useState<CaixaMes | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saldoInput, setSaldoInput] = useState<number | undefined>(undefined);
  const [saldoStatus, setSaldoStatus] = useState<"salvando" | "erro" | null>(null);
  const [previsoesDia, setPrevisoesDia] = useState<string | null>(null);
  const [parcelasDe, setParcelasDe] = useState<{ data: string | null } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [excluindo, setExcluindo] = useState<CaixaLancamento | null>(null);
  const [excluindoStatus, setExcluindoStatus] = useState(false);
  const requisicao = useRef(0);

  // Changing the Dashboard filters reopens the Caixa on the filtered month
  useEffect(() => {
    setPeriodo(periodoInicialCaixa(anoSelecionado, mesSelecionado));
  }, [anoSelecionado, mesSelecionado]);

  const carregar = useCallback(async () => {
    const id = ++requisicao.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await getCaixa(ano, mes);
      if (id !== requisicao.current) return; // resposta de um mês que já foi trocado
      setDados(r);
      setSaldoInput(r.saldoInicial ?? undefined);
    } catch (e) {
      if (id !== requisicao.current) return;
      setErro(e instanceof Error ? e.message : "Erro ao carregar o caixa");
    } finally {
      if (id === requisicao.current) setCarregando(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    setDados(null);
    setPrevisoesDia(null);
    setParcelasDe(null);
    setForm(null);
    setExcluindo(null);
    setSaldoStatus(null);
    carregar();
  }, [carregar]);

  const anos = anosCaixa(anoSelecionado);
  const anterior = navegarMes(periodo, -1, anos[0]);
  const proximo = navegarMes(periodo, 1, anos[0]);
  const nomeMes = nomeDoMes(periodo);

  const navegacao = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Tooltip title="Mês anterior">
        <span>
          <IconButton onClick={() => anterior && setPeriodo(anterior)} disabled={!anterior} aria-label="Mês anterior">
            <ChevronLeftIcon />
          </IconButton>
        </span>
      </Tooltip>
      <FormControl size="small">
        <Select
          value={mes}
          onChange={(e) => setPeriodo({ ano, mes: Number(e.target.value) })}
          inputProps={{ "aria-label": "Mês do caixa" }}
          sx={{ minWidth: 92, bgcolor: "background.paper" }}
        >
          {MESES_CAIXA.map((m, i) => (
            <MenuItem key={m} value={i + 1}>
              {m}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small">
        <Select
          value={ano}
          onChange={(e) => setPeriodo({ ano: Number(e.target.value), mes })}
          inputProps={{ "aria-label": "Ano do caixa" }}
          MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
          sx={{ minWidth: 96, bgcolor: "background.paper" }}
        >
          {anos.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title="Próximo mês">
        <span>
          <IconButton onClick={() => proximo && setPeriodo(proximo)} disabled={!proximo} aria-label="Próximo mês">
            <ChevronRightIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  const dataPadrao = () => {
    const hoje = hojeISO();
    return hoje.startsWith(`${ano}-${String(mes).padStart(2, "0")}-`) ? hoje : `${ano}-${String(mes).padStart(2, "0")}-01`;
  };

  const cabecalho = (
    <Paper elevation={0} sx={{ ...CARD_SX, mb: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            Caixa diário
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {nomeMes}
          </Typography>
        </Box>
        {navegacao}
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm({ lancamento: null, data: dataPadrao() })}>
          Nova movimentação prevista
        </Button>
      </Box>
    </Paper>
  );

  if (!dados) {
    return (
      <Box sx={{ mb: 4 }}>
        {cabecalho}
        {erro ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    );
  }

  const hoje = hojeISO();
  const saldoAlterado = (saldoInput ?? null) !== dados.saldoInicial;

  const salvarSaldo = async () => {
    if (!saldoAlterado || saldoStatus === "salvando") return;
    setSaldoStatus("salvando");
    try {
      await salvarSaldoInicial(ano, mes, saldoInput ?? null);
      await carregar(); // recalcula os saldos com o novo valor
      setSaldoStatus(null);
    } catch (e) {
      setSaldoStatus("erro");
      toast.error(e instanceof Error ? e.message : "Erro ao salvar o saldo inicial");
    }
  };

  const salvarBoleto = async (data: string, valor: number | null) => {
    try {
      await salvarBoletosDia(data, valor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar os boletos do dia");
      throw e;
    }
    await carregar();
  };

  const alterarParcela = async (p: CaixaParcela, considerar: boolean) => {
    try {
      await salvarParcelaConsiderada(p.id, considerar);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a escolha da parcela");
      throw e;
    }
    await carregar();
  };

  const saldoHelper =
    saldoStatus === "salvando"
      ? "Salvando…"
      : saldoStatus === "erro"
        ? "Não foi possível salvar"
        : saldoAlterado
          ? "Salva ao pressionar Enter ou sair do campo"
          : dados.saldoInicial === null
            ? "Não informado"
            : `Salvo${dados.saldoInicialAtualizadoEm ? ` em ${formatarAtualizadoEm(dados.saldoInicialAtualizadoEm)}` : ""}`;

  const saldoAdornment =
    saldoStatus === "salvando" ? (
      <CircularProgress size={16} />
    ) : saldoStatus === "erro" ? (
      <ErrorOutlineIcon color="error" fontSize="small" />
    ) : !saldoAlterado && dados.saldoInicial !== null ? (
      <CheckCircleIcon color="success" fontSize="small" />
    ) : null;

  const { totais, minimo } = dados;
  // Without the saldo inicial the balances start at zero: negatives are not an alarm yet
  const semSaldoInicial = dados.saldoInicial === null;
  const resumoMes = resumoParcelas(dados.parcelas);
  const diasComBoleto = dados.dias.filter((d) => d.boletos > 0).length;
  const finalNegativo = !semSaldoInicial && totais.saldoFinal < 0;
  const menorNegativo = !semSaldoInicial && minimo.saldoFinal.valor < 0;

  const confirmarExclusao = async () => {
    if (!excluindo || excluindoStatus) return;
    setExcluindoStatus(true);
    try {
      await excluirLancamentoCaixa(excluindo.id);
      toast.success("Movimentação prevista excluída");
      setExcluindo(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setExcluindoStatus(false);
    }
  };

  const tituloQuadro = (t: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
      {t}
    </Typography>
  );
  const valorQuadro = (v: string, cor = "text.primary") => (
    <Typography variant="h6" fontWeight="bold" color={cor} sx={{ my: 0.25, ...NUMERO_SX }}>
      {v}
    </Typography>
  );
  const notaQuadro = (n: React.ReactNode, cor = "text.secondary") => (
    <Typography variant="caption" color={cor} sx={{ lineHeight: 1.35 }}>
      {n}
    </Typography>
  );

  return (
    <Box sx={{ mb: 4 }}>
      {cabecalho}

      {semSaldoInicial && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Informe o saldo inicial de {MESES_EXTENSO[mes - 1]} para ver a posição real do caixa. Sem ele, os saldos partem de zero.
        </Alert>
      )}

      {/* Resumo do mês em uma linha: saldo inicial − boletos − financiamentos ± previstas = saldo final */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" },
          gap: 2,
          mb: 2.5,
        }}
      >
        <Paper elevation={0} sx={CARD_SX}>
          {tituloQuadro("Saldo inicial")}
          <NumericFormat
            customInput={TextField}
            variant="standard"
            size="small"
            value={saldoInput ?? ""}
            onValueChange={(v) => {
              setSaldoInput(v.floatValue);
              if (saldoStatus === "erro") setSaldoStatus(null);
            }}
            onBlur={salvarSaldo}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            placeholder="R$ 0,00"
            helperText={saldoHelper}
            error={saldoStatus === "erro"}
            disabled={saldoStatus === "salvando"}
            fullWidth
            sx={{ mt: 0.5 }}
            slotProps={{
              input: { endAdornment: saldoAdornment ? <InputAdornment position="end">{saldoAdornment}</InputAdornment> : undefined },
              htmlInput: { "aria-label": `Saldo inicial de ${nomeMes}`, style: { fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "1.1rem" } },
            }}
          />
        </Paper>

        <Paper elevation={0} sx={CARD_SX}>
          {tituloQuadro("Boletos")}
          {valorQuadro(brl(totais.boletos), totais.boletos ? "error.main" : "text.primary")}
          {notaQuadro(diasComBoleto ? `${diasComBoleto} dia(s) com boletos` : "Digite o total de cada dia na tabela abaixo")}
        </Paper>

        <Paper elevation={0} sx={CARD_SX}>
          {tituloQuadro("Financiamentos")}
          {valorQuadro(brl(totais.financiamento), totais.financiamento ? "error.main" : "text.primary")}
          {resumoMes.quantidade ? (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1 }}>
              {notaQuadro(`${resumoMes.consideradas} de ${resumoMes.quantidade} parcela(s) consideradas`)}
              <Button size="small" sx={{ p: 0, minWidth: 0, textTransform: "none" }} onClick={() => setParcelasDe({ data: null })}>
                Escolher parcelas
              </Button>
            </Box>
          ) : (
            notaQuadro("Nenhuma parcela vence neste mês")
          )}
        </Paper>

        <Paper elevation={0} sx={CARD_SX}>
          {tituloQuadro("Movimentações previstas")}
          {valorQuadro(
            totais.previsao ? formatSinal(totais.previsao) : brl(0),
            totais.previsao > 0 ? "success.main" : totais.previsao < 0 ? "error.main" : "text.primary",
          )}
          {notaQuadro(`Entradas ${brl(totais.previsaoC)} · saídas ${brl(totais.previsaoD)}`)}
        </Paper>

        <Paper
          elevation={0}
          sx={(theme) => ({
            ...CARD_SX,
            border: "2px solid",
            borderColor: finalNegativo ? "error.main" : semSaldoInicial ? "divider" : "success.main",
            bgcolor: finalNegativo ? alpha(theme.palette.error.main, 0.05) : "background.paper",
          })}
        >
          {tituloQuadro("Saldo final")}
          {valorQuadro(brl(totais.saldoFinal), finalNegativo ? "error.main" : "text.primary")}
          {semSaldoInicial ? (
            <Tooltip arrow title="Quanto precisa haver no caixa no início do mês para cobrir boletos, financiamentos e saídas previstas.">
              <span>{notaQuadro(<>Necessidade de caixa: <b>{brl(minimo.saldoFinal.caixaNecessario)}</b></>)}</span>
            </Tooltip>
          ) : (
            notaQuadro(
              <>
                Menor saldo: <b>{brl(minimo.saldoFinal.valor)}</b> em {rotuloDia(minimo.saldoFinal.data)} ({diaSemana(minimo.saldoFinal.data)})
              </>,
              menorNegativo ? "error.main" : "text.secondary",
            )
          )}
        </Paper>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}

      <TabelaDias
        dados={dados}
        hoje={hoje}
        carregando={carregando}
        semSaldoInicial={semSaldoInicial}
        onSalvarBoleto={salvarBoleto}
        onAbrirParcelas={(data) => setParcelasDe({ data })}
        onAbrirPrevisoes={setPrevisoesDia}
      />

      {parcelasDe && (
        <ParcelasDialog
          parcelas={parcelasDe.data ? dados.parcelas.filter((p) => p.data === parcelasDe.data) : dados.parcelas}
          titulo={parcelasDe.data ? `${formatarDataISO(parcelasDe.data)} (${diaSemana(parcelasDe.data)})` : nomeMes}
          mostrarVencimento={!parcelasDe.data}
          onAlterar={alterarParcela}
          onClose={() => setParcelasDe(null)}
        />
      )}

      {previsoesDia && (
        <PrevisoesDiaDialog
          lancamentos={previsoesDoDia(dados.lancamentos, previsoesDia)}
          data={previsoesDia}
          onClose={() => setPrevisoesDia(null)}
          onNovo={() => setForm({ lancamento: null, data: previsoesDia })}
          onEditar={(l) => setForm({ lancamento: l, data: l.data })}
          onExcluir={setExcluindo}
        />
      )}

      {form && (
        <PrevisaoFormDialog
          estado={form}
          onClose={() => setForm(null)}
          onSalvo={async (l) => {
            setForm(null);
            if (!l.data.startsWith(`${ano}-${String(mes).padStart(2, "0")}-`)) {
              toast.info(`Movimentação salva em ${formatarDataISO(l.data)}, fora de ${MESES_EXTENSO[mes - 1]}.`);
            }
            await carregar();
          }}
        />
      )}

      <Dialog open={!!excluindo} onClose={excluindoStatus ? undefined : () => setExcluindo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir movimentação prevista?</DialogTitle>
        <DialogContent>
          {excluindo && (
            <Typography variant="body2">
              “{excluindo.descricao}” — {brl(excluindo.valor)} em {formatarDataISO(excluindo.data)}. Esta ação não pode ser desfeita.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluindo(null)} disabled={excluindoStatus}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmarExclusao}
            disabled={excluindoStatus}
            startIcon={excluindoStatus ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {excluindoStatus ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

/* ---------------------------------------------------------------- tabela */

const TabelaDias: React.FC<{
  dados: CaixaMes;
  hoje: string;
  carregando: boolean;
  semSaldoInicial: boolean;
  onSalvarBoleto: (data: string, valor: number | null) => Promise<void>;
  onAbrirParcelas: (data: string) => void;
  onAbrirPrevisoes: (data: string) => void;
}> = ({ dados, hoje, carregando, semSaldoInicial, onSalvarBoleto, onAbrirParcelas, onAbrirPrevisoes }) => {
  // Boleto inputs by date: Enter / ↓ / ↑ move between days like a spreadsheet
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const mover = (data: string, delta: 1 | -1) => {
    const i = dados.dias.findIndex((d) => d.data === data);
    const alvo = dados.dias[i + delta];
    const el = alvo && inputs.current.get(alvo.data);
    if (el) el.focus();
    else inputs.current.get(data)?.blur();
  };

  // Without the saldo inicial the balances start at zero: negatives are not an alarm yet
  const corSaldo = (v: number, mudo: boolean) => (v < 0 && !semSaldoInicial ? "error.main" : mudo ? "text.disabled" : "text.primary");
  const rodape = (cor = "text.primary") => ({ fontWeight: 700, color: cor, fontSize: "0.875rem", bgcolor: "grey.50", ...NUMERO_SX });
  // The Data column stays visible while the table scrolls sideways on small screens (min width 820px)
  const colunaFixa = { position: "sticky", left: 0 } as const;
  const notaFimDoMes = (
    <Box component="span" sx={{ display: "block", fontSize: "0.7rem", fontWeight: 400, color: "text.secondary" }}>
      no fim do mês
    </Box>
  );

  const celulaClicavel = (titulo: string, onClick: () => void) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": titulo,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    sx: {
      cursor: "pointer",
      ...NUMERO_SX,
      "&:hover, &:focus-visible": { bgcolor: (t: any) => alpha(t.palette.primary.main, 0.08), outline: "none" },
    },
  });

  const cabecalho: Array<{ rotulo: string; dica?: string }> = [
    { rotulo: "Data" },
    { rotulo: "Boletos (R$)", dica: "Digite o total dos boletos a pagar no dia. Salva ao pressionar Enter ou sair do campo; deixe vazio para zerar." },
    { rotulo: "Financiamento", dica: "Parcelas de financiamento com vencimento no dia marcadas para entrar no saldo. Clique para escolher." },
    { rotulo: "Saldo", dica: "Saldo inicial − boletos − financiamentos, acumulado até o dia." },
    { rotulo: "Movimentações previstas", dica: "Entradas menos saídas previstas no dia. Passe o mouse para ver as descrições; clique para incluir ou editar." },
    { rotulo: "Saldo final", dica: "Saldo + entradas previstas − saídas previstas, acumulado até o dia." },
  ];

  return (
    <Paper elevation={0} sx={{ border: "1px solid #e0e0e0", borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ height: 4 }}>{carregando && <LinearProgress />}</Box>
      <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
        <Table stickyHeader size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              {cabecalho.map((c, i) => (
                <TableCell
                  key={c.rotulo}
                  align={i === 0 ? "left" : "right"}
                  sx={{ fontWeight: 700, bgcolor: "grey.100", whiteSpace: "nowrap", ...(i === 0 ? { ...colunaFixa, zIndex: 3 } : {}) }}
                >
                  {c.dica ? (
                    <Tooltip title={c.dica} arrow>
                      <span>{c.rotulo}</span>
                    </Tooltip>
                  ) : (
                    c.rotulo
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {dados.dias.map((d) => {
              const parcelasDia = resumoParcelas(dados.parcelas, d.data);
              const previsoes = previsoesDoDia(dados.lancamentos, d.data);
              const mudo = d.boletos === 0 && d.financiamento === 0 && previsoes.length === 0;
              const ehHoje = d.data === hoje;
              return (
                <TableRow
                  key={d.data}
                  hover
                  sx={(t) => ({
                    ...(ehHoje ? { bgcolor: alpha(t.palette.primary.main, 0.07), boxShadow: `inset 3px 0 0 ${t.palette.primary.main}` } : {}),
                  })}
                >
                  <TableCell
                    sx={(t) => ({
                      whiteSpace: "nowrap",
                      color: mudo ? "text.disabled" : "text.primary",
                      ...colunaFixa,
                      zIndex: 1,
                      // Opaque background so the cells scrolled underneath don't show through
                      background: ehHoje
                        ? `linear-gradient(${alpha(t.palette.primary.main, 0.07)}, ${alpha(t.palette.primary.main, 0.07)}), ${t.palette.background.paper}`
                        : t.palette.background.paper,
                    })}
                  >
                    <Box component="span" sx={{ fontWeight: mudo ? 400 : 600, ...NUMERO_SX }}>
                      {rotuloDia(d.data)}
                    </Box>
                    <Box component="span" sx={{ ml: 1, color: "text.secondary", fontSize: "0.75rem" }}>
                      {diaSemana(d.data)}
                    </Box>
                    {ehHoje && <Chip label="hoje" size="small" color="primary" sx={{ ml: 1, height: 18, fontSize: "0.68rem" }} />}
                  </TableCell>

                  <TableCell align="right" sx={{ py: 0.25, px: 1, width: 150 }}>
                    <BoletoDiaInput
                      data={d.data}
                      valor={d.boletos}
                      rotulo={rotuloDia(d.data)}
                      registrar={(el) => (el ? inputs.current.set(d.data, el) : inputs.current.delete(d.data))}
                      onSalvar={onSalvarBoleto}
                      onMover={mover}
                    />
                  </TableCell>

                  {parcelasDia.quantidade ? (
                    <TableCell align="right" {...celulaClicavel(`Parcelas de ${rotuloDia(d.data)}`, () => onAbrirParcelas(d.data))}>
                      <Box component="span" sx={{ color: d.financiamento ? "error.main" : "text.disabled" }}>
                        {d.financiamento ? brl(d.financiamento) : "—"}
                      </Box>
                      {parcelasDia.valorNaoConsiderado > 0 && (
                        <Box component="span" sx={{ display: "block", fontSize: "0.7rem", color: "text.secondary" }}>
                          {brl(parcelasDia.valorNaoConsiderado)} não considerado
                        </Box>
                      )}
                    </TableCell>
                  ) : (
                    <TableCell align="right" sx={{ color: "text.disabled" }}>
                      —
                    </TableCell>
                  )}

                  <TableCell align="right" sx={{ ...NUMERO_SX, fontWeight: 600, color: corSaldo(d.saldo, mudo) }}>
                    {brl(d.saldo)}
                  </TableCell>

                  <TableCell
                    align="right"
                    {...celulaClicavel(
                      previsoes.length ? `Movimentações previstas de ${rotuloDia(d.data)}` : `Incluir movimentação prevista em ${rotuloDia(d.data)}`,
                      () => onAbrirPrevisoes(d.data),
                    )}
                  >
                    {previsoes.length ? (
                      <Tooltip arrow title={<DicaPrevisoes previsoes={previsoes} />}>
                        <Box
                          component="span"
                          sx={{
                            color: d.previsao > 0 ? "success.main" : d.previsao < 0 ? "error.main" : "text.secondary",
                            borderBottom: "1px dotted",
                          }}
                        >
                          {d.previsao ? formatSinal(d.previsao) : brl(0)}
                        </Box>
                      </Tooltip>
                    ) : (
                      <Box component="span" sx={{ color: "text.disabled" }}>
                        —
                      </Box>
                    )}
                  </TableCell>

                  <TableCell align="right" sx={{ ...NUMERO_SX, fontWeight: 700, color: corSaldo(d.saldoFinal, mudo) }}>
                    {brl(d.saldoFinal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell sx={{ ...rodape(), ...colunaFixa, zIndex: 1 }}>Total do mês</TableCell>
              <TableCell align="right" sx={rodape()}>{brl(dados.totais.boletos)}</TableCell>
              <TableCell align="right" sx={rodape()}>{brl(dados.totais.financiamento)}</TableCell>
              <TableCell align="right" sx={rodape(dados.totais.saldo < 0 && !semSaldoInicial ? "error.main" : undefined)}>
                {brl(dados.totais.saldo)}
                {notaFimDoMes}
              </TableCell>
              <TableCell align="right" sx={rodape()}>
                {dados.totais.previsao ? formatSinal(dados.totais.previsao) : brl(0)}
              </TableCell>
              <TableCell align="right" sx={rodape(dados.totais.saldoFinal < 0 && !semSaldoInicial ? "error.main" : undefined)}>
                {brl(dados.totais.saldoFinal)}
                {notaFimDoMes}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Paper>
  );
};

/** Tooltip das movimentações previstas: uma linha por lançamento, com a descrição. */
const DicaPrevisoes: React.FC<{ previsoes: CaixaLancamento[] }> = ({ previsoes }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, py: 0.25 }}>
    {previsoes.map((l) => (
      <Box key={l.id} sx={{ display: "flex", gap: 1.5, justifyContent: "space-between" }}>
        <span>
          {l.natureza === "C" ? "Entrada" : "Saída"} · {l.descricao}
        </span>
        <Box component="span" sx={{ fontWeight: 700, ...NUMERO_SX }}>
          {l.natureza === "C" ? "+" : "−"} {brl(l.valor)}
        </Box>
      </Box>
    ))}
  </Box>
);

/** Célula editável com o total de boletos do dia: salva ao sair do campo ou com Enter (e desce para o próximo dia). */
const BoletoDiaInput: React.FC<{
  data: string;
  valor: number;
  rotulo: string;
  registrar: (el: HTMLInputElement | null) => void;
  onSalvar: (data: string, valor: number | null) => Promise<void>;
  onMover: (data: string, delta: 1 | -1) => void;
}> = ({ data, valor, rotulo, registrar, onSalvar, onMover }) => {
  const [texto, setTexto] = useState(() => textoValorEditavel(valor));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const focado = useRef(false);
  const cancelar = useRef(false);

  // A new value from the server (after a save / reload) replaces the text unless the user is typing
  useEffect(() => {
    if (!focado.current) {
      setTexto(textoValorEditavel(valor));
      setErro(null);
    }
  }, [valor]);

  const confirmar = async () => {
    const r = interpretarValorDia(texto);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    setTexto(textoValorEditavel(r.valor));
    if (mesmoValor(r.valor, valor)) return;
    setSalvando(true);
    try {
      await onSalvar(data, r.valor);
    } catch {
      setErro("Não foi possível salvar. Saia do campo de novo para tentar outra vez.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <InputBase
      inputRef={registrar}
      value={texto}
      placeholder="0,00"
      onChange={(e) => {
        setTexto(e.target.value);
        if (erro) setErro(null);
      }}
      onFocus={(e) => {
        focado.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focado.current = false;
        if (cancelar.current) {
          cancelar.current = false;
          return;
        }
        confirmar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "ArrowDown") {
          e.preventDefault();
          onMover(data, 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onMover(data, -1);
        } else if (e.key === "Escape") {
          cancelar.current = true;
          setTexto(textoValorEditavel(valor));
          setErro(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
      error={!!erro}
      endAdornment={
        salvando ? (
          <CircularProgress size={12} sx={{ ml: 0.5, flexShrink: 0 }} />
        ) : erro ? (
          <Tooltip title={erro} arrow>
            <ErrorOutlineIcon color="error" sx={{ ml: 0.5, fontSize: 16 }} />
          </Tooltip>
        ) : undefined
      }
      inputProps={{
        inputMode: "decimal",
        "aria-label": `Boletos de ${rotulo}`,
        "aria-invalid": !!erro,
        title: erro ?? undefined,
        style: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
      }}
      sx={(t) => ({
        width: "100%",
        px: 1,
        py: 0.25,
        fontSize: "0.875rem",
        borderRadius: 1,
        border: "1px solid",
        borderColor: erro ? t.palette.error.main : "transparent",
        bgcolor: erro ? alpha(t.palette.error.main, 0.06) : "transparent",
        color: valor ? t.palette.error.main : t.palette.text.primary,
        "&:hover": { borderColor: erro ? t.palette.error.main : t.palette.grey[400] },
        "&.Mui-focused": { borderColor: t.palette.primary.main, bgcolor: t.palette.background.paper, color: t.palette.text.primary },
        "& input::placeholder": { color: t.palette.text.disabled, opacity: 1 },
      })}
    />
  );
};

/* ------------------------------------------------ parcelas (escolha) */

const STATUS_COR: Record<string, "success" | "error" | "info" | "default"> = {
  Liquidado: "success",
  Vencido: "error",
  Aberto: "info",
};

const semChave = <T,>(obj: Record<number, T>, id: number) => {
  const copia = { ...obj };
  delete copia[id];
  return copia;
};

const ParcelasDialog: React.FC<{
  parcelas: CaixaParcela[];
  titulo: string;
  mostrarVencimento: boolean;
  onAlterar: (p: CaixaParcela, considerar: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ parcelas, titulo, mostrarVencimento, onAlterar, onClose }) => {
  // Choice shown right away while it is saved; the reload brings the stored value
  const [marcadas, setMarcadas] = useState<Record<number, boolean>>({});
  const [salvando, setSalvando] = useState<Record<number, boolean>>({});
  const considerada = (p: CaixaParcela) => marcadas[p.id] ?? p.considerada;

  const alternar = async (p: CaixaParcela) => {
    const novo = !considerada(p);
    setMarcadas((m) => ({ ...m, [p.id]: novo }));
    setSalvando((s) => ({ ...s, [p.id]: true }));
    try {
      await onAlterar(p, novo);
    } catch {
      // toast already shown; the checkbox goes back to the stored value
    } finally {
      setMarcadas((m) => semChave(m, p.id));
      setSalvando((m) => semChave(m, p.id));
    }
  };

  const total = (filtro: (p: CaixaParcela) => boolean) =>
    parcelas.filter(filtro).reduce((s, p) => s + Math.round(p.valor * 100), 0) / 100;
  const totalConsiderado = total(considerada);
  const totalGeral = total(() => true);
  const colunas = [...(mostrarVencimento ? ["Vencimento"] : []), "Contrato", "Tomador", "Banco", "Parcela", "Status", "Valor"];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Parcelas de financiamento — {titulo}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.25 }}>
          Marque as parcelas que devem entrar na apuração do saldo.
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ fontWeight: 700, whiteSpace: "nowrap", pl: 2 }}>
                  Considerar
                </TableCell>
                {colunas.map((h) => (
                  <TableCell key={h} align={h === "Valor" ? "right" : "left"} sx={{ fontWeight: 700 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {parcelas.map((p) => {
                const marcada = considerada(p);
                const descricao = `parcela ${p.numParcela} do contrato ${p.contrato ?? `#${p.idFinanciamento}`}`;
                return (
                  <TableRow key={p.id} hover onClick={() => !salvando[p.id] && alternar(p)} sx={{ cursor: "pointer" }}>
                    <TableCell padding="checkbox" sx={{ pl: 2 }}>
                      <Checkbox
                        checked={marcada}
                        disabled={!!salvando[p.id]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => alternar(p)}
                        inputProps={{ "aria-label": `Considerar ${descricao}` }}
                      />
                    </TableCell>
                    {mostrarVencimento && (
                      <TableCell sx={{ ...NUMERO_SX, color: marcada ? "text.primary" : "text.secondary" }}>
                        {formatarDataISO(p.data)}
                      </TableCell>
                    )}
                    <TableCell sx={{ color: marcada ? "text.primary" : "text.secondary" }}>
                      {p.contrato ?? `#${p.idFinanciamento}`}
                      {p.modalidade === "RENEGOCIACAO" && (
                        <Chip label="Renegociação" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: "0.68rem" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: marcada ? "text.primary" : "text.secondary" }}>{p.tomador ?? "—"}</TableCell>
                    <TableCell sx={{ color: marcada ? "text.primary" : "text.secondary" }}>{p.banco ?? "—"}</TableCell>
                    <TableCell sx={{ color: marcada ? "text.primary" : "text.secondary" }}>{p.numParcela}ª</TableCell>
                    <TableCell>
                      <Chip label={p.status} size="small" color={STATUS_COR[p.status] ?? "default"} variant="outlined" />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ ...NUMERO_SX, color: marcada ? "error.main" : "text.secondary", textDecoration: marcada ? "none" : "line-through" }}
                    >
                      {brl(p.valor)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={colunas.length} sx={{ fontWeight: 700, color: "text.primary", pl: 2 }}>
                  Considerado no saldo
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "text.primary", ...NUMERO_SX }}>
                  {brl(totalConsiderado)}
                  {totalConsiderado !== totalGeral && (
                    <Box component="span" sx={{ display: "block", fontSize: "0.7rem", fontWeight: 400, color: "text.secondary" }}>
                      de {brl(totalGeral)}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, py: 1.25 }}>
          Sem escolha sua, parcelas abertas e vencidas entram no saldo e as liquidadas não. A escolha fica salva; se o
          vencimento mudar no cadastro do financiamento, a parcela passa para a nova data automaticamente.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ---------------------------------------- movimentações previstas do dia */

const PrevisoesDiaDialog: React.FC<{
  lancamentos: CaixaLancamento[];
  data: string;
  onClose: () => void;
  onNovo: () => void;
  onEditar: (l: CaixaLancamento) => void;
  onExcluir: (l: CaixaLancamento) => void;
}> = ({ lancamentos, data, onClose, onNovo, onEditar, onExcluir }) => {
  const total = lancamentos.reduce((s, l) => s + (l.natureza === "C" ? l.valor : -l.valor), 0);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Movimentações previstas — {formatarDataISO(data)} ({diaSemana(data)})
      </DialogTitle>
      <DialogContent dividers>
        {lancamentos.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Nenhuma movimentação prevista neste dia.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {lancamentos.map((l) => (
              <Box
                key={l.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {l.descricao}
                  </Typography>
                  <Chip
                    label={l.natureza === "C" ? "Entrada (C)" : "Saída (D)"}
                    size="small"
                    color={l.natureza === "C" ? "success" : "error"}
                    variant="outlined"
                    sx={{ mt: 0.5, height: 20, fontSize: "0.7rem" }}
                  />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: l.natureza === "C" ? "success.main" : "error.main", ...NUMERO_SX }}>
                  {brl(l.valor)}
                </Typography>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEditar(l)} aria-label={`Editar ${l.descricao}`}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Excluir">
                  <IconButton size="small" color="error" onClick={() => onExcluir(l)} aria-label={`Excluir ${l.descricao}`}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Total do dia
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: total < 0 ? "error.main" : "success.main", ...NUMERO_SX }}>
                {total ? formatSinal(total) : brl(0)}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onNovo}>
          Adicionar movimentação
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ------------------------------------------------- formulário (modal) */

const PrevisaoFormDialog: React.FC<{
  estado: FormState;
  onClose: () => void;
  onSalvo: (l: CaixaLancamento) => void;
}> = ({ estado, onClose, onSalvo }) => {
  const { lancamento } = estado;
  const naturezaInicial: NaturezaCaixa = lancamento?.natureza ?? "C";
  const [data, setData] = useState(estado.data);
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState<number | undefined>(lancamento?.valor);
  const [natureza, setNatureza] = useState<NaturezaCaixa>(naturezaInicial);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const alterado =
    data !== estado.data ||
    descricao !== (lancamento?.descricao ?? "") ||
    valor !== lancamento?.valor ||
    natureza !== naturezaInicial;

  // Esc / click outside must not throw away what was typed: ask first
  const fecharPorFora = () => {
    if (salvando) return;
    if (alterado) setConfirmarDescarte(true);
    else onClose();
  };

  const erros = {
    data: dataCaixaValida(data) ? "" : `Informe uma data válida até 31/12/${ANO_MAX_CAIXA}`,
    descricao: descricao.trim() ? "" : "Informe a descrição",
    valor: valor && valor > 0 ? "" : "Informe um valor maior que zero",
  };
  const valido = !erros.data && !erros.descricao && !erros.valor;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const corpo = { tipo: "PREVISAO" as const, natureza, data, descricao: descricao.trim(), valor: valor! };
      const salvo = lancamento ? await atualizarLancamentoCaixa(lancamento.id, corpo) : await criarLancamentoCaixa(corpo);
      toast.success(lancamento ? "Movimentação prevista atualizada" : "Movimentação prevista incluída");
      onSalvo(salvo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar a movimentação prevista");
      setSalvando(false);
    }
  };

  return (
    <Dialog open onClose={fecharPorFora} maxWidth="xs" fullWidth>
      <form onSubmit={enviar} noValidate>
        <DialogTitle>{lancamento ? "Editar movimentação prevista" : "Nova movimentação prevista"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={natureza}
            onChange={(_, v: NaturezaCaixa | null) => v && setNatureza(v)}
            aria-label="Entrada ou saída"
          >
            <ToggleButton value="C" color="success">
              Entrada (C)
            </ToggleButton>
            <ToggleButton value="D" color="error">
              Saída (D)
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Data"
            type="date"
            size="small"
            value={data}
            onChange={(e) => setData(e.target.value)}
            error={tentou && !!erros.data}
            helperText={tentou ? erros.data : ""}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: DATA_MAX } }}
            required
          />
          <TextField
            label="Descrição"
            size="small"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            error={tentou && !!erros.descricao}
            helperText={tentou ? erros.descricao : "Aparece ao passar o mouse sobre o valor na tabela"}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            autoFocus
            required
          />
          <NumericFormat
            customInput={TextField}
            label="Valor"
            size="small"
            value={valor ?? ""}
            onValueChange={(v) => setValor(v.floatValue)}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            placeholder="R$ 0,00"
            error={tentou && !!erros.valor}
            helperText={tentou ? erros.valor : ""}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogActions>
      </form>

      <Dialog open={confirmarDescarte} onClose={() => setConfirmarDescarte(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Descartar o que foi digitado?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {lancamento ? "As alterações ainda não foram salvas." : "Esta movimentação ainda não foi salva."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarDescarte(false)} autoFocus>
            Continuar editando
          </Button>
          <Button color="error" onClick={onClose}>
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default CaixaTab;
