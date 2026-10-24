import React, { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { TotaisPorCentros } from './totaisPorCentros';

const Chart = lazy(() => import('react-apexcharts'));

const formatCurrency = (value: number) =>
	new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
					yaxis: {
						title: { text: 'Valor (R$)' },
						labels: { formatter: (val: number) => formatCurrency(val) },
					},
					dataLabels: { enabled: false },
					tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
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
