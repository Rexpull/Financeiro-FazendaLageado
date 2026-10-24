import React, { lazy, Suspense } from "react";
import { Paper, Typography, Box, CircularProgress } from "@mui/material";
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import type { ResumoSaldoDevedorMes } from "../../services/dashboardService";
import { saldoDevedorPeriodo } from "./saldoDevedorPeriodo";

const Chart = lazy(() => import("react-apexcharts"));

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const CARD_SX = {
  border: '1px solid #e0e0e0',
  borderRadius: 3,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  px: 3,
  py: 2,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
} as const;

const NoData = ({ message }: { message: string }) => (
  <Box sx={{ textAlign: 'center', py: 6, color: 'grey.500' }}>
    <InsertChartOutlinedIcon sx={{ fontSize: 60, color: 'grey.400' }} />
    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
      {message}
    </Typography>
  </Box>
);

interface FinanciamentosTabProps {
  anoSelecionado: number;
  mesSelecionado: string;
  resumo: ResumoSaldoDevedorMes[] | null;
}

/**
 * Saldo devedor = parcelas não liquidadas (o valor de cada parcela já inclui os juros).
 * Saldo final = saldo inicial − quitados + créditos novos.
 */
const FinanciamentosTab: React.FC<FinanciamentosTabProps> = ({ anoSelecionado, mesSelecionado, resumo }) => {
  if (!resumo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const mesIdx = mesSelecionado ? MESES.indexOf(mesSelecionado) : -1;
  const periodo = saldoDevedorPeriodo(resumo, mesIdx);
  const rotulo = mesIdx >= 0 ? `${MESES[mesIdx]}/${anoSelecionado}` : String(anoSelecionado);
  const rotuloInicio = mesIdx >= 0 ? `início de ${MESES[mesIdx]}/${anoSelecionado}` : `início de ${anoSelecionado}`;
  const rotuloFim = mesIdx >= 0 ? `fim de ${MESES[mesIdx]}/${anoSelecionado}` : `fim de ${anoSelecionado}`;

  // Evolução do saldo: no ano corrente, só até o mês atual (meses futuros ainda não aconteceram)
  const hoje = new Date();
  const ultimoMes = anoSelecionado === hoje.getFullYear() ? hoje.getMonth() + 1 : anoSelecionado < hoje.getFullYear() ? 12 : 0;
  const evolucao = resumo.map((r) => (r.mes <= ultimoMes ? r.saldoFinal : null));

  const quadros = periodo
    ? [
        {
          titulo: 'Saldo devedor inicial',
          valor: periodo.saldoInicial,
          cor: 'text.primary',
          nota: `Parcelas em aberto no ${rotuloInicio}`,
        },
        {
          titulo: 'Quitados',
          valor: periodo.quitados,
          cor: 'success.main',
          nota: `Parcelas amortizadas e liquidadas em ${rotulo}`,
        },
        {
          titulo: 'Créditos novos',
          valor: periodo.creditosNovos,
          cor: 'info.main',
          nota:
            periodo.contratosNovos > 0
              ? `${periodo.contratosNovos} contrato(s), valor contratado ${formatCurrency(periodo.valorContratadoNovos)}`
              : `Nenhum contrato novo em ${rotulo}`,
        },
        {
          titulo: 'Saldo devedor final',
          valor: periodo.saldoFinal,
          cor: 'warning.dark',
          nota: `No ${rotuloFim} (inicial − quitados + créditos novos)`,
          destaque: true,
        },
      ]
    : [];

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        {quadros.map((q) => (
          <Paper
            key={q.titulo}
            elevation={3}
            sx={{ ...CARD_SX, ...(q.destaque ? { border: '2px solid', borderColor: 'warning.main' } : {}) }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '0.9rem', fontWeight: q.destaque ? 700 : 600 }}>
              {q.titulo}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color={q.cor} sx={{ my: 0.5 }}>
              {formatCurrency(q.valor)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
              {q.nota}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Contratados x Liquidados por mês — {anoSelecionado}
          </Typography>
          {resumo.some((r) => r.creditosNovos || r.quitados) ? (
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={{
                  chart: { type: 'bar', toolbar: { show: false } },
                  plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 3 } },
                  xaxis: { categories: MESES },
                  yaxis: { labels: { formatter: (val: number) => formatCurrency(val) } },
                  tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                  colors: ['#2196f3', '#4caf50'],
                  legend: { position: 'top' },
                  dataLabels: { enabled: false },
                }}
                series={[
                  { name: 'Créditos novos', data: resumo.map((r) => r.creditosNovos) },
                  { name: 'Quitados', data: resumo.map((r) => r.quitados) },
                ]}
                type="bar"
                height={350}
                width="100%"
              />
            </Suspense>
          ) : (
            <NoData message={`Nenhum contrato novo ou parcela liquidada em ${anoSelecionado}.`} />
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Evolução do saldo devedor — {anoSelecionado}
          </Typography>
          {evolucao.some((v) => v != null) ? (
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={{
                  chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
                  stroke: { curve: 'straight', width: 3 },
                  xaxis: { categories: MESES },
                  yaxis: { labels: { formatter: (val: number) => formatCurrency(val) } },
                  tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
                  colors: ['#ff9800'],
                  markers: { size: 5 },
                  dataLabels: { enabled: false },
                }}
                series={[{ name: 'Saldo devedor no fim do mês', data: evolucao }]}
                type="line"
                height={350}
                width="100%"
              />
            </Suspense>
          ) : (
            <NoData message="Ano futuro: ainda não há saldo para mostrar." />
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default FinanciamentosTab;
