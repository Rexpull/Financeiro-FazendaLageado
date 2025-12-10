import React, { useState, useEffect } from 'react';
import { listarContas } from '../../services/contaCorrenteService';
import { listarCentroCustos } from '../../services/centroCustosService';
import { CentroCustos } from '../../../../backend/src/models/CentroCustos';

interface ContaCorrente {
	id: number;
	nome?: string;
	numero?: string;
	numConta?: string;
	agencia?: string;
	bancoNome?: string;
	responsavel?: string;
	ativo?: boolean;
}

interface FiltroRelatorioProps {
	onAplicarFiltros: (filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}) => void;
	mostrarCentroCustos?: boolean;
}

const FiltroRelatorio: React.FC<FiltroRelatorioProps> = ({
	onAplicarFiltros,
	mostrarCentroCustos = false
}) => {
	const getCurrentMonthRange = () => {
		const now = new Date();
		const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		return {
			inicio: firstDay.toISOString().split('T')[0],
			fim: lastDay.toISOString().split('T')[0]
		};
	};

	const [dataInicio, setDataInicio] = useState<string>('');
	const [dataFim, setDataFim] = useState<string>('');
	const [contaId, setContaId] = useState<number | undefined>(undefined);
	const [status, setStatus] = useState<string>('todos');
	const [centroCustosId, setCentroCustosId] = useState<number | undefined>(undefined);
	const [contas, setContas] = useState<ContaCorrente[]>([]);
	const [centrosCustos, setCentrosCustos] = useState<CentroCustos[]>([]);
	const [erroData, setErroData] = useState<string>('');

	useEffect(() => {
		const carregarDados = async () => {
			try {
				const [contasData, centrosData] = await Promise.all([
					listarContas(),
					mostrarCentroCustos ? listarCentroCustos() : Promise.resolve([])
				]);
				setContas(contasData);
				setCentrosCustos(centrosData);
			} catch (error) {
				console.error('Erro ao carregar dados:', error);
			}
		};
		carregarDados();

		// Inicializar com o mês atual
		const range = getCurrentMonthRange();
		setDataInicio(range.inicio);
		setDataFim(range.fim);
	}, [mostrarCentroCustos]);

	useEffect(() => {
		if (dataInicio && dataFim && dataInicio > dataFim) {
			setErroData('A data de início deve ser anterior à data de fim');
		} else {
			setErroData('');
		}
	}, [dataInicio, dataFim]);

	const handleAplicar = () => {
		if (erroData) {
			return;
		}

		onAplicarFiltros({
			dataInicio: dataInicio || undefined,
			dataFim: dataFim || undefined,
			contaId,
			status: status === 'todos' ? undefined : status,
			centroCustosId
		});
	};

	return (
		<div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mb-6">
			<div className="flex items-center justify-between flex-wrap gap-2 mb-4">
				<h3 className="text-base font-semibold text-gray-800">Filtros</h3>
				{erroData && <p className="text-red-500 text-xs">{erroData}</p>}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
				{/* Data Início */}
				<div className="space-y-1">
					<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
						Data Início
					</label>
					<input
						type="date"
						value={dataInicio}
						onChange={(e) => setDataInicio(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				{/* Data Fim */}
				<div className="space-y-1">
					<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
						Data Fim
					</label>
					<input
						type="date"
						value={dataFim}
						onChange={(e) => setDataFim(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				{/* Conta Corrente */}
				<div className="space-y-1">
					<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
						Conta Corrente
					</label>
					<select
						value={contaId || ''}
						onChange={(e) => setContaId(e.target.value ? parseInt(e.target.value) : undefined)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
					>
						<option value="">Todas</option>
						{contas
							.filter((conta, index, self) => 
								// Remover duplicatas baseado no id
								index === self.findIndex(c => c.id === conta.id)
							)
							.filter(conta => conta.ativo !== false) // Filtrar apenas contas ativas
							.map((conta) => {
								const displayText = conta.numConta 
									? `${conta.bancoNome || ''} - ${conta.agencia || ''} - ${conta.numConta}${conta.responsavel ? ` (${conta.responsavel})` : ''}`
									: `${conta.bancoNome || ''}${conta.responsavel ? ` (${conta.responsavel})` : ''}`;
								return (
									<option key={conta.id} value={conta.id}>
										{displayText}
									</option>
								);
							})}
					</select>
				</div>

				{/* Status */}
				<div className="space-y-1">
					<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
						Status
					</label>
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
					>
						<option value="todos">Todos</option>
						<option value="conciliados">Conciliados</option>
						<option value="pendentes">Pendentes</option>
					</select>
				</div>

				{/* Centro de Custos (apenas se mostrarCentroCustos for true) */}
				{mostrarCentroCustos && (
					<div className="space-y-1">
						<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
							Centro de Custos
						</label>
						<select
							value={centroCustosId || ''}
							onChange={(e) => setCentroCustosId(e.target.value ? parseInt(e.target.value) : undefined)}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
						>
							<option value="">Todos</option>
							{centrosCustos.map((centro) => (
								<option key={centro.id} value={centro.id}>
									{centro.descricao}
								</option>
							))}
						</select>
					</div>
				)}
			</div>

			<div className="mt-5 flex justify-end">
				<button
					onClick={handleAplicar}
					disabled={!!erroData}
					className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
				>
					Aplicar Filtros
				</button>
			</div>
		</div>
	);
};

export default FiltroRelatorio;

