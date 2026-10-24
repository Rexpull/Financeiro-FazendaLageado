import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { NumericFormat } from "react-number-format";
import { toast } from "react-toastify";
import {
  atualizarLancamentoCaixa,
  CaixaLancamento,
  CaixaMes,
  criarLancamentoCaixa,
  excluirLancamentoCaixa,
  getCaixa,
  NaturezaCaixa,
  salvarSaldoInicial,
  TipoLancamentoCaixa,
} from "../../services/caixaService";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatSinal = (value: number) => `${value > 0 ? "+" : "−"} ${formatCurrency(Math.abs(value))}`;

// Datas sempre como 'YYYY-MM-DD' (string); dia da semana via UTC para não depender do fuso.
const partes = (data: string) => data.split("-").map(Number) as [number, number, number];
const diaSemana = (data: string) => {
  const [a, m, d] = partes(data);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
};
const rotuloDia = (data: string) => {
  const [, m, d] = partes(data);
  return `${String(d).padStart(2, "0")}/${MESES[m - 1].toLowerCase()}`;
};
const dataBR = (data: string) => {
  const [a, m, d] = partes(data);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
};
const hojeISO = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
};
/** CURRENT_TIMESTAMP do SQLite é UTC 'YYYY-MM-DD HH:MM:SS'. */
const formatarAtualizadoEm = (s: string | null) => {
  if (!s) return "";
  const dt = new Date(`${s.replace(" ", "T")}${/Z|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z"}`);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const NUMERO_SX = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

const CARD_SX = {
  border: "1px solid #e0e0e0",
  borderRadius: 3,
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  px: 2.5,
  py: 2,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
} as const;

type TipoDetalhe = TipoLancamentoCaixa | "FINANCIAMENTO";

interface FormState {
  tipo: TipoLancamentoCaixa;
  lancamento: CaixaLancamento | null;
  data: string;
}

interface CaixaTabProps {
  anoSelecionado: number;
  /** '' (todos) ou "Jan".."Dez" */
  mesSelecionado: string;
}

/**
 * Caixa diário do mês: saldo inicial digitado − boletos − parcelas de financiamento (Saldo),
 * e o simulador de previsões de entrada/saída (Saldo final). Ambos acumulados dia a dia.
 */
export const CaixaTab: React.FC<CaixaTabProps> = ({ anoSelecionado, mesSelecionado }) => {
  const mes = MESES.indexOf(mesSelecionado) + 1; // 0 = nenhum mês selecionado
  const [dados, setDados] = useState<CaixaMes | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saldoInput, setSaldoInput] = useState<number | undefined>(undefined);
  const [saldoStatus, setSaldoStatus] = useState<"salvando" | "erro" | null>(null);
  const [detalhe, setDetalhe] = useState<{ tipo: TipoDetalhe; data: string } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [excluindo, setExcluindo] = useState<CaixaLancamento | null>(null);
  const [excluindoStatus, setExcluindoStatus] = useState(false);
  const requisicao = useRef(0);

  const carregar = useCallback(async () => {
    if (!mes) return;
    const id = ++requisicao.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await getCaixa(anoSelecionado, mes);
      if (id !== requisicao.current) return; // resposta de um mês que já foi trocado
      setDados(r);
      setSaldoInput(r.saldoInicial ?? undefined);
    } catch (e) {
      if (id !== requisicao.current) return;
      setErro(e instanceof Error ? e.message : "Erro ao carregar o caixa");
    } finally {
      if (id === requisicao.current) setCarregando(false);
    }
  }, [anoSelecionado, mes]);

  useEffect(() => {
    setDados(null);
    setDetalhe(null);
    setForm(null);
    setExcluindo(null);
    setSaldoStatus(null);
    carregar();
  }, [carregar]);

  if (!mes) {
    return (
      <Paper elevation={0} sx={{ ...CARD_SX, alignItems: "center", py: 6, textAlign: "center" }}>
        <CalendarMonthIcon sx={{ fontSize: 56, color: "grey.400" }} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 1.5 }}>
          Selecione um mês no filtro “Mês” acima para ver o caixa dia a dia.
        </Typography>
      </Paper>
    );
  }

  const nomeMes = `${MESES_EXTENSO[mes - 1].charAt(0).toUpperCase()}${MESES_EXTENSO[mes - 1].slice(1)} de ${anoSelecionado}`;

  if (!dados) {
    return erro ? (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
        {erro}
      </Alert>
    ) : (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hoje = hojeISO();
  const dataPadrao = hoje.startsWith(`${anoSelecionado}-${String(mes).padStart(2, "0")}-`) ? hoje : dados.dias[0].data;
  const saldoAlterado = (saldoInput ?? null) !== dados.saldoInicial;

  const salvarSaldo = async () => {
    if (!saldoAlterado || saldoStatus === "salvando") return;
    setSaldoStatus("salvando");
    try {
      await salvarSaldoInicial(anoSelecionado, mes, saldoInput ?? null);
      await carregar(); // recalcula os saldos com o novo valor
      setSaldoStatus(null);
    } catch (e) {
      setSaldoStatus("erro");
      toast.error(e instanceof Error ? e.message : "Erro ao salvar o saldo inicial");
    }
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
  const nBoletos = dados.lancamentos.filter((l) => l.tipo === "BOLETO").length;
  // Without the saldo inicial the balances start at zero: show the cash need neutrally, not as an alarm
  const semSaldoInicial = dados.saldoInicial === null;
  const menorNegativo = !semSaldoInicial && minimo.saldo.valor < 0;
  const corDestaque = semSaldoInicial ? "info" : menorNegativo ? "error" : "success";

  const quadros = [
    { titulo: "Total de boletos", valor: totais.boletos, cor: "error.main", nota: `${nBoletos} boleto(s) no mês` },
    { titulo: "Total de financiamentos", valor: totais.financiamento, cor: "error.main", nota: `${dados.parcelas.length} parcela(s) com vencimento no mês` },
    {
      titulo: "Saldo projetado (sem entradas)",
      valor: totais.saldo,
      cor: totais.saldo < 0 && !semSaldoInicial ? "error.main" : "text.primary",
      nota: "No fim do mês: saldo inicial − boletos − financiamentos",
    },
    {
      titulo: "Saldo final com previsões",
      valor: totais.saldoFinal,
      cor: totais.saldoFinal < 0 && !semSaldoInicial ? "error.main" : "text.primary",
      nota: `Entradas ${formatCurrency(totais.previsaoC)} · saídas ${formatCurrency(totais.previsaoD)}`,
    },
  ];

  const abrirNovo = (tipo: TipoLancamentoCaixa, data = dataPadrao) => setForm({ tipo, lancamento: null, data });

  const confirmarExclusao = async () => {
    if (!excluindo || excluindoStatus) return;
    setExcluindoStatus(true);
    try {
      await excluirLancamentoCaixa(excluindo.id);
      toast.success(excluindo.tipo === "BOLETO" ? "Boleto excluído" : "Previsão excluída");
      setExcluindo(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setExcluindoStatus(false);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Barra superior: mês, saldo inicial e ações */}
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

          <NumericFormat
            customInput={TextField}
            label="Saldo inicial"
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
            sx={{ width: { xs: "100%", sm: 260 } }}
            slotProps={{
              input: { endAdornment: saldoAdornment ? <InputAdornment position="end">{saldoAdornment}</InputAdornment> : undefined },
              htmlInput: { "aria-label": `Saldo inicial de ${nomeMes}`, style: { fontVariantNumeric: "tabular-nums" } },
            }}
          />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNovo("BOLETO")}>
              Novo boleto
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => abrirNovo("PREVISAO")}>
              Nova previsão
            </Button>
          </Box>
        </Box>
      </Paper>

      {dados.saldoInicial === null && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Informe o saldo inicial de {MESES_EXTENSO[mes - 1]} para ver a posição real do caixa. Sem ele, os saldos partem de zero.
        </Alert>
      )}

      {/* Quadros de resumo: o menor saldo do mês é o número-chave */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "minmax(0, 1.4fr) repeat(2, minmax(0, 1fr))", xl: "minmax(0, 1.5fr) repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 2.5 }}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            ...CARD_SX,
            gridColumn: { sm: "1 / -1", lg: "auto" },
            border: "2px solid",
            borderColor: `${corDestaque}.main`,
            bgcolor: alpha(theme.palette[corDestaque].main, 0.06),
          })}
        >
          {semSaldoInicial ? (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                Necessidade de caixa no mês
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="text.primary" sx={{ my: 0.25, ...NUMERO_SX }}>
                {formatCurrency(minimo.saldo.caixaNecessario)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                saídas acumuladas até {rotuloDia(minimo.saldo.data)} ({diaSemana(minimo.saldo.data)})
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.4 }}>
                Valor que precisa estar no caixa no início do mês para pagar os boletos e financiamentos.
                Informe o saldo inicial acima para ver se o caixa cobre esses compromissos.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                Com previsões: <b>{formatCurrency(minimo.saldoFinal.caixaNecessario)}</b> até {rotuloDia(minimo.saldoFinal.data)} ({diaSemana(minimo.saldoFinal.data)})
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                Menor saldo do mês
              </Typography>
              <Typography variant="h4" fontWeight="bold" color={menorNegativo ? "error.main" : "success.dark"} sx={{ my: 0.25, ...NUMERO_SX }}>
                {formatCurrency(minimo.saldo.valor)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                em {rotuloDia(minimo.saldo.data)} ({diaSemana(minimo.saldo.data)})
              </Typography>
              <Typography variant="caption" color={menorNegativo ? "error.main" : "text.secondary"} sx={{ mt: 0.5, lineHeight: 1.4 }}>
                {menorNegativo
                  ? `Faltam ${formatCurrency(minimo.saldo.aporteNecessario)} para honrar os compromissos.`
                  : "Compromissos cobertos pelo saldo inicial."}{" "}
                Caixa mínimo necessário no início do mês: <b>{formatCurrency(minimo.saldo.caixaNecessario)}</b>.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                Com previsões:{" "}
                <Box component="span" sx={{ color: minimo.saldoFinal.valor < 0 ? "error.main" : "inherit", fontWeight: 600 }}>
                  {formatCurrency(minimo.saldoFinal.valor)}
                </Box>{" "}
                em {rotuloDia(minimo.saldoFinal.data)} ({diaSemana(minimo.saldoFinal.data)})
              </Typography>
            </>
          )}
        </Paper>

        {quadros.map((q) => (
          <Paper key={q.titulo} elevation={0} sx={CARD_SX}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {q.titulo}
            </Typography>
            <Typography variant="h6" fontWeight="bold" color={q.cor} sx={{ my: 0.25, ...NUMERO_SX }}>
              {formatCurrency(q.valor)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
              {q.nota}
            </Typography>
          </Paper>
        ))}
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
        onAbrir={(tipo, data) => setDetalhe({ tipo, data })}
      />

      {detalhe && (
        <DetalheDiaDialog
          dados={dados}
          tipo={detalhe.tipo}
          data={detalhe.data}
          onClose={() => setDetalhe(null)}
          onNovo={(tipo) => abrirNovo(tipo, detalhe.data)}
          onEditar={(l) => setForm({ tipo: l.tipo, lancamento: l, data: l.data })}
          onExcluir={setExcluindo}
        />
      )}

      {form && (
        <LancamentoFormDialog
          estado={form}
          onClose={() => setForm(null)}
          onSalvo={async (l) => {
            setForm(null);
            if (!l.data.startsWith(`${anoSelecionado}-${String(mes).padStart(2, "0")}-`)) {
              toast.info(`Lançamento salvo em ${dataBR(l.data)}, fora de ${MESES_EXTENSO[mes - 1]}.`);
            }
            await carregar();
          }}
        />
      )}

      <Dialog open={!!excluindo} onClose={excluindoStatus ? undefined : () => setExcluindo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir {excluindo?.tipo === "BOLETO" ? "boleto" : "previsão"}?</DialogTitle>
        <DialogContent>
          {excluindo && (
            <Typography variant="body2">
              “{excluindo.descricao}” — {formatCurrency(excluindo.valor)} em {dataBR(excluindo.data)}. Esta ação não pode ser desfeita.
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
  onAbrir: (tipo: TipoDetalhe, data: string) => void;
}> = ({ dados, hoje, carregando, semSaldoInicial, onAbrir }) => {
  // Without the saldo inicial the balances start at zero: negatives are not an alarm yet
  const corSaldo = (v: number, mudo: boolean) => (v < 0 && !semSaldoInicial ? "error.main" : mudo ? "text.disabled" : "text.primary");
  const rodape = (cor = "text.primary") => ({ fontWeight: 700, color: cor, fontSize: "0.875rem", bgcolor: "grey.50", ...NUMERO_SX });
  // The Data column stays visible while the table scrolls sideways on small screens (min width 760px)
  const colunaFixa = { position: "sticky", left: 0 } as const;
  const notaFimDoMes = (
    <Box component="span" sx={{ display: "block", fontSize: "0.7rem", fontWeight: 400, color: "text.secondary" }}>
      no fim do mês
    </Box>
  );

  const celulaClicavel = (titulo: string, onClick: () => void) => ({
    role: "button",
    tabIndex: 0,
    title: titulo,
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
    { rotulo: "Boletos", dica: "Boletos a pagar com vencimento no dia. Clique para ver, incluir ou editar." },
    { rotulo: "Financiamento", dica: "Parcelas de financiamento com vencimento no dia (todos os status)." },
    { rotulo: "Saldo", dica: "Saldo inicial − boletos − financiamentos, acumulado até o dia." },
    { rotulo: "Previsões (entradas − saídas)", dica: "Previsões de entrada (C) menos previsões de saída (D) ainda não confirmadas. Clique para ver, incluir ou editar." },
    { rotulo: "Saldo final", dica: "Saldo + previsões de entrada − previsões de saída, acumulado até o dia." },
  ];

  return (
    <Paper elevation={0} sx={{ border: "1px solid #e0e0e0", borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ height: 4 }}>{carregando && <LinearProgress />}</Box>
      <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
        <Table stickyHeader size="small" sx={{ minWidth: 760 }}>
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
              const mudo = d.boletos === 0 && d.financiamento === 0 && d.previsaoC === 0 && d.previsaoD === 0;
              const ehHoje = d.data === hoje;
              const corMov = mudo ? "text.disabled" : "text.primary";
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
                      color: corMov,
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

                  <TableCell align="right" {...celulaClicavel(`Boletos de ${rotuloDia(d.data)}`, () => onAbrir("BOLETO", d.data))}>
                    <Box component="span" sx={{ color: d.boletos ? "error.main" : "text.disabled" }}>
                      {d.boletos ? formatCurrency(d.boletos) : "—"}
                    </Box>
                  </TableCell>

                  {d.financiamento ? (
                    <TableCell align="right" {...celulaClicavel(`Parcelas de ${rotuloDia(d.data)}`, () => onAbrir("FINANCIAMENTO", d.data))}>
                      <Box component="span" sx={{ color: "error.main" }}>
                        {formatCurrency(d.financiamento)}
                      </Box>
                    </TableCell>
                  ) : (
                    <TableCell align="right" sx={{ color: "text.disabled" }}>
                      —
                    </TableCell>
                  )}

                  <TableCell align="right" sx={{ ...NUMERO_SX, fontWeight: 600, color: corSaldo(d.saldo, mudo) }}>
                    {formatCurrency(d.saldo)}
                  </TableCell>

                  <TableCell align="right" {...celulaClicavel(`Previsões de ${rotuloDia(d.data)}`, () => onAbrir("PREVISAO", d.data))}>
                    {d.previsaoC || d.previsaoD ? (
                      <Tooltip
                        arrow
                        title={`Entradas (C): ${formatCurrency(d.previsaoC)} · Saídas (D): ${formatCurrency(d.previsaoD)}`}
                      >
                        <Box component="span" sx={{ color: d.previsao > 0 ? "success.main" : d.previsao < 0 ? "error.main" : "text.secondary" }}>
                          {d.previsao ? formatSinal(d.previsao) : formatCurrency(0)}
                        </Box>
                      </Tooltip>
                    ) : (
                      <Box component="span" sx={{ color: "text.disabled" }}>
                        —
                      </Box>
                    )}
                  </TableCell>

                  <TableCell align="right" sx={{ ...NUMERO_SX, fontWeight: 700, color: corSaldo(d.saldoFinal, mudo) }}>
                    {formatCurrency(d.saldoFinal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell sx={{ ...rodape(), ...colunaFixa, zIndex: 1 }}>Total do mês</TableCell>
              <TableCell align="right" sx={rodape()}>{formatCurrency(dados.totais.boletos)}</TableCell>
              <TableCell align="right" sx={rodape()}>{formatCurrency(dados.totais.financiamento)}</TableCell>
              <TableCell align="right" sx={rodape(dados.totais.saldo < 0 && !semSaldoInicial ? "error.main" : undefined)}>
                {formatCurrency(dados.totais.saldo)}
                {notaFimDoMes}
              </TableCell>
              <TableCell align="right" sx={rodape()}>
                {dados.totais.previsao ? formatSinal(dados.totais.previsao) : formatCurrency(0)}
              </TableCell>
              <TableCell align="right" sx={rodape(dados.totais.saldoFinal < 0 && !semSaldoInicial ? "error.main" : undefined)}>
                {formatCurrency(dados.totais.saldoFinal)}
                {notaFimDoMes}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Paper>
  );
};

/* ------------------------------------------------------ detalhe do dia */

const STATUS_COR: Record<string, "success" | "error" | "info" | "default"> = {
  Liquidado: "success",
  Vencido: "error",
  Aberto: "info",
};

const DetalheDiaDialog: React.FC<{
  dados: CaixaMes;
  tipo: TipoDetalhe;
  data: string;
  onClose: () => void;
  onNovo: (tipo: TipoLancamentoCaixa) => void;
  onEditar: (l: CaixaLancamento) => void;
  onExcluir: (l: CaixaLancamento) => void;
}> = ({ dados, tipo, data, onClose, onNovo, onEditar, onExcluir }) => {
  const titulo =
    tipo === "BOLETO" ? "Boletos" : tipo === "PREVISAO" ? "Previsões" : "Parcelas de financiamento";

  if (tipo === "FINANCIAMENTO") {
    const parcelas = dados.parcelas.filter((p) => p.data === data);
    const total = parcelas.reduce((s, p) => s + p.valor, 0);
    return (
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {titulo} — {dataBR(data)} ({diaSemana(data)})
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  {["Contrato", "Tomador", "Banco", "Parcela", "Status", "Valor"].map((h, i) => (
                    <TableCell key={h} align={i === 5 ? "right" : "left"} sx={{ fontWeight: 700 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {parcelas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.contrato ?? `#${p.idFinanciamento}`}</TableCell>
                    <TableCell>{p.tomador ?? "—"}</TableCell>
                    <TableCell>{p.banco ?? "—"}</TableCell>
                    <TableCell>{p.numParcela}ª</TableCell>
                    <TableCell>
                      <Chip label={p.status} size="small" color={STATUS_COR[p.status] ?? "default"} variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={NUMERO_SX}>
                      {formatCurrency(p.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} sx={{ fontWeight: 700, color: "text.primary" }}>
                    Total do dia
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "text.primary", ...NUMERO_SX }}>
                    {formatCurrency(total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, py: 1.25 }}>
            Todas as parcelas com vencimento no dia entram na previsão, inclusive as já liquidadas (o saldo parte do saldo inicial do mês).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const itens = dados.lancamentos.filter((l) => l.tipo === tipo && l.data === data);
  const total = itens.reduce((s, l) => s + (l.tipo === "PREVISAO" && l.natureza === "C" ? l.valor : -l.valor), 0);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {titulo} — {dataBR(data)} ({diaSemana(data)})
      </DialogTitle>
      <DialogContent dividers>
        {itens.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            {tipo === "BOLETO" ? "Nenhum boleto neste dia." : "Nenhuma previsão neste dia."}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {itens.map((l) => (
              <Box
                key={l.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {l.descricao}
                  </Typography>
                  {l.tipo === "PREVISAO" && (
                    <Chip
                      label={l.natureza === "C" ? "Entrada (C)" : "Saída (D)"}
                      size="small"
                      color={l.natureza === "C" ? "success" : "error"}
                      variant="outlined"
                      sx={{ mt: 0.5, height: 20, fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: l.tipo === "PREVISAO" && l.natureza === "C" ? "success.main" : "error.main", ...NUMERO_SX }}
                >
                  {formatCurrency(l.valor)}
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
                {tipo === "BOLETO" ? formatCurrency(-total) : total ? formatSinal(total) : formatCurrency(0)}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => onNovo(tipo)}>
          {tipo === "BOLETO" ? "Adicionar boleto" : "Adicionar previsão"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ------------------------------------------------- formulário (modal) */

const LancamentoFormDialog: React.FC<{
  estado: FormState;
  onClose: () => void;
  onSalvo: (l: CaixaLancamento) => void;
}> = ({ estado, onClose, onSalvo }) => {
  const { tipo, lancamento } = estado;
  const [data, setData] = useState(estado.data);
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState<number | undefined>(lancamento?.valor);
  const [natureza, setNatureza] = useState<NaturezaCaixa>(lancamento?.natureza ?? (tipo === "BOLETO" ? "D" : "C"));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const naturezaInicial = lancamento?.natureza ?? (tipo === "BOLETO" ? "D" : "C");
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
    data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? "" : "Informe a data",
    descricao: descricao.trim() ? "" : "Informe a descrição",
    valor: valor && valor > 0 ? "" : "Informe um valor maior que zero",
  };
  const valido = !erros.data && !erros.descricao && !erros.valor;
  const nome = tipo === "BOLETO" ? "boleto" : "previsão";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const corpo = { tipo, natureza: tipo === "BOLETO" ? ("D" as const) : natureza, data, descricao: descricao.trim(), valor: valor! };
      const salvo = lancamento ? await atualizarLancamentoCaixa(lancamento.id, corpo) : await criarLancamentoCaixa(corpo);
      toast.success(
        tipo === "BOLETO"
          ? lancamento ? "Boleto atualizado" : "Boleto incluído"
          : lancamento ? "Previsão atualizada" : "Previsão incluída",
      );
      onSalvo(salvo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Erro ao salvar ${nome}`);
      setSalvando(false);
    }
  };

  return (
    <Dialog open onClose={fecharPorFora} maxWidth="xs" fullWidth>
      <form onSubmit={enviar} noValidate>
        <DialogTitle>{lancamento ? `Editar ${nome}` : tipo === "BOLETO" ? "Novo boleto" : "Nova previsão"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {tipo === "PREVISAO" && (
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={natureza}
              onChange={(_, v: NaturezaCaixa | null) => v && setNatureza(v)}
              aria-label="Natureza da previsão"
            >
              <ToggleButton value="C" color="success">
                Entrada (C)
              </ToggleButton>
              <ToggleButton value="D" color="error">
                Saída (D)
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <TextField
            label={tipo === "BOLETO" ? "Data de vencimento" : "Data"}
            type="date"
            size="small"
            value={data}
            onChange={(e) => setData(e.target.value)}
            error={tentou && !!erros.data}
            helperText={tentou ? erros.data : ""}
            slotProps={{ inputLabel: { shrink: true } }}
            required
          />
          <TextField
            label="Descrição"
            size="small"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            error={tentou && !!erros.descricao}
            helperText={tentou ? erros.descricao : ""}
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
            {lancamento
              ? "As alterações ainda não foram salvas."
              : tipo === "BOLETO"
                ? "Este boleto ainda não foi salvo."
                : "Esta previsão ainda não foi salva."}
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
