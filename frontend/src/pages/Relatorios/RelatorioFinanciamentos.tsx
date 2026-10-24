import React, { useState, useEffect, lazy, Suspense } from 'react';
import type { ApexOptions } from 'apexcharts';
import {
	getRelatorioFinanciamentos,
	FiltrosRelatorioFinanciamentos,
	RelatorioFinanciamentosData,
	ItemRelatorioFinanciamentos,
	StatusContratoFinanciamento,
	ModalidadeFinanciamento,
} from '../../services/relatorioService';
import { listarBancos } from '../../services/bancoService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSpinner, faChevronDown, faChevronUp, faFilter } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Banco } from '../../../../backend/src/models/Banco';

const Chart = lazy(() => import("react-apexcharts"));

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const MODALIDADES: Array<{ value: ModalidadeFinanciamento; label: string }> = [
	{ value: 'INVESTIMENTO', label: 'Investimento' },
	{ value: 'CUSTEIO', label: 'Custeio' },
	{ value: 'PARTICULAR', label: 'Particular' },
	{ value: 'RENEGOCIACAO', label: 'Renegociação' },
];

const STATUS_INFO: Record<StatusContratoFinanciamento, { label: string; plural: string; badge: string; borda: string; texto: string; valor: string }> = {
	NOVO: { label: 'Novo', plural: 'Novos', badge: 'bg-purple-100 text-purple-800', borda: 'border-l-purple-500', texto: 'text-purple-600', valor: 'Valor contratado' },
	ATIVO: { label: 'Ativo', plural: 'Ativos', badge: 'bg-blue-100 text-blue-800', borda: 'border-l-blue-500', texto: 'text-blue-600', valor: 'Parcelas a pagar' },
	QUITADO: { label: 'Quitado', plural: 'Quitados', badge: 'bg-green-100 text-green-800', borda: 'border-l-green-500', texto: 'text-green-600', valor: 'Valor pago' },
};
const STATUS_ORDEM: StatusContratoFinanciamento[] = ['NOVO', 'ATIVO', 'QUITADO'];

const CORES = { novos: '#8b5cf6', liquidados: '#22c55e', compromissos: '#3b82f6' };

const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(value);
};

const formatCompact = (value: number) =>
	new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sem passar por Date (evita deslocamento de fuso). */
const formatDate = (dateString?: string | null) => {
	if (!dateString) return '-';
	const [ano, mes, dia] = String(dateString).slice(0, 10).split('-');
	return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(dateString);
};

const labelModalidade = (item: ItemRelatorioFinanciamentos) => {
	const label = MODALIDADES.find((m) => m.value === item.modalidade)?.label || item.modalidade || '-';
	return item.modalidade === 'PARTICULAR' && item.nomeModalidadeParticular ? `${label} - ${item.nomeModalidadeParticular}` : label;
};

const credor = (item: ItemRelatorioFinanciamentos) => item.banco || item.pessoa || item.nomeModalidadeParticular || '-';

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: anoAtual + 5 - 2010 + 1 }, (_, i) => anoAtual + 5 - i);
const filtrosIniciais: FiltrosRelatorioFinanciamentos = { ano: anoAtual };

const rotuloPeriodo = (ano: number, mes?: number | null) => (mes ? `${MESES_EXTENSO[mes - 1]}/${ano}` : String(ano));

const opcoesBarras = (categorias: string[], cores: string[], legenda = false): ApexOptions => ({
	chart: { type: 'bar', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
	plotOptions: { bar: { horizontal: false, columnWidth: legenda ? '65%' : '55%', borderRadius: 3 } },
	xaxis: { categories: categorias },
	yaxis: { labels: { formatter: (val: number) => formatCompact(val) } },
	tooltip: { y: { formatter: (val: number) => formatCurrency(val) }, shared: legenda, intersect: false },
	colors: cores,
	legend: { show: legenda, position: 'top', horizontalAlign: 'center' },
	dataLabels: { enabled: false },
	grid: { borderColor: '#f1f1f1' },
});

const CartaoGrafico: React.FC<{ titulo: string; subtitulo: string; vazio: boolean; className?: string; children: React.ReactNode }> = ({
	titulo,
	subtitulo,
	vazio,
	className = '',
	children,
}) => (
	<div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 min-w-0 ${className}`}>
		<h3 className="text-base font-semibold text-gray-800">{titulo}</h3>
		<p className="text-xs text-gray-500 mb-3">{subtitulo}</p>
		{vazio ? (
			<p className="text-gray-500 text-center py-16 text-sm">Nenhum valor para os filtros selecionados</p>
		) : (
			<Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">Carregando gráfico...</div>}>{children}</Suspense>
		)}
	</div>
);

const totalizadoresVazios = {
	totalContratos: 0,
	totalValorContratos: 0,
	totalJuros: 0,
	totalValor: 0,
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
	const [tomadores, setTomadores] = useState<string[]>([]);

	const [filtros, setFiltros] = useState<FiltrosRelatorioFinanciamentos>(filtrosIniciais);
	const [filtrosExpandidos, setFiltrosExpandidos] = useState(true);

	useEffect(() => {
		const carregarDados = async () => {
			try {
				setBancos(await listarBancos());
			} catch (error) {
				console.error('Erro ao carregar dados:', error);
			}
		};
		carregarDados();
		handleAplicarFiltros(filtrosIniciais);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAplicarFiltros = async (filtrosAplicados: FiltrosRelatorioFinanciamentos) => {
		setIsLoading(true);
		setFiltros(filtrosAplicados);
		try {
			const resultado = await getRelatorioFinanciamentos(filtrosAplicados);
			setDados(resultado);
			setTomadores(resultado.tomadores ?? []);
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
			const periodo = rotuloPeriodo(dados.periodo.ano, dados.periodo.mes);
			const contratos = dados.itens.map((item) => ({
				'Contrato': item.numeroContrato,
				'Tomador': item.responsavel,
				'Banco/Credor': credor(item),
				'Modalidade': labelModalidade(item),
				'Data Contrato': formatDate(item.dataContrato),
				'Garantia': item.numeroGarantia || '',
				'Taxa Juros Anual': item.taxaJurosAnual ?? '',
				'Valor Contrato': item.valorContrato,
				'Total Juros': item.totalJuros,
				'Valor Total': item.valorTotal,
				'Status': STATUS_INFO[item.statusContrato].label,
				'Valor (conforme status)': item.valor,
				'Data Quitação': item.dataQuitacao ? formatDate(item.dataQuitacao) : '',
				'Parcelas Liquidadas': item.parcelas.filter((p) => p.status === 'Liquidado').length,
				'Total Parcelas': item.parcelas.length,
				'Período': periodo,
			}));

			const parcelas = dados.itens.flatMap(item =>
				item.parcelas.map(parcela => ({
					'Contrato': item.numeroContrato,
					'Tomador': item.responsavel,
					'Banco/Credor': credor(item),
					'Data Contrato': formatDate(item.dataContrato),
					'Valor Contrato': item.valorContrato,
					'Modalidade': labelModalidade(item),
					'Status Contrato': STATUS_INFO[item.statusContrato].label,
					'Valor (conforme status)': item.valor,
					'Parcela': parcela.numParcela,
					'Valor Parcela': parcela.valor,
					'Vencimento': formatDate(parcela.dt_vencimento),
					'Status Parcela': parcela.status,
					'Data Liquidação': parcela.dt_liquidacao ? formatDate(parcela.dt_liquidacao) : ''
				}))
			);

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contratos), "Contratos");
			XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parcelas), "Parcelas");
			const sufixo = dados.periodo.mes ? `${dados.periodo.ano}-${String(dados.periodo.mes).padStart(2, '0')}` : `${dados.periodo.ano}`;
			XLSX.writeFile(wb, `relatorio_financiamentos_${sufixo}.xlsx`);

			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel');
		} finally {
			setIsExporting(false);
		}
	};

	const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white";
	const labelClass = "text-xs font-medium text-gray-600 uppercase tracking-wide";

	const g = dados?.graficos;
	const anoGraficos = dados?.periodo.ano ?? filtros.ano;
	const semValores = (valores: number[]) => valores.every((v) => !v);
	const tot = dados?.totalizadores ?? totalizadoresVazios;

	return (
		<div className="min-h-screen">
			<div className="max-w-8xl mx-auto">
				{/* Period under the title: the top-right corner is covered by the global navbar icons */}
				<div className="flex flex-col gap-1 mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Relatório de Financiamentos</h1>
					{dados && (
						<span className="text-sm text-gray-600">
							Período: <strong>{rotuloPeriodo(dados.periodo.ano, dados.periodo.mes)}</strong>
						</span>
					)}
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
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{/* Ano */}
							<div className="space-y-1">
								<label className={labelClass}>Ano</label>
								<select
									value={filtros.ano}
									onChange={(e) => setFiltros({ ...filtros, ano: parseInt(e.target.value) })}
									className={inputClass}
								>
									{ANOS.map((ano) => (
										<option key={ano} value={ano}>{ano}</option>
									))}
								</select>
							</div>

							{/* Mês */}
							<div className="space-y-1">
								<label className={labelClass}>Mês</label>
								<select
									value={filtros.mes || ''}
									onChange={(e) => setFiltros({ ...filtros, mes: e.target.value ? parseInt(e.target.value) : undefined })}
									className={inputClass}
								>
									<option value="">Ano inteiro</option>
									{MESES_EXTENSO.map((nome, i) => (
										<option key={nome} value={i + 1}>{nome}</option>
									))}
								</select>
							</div>

							{/* Status do Contrato */}
							<div className="space-y-1">
								<label className={labelClass}>Status do Contrato</label>
								<select
									value={filtros.statusContrato || ''}
									onChange={(e) => setFiltros({ ...filtros, statusContrato: (e.target.value || undefined) as StatusContratoFinanciamento | undefined })}
									className={inputClass}
								>
									<option value="">Todos</option>
									{STATUS_ORDEM.map((s) => (
										<option key={s} value={s}>{STATUS_INFO[s].label}</option>
									))}
								</select>
							</div>

							{/* Tomador (Financiamento.responsavel) */}
							<div className="space-y-1">
								<label className={labelClass}>Tomador</label>
								<select
									value={filtros.tomador || ''}
									onChange={(e) => setFiltros({ ...filtros, tomador: e.target.value || undefined })}
									className={inputClass}
								>
									<option value="">Todos</option>
									{tomadores.map((tomador) => (
										<option key={tomador} value={tomador}>{tomador}</option>
									))}
								</select>
							</div>

							{/* Modalidade */}
							<div className="space-y-1">
								<label className={labelClass}>Modalidade</label>
								<select
									value={filtros.modalidade || ''}
									onChange={(e) => setFiltros({ ...filtros, modalidade: (e.target.value || undefined) as ModalidadeFinanciamento | undefined })}
									className={inputClass}
								>
									<option value="">Todas</option>
									{MODALIDADES.map((m) => (
										<option key={m.value} value={m.value}>{m.label}</option>
									))}
								</select>
							</div>

							{/* Banco */}
							<div className="space-y-1">
								<label className={labelClass}>Banco</label>
								<select
									value={filtros.idBanco || ''}
									onChange={(e) => setFiltros({ ...filtros, idBanco: e.target.value ? parseInt(e.target.value) : undefined })}
									className={inputClass}
								>
									<option value="">Todos</option>
									{bancos.map((banco) => (
										<option key={banco.id} value={banco.id}>
											{banco.nome}
										</option>
									))}
								</select>
							</div>

							{/* Garantia */}
							<div className="space-y-1">
								<label className={labelClass}>Garantia (Nº Matrícula)</label>
								<input
									type="text"
									value={filtros.numeroGarantia || ''}
									onChange={(e) => setFiltros({ ...filtros, numeroGarantia: e.target.value || undefined })}
									placeholder="Número da garantia"
									className={inputClass}
								/>
							</div>

							{/* Faixa de Juros */}
							<div className="space-y-1">
								<label className={labelClass}>Faixa de Juros (%)</label>
								<select
									value={filtros.faixaJuros || ''}
									onChange={(e) => setFiltros({ ...filtros, faixaJuros: e.target.value || undefined })}
									className={inputClass}
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

						<div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<p className="text-xs text-gray-500">
								Status no período: <strong>Novo</strong> = contrato assinado no período; <strong>Quitado</strong> = última parcela
								liquidada no período; <strong>Ativo</strong> = não quitado até o fim do período.
							</p>
							<div className="flex gap-2 justify-end shrink-0">
								<button
									onClick={() => handleAplicarFiltros(filtrosIniciais)}
									disabled={isLoading}
									className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
								>
									Limpar
								</button>
								<button
									onClick={() => handleAplicarFiltros(filtros)}
									disabled={isLoading}
									className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
								>
									{isLoading ? 'Carregando...' : 'Aplicar Filtros'}
								</button>
							</div>
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
						{/* Resumo por Status (independe do filtro de status) */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
							<h3 className="text-base font-semibold text-gray-700 mb-5 uppercase tracking-wide">Resumo por Status</h3>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{STATUS_ORDEM.map((s) => {
									const resumo = dados?.resumoStatus?.[s] ?? { quantidade: 0, valor: 0 };
									return (
										<div key={s} className={`border-l-4 ${STATUS_INFO[s].borda} border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow`}>
											<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
												Contratos {STATUS_INFO[s].plural}
											</p>
											<p className={`text-2xl font-bold ${STATUS_INFO[s].texto} mb-1`}>{resumo.quantidade}</p>
											<p className="text-sm text-gray-700 font-medium">{formatCurrency(resumo.valor)}</p>
											<p className="text-xs text-gray-500">{STATUS_INFO[s].valor}</p>
										</div>
									);
								})}
							</div>
						</div>

						{/* Totalizadores */}
						<div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
							<h3 className="text-base font-semibold text-gray-700 mb-5 uppercase tracking-wide">Totalizadores</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total de Contratos</p>
									<p className="text-2xl font-bold text-gray-900">{tot.totalContratos}</p>
								</div>
								<div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Valor (conforme status)</p>
									<p className="text-2xl font-bold text-gray-900">{formatCurrency(tot.totalValor)}</p>
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
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Total de Parcelas</p>
									<p className="text-2xl font-bold text-gray-900">{tot.totalParcelas}</p>
									<p className="text-xs text-gray-500">{formatCurrency(tot.totalValorParcelas)}</p>
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
							</div>
						</div>

						{/* Gráficos (filtros de contrato; o filtro de status afeta só a tabela) */}
						{g && (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
								<CartaoGrafico
									className="lg:col-span-2"
									titulo={`Contratos novos x quitados — ${anoGraficos}`}
									subtitulo="Novos: valor dos contratos assinados no mês · Quitados: parcelas liquidadas no mês"
									vazio={semValores(g.mensal.flatMap((m) => [m.novos, m.liquidados]))}
								>
									<Chart
										options={opcoesBarras(MESES, [CORES.novos, CORES.liquidados], true)}
										series={[
											{ name: 'Novos', data: g.mensal.map((m) => m.novos) },
											{ name: 'Quitados', data: g.mensal.map((m) => m.liquidados) },
										]}
										type="bar"
										height={320}
										width="100%"
									/>
								</CartaoGrafico>

								<CartaoGrafico
									titulo={`Compromissos financeiros de ${anoGraficos}`}
									subtitulo="Parcelas não liquidadas, pelo mês de vencimento"
									vazio={semValores(g.mensal.map((m) => m.compromissos))}
								>
									<Chart
										options={opcoesBarras(MESES, [CORES.compromissos])}
										series={[{ name: 'Compromissos', data: g.mensal.map((m) => m.compromissos) }]}
										type="bar"
										height={300}
										width="100%"
									/>
								</CartaoGrafico>

								<CartaoGrafico
									titulo="Compromissos financeiros por ano"
									subtitulo="Parcelas não liquidadas dos contratos ativos, pelo ano de vencimento"
									vazio={semValores(g.compromissosPorAno.map((a) => a.valor))}
								>
									<Chart
										options={opcoesBarras(g.compromissosPorAno.map((a) => String(a.ano)), [CORES.compromissos])}
										series={[{ name: 'Compromissos', data: g.compromissosPorAno.map((a) => a.valor) }]}
										type="bar"
										height={300}
										width="100%"
									/>
								</CartaoGrafico>

								<CartaoGrafico
									titulo={`Liquidados por mês — ${anoGraficos}`}
									subtitulo="Parcelas liquidadas, pelo mês de liquidação"
									vazio={semValores(g.mensal.map((m) => m.liquidados))}
								>
									<Chart
										options={opcoesBarras(MESES, [CORES.liquidados])}
										series={[{ name: 'Liquidados', data: g.mensal.map((m) => m.liquidados) }]}
										type="bar"
										height={300}
										width="100%"
									/>
								</CartaoGrafico>

								<CartaoGrafico
									titulo="Liquidados por ano"
									subtitulo="Parcelas liquidadas, pelo ano de liquidação"
									vazio={semValores(g.liquidadosPorAno.map((a) => a.valor))}
								>
									<Chart
										options={opcoesBarras(g.liquidadosPorAno.map((a) => String(a.ano)), [CORES.liquidados])}
										series={[{ name: 'Liquidados', data: g.liquidadosPorAno.map((a) => a.valor) }]}
										type="bar"
										height={300}
										width="100%"
									/>
								</CartaoGrafico>
							</div>
						)}

						{/* Listagem */}
						<div className="bg-white border border-gray-200 rounded-xl shadow-sm">
							<div className="p-5 border-b border-gray-200">
								<div className="flex items-center justify-between flex-wrap gap-3">
									<h3 className="text-lg font-semibold text-gray-800">Listagem de Financiamentos</h3>
									<div className="flex gap-2 flex-wrap">
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
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tomador</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Banco/Credor</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Modalidade</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data Contrato</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Garantia</th>
											<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor Contrato</th>
											<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
											<th
												className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase"
												title="Novo: valor do contrato · Ativo: parcelas não liquidadas · Quitado: valor pago"
											>
												Valor
											</th>
											<th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Parcelas</th>
											<th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{(dados?.itens ?? []).length === 0 ? (
											<tr>
												<td colSpan={11} className="px-4 py-8 text-center text-gray-500">
													{dados ? 'Nenhum financiamento encontrado para os filtros selecionados.' : 'Aplique os filtros para visualizar o relatório.'}
												</td>
											</tr>
										) : (
											(dados?.itens ?? []).map((item) => (
											<React.Fragment key={item.idFinanciamento}>
												<tr className="hover:bg-gray-50">
													<td className="px-4 py-3 text-sm font-medium text-gray-900">{item.numeroContrato}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{item.responsavel || '-'}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{credor(item)}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{labelModalidade(item)}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.dataContrato)}</td>
													<td className="px-4 py-3 text-sm text-gray-700">{item.numeroGarantia || '-'}</td>
													<td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.valorContrato)}</td>
													<td className="px-4 py-3 text-sm whitespace-nowrap">
														<span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_INFO[item.statusContrato]?.badge ?? 'bg-gray-100 text-gray-800'}`}>
															{STATUS_INFO[item.statusContrato]?.label ?? '-'}
														</span>
														{item.dataQuitacao && (
															<span className="block text-xs text-gray-500 mt-1">quitado em {formatDate(item.dataQuitacao)}</span>
														)}
													</td>
													<td className="px-4 py-3 text-sm text-right font-bold text-gray-900 whitespace-nowrap">
														{formatCurrency(item.valor)}
														<span className="block text-xs font-normal text-gray-500">{STATUS_INFO[item.statusContrato]?.valor}</span>
													</td>
													<td className="px-4 py-3 text-sm text-center text-gray-700">
														{item.parcelas.filter((p) => p.status === 'Liquidado').length}/{item.parcelas.length}
													</td>
													<td className="px-4 py-3 text-center">
														<button
															onClick={() => toggleFinanciamento(item.idFinanciamento)}
															className="text-blue-600 hover:text-blue-800"
															title="Ver parcelas"
														>
															<FontAwesomeIcon icon={financiamentosExpandidos.has(item.idFinanciamento) ? faChevronUp : faChevronDown} />
														</button>
													</td>
												</tr>
												{financiamentosExpandidos.has(item.idFinanciamento) && (
													<tr>
														<td colSpan={11} className="px-4 py-3 bg-gray-50">
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
																		{item.parcelas.length === 0 && (
																			<tr className="border-t">
																				<td colSpan={5} className="px-3 py-2 text-gray-500">Nenhuma parcela cadastrada.</td>
																			</tr>
																		)}
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
									{(dados?.itens ?? []).length > 0 && (
										<tfoot className="bg-gray-50 border-t border-gray-200">
											<tr>
												<td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700">Total ({tot.totalContratos} contratos)</td>
												<td className="px-4 py-3 text-sm text-right font-semibold text-gray-700">{formatCurrency(tot.totalValorContratos)}</td>
												<td></td>
												<td className="px-4 py-3 text-sm text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(tot.totalValor)}</td>
												<td colSpan={2}></td>
											</tr>
										</tfoot>
									)}
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
