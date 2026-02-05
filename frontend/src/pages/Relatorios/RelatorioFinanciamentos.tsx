import React, { useState, useEffect, lazy, Suspense } from 'react';
import { getRelatorioFinanciamentos, FiltrosRelatorioFinanciamentos, RelatorioFinanciamentosData } from '../../services/relatorioService';
import { listarBancos } from '../../services/bancoService';
import { listarPessoas } from '../../services/pessoaService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSpinner, faChevronDown, faChevronUp, faFilter } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Banco } from '../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../backend/src/models/Pessoa';

const Chart = lazy(() => import("react-apexcharts"));

const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(value);
};

const formatDate = (dateString: string) => {
	return new Date(dateString).toLocaleDateString('pt-BR');
};

const totalizadoresVazios = {
	totalContratos: 0,
	totalValorContratos: 0,
	totalJuros: 0,
	totalValorParcelas: 0,
	totalParcelas: 0,
	totalParcelasLiquidadas: 0,
	totalParcelasAberto: 0,
	totalParcelasVencidas: 0,
};

const RelatorioFinanciamentos: React.FC = () => {
	const [dados, setDados] = useState<RelatorioFinanciamentosData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [financiamentosExpandidos, setFinanciamentosExpandidos] = useState<Set<number>>(new Set());
	const [bancos, setBancos] = useState<Banco[]>([]);
	const [pessoas, setPessoas] = useState<Pessoa[]>([]);
	
	const [filtros, setFiltros] = useState<FiltrosRelatorioFinanciamentos>({});
	const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);

	useEffect(() => {
		const carregarDados = async () => {
			try {
				const [bancosData, pessoasData] = await Promise.all([
					listarBancos(),
					listarPessoas()
				]);
				setBancos(bancosData);
				setPessoas(pessoasData);
			} catch (error) {
				console.error('Erro ao carregar dados:', error);
			}
		};
		carregarDados();
	}, []);

	const handleAplicarFiltros = async (filtrosAplicados: FiltrosRelatorioFinanciamentos) => {
		setIsLoading(true);
		setFiltros(filtrosAplicados);
		try {
			const resultado = await getRelatorioFinanciamentos(filtrosAplicados);
			setDados(resultado);
			setFinanciamentosExpandidos(new Set());
		} catch (error) {
			console.error('Erro ao buscar relatório:', error);
			toast.error('Erro ao buscar relatório de financiamentos');
		} finally {
			setIsLoading(false);
		}
	};

	const toggleFinanciamento = (id: number) => {
		const novosExpandidos = new Set(financiamentosExpandidos);
		if (novosExpandidos.has(id)) {
			novosExpandidos.delete(id);
		} else {
			novosExpandidos.add(id);
		}
		setFinanciamentosExpandidos(novosExpandidos);
	};

	const expandirTodos = () => {
		if (dados) {
			setFinanciamentosExpandidos(new Set(dados.itens.map(item => item.idFinanciamento)));
		}
	};

	const recolherTodos = () => {
		setFinanciamentosExpandidos(new Set());
	};

	const handleExportExcel = async () => {
		if (!dados) return;
		
		setIsExporting(true);
		try {
			const dadosParaExcel = dados.itens.flatMap(item => 
				item.parcelas.map(parcela => ({
					'Contrato': item.numeroContrato,
					'Responsável': item.responsavel,
					'Banco': item.banco || '',
					'Pessoa': item.pessoa || '',
					'Data Contrato': formatDate(item.dataContrato),
					'Valor Contrato': item.valorContrato,
					'Total Juros': item.totalJuros,
					'Valor Total': item.valorTotal,
					'Modalidade': item.modalidade || '',
					'Nome Modalidade Particular': item.nomeModalidadeParticular || '',
					'Garantia': item.numeroGarantia || '',
					'Taxa Juros Anual': item.taxaJurosAnual || '',
					'Parcela': parcela.numParcela,
					'Valor Parcela': parcela.valor,
					'Vencimento': formatDate(parcela.dt_vencimento),
					'Status': parcela.status,
					'Data Liquidação': parcela.dt_liquidacao ? formatDate(parcela.dt_liquidacao) : ''
				}))
			);

			const ws = XLSX.utils.json_to_sheet(dadosParaExcel);
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Financiamentos");
			XLSX.writeFile(wb, `relatorio_financiamentos_${new Date().toISOString().split('T')[0]}.xlsx`);

			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel');
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="min-h-screen">
			<div className="max-w-8xl mx-auto">
				<div className="flex items-center justify-between flex-wrap gap-3 mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Relatório de Financiamentos</h1>
				</div>

				{/* Filtros */}
				<div className="bg-white border border-gray-200 shadow-sm rounded-xl mb-6 overflow-hidden">
					<button
						type="button"
						onClick={() => setFiltrosExpandidos((v) => !v)}
						className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-200"
					>
						<span className="flex items-center gap-2 text-base font-semibold text-gray-800">
							<FontAwesomeIcon icon={faFilter} className="text-blue-600" />
							Filtros
						</span>
						<FontAwesomeIcon
							icon={filtrosExpandidos ? faChevronUp : faChevronDown}
							className="text-gray-500 text-sm"
						/>
					</button>

					{filtrosExpandidos && (
					<div className="p-5">
					{/* Filtros de Contrato */}
					<div className="mb-6 pb-4 border-b border-gray-200">
						<h4 className="text-sm font-semibold text-gray-700 mb-3">Filtros de Contrato</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{/* Banco */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Banco
								</label>
								<select
									value={filtros.idBanco || ''}
									onChange={(e) => setFiltros({ ...filtros, idBanco: e.target.value ? parseInt(e.target.value) : undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todos</option>
									{bancos.map((banco) => (
										<option key={banco.id} value={banco.id}>
											{banco.nome}
										</option>
									))}
								</select>
							</div>

							{/* Tomador */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Tomador
								</label>
								<select
									value={filtros.idPessoa || ''}
									onChange={(e) => setFiltros({ ...filtros, idPessoa: e.target.value ? parseInt(e.target.value) : undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todos</option>
									{pessoas.map((pessoa) => (
										<option key={pessoa.id} value={pessoa.id}>
											{pessoa.nome}
										</option>
									))}
								</select>
							</div>

							{/* Garantia */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Garantia (Nº Matrícula)
								</label>
								<input
									type="text"
									value={filtros.numeroGarantia || ''}
									onChange={(e) => setFiltros({ ...filtros, numeroGarantia: e.target.value || undefined })}
									placeholder="Número da garantia"
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
								/>
							</div>

							{/* Modalidade */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Modalidade
								</label>
								<select
									value={filtros.modalidade || ''}
									onChange={(e) => setFiltros({ ...filtros, modalidade: e.target.value as any || undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todas</option>
									<option value="INVESTIMENTO">Investimento</option>
									<option value="CUSTEIO">Custeio</option>
									<option value="PARTICULAR">Particular</option>
								</select>
							</div>

							{/* Data Contratação Início */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Data Contratação Início
								</label>
								<input
									type="date"
									value={filtros.dataContratoInicio || ''}
									onChange={(e) => setFiltros({ ...filtros, dataContratoInicio: e.target.value || undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
								/>
							</div>

							{/* Data Contratação Fim */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Data Contratação Fim
								</label>
								<input
									type="date"
									value={filtros.dataContratoFim || ''}
									onChange={(e) => setFiltros({ ...filtros, dataContratoFim: e.target.value || undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
								/>
							</div>
						</div>
					</div>

					{/* Filtros de Parcelas */}
					<div className="mb-6 pb-4 border-b border-gray-200">
						<h4 className="text-sm font-semibold text-gray-700 mb-3">Filtros de Parcelas</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{/* Mês de Vencimento */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Mês de Vencimento
								</label>
								<select
									value={filtros.mesVencimento || ''}
									onChange={(e) => setFiltros({ ...filtros, mesVencimento: e.target.value ? parseInt(e.target.value) : undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todos</option>
									<option value="1">Janeiro</option>
									<option value="2">Fevereiro</option>
									<option value="3">Março</option>
									<option value="4">Abril</option>
									<option value="5">Maio</option>
									<option value="6">Junho</option>
									<option value="7">Julho</option>
									<option value="8">Agosto</option>
									<option value="9">Setembro</option>
									<option value="10">Outubro</option>
									<option value="11">Novembro</option>
									<option value="12">Dezembro</option>
								</select>
							</div>

							{/* Ano de Vencimento */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Ano de Vencimento
								</label>
								<input
									type="number"
									value={filtros.anoVencimento || ''}
									onChange={(e) => setFiltros({ ...filtros, anoVencimento: e.target.value ? parseInt(e.target.value) : undefined })}
									placeholder="Ex: 2025"
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
								/>
							</div>

							{/* Faixa de Juros */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Faixa de Juros (%)
								</label>
								<select
									value={filtros.faixaJuros || ''}
									onChange={(e) => setFiltros({ ...filtros, faixaJuros: e.target.value || undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todas</option>
									<option value={'<=8'}>≤ 8%</option>
									<option value={'>8<=10'}>{'>'} 8% ≤ 10%</option>
									<option value={'>10<=12'}>{'>'} 10% ≤ 12%</option>
									<option value={'>12<=15'}>{'>'} 12% ≤ 15%</option>
									<option value={'>15'}>{'>'} 15%</option>
								</select>
							</div>
						</div>
					</div>

					{/* Filtros de Status */}
					<div className="mb-4">
						<h4 className="text-sm font-semibold text-gray-700 mb-3">Filtros de Status</h4>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{/* Status do Contrato */}
							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
									Status do Contrato
								</label>
								<select
									value={filtros.statusContrato || ''}
									onChange={(e) => setFiltros({ ...filtros, statusContrato: e.target.value as any || undefined })}
									className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
								>
									<option value="">Todos</option>
									<option value="ATIVO">Ativo</option>
									<option value="QUITADO">Quitado</option>
									<option value="NOVO">Novo</option>
								</select>
							</div>
						</div>
					</div>

						<div className="mt-5 flex justify-end">
							<button
								onClick={() => handleAplicarFiltros(filtros)}
								disabled={isLoading}
								className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
							>
								{isLoading ? 'Carregando...' : 'Aplicar Filtros'}
							</button>
						</div>
					</div>
					)}
				</div>

				{isLoading && (
					<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12">
						<div className="flex flex-col items-center justify-center">
							<div className="relative">
								<div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
							</div>
							<p className="mt-6 text-gray-700 font-medium text-lg">Carregando dados do relatório...</p>
						</div>
					</div>
				)}

				{!isLoading && (
					<>
						{/* Totalizadores */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
							<h3 className="text-base font-semibold text-gray-700 mb-5 uppercase tracking-wide">Totalizadores</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{(() => {
									const tot = dados?.totalizadores ?? totalizadoresVazios;
									return (
										<>
											<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total de Contratos</p>
												<p className="text-2xl font-bold text-gray-900">{tot.totalContratos}</p>
											</div>
											<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Valor Total Contratos</p>
												<p className="text-2xl font-bold text-gray-900">{formatCurrency(tot.totalValorContratos)}</p>
											</div>
											<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total de Juros</p>
												<p className="text-2xl font-bold text-gray-900">{formatCurrency(tot.totalJuros)}</p>
											</div>
											<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Valor Total Parcelas</p>
												<p className="text-2xl font-bold text-gray-900">{formatCurrency(tot.totalValorParcelas)}</p>
											</div>
											<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total de Parcelas</p>
												<p className="text-2xl font-bold text-gray-900">{tot.totalParcelas}</p>
											</div>
											<div className="border-l-4 border-l-green-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Parcelas Liquidadas</p>
												<p className="text-2xl font-bold text-green-600">{tot.totalParcelasLiquidadas}</p>
											</div>
											<div className="border-l-4 border-l-amber-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Parcelas em Aberto</p>
												<p className="text-2xl font-bold text-amber-600">{tot.totalParcelasAberto}</p>
											</div>
											<div className="border-l-4 border-l-red-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Parcelas Vencidas</p>
												<p className="text-2xl font-bold text-red-600">{tot.totalParcelasVencidas}</p>
											</div>
										</>
									);
								})()}
							</div>
						</div>

						{/* Cards de Resumo por Status */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
							<h3 className="text-base font-semibold text-gray-700 mb-5 uppercase tracking-wide">Resumo por Status</h3>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="border-l-4 border-l-blue-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contratos Ativos</p>
									<p className="text-2xl font-bold text-blue-600 mb-1">
										{dados ? dados.itens.filter(item => item.statusContrato === 'ATIVO').length : 0}
									</p>
									<p className="text-sm text-gray-600">
										{formatCurrency(dados ? dados.itens.filter(item => item.statusContrato === 'ATIVO').reduce((sum, item) => sum + item.valorContrato, 0) : 0)}
									</p>
								</div>
								<div className="border-l-4 border-l-green-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contratos Quitados</p>
									<p className="text-2xl font-bold text-green-600 mb-1">
										{dados ? dados.itens.filter(item => item.statusContrato === 'QUITADO').length : 0}
									</p>
									<p className="text-sm text-gray-600">
										{formatCurrency(dados ? dados.itens.filter(item => item.statusContrato === 'QUITADO').reduce((sum, item) => sum + item.valorContrato, 0) : 0)}
									</p>
								</div>
								<div className="border-l-4 border-l-purple-500 border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Contratos Novos</p>
									<p className="text-2xl font-bold text-purple-600 mb-1">
										{dados ? dados.itens.filter(item => item.statusContrato === 'NOVO').length : 0}
									</p>
									<p className="text-sm text-gray-600">
										{formatCurrency(dados ? dados.itens.filter(item => item.statusContrato === 'NOVO').reduce((sum, item) => sum + item.valorContrato, 0) : 0)}
									</p>
								</div>
							</div>
						</div>

						{/* Gráficos */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
							{/* Gráfico Mensal */}
							<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
								<h3 className="text-lg font-semibold text-gray-800 mb-4">Gráfico Mensal</h3>
								{dados?.graficos.mensais?.length ? (
									<Suspense fallback={<div>Carregando gráfico...</div>}>
										<Chart
											options={{
												chart: { type: 'bar', height: 350, toolbar: { show: false } },
												plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
												xaxis: { categories: dados.graficos.mensais.map(g => g.mes) },
												yaxis: {
													title: { text: "Valor (R$)" },
													labels: { formatter: (val: number) => formatCurrency(val) }
												},
												tooltip: { 
													y: { formatter: (val: number) => formatCurrency(val) },
													shared: true,
													intersect: false
												},
												colors: ['#2196f3', '#4caf50', '#ff9800'],
												legend: { position: 'top', horizontalAlign: 'center' },
												dataLabels: { enabled: false }
											}}
											series={[
												{ name: "Contratos Novos", data: dados.graficos.mensais.map(g => g.novos || 0) },
												{ name: "Contratos Quitados", data: dados.graficos.mensais.map(g => g.quitados || 0) },
												{ name: "Contratos Ativos", data: dados.graficos.mensais.map(g => g.ativos || 0) }
											]}
											type="bar"
											height={350}
											style={{width: '100%'}}
										/>
									</Suspense>
								) : (
									<p className="text-gray-500 text-center py-10">Nenhum dado disponível</p>
								)}
							</div>

							{/* Gráfico Anual */}
							<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
								<h3 className="text-lg font-semibold text-gray-800 mb-4">Gráfico Anual</h3>
								{dados?.graficos.anuais?.length ? (
									<Suspense fallback={<div>Carregando gráfico...</div>}>
										<Chart
											options={{
												chart: { type: 'bar', height: 350, toolbar: { show: false } },
												plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
												xaxis: { categories: dados.graficos.anuais.map(g => g.ano.toString()) },
												yaxis: {
													title: { text: "Valor (R$)" },
													labels: { formatter: (val: number) => formatCurrency(val) }
												},
												tooltip: { 
													y: { formatter: (val: number) => formatCurrency(val) },
													shared: true,
													intersect: false
												},
												colors: ['#2196f3', '#4caf50', '#ff9800'],
												legend: { position: 'top', horizontalAlign: 'center' },
												dataLabels: { enabled: false }
											}}
											series={[
												{ name: "Contratos Novos", data: dados.graficos.anuais.map(g => g.novos || 0) },
												{ name: "Contratos Quitados", data: dados.graficos.anuais.map(g => g.quitados || 0) },
												{ name: "Contratos Ativos", data: dados.graficos.anuais.map(g => g.ativos || 0) }
											]}
											type="bar"
											height={350}
											style={{width: '100%'}}
										/>
									</Suspense>
								) : (
									<p className="text-gray-500 text-center py-10">Nenhum dado disponível</p>
								)}
							</div>
						</div>

						{/* Listagem */}
						<div className="bg-white border border-gray-200 rounded-xl shadow-sm">
							<div className="p-5 border-b border-gray-200">
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-semibold text-gray-800">Listagem de Financiamentos</h3>
									<div className="flex gap-2">
										<button
											onClick={expandirTodos}
											className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
										>
											<FontAwesomeIcon icon={faChevronDown} />
											Expandir todos
										</button>
										<button
											onClick={recolherTodos}
											className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
										>
											<FontAwesomeIcon icon={faChevronUp} />
											Recolher todos
										</button>
										<button
											onClick={handleExportExcel}
											disabled={isExporting || !dados?.itens?.length}
											className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
										>
											{isExporting ? (
												<FontAwesomeIcon icon={faSpinner} className="animate-spin" />
											) : (
												<FontAwesomeIcon icon={faFileExcel} />
											)}
											Exportar Excel
										</button>
									</div>
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="min-w-full">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contrato</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Responsável</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Banco/Pessoa</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data Contrato</th>
											<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor Contrato</th>
											<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Juros</th>
											<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor Total</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Modalidade</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Garantia</th>
											<th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Parcelas</th>
											<th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{(dados?.itens ?? []).length === 0 ? (
											<tr>
												<td colSpan={12} className="px-4 py-8 text-center text-gray-500">
													Aplique os filtros para visualizar o relatório.
												</td>
											</tr>
										) : (
											(dados?.itens ?? []).map((item) => (
											<React.Fragment key={item.idFinanciamento}>
												<tr className="hover:bg-gray-50">
													<td className="px-4 py-3 text-sm font-medium text-gray-900">{item.numeroContrato}</td>
													<td className="px-4 py-3 text-sm">
														{item.statusContrato && (
															<span className={`px-2 py-1 rounded text-xs font-semibold ${
																item.statusContrato === 'ATIVO' ? 'bg-blue-100 text-blue-800' :
																item.statusContrato === 'QUITADO' ? 'bg-green-100 text-green-800' :
																item.statusContrato === 'NOVO' ? 'bg-purple-100 text-purple-800' :
																'bg-gray-100 text-gray-800'
															}`}>
																{item.statusContrato === 'ATIVO' ? 'Ativo' :
																 item.statusContrato === 'QUITADO' ? 'Quitado' :
																 item.statusContrato === 'NOVO' ? 'Novo' : '-'}
															</span>
														)}
													</td>
													<td className="px-4 py-3 text-sm text-gray-700">{item.responsavel}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{item.banco || item.pessoa || '-'}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.dataContrato)}</td>
													<td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(item.valorContrato)}</td>
													<td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.totalJuros)}</td>
													<td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(item.valorTotal)}</td>
													<td className="px-4 py-3 text-sm text-gray-700">
														{item.modalidade === 'PARTICULAR' && item.nomeModalidadeParticular
															? `Particular - ${item.nomeModalidadeParticular}`
															: item.modalidade || '-'}
													</td>
													<td className="px-4 py-3 text-sm text-gray-700">{item.numeroGarantia || '-'}</td>
													<td className="px-4 py-3 text-sm text-center text-gray-700">{item.parcelas.length}</td>
													<td className="px-4 py-3 text-center">
														<button
															onClick={() => toggleFinanciamento(item.idFinanciamento)}
															className="text-blue-600 hover:text-blue-800"
														>
															<FontAwesomeIcon icon={financiamentosExpandidos.has(item.idFinanciamento) ? faChevronUp : faChevronDown} />
														</button>
													</td>
												</tr>
												{financiamentosExpandidos.has(item.idFinanciamento) && (
													<tr>
														<td colSpan={12} className="px-4 py-3 bg-gray-50">
															<div className="overflow-x-auto">
																<table className="min-w-full text-sm">
																	<thead>
																		<tr>
																			<th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Parcela</th>
																			<th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Vencimento</th>
																			<th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Valor</th>
																			<th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
																			<th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Liquidação</th>
																		</tr>
																	</thead>
																	<tbody>
																		{item.parcelas.map((parcela) => (
																			<tr key={parcela.idParcela} className="border-t">
																				<td className="px-3 py-2">{parcela.numParcela}</td>
																				<td className="px-3 py-2">{formatDate(parcela.dt_vencimento)}</td>
																				<td className="px-3 py-2 text-right font-medium">{formatCurrency(parcela.valor)}</td>
																				<td className="px-3 py-2">
																					<span className={`px-2 py-1 rounded text-xs font-semibold ${
																						parcela.status === 'Liquidado' ? 'bg-green-100 text-green-800' :
																						parcela.status === 'Vencido' ? 'bg-red-100 text-red-800' :
																						'bg-yellow-100 text-yellow-800'
																					}`}>
																						{parcela.status}
																					</span>
																				</td>
																				<td className="px-3 py-2">{parcela.dt_liquidacao ? formatDate(parcela.dt_liquidacao) : '-'}</td>
																			</tr>
																		))}
																	</tbody>
																</table>
															</div>
														</td>
													</tr>
												)}
											</React.Fragment>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default RelatorioFinanciamentos;

