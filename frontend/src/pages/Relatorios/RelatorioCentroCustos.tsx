import React, { useState } from 'react';
import BreadCrumb from '../../components/BreadCrumb';
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
import { formatarDataISO } from '../../Utils/formatarData';

const RelatorioCentroCustos: React.FC = () => {
	const [dados, setDados] = useState<RelatorioCentroCustosItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [centrosExpandidos, setCentrosExpandidos] = useState<Set<string>>(new Set());
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

	const toggleCentro = (key: string) => {
		const novosExpandidos = new Set(centrosExpandidos);
		if (novosExpandidos.has(key)) {
			novosExpandidos.delete(key);
		} else {
			novosExpandidos.add(key);
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

	// Same rules as the Dashboard / Fluxo de Caixa (and the Excel/PDF of this report):
	// - Receitas = credits by cost centre; Despesas = debits, custeio (centre tipo CUSTEIO) × investimento
	// - financing and "sem centro de custos" (pending) are shown apart, outside the totals
	const ehCusteio = (item: RelatorioCentroCustosItem) =>
		item.centro.subtipoDespesa ? item.centro.subtipoDespesa === 'custeio' : item.centro.tipo === 'CUSTEIO';

	const comCentro = dados.filter(item => !item.centro.semCentro);
	const dadosReceitas = comCentro.filter(item => item.centro.tipoReceitaDespesa === 'RECEITA');
	const dadosDespesas = comCentro.filter(item => item.centro.tipoReceitaDespesa === 'DESPESA');
	const dadosFinanciamentos = comCentro.filter(item => item.centro.tipoReceitaDespesa === 'FINANCIAMENTO');
	const dadosSemCentro = dados.filter(item => item.centro.semCentro);

	const somar = (itens: RelatorioCentroCustosItem[]) => Math.round(itens.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
	const totalReceitas = somar(dadosReceitas);
	const totalDespesasCusteio = somar(dadosDespesas.filter(ehCusteio));
	const totalDespesasInvestimento = somar(dadosDespesas.filter(item => !ehCusteio(item)));
	const totalDespesas = totalDespesasCusteio + totalDespesasInvestimento;
	const totalFinanciamentos = somar(dadosFinanciamentos);
	const totalSemCentro = somar(dadosSemCentro);

	// A = Receitas − Despesas operacionais (custeio); C = Receitas − todas as despesas
	const saldoOperacional = totalReceitas - totalDespesasCusteio;
	const saldoAposInvestimentos = totalReceitas - totalDespesas;

	const quantidadeCentros = new Set(comCentro.map(item => item.centro.id)).size;

	const grupoKey = (item: RelatorioCentroCustosItem) =>
		`${item.centro.id}|${item.centro.tipoReceitaDespesa ?? ''}`;

	const formatBRL = (value: number) =>
		new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

	const corSaldo = (v: number) => (v < 0 ? 'text-rose-700' : 'text-emerald-700');

	const expandirTodos = () => {
		setCentrosExpandidos(new Set(dados.map(grupoKey)));
	};

	const recolherTodos = () => {
		setCentrosExpandidos(new Set());
	};

	const botaoExpandir = (item: RelatorioCentroCustosItem) => (
		<button
			onClick={() => toggleCentro(grupoKey(item))}
			className="text-blue-600 hover:text-blue-800"
			title={centrosExpandidos.has(grupoKey(item)) ? 'Recolher' : 'Expandir'}
		>
			<FontAwesomeIcon icon={centrosExpandidos.has(grupoKey(item)) ? faChevronUp : faChevronDown} />
		</button>
	);

	const renderDetalhe = (item: RelatorioCentroCustosItem) =>
		centrosExpandidos.has(grupoKey(item)) && (
			<tr>
				<td colSpan={5} className="px-6 py-4 bg-slate-50">
					<div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
						<table className="min-w-full">
							<thead className="bg-slate-100">
								<tr>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Data</th>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Histórico</th>
									<th className="px-4 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Valor R$</th>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Tipo</th>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Plano de Contas</th>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Pessoa</th>
									<th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Conta Corrente</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{item.movimentos.map((mov, idx) => (
									<tr key={`${mov.id}-${idx}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
										<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{formatarDataISO(mov.dtMovimento)}</td>
										<td className="px-4 py-2 text-sm text-gray-800">
											{mov.historico}
											{mov.pendente && (
												<span
													className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase"
													title="Pendente de conciliação (falta plano de contas ou centro de custos)"
												>
													Pendente
												</span>
											)}
										</td>
										<td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatBRL(mov.valor)}</td>
										<td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito'}</td>
										<td className="px-4 py-2 text-sm text-gray-700">
											{mov.planoDescricao || (mov.tipoMovimento === 'D' ? <span className="text-amber-700">Sem plano</span> : '-')}
										</td>
										<td className="px-4 py-2 text-sm text-gray-700">{mov.pessoaNome || '-'}</td>
										<td className="px-4 py-2 text-sm text-gray-700">
											<div className="flex items-center gap-2" title={mov.contaDescricao || ''}>
												{mov.bancoCodigo && <img src={getBancoLogo(mov.bancoCodigo)} alt={mov.bancoNome || 'Banco'} className="w-5 h-5 object-contain flex-shrink-0" />}
												<span className="truncate whitespace-nowrap">{mov.agencia ? `${mov.agencia} - ` : ''}{mov.numConta || '-'}</span>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</td>
			</tr>
		);

	return (
		<div className="min-h-screen">
			<div className="max-w-8xl mx-auto">
				<BreadCrumb grupo="Relatórios" pagina="Centro de Custos" />
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
						<div className="flex flex-wrap items-center justify-between gap-3 mb-2">
							<h3 className="text-lg font-semibold text-gray-800">Resumo por Centro de Custos</h3>
							<div className="flex flex-wrap gap-2">
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
						<div className="mb-4 pt-4 mt-4 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
							<div className="text-gray-600">
								Total de centros: <span className="font-medium text-gray-900">{quantidadeCentros}</span>
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-emerald-700">
								Total Receitas: <span className="font-semibold">{formatBRL(totalReceitas)}</span>
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-rose-700">
								Total Despesas: <span className="font-semibold">{formatBRL(totalDespesas)}</span>
								<span className="text-xs ml-2">
									(Custeio: {formatBRL(totalDespesasCusteio)} | Investimento: {formatBRL(totalDespesasInvestimento)})
								</span>
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-gray-900 font-semibold" title="A = Receitas − Despesas de custeio">
								Saldo operacional (A): <span className={corSaldo(saldoOperacional)}>{formatBRL(saldoOperacional)}</span>
							</div>
							<span className="text-gray-600">|</span>
							<div className="text-gray-900 font-semibold" title="C = Receitas − Despesas de custeio − Despesas de investimento">
								Saldo após investimentos (C): <span className={corSaldo(saldoAposInvestimentos)}>{formatBRL(saldoAposInvestimentos)}</span>
							</div>
							{dadosFinanciamentos.length > 0 && (
								<>
									<span className="text-gray-600">|</span>
									<div className="text-blue-700" title="Financiamentos ficam fora de receitas, despesas e saldos">
										Financiamentos (fora do resultado): <span className="font-semibold">{formatBRL(totalFinanciamentos)}</span>
									</div>
								</>
							)}
							{dadosSemCentro.length > 0 && (
								<>
									<span className="text-gray-600">|</span>
									<div className="text-amber-700" title="Movimentos pendentes de conciliação sem centro de custos: não entram nos totais">
										Sem centro de custos (pendentes): <span className="font-semibold">{formatBRL(totalSemCentro)}</span>
									</div>
								</>
							)}
						</div>
						<div className="overflow-x-auto border border-gray-200 rounded-lg overflow-hidden">
							<table className="min-w-full table-fixed">
								<thead className="bg-slate-50">
									<tr>
										<th rowSpan={2} className="px-6 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300 align-middle">
											Centro de Custos
										</th>
										<th rowSpan={2} className="px-6 py-3 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-l-2 border-r-2 border-gray-300 align-middle bg-emerald-50">
											Receita R$
										</th>
										<th colSpan={2} className="px-6 py-3 text-center text-[11px] font-semibold text-slate-700 uppercase tracking-wide border-b-2 border-r border-gray-300 bg-rose-50">
											Despesa R$
										</th>
										<th rowSpan={2} className="px-6 py-3 text-center text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-l border-gray-300 align-middle">
											Ações
										</th>
									</tr>
									<tr className="bg-rose-50">
										<th className="px-6 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-r border-gray-300">
											Custeio
										</th>
										<th className="px-6 py-2 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide border-b-2 border-gray-300">
											Investimento
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{/* Bloco Receitas: totalizador primeiro, depois desdobramentos */}
									{dadosReceitas.length > 0 && (
										<tr className="bg-emerald-50 font-semibold border-b-2 border-emerald-200">
											<td className="px-6 py-3 whitespace-nowrap text-gray-900">Total Receitas</td>
											<td className="px-6 py-3 whitespace-nowrap text-right text-emerald-700">{formatBRL(totalReceitas)}</td>
											<td className="px-6 py-3"></td>
											<td className="px-6 py-3"></td>
											<td className="px-6 py-3"></td>
										</tr>
									)}
									{dadosReceitas.map((item, idxResumo) => (
										<React.Fragment key={grupoKey(item)}>
											<tr className={idxResumo % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
												<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.centro.descricao}</td>
												<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
													<span className="text-emerald-700">{formatBRL(item.total)}</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900"><span className="text-gray-400">-</span></td>
												<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900"><span className="text-gray-400">-</span></td>
												<td className="px-6 py-4 whitespace-nowrap text-center">{botaoExpandir(item)}</td>
											</tr>
											{renderDetalhe(item)}
										</React.Fragment>
									))}
									{/* Bloco Despesas: totalizador primeiro, depois desdobramentos */}
									{dadosDespesas.length > 0 && (
										<tr className="bg-rose-50 font-semibold border-t-2 border-b-2 border-rose-200">
											<td className="px-6 py-3 whitespace-nowrap text-gray-900">Total Despesas</td>
											<td className="px-6 py-3"></td>
											<td className="px-6 py-3 whitespace-nowrap text-right text-rose-700">{formatBRL(totalDespesasCusteio)}</td>
											<td className="px-6 py-3 whitespace-nowrap text-right text-rose-700">{formatBRL(totalDespesasInvestimento)}</td>
											<td className="px-6 py-3"></td>
										</tr>
									)}
									{dadosDespesas.map((item, idxResumo) => {
										const custeio = ehCusteio(item);
										return (
											<React.Fragment key={grupoKey(item)}>
												<tr className={idxResumo % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
													<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.centro.descricao}</td>
													<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900"><span className="text-gray-400">-</span></td>
													<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
														{custeio ? <span className="text-rose-700">{formatBRL(item.total)}</span> : <span className="text-gray-400">-</span>}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
														{!custeio ? <span className="text-rose-700">{formatBRL(item.total)}</span> : <span className="text-gray-400">-</span>}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center">{botaoExpandir(item)}</td>
												</tr>
												{renderDetalhe(item)}
											</React.Fragment>
										);
									})}
									{/* Saldos (A e C) */}
									{(dadosReceitas.length > 0 || dadosDespesas.length > 0) && (
										<>
											<tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
												<td className="px-6 py-3 whitespace-nowrap text-gray-900" title="A = Receitas − Despesas de custeio">Saldo operacional (A)</td>
												<td colSpan={3} className={`px-6 py-3 whitespace-nowrap text-right ${corSaldo(saldoOperacional)}`}>{formatBRL(saldoOperacional)}</td>
												<td className="px-6 py-3"></td>
											</tr>
											<tr className="bg-slate-100 font-semibold border-b-2 border-slate-300">
												<td className="px-6 py-3 whitespace-nowrap text-gray-900" title="C = Receitas − Despesas de custeio − Despesas de investimento">Saldo após investimentos (C)</td>
												<td colSpan={3} className={`px-6 py-3 whitespace-nowrap text-right ${corSaldo(saldoAposInvestimentos)}`}>{formatBRL(saldoAposInvestimentos)}</td>
												<td className="px-6 py-3"></td>
											</tr>
										</>
									)}
									{/* Bloco Financiamentos: separado de receitas/despesas (fora do resultado) */}
									{dadosFinanciamentos.length > 0 && (
										<tr className="bg-blue-50 font-semibold border-t-2 border-b-2 border-blue-200">
											<td className="px-6 py-3 whitespace-nowrap text-gray-900">Total Financiamentos <span className="text-xs font-normal text-gray-500">(fora do resultado)</span></td>
											<td colSpan={3} className="px-6 py-3 whitespace-nowrap text-center text-blue-700">
												<span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mr-2">Financiamentos R$</span>
												{formatBRL(totalFinanciamentos)}
											</td>
											<td className="px-6 py-3"></td>
										</tr>
									)}
									{dadosFinanciamentos.map((item, idxResumo) => (
										<React.Fragment key={grupoKey(item)}>
											<tr className={idxResumo % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
												<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.centro.descricao}</td>
												<td colSpan={3} className="px-6 py-4 whitespace-nowrap text-center font-semibold text-blue-700">{formatBRL(item.total)}</td>
												<td className="px-6 py-4 whitespace-nowrap text-center">{botaoExpandir(item)}</td>
											</tr>
											{renderDetalhe(item)}
										</React.Fragment>
									))}
									{/* Pendentes sem centro de custos: fora dos totais */}
									{dadosSemCentro.length > 0 && (
										<tr className="bg-amber-50 font-semibold border-t-2 border-b-2 border-amber-200">
											<td className="px-6 py-3 text-gray-900">
												Sem centro de custos <span className="text-xs font-normal text-gray-500">(pendentes de conciliação, fora dos totais)</span>
											</td>
											<td colSpan={3} className="px-6 py-3 whitespace-nowrap text-center text-amber-700">
												<span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide mr-2">Pendentes R$</span>
												{formatBRL(totalSemCentro)}
											</td>
											<td className="px-6 py-3"></td>
										</tr>
									)}
									{dadosSemCentro.map((item, idxResumo) => {
										const rotulo =
											item.centro.tipoReceitaDespesa === 'RECEITA' ? 'créditos' : item.centro.tipoReceitaDespesa === 'DESPESA' ? 'débitos' : 'financiamentos';
										return (
											<React.Fragment key={grupoKey(item)}>
												<tr className={idxResumo % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
													<td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
														{item.centro.descricao} <span className="text-xs text-gray-500">({rotulo})</span>
													</td>
													<td colSpan={3} className="px-6 py-4 whitespace-nowrap text-center font-semibold text-amber-700">{formatBRL(item.total)}</td>
													<td className="px-6 py-4 whitespace-nowrap text-center">{botaoExpandir(item)}</td>
												</tr>
												{renderDetalhe(item)}
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

export default RelatorioCentroCustos;
