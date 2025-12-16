import React, { useState } from 'react';
import FiltroRelatorio from './FiltroRelatorio';
import {
	getRelatorioCentroCustos,
	exportRelatorioCentroCustosExcel,
	exportRelatorioCentroCustosPDF,
	RelatorioCentroCustosItem
} from '../../services/relatorioService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faFilePdf, faChevronDown, faChevronUp, faPlus, faMinus, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { getBancoLogo } from '../../Utils/bancoUtils';

const RelatorioCentroCustos: React.FC = () => {
	const [dados, setDados] = useState<RelatorioCentroCustosItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [centrosExpandidos, setCentrosExpandidos] = useState<Set<number>>(new Set());
	const [filtrosAplicados, setFiltrosAplicados] = useState<{
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}>({});

	const handleAplicarFiltros = async (filters: {
		dataInicio?: string;
		dataFim?: string;
		contaId?: number;
		status?: string;
		centroCustosId?: number;
	}) => {
		setIsLoading(true);
		setFiltrosAplicados(filters);
		try {
			const resultado = await getRelatorioCentroCustos(
				filters.dataInicio,
				filters.dataFim,
				filters.contaId,
				filters.status,
				filters.centroCustosId
			);
			setDados(resultado);
			// Por padrão, iniciar recolhido
			setCentrosExpandidos(new Set());
		} catch (error) {
			console.error('Erro ao buscar relatório:', error);
			toast.error('Erro ao buscar relatório de centro de custos');
		} finally {
			setIsLoading(false);
		}
	};

	const toggleCentro = (centroId: number) => {
		const novosExpandidos = new Set(centrosExpandidos);
		if (novosExpandidos.has(centroId)) {
			novosExpandidos.delete(centroId);
		} else {
			novosExpandidos.add(centroId);
		}
		setCentrosExpandidos(novosExpandidos);
	};

	const handleExportExcel = async () => {
		setIsExporting(true);
		try {
			const blob = await exportRelatorioCentroCustosExcel(
				filtrosAplicados.dataInicio,
				filtrosAplicados.dataFim,
				filtrosAplicados.contaId,
				filtrosAplicados.status,
				filtrosAplicados.centroCustosId
			);

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `relatorio_centro_custos_${filtrosAplicados.dataInicio || ''}_${filtrosAplicados.dataFim || ''}.xlsx`;
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
			const blob = await exportRelatorioCentroCustosPDF(
				filtrosAplicados.dataInicio,
				filtrosAplicados.dataFim,
				filtrosAplicados.contaId,
				filtrosAplicados.status,
				filtrosAplicados.centroCustosId
			);

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `relatorio_centro_custos_${filtrosAplicados.dataInicio || ''}_${filtrosAplicados.dataFim || ''}.pdf`;
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
		.filter(item => item.centro.tipoReceitaDespesa === 'RECEITA')
		.reduce((sum, item) => sum + item.total, 0);
	
	const totalDespesas = dados
		.filter(item => item.centro.tipoReceitaDespesa === 'DESPESA')
		.reduce((sum, item) => sum + item.total, 0);
	
	const totalGeral = totalReceitas - totalDespesas;

	const expandirTodos = () => {
		setCentrosExpandidos(new Set(dados.map(item => item.centro.id)));
	};

	const recolherTodos = () => {
		setCentrosExpandidos(new Set());
	};

	return (
		<div className="min-h-screen">
			<div className="max-w-8xl mx-auto">
				<div className="flex items-center justify-between flex-wrap gap-3 mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Relatório de Centro de Custos</h1>
				</div>
				<FiltroRelatorio onAplicarFiltros={handleAplicarFiltros} mostrarCentroCustos={true} />

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
				<div className="bg-white border border-gray-200 rounded-xl shadow-sm">
					{/* Resumo */}
					<div className="p-5 border-b border-gray-200">
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-lg font-semibold text-gray-800">Resumo por Centro de Custos</h3>
							<div className="flex gap-2">
								<button
									onClick={expandirTodos}
									className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
								>
									<FontAwesomeIcon icon={faPlus} />
									Expandir todos
								</button>
								<button
									onClick={recolherTodos}
									className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
								>
									<FontAwesomeIcon icon={faMinus} />
									Recolher todos
								</button>
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
						<div className="mb-4 pt-4 mt-4 border-t flex items-center gap-4 text-sm">
							<div className="text-gray-600">
								Total de centros: <span className="font-medium text-gray-900">{dados.length}</span>
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
						<div className="overflow-x-auto">
							<table className="min-w-full">
								<thead className="bg-slate-50">
									<tr>
										<th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Centro de Custos
										</th>
										<th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Tipo
										</th>
										<th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Custeio/Investimento
										</th>
										<th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Receita R$
										</th>
										<th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Despesa R$
										</th>
										<th className="px-6 py-3 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
											Ações
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{dados.map((item, idxResumo) => (
										<React.Fragment key={item.centro.id}>
											<tr className={idxResumo % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
												<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
													{item.centro.descricao}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm">
													{item.centro.tipoReceitaDespesa ? (
														<span
															className={`px-2.5 py-1 rounded-full text-xs font-medium ${
																item.centro.tipoReceitaDespesa === 'RECEITA'
																	? 'bg-emerald-100 text-emerald-800'
																	: 'bg-rose-100 text-rose-800'
															}`}
														>
															{item.centro.tipoReceitaDespesa}
														</span>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm">
													{item.centro.tipo ? (
														<span
															className={`px-2.5 py-1 rounded-full text-xs font-medium ${
																item.centro.tipo === 'CUSTEIO'
																	? 'bg-amber-100 text-amber-800'
																	: 'bg-blue-100 text-blue-800'
															}`}
														>
															{item.centro.tipo}
														</span>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
													{item.centro.tipoReceitaDespesa === 'RECEITA' ? (
														<span className="text-emerald-700">
															{new Intl.NumberFormat('pt-BR', {
																style: 'currency',
																currency: 'BRL'
															}).format(item.total)}
														</span>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
													{item.centro.tipoReceitaDespesa === 'DESPESA' ? (
														<span className="text-rose-700">
															{new Intl.NumberFormat('pt-BR', {
																style: 'currency',
																currency: 'BRL'
															}).format(item.total)}
														</span>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-center">
													<button
														onClick={() => toggleCentro(item.centro.id)}
														className="text-blue-600 hover:text-blue-800"
														title={centrosExpandidos.has(item.centro.id) ? 'Recolher' : 'Expandir'}
													>
														<FontAwesomeIcon
															icon={centrosExpandidos.has(item.centro.id) ? faChevronUp : faChevronDown}
														/>
													</button>
												</td>
											</tr>
											{centrosExpandidos.has(item.centro.id) && (
												<tr>
													<td colSpan={7} className="px-6 py-4 bg-slate-50">
														<div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
															<table className="min-w-full">
																<thead className="bg-slate-100">
																	<tr>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Data
																		</th>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Histórico
																		</th>
																		<th className="px-4 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Valor R$
																		</th>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Tipo
																		</th>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Plano de Contas
																		</th>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Pessoa
																		</th>
																		<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
																			Conta Corrente
																		</th>
																	</tr>
																</thead>
																<tbody className="divide-y divide-gray-100">
																	{item.movimentos.map((mov, idx) => (
																		<tr
																			key={`${mov.id}-${idx}`}
																			className={`${
																				idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
																			} hover:bg-blue-50 transition-colors`}
																		>
																			<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
																				{new Date(mov.dtMovimento).toLocaleDateString('pt-BR')}
																			</td>
																			<td className="px-4 py-2 text-sm text-gray-800">
																				{mov.historico}
																			</td>
																			<td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">
																				{new Intl.NumberFormat('pt-BR', {
																					style: 'currency',
																					currency: 'BRL'
																				}).format(mov.valor)}
																			</td>
																			<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
																				{mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito'}
																			</td>
																			<td className="px-4 py-2 text-sm text-gray-700">
																				{mov.planoDescricao || '-'}
																			</td>
																			<td className="px-4 py-2 text-sm text-gray-700">
																				{mov.pessoaNome || '-'}
																			</td>
																			<td className="px-4 py-2 text-sm text-gray-700">
																				<div className="flex items-center gap-2" title={mov.contaDescricao || ''}>
																					{(mov as any).bancoCodigo && (
																						<img 
																							src={getBancoLogo((mov as any).bancoCodigo)} 
																							alt={(mov as any).bancoNome || 'Banco'} 
																							className="w-5 h-5 object-contain flex-shrink-0"
																						/>
																					)}
																					<span className="truncate whitespace-nowrap">
																						{(mov as any).agencia ? `${(mov as any).agencia} - ` : ''}{(mov as any).numConta || '-'}
																					</span>
																				</div>
																			</td>
																		</tr>
																	))}
																</tbody>
															</table>
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
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

export default RelatorioCentroCustos;

