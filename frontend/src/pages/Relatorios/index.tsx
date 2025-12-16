import React, { useState } from 'react';
import RelatorioCentroCustos from './RelatorioCentroCustos';
import RelatorioItensClassificados from './RelatorioItensClassificados';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faListCheck } from '@fortawesome/free-solid-svg-icons';

const Relatorios: React.FC = () => {
	const [abaAtiva, setAbaAtiva] = useState<'centro-custos' | 'itens-classificados'>('centro-custos');

	return (
		<div className="min-h-screen image.pngp-6">
			<div className="max-w-8xl mx-auto">
				<div className="flex items-center justify-between flex-wrap gap-3 mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
				</div>

				{/* Abas */}
				<div className="flex gap-2 mb-6">
					<button
						onClick={() => setAbaAtiva('centro-custos')}
						className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
							abaAtiva === 'centro-custos'
								? 'bg-blue-50 border-blue-200 text-blue-700'
								: 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
						}`}
					>
						<FontAwesomeIcon icon={faChartBar} />
						Relatório de Centro de Custos
					</button>
					<button
						onClick={() => setAbaAtiva('itens-classificados')}
						className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
							abaAtiva === 'itens-classificados'
								? 'bg-blue-50 border-blue-200 text-blue-700'
								: 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
						}`}
					>
						<FontAwesomeIcon icon={faListCheck} />
						Relatório de Plano de Contas
					</button>
				</div>

				{/* Conteúdo das abas */}
				<div className="mt-2">
					{abaAtiva === 'centro-custos' && <RelatorioCentroCustos />}
					{abaAtiva === 'itens-classificados' && <RelatorioItensClassificados />}
				</div>
			</div>
		</div>
	);
};

export default Relatorios;

