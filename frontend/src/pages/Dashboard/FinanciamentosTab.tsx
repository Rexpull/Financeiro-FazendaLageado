import React, { useEffect, useState } from "react";
import { Paper, Typography, Box, CircularProgress, Tooltip } from "@mui/material";
import {
  getIndicadoresFinanciamentoPeriodo,
  type IndicadoresFinanciamentoPeriodo,
  type ResumoSaldoDevedorMes,
} from "../../services/dashboardService";
import { saldoDevedorPeriodo } from "./saldoDevedorPeriodo";
import { MESES_LONGOS, ultimoDiaDoIntervalo, type IntervaloDashboard } from "./periodoDashboard";
import ModalContratosPeriodo, { type AbaContratos } from "./ModalContratosPeriodo";
import EvolucaoSaldoDevedorChart from "./EvolucaoSaldoDevedorChart";
import { formatarDataISO } from "../../Utils/dataSemFuso";
import { brl } from "../../Utils/formatos";

/** Card value that opens the contracts behind it (novos / liquidações e amortizações). */
export const ValorContratos: React.FC<{ valor: number; cor: string; onClick: () => void; variant?: 'h5' | 'subtitle1'; texto?: string }> = ({
  valor,
  cor,
  onClick,
  variant = 'h5',
  texto,
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
      fontWeight: variant === 'h5' ? 'bold' : 500,
      color: cor,
      fontSize: variant === 'h5' ? '1.5rem' : '1rem',
      lineHeight: 1.4,
      fontVariantNumeric: 'tabular-nums',
      textDecoration: 'underline dotted',
      textUnderlineOffset: '4px',
      '&:hover': { textDecoration: 'underline' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 0.5 },
    }}
  >
    {texto ?? brl(valor)}
  </Typography>
);

const contratos = (n: number | undefined) => (n == null ? '' : `${n} ${n === 1 ? 'contrato' : 'contratos'}`);
const sinal = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±');

interface LinhaProps {
  sinal?: string;
  rotulo: React.ReactNode;
  nota?: React.ReactNode;
  valor: React.ReactNode;
  qtd?: string;
  final?: boolean;
  recuo?: boolean;
}

/** One line of "Saldo devedor no período": sign, label (+ note), value, number of contracts. */
const Linha: React.FC<LinhaProps> = ({ sinal: s, rotulo, nota, valor, qtd, final, recuo }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr auto 104px',
      alignItems: 'baseline',
      columnGap: 1,
      py: recuo ? 0.5 : 1.25,
      pl: recuo ? 4 : 0,
      borderTop: final ? '2px solid' : recuo ? 'none' : '1px solid',
      borderColor: final ? 'warning.main' : 'grey.200',
      ...(final ? { mt: 0.5, pt: 1.75 } : {}),
    }}
  >
    <Typography component="span" sx={{ color: 'text.disabled', textAlign: 'center', fontSize: '1rem' }}>{s}</Typography>
    <Box sx={{ minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: recuo ? '0.875rem' : final ? '1rem' : '0.95rem', fontWeight: final ? 600 : 400, color: recuo ? 'text.secondary' : 'text.primary' }}>
        {rotulo}
      </Typography>
      {nota && (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.78rem' }}>
          {nota}
        </Typography>
      )}
    </Box>
    <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valor}</Box>
    <Typography component="span" sx={{ textAlign: 'right', fontSize: '0.8rem', color: final ? 'text.primary' : 'text.secondary', fontWeight: final ? 600 : 400, whiteSpace: 'nowrap' }}>
      {qtd}
    </Typography>
  </Box>
);

/** "Quanto vence em cada ano": parcelas still in the saldo at the end of the period, by year of vencimento. */
const VencimentosPorAno: React.FC<{ dados: IndicadoresFinanciamentoPeriodo['vencimentosPorAno']; data: string }> = ({ dados, data }) => {
  // More than 10 years: the tail becomes "AAAA em diante"
  const anos = dados.length > 10
    ? [...dados.slice(0, 9), { ano: dados[9].ano, valor: dados.slice(9).reduce((s, d) => s + d.valor, 0), emDiante: true }]
    : dados;
  const maior = Math.max(...anos.map((a) => a.valor), 1);
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
        Quanto vence em cada ano
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Parcelas em aberto em {data}, pelo ano de vencimento, em R$ milhões. As vencidas e não pagas contam no ano em que venceram.
      </Typography>
      {anos.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Nenhuma parcela em aberto.</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.75, sm: 1.75 }, height: 200, borderBottom: '1px solid', borderColor: 'grey.300' }}>
            {anos.map((a) => {
              const destaque = a.valor === maior;
              return (
                <Tooltip key={a.ano} arrow title={`${a.ano}${'emDiante' in a ? ' em diante' : ''}: ${brl(a.valor)}`}>
                  <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Typography component="span" sx={{ fontSize: '0.8rem', mb: 0.5, fontVariantNumeric: 'tabular-nums', color: destaque ? 'warning.dark' : 'text.secondary', fontWeight: destaque ? 600 : 400 }}>
                      {(a.valor / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </Typography>
                    <Box sx={{ width: '100%', height: `${Math.max(2, (a.valor / maior) * 100)}%`, bgcolor: destaque ? '#ef6c00' : '#90a4ae', borderRadius: '2px 2px 0 0' }} />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1.75 }, pt: 1 }}>
            {anos.map((a) => (
              <Typography key={a.ano} component="span" sx={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', color: 'text.secondary' }}>
                {a.ano}{'emDiante' in a ? ' em diante' : ''}
              </Typography>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
};

interface FinanciamentosTabProps {
  /** Period of the filter (mês, trimestre, semestre or ano), never before outubro/2026 */
  intervalo: IntervaloDashboard;
  resumo: ResumoSaldoDevedorMes[] | null;
}

/**
 * Saldo devedor = every registered parcela not liquidated (each parcela already includes the interest), at the END
 * of a month. The card is the bridge the client asked for:
 * saldo inicial + novos financiamentos − liquidações e amortizações ± variação nas renegociações = saldo final.
 * A renegotiation replaces a contract with another without new money: the old one is closed without counting as
 * liquidated, the new one is not a new financing, and only the difference between them changes the saldo.
 */
const FinanciamentosTab: React.FC<FinanciamentosTabProps> = ({ intervalo, resumo }) => {
  const [modalContratos, setModalContratos] = useState<AbaContratos | null>(null);
  const chave = `${intervalo.inicio}|${intervalo.fim}`;
  const [indicadores, setIndicadores] = useState<{ chave: string; data: IndicadoresFinanciamentoPeriodo } | null>(null);
  const [erroIndicadores, setErroIndicadores] = useState<string | null>(null);

  useEffect(() => {
    if (indicadores?.chave === chave || erroIndicadores === chave) return;
    let ativo = true;
    getIndicadoresFinanciamentoPeriodo({ inicio: intervalo.inicio, fim: intervalo.fim })
      .then((data) => { if (ativo) setIndicadores({ chave, data }); })
      .catch((e) => {
        // Not fatal: the card still shows the values, without the number of contracts
        console.error('Erro ao carregar os indicadores de financiamentos:', e);
        if (ativo) setErroIndicadores(chave);
      });
    return () => { ativo = false; };
  }, [chave, indicadores, erroIndicadores, intervalo.inicio, intervalo.fim]);

  if (!resumo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const periodo = saldoDevedorPeriodo(resumo, -1);
  const ind = indicadores?.chave === chave ? indicadores.data : null;
  const dataInicial = formatarDataISO(ultimoDiaDoIntervalo(intervalo.inicio));
  const dataFinal = formatarDataISO(ultimoDiaDoIntervalo(intervalo.fim));
  const ultimo = intervalo.meses[intervalo.meses.length - 1];
  const hoje = new Date();
  const emAndamento = !!ultimo && ultimo.ano === hoje.getFullYear() && ultimo.mes === hoje.getMonth() + 1;

  const variacao = periodo ? Math.round((periodo.saldoFinal - periodo.saldoInicial) * 100) / 100 : 0;
  const variacaoPct = periodo?.saldoInicial ? (variacao / periodo.saldoInicial) * 100 : 0;
  const renegs = ind?.renegociacoes ?? [];
  const notaReneg = renegs.length
    ? renegs.slice(0, 2).map((r) => (r.numeroContratoNovo ? `${r.numeroContrato} → ${r.numeroContratoNovo}` : `${r.numeroContrato} (aditivo)`)).join('; ') +
      (renegs.length > 2 ? ` e mais ${renegs.length - 2}` : '')
    : 'Nenhuma renegociação no período';

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
        Financiamentos — {intervalo.rotulo}
      </Typography>

      {!periodo ? (
        <Typography color="text.secondary">Nenhum financiamento em {intervalo.rotulo}.</Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.45fr 1fr' }, gap: 2, mb: 2, alignItems: 'stretch' }}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
                Saldo devedor no período
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Contratos ativos no início, o que entrou e o que foi pago. Clique num valor para ver os contratos.
              </Typography>

              <Linha
                rotulo={`Saldo devedor inicial (${dataInicial})`}
                nota="Parcelas em aberto dos contratos ativos"
                valor={<Typography component="span" sx={{ fontWeight: 600 }}>{brl(periodo.saldoInicial)}</Typography>}
                qtd={contratos(ind?.contratosAtivosInicio)}
              />
              <Linha
                sinal="+"
                rotulo="Novos financiamentos"
                nota={periodo.contratosNovos > 0 ? `${brl(periodo.valorContratadoNovos)} contratados, mais juros` : 'Nenhum contrato novo no período'}
                valor={<ValorContratos variant="subtitle1" cor="info.dark" valor={periodo.creditosNovos} onClick={() => setModalContratos('novos')} />}
                qtd={contratos(ind?.contratosNovos ?? periodo.contratosNovos)}
              />
              <Linha
                sinal="−"
                rotulo="Liquidações e amortizações"
                nota="Parcelas pagas no período"
                valor={<ValorContratos variant="subtitle1" cor="success.dark" valor={periodo.quitados} onClick={() => setModalContratos('quitados')} />}
              />
              <Linha recuo rotulo="Contratos quitados" valor={<Typography component="span" sx={{ fontSize: '0.875rem' }}>{brl(periodo.quitacoes)}</Typography>} qtd={contratos(ind?.contratosQuitados ?? periodo.contratosQuitados)} />
              <Linha recuo rotulo="Parcelas amortizadas" valor={<Typography component="span" sx={{ fontSize: '0.875rem' }}>{brl(periodo.amortizacoes)}</Typography>} qtd={contratos(ind?.contratosAmortizados)} />
              <Linha
                sinal={sinal(periodo.renegociacoes)}
                rotulo="Variação nas renegociações"
                nota={notaReneg}
                valor={<Typography component="span" sx={{ fontWeight: 500 }}>{brl(Math.abs(periodo.renegociacoes))}</Typography>}
                qtd={renegs.length ? contratos(renegs.length) : ''}
              />
              <Linha
                final
                sinal="="
                rotulo={`Saldo devedor final (${dataFinal})`}
                nota={emAndamento ? `${MESES_LONGOS[ultimo!.mes - 1]} ainda está em andamento` : undefined}
                valor={<Typography component="span" sx={{ fontWeight: 700, fontSize: '1.3rem', color: 'warning.dark' }}>{brl(periodo.saldoFinal)}</Typography>}
                qtd={contratos(ind?.contratosAtivosFim)}
              />

              <Box sx={{ mt: 2, px: 2, py: 1.5, borderRadius: 2, bgcolor: variacao <= 0 ? '#edf7ee' : '#fff4e5', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 600, color: variacao <= 0 ? 'success.dark' : 'warning.dark' }}>
                  Variação do endividamento no período
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', fontVariantNumeric: 'tabular-nums', color: variacao <= 0 ? 'success.dark' : 'warning.dark' }}>
                  {sinal(variacao)} {brl(Math.abs(variacao))}{' '}
                  <Typography component="span" sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                    ({sinal(variacao)}{Math.abs(variacaoPct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                  </Typography>
                </Typography>
              </Box>
              {erroIndicadores === chave && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Não foi possível carregar a quantidade de contratos.
                </Typography>
              )}
            </Paper>

            <EvolucaoSaldoDevedorChart intervalo={intervalo} resumo={resumo} />
          </Box>

          {ind ? (
            <VencimentosPorAno dados={ind.vencimentosPorAno} data={dataFinal} />
          ) : erroIndicadores === chave ? null : (
            <Paper sx={{ p: 2.5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Paper>
          )}
        </>
      )}

      <ModalContratosPeriodo aberto={modalContratos} periodo={intervalo} onClose={() => setModalContratos(null)} />
    </Box>
  );
};

export default FinanciamentosTab;
