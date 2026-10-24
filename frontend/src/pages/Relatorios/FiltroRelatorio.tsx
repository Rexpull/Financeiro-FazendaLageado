import React, { useState, useEffect } from 'react';
import { listarContas } from '../../services/contaCorrenteService';
import { listarCentroCustos } from '../../services/centroCustosService';
import { CentroCustos } from '../../../../backend/src/models/CentroCustos';
import { formatarDataISO, hojeISO } from '../../Utils/dataSemFuso';

interface ContaCorrente {
	id: number;
	nome?: string;
	numero?: string;
	numConta?: string;
	agencia?: string;
	bancoNome?: string;
	responsavel?: string;
	ativo?: boolean | number;
}

export interface FiltrosRelatorio {
	dataInicio?: string;
	dataFim?: string;
	contaId?: number;
	status?: string;
	centroCustosId?: number;
}

interface FiltroRelatorioProps {
	onAplicarFiltros: (filters: FiltrosRelatorio) => void;
	mostrarCentroCustos?: boolean;
}

const contaInativa = (conta: ContaCorrente) => conta.ativo === false || conta.ativo === 0;

const rotuloConta = (conta: ContaCorrente) => {
	const texto = conta.numConta
		? `${conta.bancoNome || ''} - ${conta.agencia || ''} - ${conta.numConta}${conta.responsavel ? ` (${conta.responsavel})` : ''}`
		: `${conta.bancoNome || ''}${conta.responsavel ? ` (${conta.responsavel})` : ''}`;
	return contaInativa(conta) ? `${texto} (inativa)` : texto;
};

const ROTULO_STATUS: Record<string, string> = { conciliados: 'só conciliados', pendentes: 'só pendentes' };

const FiltroRelatorio: React.FC<FiltroRelatorioProps> = ({
	onAplicarFiltros,
	mostrarCentroCustos = false
}) => {
	// Local calendar dates (toISOString() is UTC and can shift the day)
	const getCurrentMonthRange = () => {
		const now = new Date();
		return {
			inicio: hojeISO(new Date(now.getFullYear(), now.getMonth(), 1)),
			fim: hojeISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
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
	// Filter the report on screen was generated with (summary next to the button)
	const [aplicado, setAplicado] = useState<FiltrosRelatorio | null>(null);

	const aplicar = (filtros: FiltrosRelatorio) => {
		setAplicado(filtros);
		onAplicarFiltros(filtros);
	};

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

		// Opens already loaded with the default filter: current month, all accounts
		const range = getCurrentMonthRange();
		setDataInicio(range.inicio);
		setDataFim(range.fim);
		aplicar({ dataInicio: range.inicio, dataFim: range.fim });
		// eslint-disable-next-line react-hooks/exhaustive-deps
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

		aplicar({
			dataInicio: dataInicio || undefined,
			dataFim: dataFim || undefined,
			contaId,
			status: status === 'todos' ? undefined : status,
			centroCustosId
		});
	};

	// Active accounts first; inactive ones stay available (old periods may need them)
	const contasOrdenadas = contas
		.filter((conta, index, self) =>
			// Remover duplicatas baseado no id
			index === self.findIndex(c => c.id === conta.id)
		)
		.sort((a, b) => Number(contaInativa(a)) - Number(contaInativa(b)));

	const resumoAplicado = (() => {
		if (!aplicado) return '';
		const periodo =
			aplicado.dataInicio || aplicado.dataFim
				? `${formatarDataISO(aplicado.dataInicio, '…')} a ${formatarDataISO(aplicado.dataFim, '…')}`
				: 'todo o período';
		const conta = aplicado.contaId ? contas.find(c => c.id === aplicado.contaId) : undefined;
		const centro = aplicado.centroCustosId ? centrosCustos.find(c => c.id === aplicado.centroCustosId) : undefined;
		return [
			periodo,
			aplicado.contaId ? (conta ? rotuloConta(conta) : `conta ${aplicado.contaId}`) : 'todas as contas',
			aplicado.status ? ROTULO_STATUS[aplicado.status] ?? aplicado.status : '',
			aplicado.centroCustosId ? `centro: ${centro?.descricao ?? aplicado.centroCustosId}` : '',
		]
			.filter(Boolean)
			.join(' · ');
	})();

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
						{contasOrdenadas.map((conta) => (
							<option key={conta.id} value={conta.id}>
								{rotuloConta(conta)}
							</option>
						))}
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

			<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm text-gray-600 min-w-0" title="Filtro usado no relatório abaixo">
					{resumoAplicado && (
						<>
							Mostrando: <span className="font-medium text-gray-800">{resumoAplicado}</span>
						</>
					)}
				</p>
				<button
					onClick={handleAplicar}
					disabled={!!erroData}
					className="ml-auto px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
				>
					Aplicar Filtros
				</button>
			</div>
		</div>
	);
};

export default FiltroRelatorio;
