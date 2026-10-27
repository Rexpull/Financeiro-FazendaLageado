import React, { useState, useEffect, useMemo, useRef } from 'react';
import { listarContas } from '../../services/contaCorrenteService';
import { listarCentroCustos } from '../../services/centroCustosService';
import { listarPlanoContas } from '../../services/planoContasService';
import { CentroCustos } from '../../../../backend/src/models/CentroCustos';
import { PlanoConta } from '../../../../backend/src/models/PlanoConta';
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
	planoContasId?: number;
}

interface FiltroRelatorioProps {
	onAplicarFiltros: (filters: FiltrosRelatorio) => void;
	mostrarCentroCustos?: boolean;
	mostrarPlanoContas?: boolean;
}

const contaInativa = (conta: ContaCorrente) => conta.ativo === false || conta.ativo === 0;

const rotuloConta = (conta: ContaCorrente) => {
	const texto = conta.numConta
		? `${conta.bancoNome || ''} - ${conta.agencia || ''} - ${conta.numConta}${conta.responsavel ? ` (${conta.responsavel})` : ''}`
		: `${conta.bancoNome || ''}${conta.responsavel ? ` (${conta.responsavel})` : ''}`;
	return contaInativa(conta) ? `${texto} (inativa)` : texto;
};

const ROTULO_STATUS: Record<string, string> = { conciliados: 'só conciliados', pendentes: 'só pendentes' };

/** Lower case without accents, so "manutencao" finds "Manutenção". */
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const rotuloPlano = (plano: PlanoConta) => `${plano.hierarquia} - ${plano.descricao}`;

type OpcaoPlano = { plano: PlanoConta; grupo: string; pai: string; textoBusca: string };

/** Active level-3 plans (the ones movements are classified with), in plan order, labelled by level 1 / level 2. */
const opcoesPlanos = (planos: PlanoConta[]): OpcaoPlano[] => {
	const porHierarquia = new Map(planos.map((p) => [p.hierarquia, p]));
	const nome = (hierarquia: string) => {
		const p = porHierarquia.get(hierarquia);
		return p ? `${p.hierarquia} - ${p.descricao}` : hierarquia;
	};
	return planos
		.filter((p) => Number(p.nivel) === 3 && !p.inativo && !!p.hierarquia)
		.sort((a, b) => a.hierarquia.localeCompare(b.hierarquia, 'pt-BR', { numeric: true }))
		.map((plano) => {
			const partes = plano.hierarquia.split('.');
			const grupo = nome(partes[0]);
			const pai = porHierarquia.get(partes.slice(0, 2).join('.'))?.descricao ?? '';
			return { plano, grupo, pai, textoBusca: normalizar(`${plano.hierarquia} ${plano.descricao} ${pai}`) };
		});
};

/** Searchable plan picker: type part of the name or code; "Todos" clears the filter. */
const SeletorPlanoContas: React.FC<{
	planos: PlanoConta[];
	valor?: number;
	onChange: (id: number | undefined) => void;
}> = ({ planos, valor, onChange }) => {
	const [aberto, setAberto] = useState(false);
	const [busca, setBusca] = useState('');
	const ref = useRef<HTMLDivElement>(null);
	const opcoes = useMemo(() => opcoesPlanos(planos), [planos]);
	const selecionado = valor ? planos.find((p) => p.id === valor) : undefined;

	const termo = normalizar(busca.trim());
	const filtradas = termo ? opcoes.filter((o) => o.textoBusca.includes(termo)) : opcoes;

	useEffect(() => {
		if (!aberto) return;
		const fecharFora = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
		};
		document.addEventListener('mousedown', fecharFora);
		return () => document.removeEventListener('mousedown', fecharFora);
	}, [aberto]);

	const escolher = (id: number | undefined) => {
		onChange(id);
		setBusca('');
		setAberto(false);
	};

	return (
		<div ref={ref} className="relative">
			<input
				type="text"
				value={aberto ? busca : selecionado ? rotuloPlano(selecionado) : ''}
				placeholder={aberto && selecionado ? rotuloPlano(selecionado) : 'Todos (digite para buscar)'}
				title={selecionado ? rotuloPlano(selecionado) : 'Todos os planos de contas'}
				onFocus={() => {
					setBusca('');
					setAberto(true);
				}}
				onChange={(e) => {
					setBusca(e.target.value);
					setAberto(true);
				}}
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						setAberto(false);
						(e.target as HTMLInputElement).blur();
					} else if (e.key === 'Enter' && aberto && filtradas.length > 0) {
						e.preventDefault();
						escolher(filtradas[0].plano.id);
					}
				}}
				className={`w-full px-3 py-2 ${selecionado ? 'pr-8' : ''} border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white truncate`}
			/>
			{selecionado && !aberto && (
				<button
					type="button"
					onClick={() => escolher(undefined)}
					title="Limpar: todos os planos"
					aria-label="Limpar plano de contas"
					className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
				>
					×
				</button>
			)}
			{aberto && (
				<ul className="absolute z-20 mt-1 w-full min-w-[18rem] max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
					<li
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => escolher(undefined)}
						className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${!valor ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
					>
						Todos
					</li>
					{filtradas.length === 0 && <li className="px-3 py-2 text-gray-500">Nenhum plano encontrado</li>}
					{filtradas.map((o, idx) => (
						<React.Fragment key={o.plano.id}>
							{(idx === 0 || filtradas[idx - 1].grupo !== o.grupo) && (
								<li className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-t border-gray-100">
									{o.grupo}
								</li>
							)}
							<li
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => escolher(o.plano.id)}
								className={`px-3 py-1.5 cursor-pointer hover:bg-blue-50 ${o.plano.id === valor ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-800'}`}
							>
								<div className="truncate">{o.plano.descricao}</div>
								<div className="text-xs text-gray-500 truncate">
									{o.plano.hierarquia}
									{o.pai ? ` · ${o.pai}` : ''}
								</div>
							</li>
						</React.Fragment>
					))}
				</ul>
			)}
		</div>
	);
};

const FiltroRelatorio: React.FC<FiltroRelatorioProps> = ({
	onAplicarFiltros,
	mostrarCentroCustos = false,
	mostrarPlanoContas = false
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
	const [planoContasId, setPlanoContasId] = useState<number | undefined>(undefined);
	const [contas, setContas] = useState<ContaCorrente[]>([]);
	const [centrosCustos, setCentrosCustos] = useState<CentroCustos[]>([]);
	const [planosContas, setPlanosContas] = useState<PlanoConta[]>([]);
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
				const [contasData, centrosData, planosData] = await Promise.all([
					listarContas(),
					mostrarCentroCustos ? listarCentroCustos() : Promise.resolve([]),
					mostrarPlanoContas ? listarPlanoContas() : Promise.resolve([])
				]);
				setContas(contasData);
				setCentrosCustos(centrosData);
				setPlanosContas(planosData);
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
	}, [mostrarCentroCustos, mostrarPlanoContas]);

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
			centroCustosId,
			planoContasId: mostrarPlanoContas ? planoContasId : undefined
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
		const plano = aplicado.planoContasId ? planosContas.find(p => p.id === aplicado.planoContasId) : undefined;
		return [
			periodo,
			aplicado.contaId ? (conta ? rotuloConta(conta) : `conta ${aplicado.contaId}`) : 'todas as contas',
			aplicado.status ? ROTULO_STATUS[aplicado.status] ?? aplicado.status : '',
			aplicado.centroCustosId ? `centro: ${centro?.descricao ?? aplicado.centroCustosId}` : '',
			aplicado.planoContasId ? `plano: ${plano?.descricao ?? aplicado.planoContasId}` : '',
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

				{/* Plano de Contas (apenas se mostrarPlanoContas for true) */}
				{mostrarPlanoContas && (
					<div className="space-y-1">
						<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
							Plano de Contas
						</label>
						<SeletorPlanoContas planos={planosContas} valor={planoContasId} onChange={setPlanoContasId} />
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
