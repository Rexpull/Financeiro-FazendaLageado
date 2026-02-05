import React, { useMemo, useState } from 'react';
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

	const totalReceitas = dados
		.filter(item => item.tipoMovimento === 'C')
		.reduce((sum, item) => sum + item.valor, 0);
	
	const totalDespesas = dados
		.filter(item => item.tipoMovimento === 'D')
		.reduce((sum, item) => sum + item.valor, 0);
	
	const totalGeral = totalReceitas - totalDespesas;

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

	const renderLinhaItem = (item: RelatorioItensClassificadosItem, idx: number) => (
		<tr
			key={item.id}
			className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
		>
			<td className="px-2 py-2 whitespace-nowrap text-xs text-gray-800">{new Date(item.dtMovimento).toLocaleDateString('pt-BR')}</td>
			<td className="px-2 py-2 text-xs truncate text-gray-800" title={item.historico}>{item.historico}</td>
			<td className="px-2 py-2 whitespace-nowrap text-xs text-right font-medium text-gray-900">
				{item.tipoMovimento === 'C' ? <span className="text-emerald-700">{formatarMoeda(item.valor)}</span> : <span className="text-gray-400">-</span>}
			</td>
			<td className="px-2 py-2 whitespace-nowrap text-xs text-right font-medium text-gray-900">
				{item.tipoMovimento === 'D' && item.centroCustosTipo === 'CUSTEIO' ? <span className="text-rose-700">{formatarMoeda(item.valor)}</span> : <span className="text-gray-400">-</span>}
			</td>
			<td className="px-2 py-2 whitespace-nowrap text-xs text-right font-medium text-gray-900">
				{(() => {
					const mostraInvest = item.tipoMovimento === 'D' && (item.centroCustosTipo === 'INVESTIMENTO' || !item.centroCustosTipo);
					return mostraInvest ? <span className="text-rose-700">{formatarMoeda(item.valor)}</span> : <span className="text-gray-400">-</span>;
				})()}
			</td>
			<td className="px-2 py-2 text-xs truncate text-gray-800" title={item.planoDescricao || ''}>{item.planoDescricao || '-'}</td>
			<td className="px-2 py-2 text-xs truncate" title={item.centroCustosDescricao || ''}>
				<span className={item.centroCustosDescricao === 'Não definido' ? 'text-red-600 font-medium' : 'text-gray-800'}>{item.centroCustosDescricao || '-'}</span>
			</td>
			<td className="px-2 py-2 text-xs text-gray-800">
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
				<div className="flex items-center justify-between flex-wrap gap-3 mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Relatório de Plano de Contas</h1>
				</div>
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
							<div className="flex items-center gap-3">
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
							<div className="flex gap-2">
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
						<div className=" mb-4 pt-4 mt-4 border-t flex items-center gap-4 text-sm">
							<div className="text-gray-600">
								Total de registros: <span className="font-medium text-gray-900">{dados.length}</span>
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
							</div>
							<span className="text-gray-600">|</span>

							<div className="text-gray-900 font-semibold">
								Saldo: {new Intl.NumberFormat('pt-BR', {
									style: 'currency',
									currency: 'BRL'
								}).format(totalGeral)}
							</div>
						</div>
						<div className="border border-gray-200 rounded-lg overflow-hidden">
							<table className="w-full table-fixed">
							<thead className="bg-slate-50">
								<tr>
									<th rowSpan={2} className="w-24 px-2 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Data
									</th>
									<th rowSpan={2} className="w-48 px-2 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Histórico
									</th>
									<th rowSpan={2} className="w-28 px-2 py-3 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-l-1 border-r border-t-1 border-gray-300 align-middle bg-emerald-50">
										Receita R$
									</th>
									<th colSpan={2} className="px-2 py-2 text-center text-[10px] font-semibold text-slate-700 uppercase tracking-wide border-b border-r border-gray-300 bg-rose-50">
										Despesa R$
									</th>
									<th rowSpan={2} className="px-2 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-l border-gray-300 align-middle">
										Plano de Contas
									</th>
									<th rowSpan={2} className="px-2 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
										Centro de Custos
									</th>
									<th rowSpan={2} className="w-40 px-2 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-gray-300 align-middle">
										Conta Corrente
									</th>
								</tr>
								<tr className="bg-rose-50">
									<th className="w-28 px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300">
										Custeio
									</th>
									<th className="w-28 px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-gray-300">
										Investimento
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{ordenarPor === 'data' && dados.map((item, idx) => renderLinhaItem(item, idx))}
								{ordenarPor === 'plano' && gruposPorPlano.map(([chave, itens]) => {
									const nomePlano = typeof chave === 'string' ? chave : (itens[0]?.planoDescricao ?? String(chave));
									const subReceita = itens.filter(i => i.tipoMovimento === 'C').reduce((s, i) => s + i.valor, 0);
									const subDespesaCusteio = itens.filter(i => i.tipoMovimento === 'D' && i.centroCustosTipo === 'CUSTEIO').reduce((s, i) => s + i.valor, 0);
									const subDespesaInvest = itens.filter(i => i.tipoMovimento === 'D' && (i.centroCustosTipo === 'INVESTIMENTO' || !i.centroCustosTipo)).reduce((s, i) => s + i.valor, 0);
									return (
										<React.Fragment key={String(chave)}>
											<tr className="bg-slate-100 border-t-2 border-slate-200">
												<td colSpan={8} className="px-2 py-2 text-xs font-semibold text-slate-700">
													Plano de contas: {nomePlano}
												</td>
											</tr>
											{itens.map((item, idx) => renderLinhaItem(item, idx))}
											<tr className="bg-slate-50 font-semibold border-t border-slate-200">
												<td colSpan={2} className="px-2 py-2 text-xs text-gray-700">Subtotal {nomePlano}</td>
												<td className="px-2 py-2 text-xs text-right text-emerald-700">{subReceita > 0 ? formatarMoeda(subReceita) : '-'}</td>
												<td className="px-2 py-2 text-xs text-right text-rose-700">{subDespesaCusteio > 0 ? formatarMoeda(subDespesaCusteio) : '-'}</td>
												<td className="px-2 py-2 text-xs text-right text-rose-700">{subDespesaInvest > 0 ? formatarMoeda(subDespesaInvest) : '-'}</td>
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

