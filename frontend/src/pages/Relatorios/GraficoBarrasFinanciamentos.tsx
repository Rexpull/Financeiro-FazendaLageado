import React, { lazy, Suspense } from 'react';
import type { ApexOptions } from 'apexcharts';
import { brl, brlCompacto } from '../../Utils/formatos';
import { emMilhares } from '../Dashboard/periodoDashboard';

const Chart = lazy(() => import('react-apexcharts'));

/** Chart colors: same meaning as the Dashboard (novos blue, liquidados green, compromissos orange). */
export const CORES_FINANCIAMENTOS = {
	novos: '#2196f3',
	liquidados: '#4caf50',
	compromissos: '#ff9800',
	atraso: '#e53935',
	tomador: '#3b82f6',
};

/**
 * Bar chart of the report: value labels in R$ mil (like the Dashboard), exact value in the tooltip,
 * and a click on a bar opens the contracts behind it.
 */
const GraficoBarrasFinanciamentos: React.FC<{
	categorias: string[];
	series: Array<{ name: string; data: number[] }>;
	/** One color per series, or one per bar when `corPorBarra` */
	cores: string[];
	corPorBarra?: boolean;
	horizontal?: boolean;
	vazio: string;
	onClickBarra: (serie: number, ponto: number) => void;
}> = ({ categorias, series, cores, corPorBarra = false, horizontal = false, vazio, onClickBarra }) => {
	if (series.every((s) => s.data.every((v) => !v))) {
		return <p className="text-gray-500 text-center py-12 text-sm">{vazio}</p>;
	}
	const legenda = series.length > 1;
	const muitasBarras = categorias.length * series.length > 8;
	const altura = horizontal ? Math.max(220, categorias.length * (legenda ? 56 : 38) + 70) : 320;
	const options: ApexOptions = {
		chart: {
			type: 'bar',
			toolbar: { show: false },
			zoom: { enabled: false },
			fontFamily: 'inherit',
			animations: { enabled: true, speed: 350 },
			events: {
				dataPointSelection: (_e: unknown, _ctx: unknown, cfg: { seriesIndex: number; dataPointIndex: number }) =>
					onClickBarra(cfg.seriesIndex, cfg.dataPointIndex),
			},
		},
		states: { active: { filter: { type: 'none' } } },
		plotOptions: {
			bar: {
				horizontal,
				distributed: corPorBarra,
				borderRadius: 3,
				columnWidth: legenda ? '70%' : '55%',
				barHeight: '70%',
				dataLabels: { position: 'top' },
			},
		},
		xaxis: horizontal
			? { categories: categorias, labels: { formatter: (val: string | number) => brlCompacto(Number(val)), hideOverlappingLabels: true }, tickAmount: 4 }
			: { categories: categorias },
		yaxis: horizontal
			? { labels: { maxWidth: 170 } }
			: { labels: { formatter: (val: number) => brlCompacto(val), minWidth: 60 } },
		// Labels in thousands (4.945.000,00 → "4.945"); empty bars get no label
		dataLabels: {
			enabled: true,
			formatter: (val: number) => (val ? emMilhares(val) : ''),
			offsetY: horizontal ? 0 : -20,
			offsetX: horizontal ? 34 : 0,
			style: { fontSize: '11px', fontWeight: 700, colors: ['#374151'] },
		},
		grid: { borderColor: '#f1f1f1', padding: horizontal ? { right: 44 } : { top: 12 } },
		tooltip: { y: { formatter: (val: number) => brl(val) }, shared: false, intersect: true },
		colors: cores,
		legend: { show: legenda, position: 'top', horizontalAlign: 'center' },
		// Phones: many labels overlap — keep only the tooltip
		responsive: muitasBarras ? [{ breakpoint: 640, options: { dataLabels: { enabled: false } } }] : [],
	};
	return (
		<div className="[&_.apexcharts-bar-area]:cursor-pointer">
			<Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">Carregando gráfico...</div>}>
				<Chart options={options} series={series} type="bar" height={altura} width="100%" />
			</Suspense>
			<p className="text-xs text-gray-500 px-1">Valores nas barras em R$ mil. Passe o mouse para ver o valor exato e clique na barra para ver os contratos.</p>
		</div>
	);
};

export default GraficoBarrasFinanciamentos;
