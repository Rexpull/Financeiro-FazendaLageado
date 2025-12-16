import React, { useState } from 'react';
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

const RelatorioItensClassificados: React.FC = () => {
	const [dados, setDados] = useState<RelatorioItensClassificadosItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
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
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-lg font-semibold text-gray-800">Plano de Contas</h3>
							{/* Botões de Exportação */}
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
									<th className="w-24 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Data
									</th>
									<th className="w-48 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Histórico
									</th>
									<th className="w-28 px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Receita R$
									</th>
									<th className="w-28 px-2 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Despesa R$
									</th>
									<th className="w-20 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Tipo
									</th>
									<th className="w-24 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Modalidade
									</th>
									<th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Plano de Contas
									</th>
									<th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Centro de Custos
									</th>
									<th className="w-32 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Pessoa
									</th>
									<th className="w-40 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
										Conta Corrente
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{dados.map((item, idx) => (
									<tr
										key={item.id}
										className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
									>
										<td className="px-2 py-2 whitespace-nowrap text-xs text-gray-800">
											{new Date(item.dtMovimento).toLocaleDateString('pt-BR')}
										</td>
										<td className="px-2 py-2 text-xs truncate text-gray-800" title={item.historico}>
											{item.historico}
										</td>
										<td className="px-2 py-2 whitespace-nowrap text-xs text-right font-medium text-gray-900">
											{item.tipoMovimento === 'C' ? (
												<span className="text-emerald-700">
													{new Intl.NumberFormat('pt-BR', {
														style: 'currency',
														currency: 'BRL'
													}).format(item.valor)}
												</span>
											) : (
												<span className="text-gray-400">-</span>
											)}
										</td>
										<td className="px-2 py-2 whitespace-nowrap text-xs text-right font-medium text-gray-900">
											{item.tipoMovimento === 'D' ? (
												<span className="text-rose-700">
													{new Intl.NumberFormat('pt-BR', {
														style: 'currency',
														currency: 'BRL'
													}).format(item.valor)}
												</span>
											) : (
												<span className="text-gray-400">-</span>
											)}
										</td>
										<td className="px-2 py-2 whitespace-nowrap text-xs">
											<span
												className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
													item.tipoMovimento === 'C'
														? 'bg-emerald-100 text-emerald-800'
														: 'bg-rose-100 text-rose-800'
												}`}
											>
												{item.tipoMovimento === 'C' ? 'Receita' : 'Despesa'}
											</span>
										</td>
										<td className="px-2 py-2 whitespace-nowrap text-xs">
											<span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${
												item.modalidadeMovimento === 'financiamento' 
													? 'bg-blue-100 text-blue-800' 
													: item.modalidadeMovimento === 'transferencia' 
													? 'bg-purple-100 text-purple-800' 
													: 'bg-slate-100 text-slate-700'
											}`}>
												{item.modalidadeMovimento === 'financiamento' ? 'Financiamento' : 
												 item.modalidadeMovimento === 'transferencia' ? 'Transferência' : 
												 'Padrão'}
											</span>
										</td>
										<td className="px-2 py-2 text-xs truncate text-gray-800" title={item.planoDescricao || ''}>
											{item.planoDescricao || '-'}
										</td>
										<td className="px-2 py-2 text-xs truncate" title={item.centroCustosDescricao || ''}>
											<span className={item.centroCustosDescricao === 'Não definido' ? 'text-red-600 font-medium' : 'text-gray-800'}>
												{item.centroCustosDescricao || '-'}
											</span>
										</td>
										<td className="px-2 py-2 text-xs truncate text-gray-800" title={item.pessoaNome || ''}>
											{item.pessoaNome || '-'}
										</td>
										<td className="px-2 py-2 text-xs text-gray-800">
											<div className="flex items-center gap-1.5" title={item.contaDescricao || ''}>
												{item.bancoCodigo && (
													<img 
														src={getBancoLogo(item.bancoCodigo)} 
														alt={item.bancoNome || 'Banco'} 
														className="w-5 h-5 object-contain flex-shrink-0"
													/>
												)}
												<span className="truncate whitespace-nowrap">
													{item.agencia ? `${item.agencia} - ` : ''}{item.numConta || '-'}
												</span>
											</div>
										</td>
									</tr>
								))}
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

