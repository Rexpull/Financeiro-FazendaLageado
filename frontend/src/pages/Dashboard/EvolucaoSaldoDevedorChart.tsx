import React, { lazy, Suspense } from "react";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import type { ResumoSaldoDevedorMes } from "../../services/dashboardService";
import { pontosEvolucaoSaldoDevedor } from "./saldoDevedorPeriodo";
import { rotuloFimDeMes, rotuloMesGrafico, type IntervaloDashboard } from "./periodoDashboard";
import { brl, brlCompacto } from "../../Utils/formatos";

const Chart = lazy(() => import("react-apexcharts"));

/** "R$ 79,5 mi": one decimal, so a month that moved R$ 800 mil still shows a different bar label. */
const emMilhoes = (v: number) => `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;

interface Props {
  /** Period of the tab filter */
  intervalo: IntervaloDashboard;
  /** Saldo devedor mês a mês of `intervalo` (already loaded by the tab) */
  resumo: ResumoSaldoDevedorMes[];
}

/**
 * "Evolução do saldo devedor": the saldo at the END of each month of the filter, plus the end of the month
 * before it (the saldo inicial of the cards), so the first bar is the base and the last one the saldo final.
 * The axis starts at zero: a month that pays R$ 800 mil of R$ 79 mi looks like what it is.
 */
const EvolucaoSaldoDevedorChart: React.FC<Props> = ({ intervalo, resumo }) => {
  const pontos = pontosEvolucaoSaldoDevedor(resumo, intervalo.meses);
  const variosAnos = new Set(pontos.map((p) => p.ano)).size > 1;
  const categorias = pontos.map((p, i) => (i === 0 ? `${rotuloMesGrafico(p, true)} (início)` : rotuloMesGrafico(p, variosAnos)));

  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
        Evolução do saldo devedor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Saldo no fim de cada mês, a partir do saldo inicial do período
      </Typography>

      {pontos.some((p) => p.saldo) ? (
        <Suspense fallback={<CircularProgress />}>
          <Chart
            options={{
              chart: { type: 'bar', toolbar: { show: false }, zoom: { enabled: false } },
              plotOptions: { bar: { columnWidth: pontos.length <= 3 ? '38%' : '60%', borderRadius: 2, distributed: true, dataLabels: { position: 'top' } } },
              colors: pontos.map((_p, i) => (i === 0 ? '#ffcc80' : '#ef6c00')),
              xaxis: { categories: categorias, tooltip: { enabled: false } },
              yaxis: { min: 0, labels: { formatter: (val: number) => brlCompacto(val), minWidth: 60 } },
              dataLabels: { enabled: true, offsetY: -22, formatter: (val: number) => emMilhoes(val), style: { colors: ['#424242'], fontSize: '12px', fontWeight: 500 } },
              tooltip: {
                x: { formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
                  const p = pontos[opts?.dataPointIndex ?? -1];
                  return p ? `Saldo devedor no ${rotuloFimDeMes(p)}` : '';
                } },
                y: { formatter: (val: number) => brl(val), title: { formatter: () => '' } },
              },
              legend: { show: false },
              grid: { padding: { top: 10 } },
            }}
            series={[{ name: 'Saldo devedor no fim do mês', data: pontos.map((p) => p.saldo) }]}
            type="bar"
            height={420}
            width="100%"
          />
        </Suspense>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6, color: 'grey.500' }}>
          <InsertChartOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Nenhum saldo devedor em {intervalo.rotulo}.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default EvolucaoSaldoDevedorChart;
