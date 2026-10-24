import React, { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { TotaisPorCentros } from './totaisPorCentros';
import { brl, brlCompacto } from '../../Utils/formatos';

const Chart = lazy(() => import('react-apexcharts'));

/** Receitas vs despesas de custeio vs despesas de investimento (3 bars). */
const ComparativoReceitasDespesasChart: React.FC<{
	title: string;
	categoria: string;
	totais: TotaisPorCentros;
	height?: number;
}> = ({ title, categoria, totais, height = 300 }) => (
	<Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
		<Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
			{title}
		</Typography>
		<Suspense fallback={<CircularProgress />}>
			<Chart
				options={{
					chart: { type: 'bar', toolbar: { show: false } },
					plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 4 } },
					xaxis: { categories: [categoria] },
					// Short axis labels ("R$ 1,5 mi"): the full currency was cut to "R$ 0..."
					yaxis: {
						labels: { formatter: (val: number) => brlCompacto(val), minWidth: 70 },
					},
					dataLabels: { enabled: false },
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
