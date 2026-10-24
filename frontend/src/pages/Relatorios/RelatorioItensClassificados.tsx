import React, { useMemo, useState } from 'react';
import BreadCrumb from '../../components/BreadCrumb';
import FiltroRelatorio from './FiltroRelatorio';
import {
	getRelatorioItensClassificados,
	exportRelatorioItensClassificadosExcel,
	exportRelatorioItensClassificadosPDF,
	RelatorioItensClassificadosItem
} from '../../services/relatorioService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faFilePdf, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { getBancoLogo } from '../../Utils/bancoUtils';
import { formatarDataISO } from '../../Utils/formatarData';

type OrdenarPor = 'data' | 'plano';

const RelatorioItensClassificados: React.FC = () => {
	const [dados, setDados] = useState<RelatorioItensClassificadosItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>('data');
	const [filtrosAplicados, setFiltrosAplicados] = useState<{
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
	}>({});

	const handleAplicarFiltros = async (filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
	}) => {
		setIsLoading(true);
		setFiltrosAplicados(filters);
		try {
			const resultado = await getRelatorioItensClassificados(
				filters.dataInicio,
				filters.dataFim,
				filters.contaId,
				filters.status
			);
			setDados(resultado);
		} catch (error) {
			console.error('Erro ao buscar relatório:', error);
			toast.error('Erro ao buscar relatório de plano de contas');
		} finally {
			setIsLoading(false);
		}
	};

	const handleExportExcel = async () => {
		setIsExporting(true);
		try {
			const blob = await exportRelatorioItensClassificadosExcel(
				filtrosAplicados.dataInicio,
				filtrosAplicados.dataFim,
				filtrosAplicados.contaId,
				filtrosAplicados.status
			);

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `relatorio_plano_contas_${filtrosAplicados.dataInicio || ''}_${filtrosAplicados.dataFim || ''}.xlsx`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel');
		} finally {
			setIsExporting(false);
		}
	};

	const handleExportPDF = async () => {
		setIsExporting(true);
		try {
			const blob = await exportRelatorioItensClassificadosPDF(
				filtrosAplicados.dataInicio,
				filtrosAplicados.dataFim,
				filtrosAplicados.contaId,
				filtrosAplicados.status
			);

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `relatorio_plano_contas_${filtrosAplicados.dataInicio || ''}_${filtrosAplicados.dataFim || ''}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			toast.success('PDF gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar PDF:', error);
			toast.error('Erro ao gerar o PDF');
		} finally {
			setIsExporting(false);
		}
	};

	// Same rules as the Dashboard / Fluxo / Relatório de Centro de Custos:
	// receitas = credits by cost centre; despesas = debits with centre, custeio (centre tipo CUSTEIO) × investimento.
	// Rows without cost centre are pending ("Sem centro"): shown, but outside the totals.
	const ehSemCentro = (item: RelatorioItensClassificadosItem) => item.semCentro === true;
	const subtipoDespesa = (item: RelatorioItensClassificadosItem): 'custeio' | 'investimento' | null => {
		if (item.tipoMovimento !== 'D' || ehSemCentro(item)) return null;
		if (item.subtipoDespesa) return item.subtipoDespesa;
		return item.centroCustosTipo === 'CUSTEIO' ? 'custeio' : 'investimento';
	};
	const somar = (itens: RelatorioItensClassificadosItem[]) => Math.round(itens.reduce((sum, item) => sum + item.valor, 0) * 100) / 100;

	const totalReceitas = somar(dados.filter(item => item.tipoMovimento === 'C' && !ehSemCentro(item)));
	const totalDespesasCusteio = somar(dados.filter(item => subtipoDespesa(item) === 'custeio'));
	const totalDespesasInvestimento = somar(dados.filter(item => subtipoDespesa(item) === 'investimento'));
	const totalDespesas = totalDespesasCusteio + totalDespesasInvestimento;
	const totalSemCentro = somar(dados.filter(ehSemCentro));

	const totalGeral = totalReceitas - totalDespesas;
	// One movement can produce several rows (rateio plan × centre)
	const totalMovimentos = new Set(dados.map(item => item.id)).size;

	// Agrupamento por plano (para visualização "Por plano de contas")
	const gruposPorPlano = useMemo(() => {
		const map = new Map<string | number, RelatorioItensClassificadosItem[]>();
		for (const item of dados) {
			const key = item.idPlanoContas ?? item.planoDescricao ?? 'Sem plano';
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(item);
		}
		const entries = Array.from(map.entries()).sort((a, b) => {
			const nomeA = typeof a[0] === 'string' ? a[0] : (a[1][0]?.planoDescricao ?? String(a[0]));
			const nomeB = typeof b[0] === 'string' ? b[0] : (b[1][0]?.planoDescricao ?? String(b[0]));
			return nomeA.localeCompare(nomeB);
		});
		return entries;
	}, [dados]);

	const formatarMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

	// Rateio: the backend emits one row per plan × centre with the same movement id → key must not be only item.id
	const renderLinhaItem = (item: RelatorioItensClassificadosItem, idx: number) => (
		<tr
			key={`${item.id}-${item.idPlanoContas ?? ''}-${idx}`}
			className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
		>
			<td className="px-2 py-2 whitespace-nowrap text-[13px] text-gray-800">{formatarDataISO(item.dtMovimento)}</td>
			<td className="px-2 py-2 text-[13px] truncate text-gray-800" title={item.historico}>{item.historico}</td>
			<td className="px-2 py-2 whitespace-nowrap text-[13px] text-right font-medium text-gray-900">
				{item.tipoMovimento === 'C' ? (
					<span
						className={ehSemCentro(item) ? 'text-amber-700' : 'text-emerald-700'}
						title={ehSemCentro(item) ? 'Pendente sem centro de custos: fora dos totais' : undefined}
					>
						{formatarMoeda(item.valor)}
						{ehSemCentro(item) && ' *'}
					</span>
				) : (
					<span className="text-gray-400">-</span>
				)}
			</td>
			{item.tipoMovimento === 'D' && ehSemCentro(item) ? (
				// Debit without cost centre: pending, neither custeio nor investimento (outside the totals)
				<td colSpan={2} className="px-2 py-2 whitespace-nowrap text-[13px] text-center font-medium text-amber-700" title="Pendente sem centro de custos: fora dos totais">
					{formatarMoeda(item.valor)} * (sem centro)
				</td>
			) : (
				<>
					<td className="px-2 py-2 whitespace-nowrap text-[13px] text-right font-medium text-gray-900">
						{subtipoDespesa(item) === 'custeio' ? <span className="text-rose-700">{formatarMoeda(item.valor)}</span> : <span className="text-gray-400">-</span>}
					</td>
					<td className="px-2 py-2 whitespace-nowrap text-[13px] text-right font-medium text-gray-900">
						{subtipoDespesa(item) === 'investimento' ? <span className="text-rose-700">{formatarMoeda(item.valor)}</span> : <span className="text-gray-400">-</span>}
					</td>
				</>
			)}
			<td className="px-2 py-2 text-[13px] truncate text-gray-800" title={item.planoDescricao || ''}>
				{item.planoDescricao ||
					(item.tipoMovimento === 'C' ? (
						<span className="text-gray-400" title="Receita classificada só por centro de custos">—</span>
					) : (
						<span className="text-amber-700 font-medium" title="Pendente: débito sem plano de contas">Sem plano</span>
					))}
			</td>
			<td className="px-2 py-2 text-[13px] truncate" title={item.centroCustosDescricao || ''}>
				<span className={ehSemCentro(item) ? 'text-red-600 font-medium' : 'text-gray-800'}>{item.centroCustosDescricao || '-'}</span>
			</td>
			<td className="px-2 py-2 text-[13px] text-gray-800">
				<div className="flex items-center gap-1.5" title={item.contaDescricao || ''}>
					{item.bancoCodigo && <img src={getBancoLogo(item.bancoCodigo)} alt={item.bancoNome || 'Banco'} className="w-5 h-5 object-contain flex-shrink-0" />}
					<span className="truncate whitespace-nowrap">{item.agencia ? `${item.agencia} - ` : ''}{item.numConta || '-'}</span>
				</div>
			</td>
		</tr>
	);

	return (
		<div className="min-h-screen ">
			<div className="max-w-8xl mx-auto">
				<BreadCrumb grupo="Relatórios" pagina="Plano de Contas" />
				<FiltroRelatorio onAplicarFiltros={handleAplicarFiltros} mostrarCentroCustos={false} />

			{isLoading && (
				<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12">
					<div className="flex flex-col items-center justify-center">
						<div className="relative">
							<div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
						</div>
						<p className="mt-6 text-gray-700 font-medium text-lg">Carregando dados do relatório...</p>
						<p className="mt-2 text-gray-500 text-sm">Aguarde enquanto processamos as informações</p>
					</div>
				</div>
			)}

			{!isLoading && dados.length === 0 && Object.keys(filtrosAplicados).length > 0 && (
				<div className="text-center py-8">
					<p className="text-gray-600">Nenhum dado encontrado para os filtros aplicados.</p>
				</div>
			)}

			{!isLoading && dados.length > 0 && (
				<div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
					<div className="p-5">
						<div className="flex items-center justify-between mb-3 flex-wrap gap-2">
							<div className="flex flex-wrap items-center gap-3">
								<h3 className="text-lg font-semibold text-gray-800">Plano de Contas</h3>
								<span className="text-sm text-gray-500">Visualização:</span>
								<select
									value={ordenarPor}
									onChange={(e) => setOrdenarPor(e.target.value as OrdenarPor)}
									className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									<option value="data">Por data (mais recente primeiro)</option>
									<option value="plano">Por plano de contas (subtotais)</option>
								</select>
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									onClick={handleExportExcel}
									disabled={isExporting}
									className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
								>
									{isExporting ? (
										<FontAwesomeIcon icon={faSpinner} className="animate-spin" />
									) : (
										<FontAwesomeIcon icon={faFileExcel} />
									)}
									Exportar Excel
								</button>
								<button
									onClick={handleExportPDF}
									disabled={isExporting}
									className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
								>
									{isExporting ? (
										<FontAwesomeIcon icon={faSpinner} className="animate-spin" />
									) : (
										<FontAwesomeIcon icon={faFilePdf} />
									)}
									Exportar PDF
								</button>
							</div>
						</div>
						<div className="mb-4 pt-4 mt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
							<div className="text-gray-600" title="Um movimento rateado aparece em uma linha por plano × centro">
								Total de movimentos: <span className="font-medium text-gray-900">{totalMovimentos}</span>
								{dados.length !== totalMovimentos && <span className="text-xs text-gray-500 ml-1">({dados.length} linhas)</span>}
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-emerald-700">
								Total Receitas: <span className="font-semibold">
									{new Intl.NumberFormat('pt-BR', {
										style: 'currency',
										currency: 'BRL'
									}).format(totalReceitas)}
								</span>
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-rose-700">
								Total Despesas: <span className="font-semibold">
									{new Intl.NumberFormat('pt-BR', {
										style: 'currency',
										currency: 'BRL'
									}).format(totalDespesas)}
								</span>
								<span className="text-xs ml-2">
									(Custeio: {formatarMoeda(totalDespesasCusteio)} | Investimento: {formatarMoeda(totalDespesasInvestimento)})
								</span>
							</div>
							<span className="text-gray-600">|</span>

							<div className="text-gray-900 font-semibold" title="C = Receitas − Despesas de custeio − Despesas de investimento">
								Saldo após investimentos (C):{' '}
								<span className={totalGeral < 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatarMoeda(totalGeral)}</span>
							</div>
							{totalSemCentro > 0 && (
								<>
									<span className="text-gray-600">|</span>
									<div className="text-amber-700" title="Movimentos pendentes sem centro de custos: não entram nos totais">
										* Sem centro (pendentes): <span className="font-semibold">{formatarMoeda(totalSemCentro)}</span>
									</div>
								</>
							)}
						</div>
						{/* Horizontal scroll on small screens instead of squeezing the columns */}
						<div className="border border-gray-200 rounded-lg overflow-x-auto">
							<table className="w-full min-w-[960px] table-fixed">
							<thead className="bg-slate-50">
								<tr>
									<th rowSpan={2} className="w-24 px-2 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Data
									</th>
									<th rowSpan={2} className="w-48 px-2 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Histórico
									</th>
									<th rowSpan={2} className="w-28 px-2 py-3 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-l-1 border-r border-t-1 border-gray-300 align-middle bg-emerald-50">
										Receita R$
									</th>
									<th colSpan={2} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-700 uppercase tracking-wide border-b border-r border-gray-300 bg-rose-50">
										Despesa R$
									</th>
									<th rowSpan={2} className="px-2 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-l border-gray-300 align-middle">
										Plano de Contas
									</th>
									<th rowSpan={2} className="px-2 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Centro de Custos
									</th>
									<th rowSpan={2} className="w-40 px-2 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-gray-300 align-middle">
										Conta Corrente
									</th>
								</tr>
								<tr className="bg-rose-50">
									<th className="w-28 px-2 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300">
										Custeio
									</th>
									<th className="w-28 px-2 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-gray-300">
										Investimento
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{ordenarPor === 'data' && dados.map((item, idx) => renderLinhaItem(item, idx))}
								{ordenarPor === 'plano' && gruposPorPlano.map(([chave, itens]) => {
									const nomePlano = typeof chave === 'string' ? chave : (itens[0]?.planoDescricao ?? String(chave));
									const subReceita = itens.filter(i => i.tipoMovimento === 'C' && !ehSemCentro(i)).reduce((s, i) => s + i.valor, 0);
									const subDespesaCusteio = itens.filter(i => subtipoDespesa(i) === 'custeio').reduce((s, i) => s + i.valor, 0);
									const subDespesaInvest = itens.filter(i => subtipoDespesa(i) === 'investimento').reduce((s, i) => s + i.valor, 0);
									return (
										<React.Fragment key={String(chave)}>
											<tr className="bg-slate-100 border-t-2 border-slate-200">
												<td colSpan={8} className="px-2 py-2 text-[13px] font-semibold text-slate-700">
													Plano de contas: {nomePlano}
												</td>
											</tr>
											{itens.map((item, idx) => renderLinhaItem(item, idx))}
											<tr className="bg-slate-50 font-semibold border-t border-slate-200">
												<td colSpan={2} className="px-2 py-2 text-[13px] text-gray-700">Subtotal {nomePlano}</td>
												<td className="px-2 py-2 text-[13px] text-right text-emerald-700">{subReceita > 0 ? formatarMoeda(subReceita) : '-'}</td>
												<td className="px-2 py-2 text-[13px] text-right text-rose-700">{subDespesaCusteio > 0 ? formatarMoeda(subDespesaCusteio) : '-'}</td>
												<td className="px-2 py-2 text-[13px] text-right text-rose-700">{subDespesaInvest > 0 ? formatarMoeda(subDespesaInvest) : '-'}</td>
												<td colSpan={3} className="px-2 py-2"></td>
											</tr>
										</React.Fragment>
									);
								})}
							</tbody>
						</table>
						</div>
					</div>
				</div>
			)}
			</div>
		</div>
	);
};

export default RelatorioItensClassificados;

