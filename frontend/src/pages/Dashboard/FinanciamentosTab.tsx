import React, { lazy, Suspense, useState } from "react";
import { Paper, Typography, Box, CircularProgress } from "@mui/material";
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import type { ResumoSaldoDevedorMes } from "../../services/dashboardService";
import { saldoDevedorPeriodo } from "./saldoDevedorPeriodo";
import { mesAnterior, rotuloFimDeMes, rotuloMesGrafico, ultimoDiaDoIntervalo, type IntervaloDashboard } from "./periodoDashboard";
import ModalContratosPeriodo, { type AbaContratos } from "./ModalContratosPeriodo";
import EvolucaoSaldoDevedorChart from "./EvolucaoSaldoDevedorChart";
import { formatarDataISO } from "../../Utils/dataSemFuso";
import { brl, brlCompacto } from "../../Utils/formatos";

const Chart = lazy(() => import("react-apexcharts"));

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

/** Card value that opens the contracts behind it (créditos novos / quitados). */
export const ValorContratos: React.FC<{ valor: number; cor: string; onClick: () => void; variant?: 'h5' | 'subtitle1' }> = ({
  valor,
  cor,
  onClick,
  variant = 'h5',
}) => (
  <Typography
    component="button"
    type="button"
    variant={variant}
    onClick={onClick}
    title="Ver os contratos deste valor"
    sx={{
      all: 'unset',
      cursor: 'pointer',
      fontWeight: 'bold',
      color: cor,
      fontSize: variant === 'h5' ? '1.5rem' : '1rem',
      lineHeight: 1.4,
      textDecoration: 'underline dotted',
      textUnderlineOffset: '4px',
      '&:hover': { textDecoration: 'underline' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 0.5 },
    }}
  >
    {brl(valor)}
  </Typography>
);

interface FinanciamentosTabProps {
  /** Period filter (ano inteiro, trimestre, semestre, últimos 12 meses or one month) */
  intervalo: IntervaloDashboard;
  resumo: ResumoSaldoDevedorMes[] | null;
}

/**
 * Saldo devedor = every registered parcela not liquidated (the value of each parcela already includes
 * the interest). One convention everywhere: positions at the END of a month (month closed). Saldo no
 * início do período = end of the month before it; saldo no fim = end of its last month
 * = início − quitados + créditos novos (also the last point of the evolution chart).
 */
const FinanciamentosTab: React.FC<FinanciamentosTabProps> = ({ intervalo, resumo }) => {
  const [modalContratos, setModalContratos] = useState<AbaContratos | null>(null);

  if (!resumo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const periodo = saldoDevedorPeriodo(resumo, -1);
  const rotulo = intervalo.rotulo;
  const variosAnos = new Set(resumo.map((r) => r.ano ?? 0)).size > 1;
  const categorias = resumo.map((r, i) =>
    rotuloMesGrafico({ ano: r.ano ?? intervalo.meses[i]?.ano ?? 0, mes: r.mes }, variosAnos),
  );
  // Closed months: the period starts at the end of the month before it and ends at the end of its last month
  const primeiroMes = intervalo.meses[0];
  const ultimoMes = intervalo.meses[intervalo.meses.length - 1];
  const dataInicial = formatarDataISO(ultimoDiaDoIntervalo(intervalo.inicio));
  const dataFinal = formatarDataISO(ultimoDiaDoIntervalo(intervalo.fim));
  const fimMesAnterior = primeiroMes ? ` (${rotuloFimDeMes(mesAnterior(primeiroMes))})` : '';
  const fimUltimoMes = ultimoMes ? ` (${rotuloFimDeMes(ultimoMes)})` : '';
  const faixaDatas = `de ${formatarDataISO(intervalo.inicio)} a ${dataFinal}`;

  const quadros = periodo
    ? [
        {
          titulo: 'Saldo devedor no início do período',
          valor: periodo.saldoInicial,
          cor: 'text.primary',
          nota: `Em ${dataInicial}${fimMesAnterior}: parcelas em aberto`,
        },
        {
          titulo: 'Quitados',
          valor: periodo.quitados,
          cor: 'success.main',
          nota: `Parcelas liquidadas ${faixaDatas}`,
          aba: 'quitados' as const,
        },
        {
          titulo: 'Créditos novos',
          valor: periodo.creditosNovos,
          cor: 'info.main',
          nota:
            periodo.contratosNovos > 0
              ? `${periodo.contratosNovos} contrato(s) assinado(s) ${faixaDatas}, valor contratado ${brl(periodo.valorContratadoNovos)}`
              : `Nenhum contrato assinado ${faixaDatas}`,
          aba: 'novos' as const,
        },
        {
          titulo: 'Saldo devedor no fim do período',
          valor: periodo.saldoFinal,
          cor: 'warning.dark',
          nota: `Em ${dataFinal}${fimUltimoMes} = início − quitados + créditos novos${
            periodo.renegociacoes ? ` ${periodo.renegociacoes > 0 ? '+' : '−'} ${brl(Math.abs(periodo.renegociacoes))} de renegociações` : ''
          }`,
          destaque: true,
        },
      ]
    : [];

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Financiamentos — {rotulo}
      </Typography>
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
            <Box sx={{ my: 0.5 }}>
              {q.aba ? (
                <ValorContratos valor={q.valor} cor={q.cor} onClick={() => setModalContratos(q.aba)} />
              ) : (
                <Typography variant="h5" fontWeight="bold" color={q.cor}>
                  {brl(q.valor)}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
              {q.nota}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Créditos novos x Quitados por mês — {rotulo}
          </Typography>
          {resumo.some((r) => r.creditosNovos || r.quitados) ? (
            <Suspense fallback={<CircularProgress />}>
              <Chart
                options={{
                  chart: { type: 'bar', toolbar: { show: false } },
                  plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 3 } },
                  // Horizontal bars: months on the vertical axis, money along the horizontal one
                  xaxis: {
                    categories: categorias,
                    labels: { formatter: (val: string | number) => brlCompacto(Number(val)), hideOverlappingLabels: true, trim: false },
                    tickAmount: 4,
                  },
                  tooltip: { y: { formatter: (val: number) => brl(val) } },
                  colors: ['#2196f3', '#4caf50'],
                  legend: { position: 'top' },
                  dataLabels: { enabled: false },
                  grid: { padding: { right: 16 } },
                }}
                series={[
                  { name: 'Créditos novos', data: resumo.map((r) => r.creditosNovos) },
                  { name: 'Quitados', data: resumo.map((r) => r.quitados) },
                ]}
                type="bar"
                height={Math.max(300, resumo.length * 44 + 90)}
                width="100%"
              />
            </Suspense>
          ) : (
            <NoData message={`Nenhum contrato novo ou parcela liquidada em ${rotulo}.`} />
          )}
        </Paper>

        <EvolucaoSaldoDevedorChart intervalo={intervalo} resumo={resumo} />
      </Box>

      <ModalContratosPeriodo aberto={modalContratos} periodo={intervalo} onClose={() => setModalContratos(null)} />
    </Box>
  );
};

export default FinanciamentosTab;
