import React, { lazy, Suspense, useEffect, useState } from "react";
import { Box, Button, CircularProgress, Paper, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import { getResumoSaldoDevedor, type ResumoSaldoDevedorMes } from "../../services/dashboardService";
import { pontosEvolucaoSaldoDevedor } from "./saldoDevedorPeriodo";
import {
  intervaloGrafico,
  mesAnterior,
  OPCOES_PERIODO_GRAFICO,
  rotuloFimDeMes,
  rotuloMesGrafico,
  type IntervaloDashboard,
  type PeriodoGrafico,
} from "./periodoDashboard";
import { brl, brlCompacto } from "../../Utils/formatos";

const Chart = lazy(() => import("react-apexcharts"));

const DICAS: Record<PeriodoGrafico, string> = {
  periodo: 'Mesmo período do filtro acima',
  ano: 'De janeiro a dezembro do ano',
  semestre: 'Os 6 meses que terminam no último mês do filtro',
  '12m': 'Os 12 meses que terminam no último mês do filtro',
};

interface Props {
  /** Period of the tab filter (the chart starts on it) */
  intervalo: IntervaloDashboard;
  /** Saldo devedor mês a mês of `intervalo` (already loaded by the tab) */
  resumo: ResumoSaldoDevedorMes[];
}

/**
 * "Evolução do saldo devedor": the position at the END of each month (month closed), plus the end of the
 * month before the range, so the first point equals "Saldo devedor no início do período" and the last one
 * "Saldo devedor no fim do período". Its own period (Ano, Último semestre, Últimos 12 meses) can be chosen
 * on the chart; it goes back to the tab period whenever the tab filter changes.
 */
const EvolucaoSaldoDevedorChart: React.FC<Props> = ({ intervalo, resumo }) => {
  const chaveFiltro = `${intervalo.inicio}|${intervalo.fim}`;
  const [escolha, setEscolha] = useState<{ chave: string; tipo: PeriodoGrafico } | null>(null);
  const tipo: PeriodoGrafico = escolha?.chave === chaveFiltro ? escolha.tipo : 'periodo';
  const faixa = intervaloGrafico(intervalo, tipo);
  const mesmoDoFiltro = faixa.inicio === intervalo.inicio && faixa.fim === intervalo.fim;

  const chave = `${faixa.inicio}|${faixa.fim}`;
  const [proprio, setProprio] = useState<{ chave: string; data: ResumoSaldoDevedorMes[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (mesmoDoFiltro || proprio?.chave === chave || erro === chave) return;
    let ativo = true;
    getResumoSaldoDevedor({ inicio: faixa.inicio, fim: faixa.fim })
      .then((data) => { if (ativo) setProprio({ chave, data }); })
      .catch((e) => {
        console.error('Erro ao carregar a evolução do saldo devedor:', e);
        if (ativo) setErro(chave);
      });
    return () => { ativo = false; };
  }, [mesmoDoFiltro, chave, proprio, erro, faixa.inicio, faixa.fim]);

  const dados = mesmoDoFiltro ? resumo : proprio?.chave === chave ? proprio.data : null;
  const pontos = dados ? pontosEvolucaoSaldoDevedor(dados, faixa.meses) : [];
  const variosAnos = new Set(pontos.map((p) => p.ano)).size > 1;
  const categorias = pontos.map((p) => rotuloMesGrafico(p, variosAnos));

  // Chart longer than the filter: shade the filtered period (from its initial position to the end)
  const inicioFiltro = intervalo.meses[0] ? mesAnterior(intervalo.meses[0]) : null;
  const idxInicioFiltro = inicioFiltro ? pontos.findIndex((p) => p.ano === inicioFiltro.ano && p.mes === inicioFiltro.mes) : -1;
  const marcaFiltro =
    idxInicioFiltro > 0
      ? [{
          x: categorias[idxInicioFiltro],
          x2: categorias[categorias.length - 1],
          fillColor: '#ff9800',
          opacity: 0.08,
          borderColor: '#ff9800',
          label: { text: intervalo.rotulo, orientation: 'horizontal', style: { color: '#e65100', background: '#fff3e0', fontSize: '11px' } },
        }]
      : [];

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Evolução do saldo devedor — {faixa.rotulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Saldo no fim de cada mês (mês fechado)
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={tipo}
          onChange={(_e, v: PeriodoGrafico | null) => { if (v) setEscolha({ chave: chaveFiltro, tipo: v }); }}
          aria-label="Período do gráfico"
          sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { py: 0.25, px: 1, textTransform: 'none', fontSize: '0.78rem' } }}
        >
          {OPCOES_PERIODO_GRAFICO.map((o) => (
            <Tooltip key={o.valor} arrow title={o.valor === 'periodo' ? `${DICAS.periodo} (${intervalo.rotulo})` : DICAS[o.valor]}>
              <ToggleButton value={o.valor}>{o.rotulo}</ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Box>

      {erro === chave && !dados ? (
        <Typography variant="body2" color="error.main" sx={{ py: 6, textAlign: 'center' }}>
          Não foi possível carregar o saldo devedor de {faixa.rotulo}.{' '}
          <Button size="small" onClick={() => setErro(null)} sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
            Tentar novamente
          </Button>
        </Typography>
      ) : !dados ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : pontos.some((p) => p.saldo) ? (
        // Every registered parcela not liquidated is part of the saldo devedor (no projection)
        <Suspense fallback={<CircularProgress />}>
          <Chart
            options={{
              chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
              stroke: { curve: 'straight', width: 3 },
              xaxis: { categories: categorias, tooltip: { enabled: false } },
              yaxis: { labels: { formatter: (val: number) => brlCompacto(val), minWidth: 70 } },
              tooltip: {
                x: { formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
                  const p = pontos[opts?.dataPointIndex ?? -1];
                  return p ? `Saldo devedor no ${rotuloFimDeMes(p)}` : '';
                } },
                y: { formatter: (val: number) => brl(val), title: { formatter: () => '' } },
              },
              annotations: { xaxis: marcaFiltro },
              colors: ['#ff9800'],
              markers: { size: 5 },
              legend: { show: false },
              dataLabels: { enabled: false },
            }}
            series={[{ name: 'Saldo devedor no fim do mês', data: pontos.map((p) => p.saldo) }]}
            type="line"
            height={350}
            width="100%"
          />
        </Suspense>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6, color: 'grey.500' }}>
          <InsertChartOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Nenhum saldo devedor em {faixa.rotulo}.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default EvolucaoSaldoDevedorChart;
