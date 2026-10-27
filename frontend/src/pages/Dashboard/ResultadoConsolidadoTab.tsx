import React, { useState } from 'react';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import type { ReceitasDespesasPeriodo, ResumoSaldoDevedorMes } from '../../services/dashboardService';
import CardsResultado from './CardsResultado';
import ComparativoReceitasDespesasChart from './ComparativoReceitasDespesasChart';
import ModalContratosPeriodo, { type AbaContratos } from './ModalContratosPeriodo';
import { ValorContratos } from './FinanciamentosTab';
import { totaisPorCentros } from './totaisPorCentros';
import { saldoDevedorPeriodo } from './saldoDevedorPeriodo';
import type { IntervaloDashboard } from './periodoDashboard';
import { brl } from '../../Utils/formatos';

interface ResultadoConsolidadoTabProps {
	dados: ReceitasDespesasPeriodo;
	intervalo: IntervaloDashboard;
	resumo: ResumoSaldoDevedorMes[] | null;
	erroResumo: boolean;
	onTentarResumoNovamente: () => void;
}

/** Accumulated values of the period (year, quarter, semester or last 12 months), same rules as "Receitas e despesas". */
const ResultadoConsolidadoTab: React.FC<ResultadoConsolidadoTabProps> = ({ dados, intervalo, resumo, erroResumo, onTentarResumoNovamente }) => {
	const [modalContratos, setModalContratos] = useState<AbaContratos | null>(null);
	// Centros de custo (custeio = operacionais; investimento inclui aplicações financeiras)
	const t = totaisPorCentros(dados);
	const fin = saldoDevedorPeriodo(resumo ?? [], -1);

	const linhaFin = (rotulo: string, dica: string, valor: number, cor: string, aba: AbaContratos) => (
		<Tooltip arrow title={dica} placement="top-start">
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
				<Typography variant="body2" color="text.secondary">
					{rotulo}
				</Typography>
				<ValorContratos valor={valor} cor={cor} variant="subtitle1" onClick={() => setModalContratos(aba)} />
			</Box>
		</Tooltip>
	);

	return (
		<Box sx={{ mt: 1 }}>
			<Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
				Resultado consolidado — acumulado de {intervalo.rotulo}
			</Typography>

			<CardsResultado totais={t} />

			<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2.5, mt: 3, alignItems: 'start' }}>
				<Paper
					elevation={0}
					sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', borderLeft: '4px solid', borderLeftColor: 'info.main' }}
				>
					<Typography variant="subtitle2" sx={{ color: 'info.dark', fontWeight: 700, mb: 0.5 }}>
						Financiamentos
					</Typography>
					<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
						Ficam fora do resultado acima. Clique nos valores para ver os contratos.
					</Typography>
					{fin ? (
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
							{linhaFin('Créditos novos', 'Parcelas dos contratos assinados no período', fin.creditosNovos, 'info.dark', 'novos')}
							{linhaFin('Quitados / amortizados', 'Parcelas liquidadas no período', fin.quitados, 'success.dark', 'quitados')}
							{fin.contratosNovos > 0 && (
								<Typography variant="caption" color="text.secondary">
									{fin.contratosNovos} contrato(s) novo(s), valor contratado {brl(fin.valorContratadoNovos)}
								</Typography>
							)}
						</Box>
					) : erroResumo ? (
						<Typography variant="body2" color="error.main">
							Não foi possível carregar.{' '}
							<Button size="small" onClick={onTentarResumoNovamente} sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
								Tentar novamente
							</Button>
						</Typography>
					) : resumo ? (
						<Typography variant="body2" color="text.secondary">
							Nenhum financiamento em {intervalo.rotulo}.
						</Typography>
					) : (
						<Typography variant="body2" color="text.secondary">
							Carregando…
						</Typography>
					)}
				</Paper>

				{/* Same 3 bars as "Receitas e despesas", accumulated for the period */}
				<Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
					<ComparativoReceitasDespesasChart title={`Comparativo acumulado — ${intervalo.rotulo}`} categoria={intervalo.rotulo} totais={t} height={320} />
				</Paper>
			</Box>

			<ModalContratosPeriodo aberto={modalContratos} periodo={intervalo} onClose={() => setModalContratos(null)} />
		</Box>
	);
};

export default ResultadoConsolidadoTab;
