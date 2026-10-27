import React, { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { TotaisPorCentros } from './totaisPorCentros';
import { brl, brlCompacto } from '../../Utils/formatos';
import { emMilhares } from './periodoDashboard';

const Chart = lazy(() => import('react-apexcharts'));

/** Receitas vs despesas de custeio vs despesas de investimento (3 bars). */
const ComparativoReceitasDespesasChart: React.FC<{
	title: string;
	categoria: string;
	totais: TotaisPorCentros;
	height?: number;
}> = ({ title, categoria, totais, height = 300 }) => (
	<Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
		<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
			{title}
		</Typography>
		<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
			Valores nas barras em milhares de reais (R$ mil). Passe o mouse sobre a barra para ver o valor exato.
		</Typography>
		<Suspense fallback={<CircularProgress />}>
			<Chart
				options={{
					chart: { type: 'bar', toolbar: { show: false } },
					plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 4, dataLabels: { position: 'top' } } },
					xaxis: { categories: [categoria] },
					// Short axis labels ("R$ 1,5 mi"): the full currency was cut to "R$ 0..."
					yaxis: {
						labels: { formatter: (val: number) => brlCompacto(val), minWidth: 70 },
					},
					// Labels in thousands (4.945.000,00 → "4.945"); the tooltip keeps the exact value
					dataLabels: {
						enabled: true,
						formatter: (val: number) => emMilhares(val),
						offsetY: -22,
						style: { fontSize: '13px', fontWeight: 700, colors: ['#424242'] },
					},
					// Room for the label above the tallest bar
					grid: { padding: { top: 16 } },
					tooltip: { y: { formatter: (val: number) => brl(val) } },
					colors: ['#4caf50', '#f44336', '#ff9800'],
					legend: { position: 'top' },
				}}
				series={[
					{ name: 'Receitas', data: [totais.receitas] },
					{ name: 'Despesas de custeio', data: [totais.custeio] },
					{ name: 'Despesas de investimento', data: [totais.investimento] },
				]}
				type="bar"
				height={height}
				width="100%"
			/>
		</Suspense>
	</Box>
);

export default ComparativoReceitasDespesasChart;
