// frontend/src/pages/financeiro/financiamentos/ListFinanciamentos.tsx

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faPlus,
	faSearch,
	faChevronDown,
	faMoneyCheckAlt,
	faEllipsisV,
	faEdit,
	faTrash,
	faList,
	faTable,
	faCheck,
	faUndo,
	faMoneyBillWave,
	faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import defaultIcon from '../../../assets/img/icon-Bancos/default.png';
import noData from '/frontend/src/assets/img/noData.svg';
import ModalFinanciamento from './ModalFinanciamento';
import { Financiamento } from '../../../../../backend/src/models/Financiamento';
import { salvarFinanciamento, listarFinanciamentos, excluirFinanciamento } from '../../../services/financiamentoService';
import { salvarParcelaFinanciamento } from '../../../services/financiamentoParcelasService';
import { toast } from 'react-toastify';
import { listarBancos } from '../../../services/bancoService';
import { listarPessoas } from '../../../services/pessoaService';
import { Banco } from '../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../backend/src/models/Pessoa';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import DialogModal from '../../../components/DialogModal';
import ModalParcelas from './ModalParcelas';

// Importando logos dos bancos
import bancoBrasil from '../../../assets/img/icon-Bancos/banco-brasil.svg';
import santander from '../../../assets/img/icon-Bancos/santander.svg';
import caixa from '../../../assets/img/icon-Bancos/caixa.svg';
import bradesco from '../../../assets/img/icon-Bancos/bradesco.svg';
import itau from '../../../assets/img/icon-Bancos/itau.svg';
import inter from '../../../assets/img/icon-Bancos/inter.svg';
import sicredi from '../../../assets/img/icon-Bancos/sicredi.svg';
import sicoob from '../../../assets/img/icon-Bancos/sicoob.svg';
import safra from '../../../assets/img/icon-Bancos/safra.svg';
import nubank from '../../../assets/img/icon-Bancos/nubank.svg';
import original from '../../../assets/img/icon-Bancos/original.svg';
import bancoBrasilia from '../../../assets/img/icon-Bancos/banco-brasilia.svg';
import banrisul from '../../../assets/img/icon-Bancos/banrisul.svg';
import citiBank from '../../../assets/img/icon-Bancos/citi-bank.svg';
import hsbc from '../../../assets/img/icon-Bancos/hsbc.svg';
import banestes from '../../../assets/img/icon-Bancos/banestes.svg';
import bancoAmazonia from '../../../assets/img/icon-Bancos/banco-amazonia.svg';
import bancoNordeste from '../../../assets/img/icon-Bancos/banco-nordeste.svg';
import bankBoston from '../../../assets/img/icon-Bancos/bank-boston.svg';

const BancoLogos: { [key: string]: string } = {
	'001': bancoBrasil,
	'033': santander,
	'104': caixa,
	'237': bradesco,
	'341': itau,
	'077': inter,
	'748': sicredi,
	'756': sicoob,
	'422': safra,
	'260': nubank,
	'212': original,
	'070': bancoBrasilia,
	'389': banrisul,
	'745': citiBank,
	'399': hsbc,
	'021': banestes,
	'085': bancoAmazonia,
	'003': bancoNordeste,
	'318': bankBoston,
};

const ListFinanciamentos: React.FC = () => {
	const [searchTerm, setSearchTerm] = useState('');
	const [modalFinanciamento, setModalFinanciamento] = useState(false);
	const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [bancos, setBancos] = useState<Banco[]>([]);
	const [pessoas, setPessoas] = useState<Pessoa[]>([]);
	const [activeMenu, setActiveMenu] = useState<number | null>(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [deleteFinanciamentoId, setDeleteFinanciamentoId] = useState<number | null>(null);
	const [editingFinanciamento, setEditingFinanciamento] = useState<Financiamento | null>(null);
	const [viewMode, setViewMode] = useState<'cards' | 'parcelas'>('cards');
	const [expandedFinanciamentos, setExpandedFinanciamentos] = useState<number[]>([]);
	const [filterMode, setFilterMode] = useState<'todos' | 'vencidas'>('todos');
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationDate, setLiquidationDate] = useState('');
	const [modalParcelasOpen, setModalParcelasOpen] = useState(false);
	const [selectedFinanciamento, setSelectedFinanciamento] = useState<Financiamento | null>(null);
	const [showEstornoConfirmModal, setShowEstornoConfirmModal] = useState(false);
	const [parcelaToEstornar, setParcelaToEstornar] = useState<ParcelaFinanciamento | null>(null);
	const [showCompleted, setShowCompleted] = useState(false);
	const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

	useEffect(() => {
		carregarFinanciamentos();
		carregarDados();
	}, []);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (activeMenu !== null && menuRefs.current[activeMenu] && !menuRefs.current[activeMenu]?.contains(event.target as Node)) {
				setActiveMenu(null);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [activeMenu]);

	const carregarDados = async () => {
		try {
			listarBancos().then(setBancos);
			listarPessoas().then(setPessoas);
		} catch (error) {
			console.error('Erro ao carregar dados:', error);
			toast.error('Erro ao carregar dados de bancos e pessoas');
		}
	};

	const carregarFinanciamentos = async () => {
		try {
			setIsLoading(true);
			const data = await listarFinanciamentos();
			setFinanciamentos(data);
		} catch (error) {
			console.error('Erro ao carregar financiamentos:', error);
			toast.error('Erro ao carregar financiamentos');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async (financiamento: Financiamento) => {
		try {
			console.log('Financiamento salvo:', financiamento);
			await salvarFinanciamento(financiamento);
			toast.success('Financiamento salvo com sucesso!');
			await carregarFinanciamentos(); // Recarrega a lista após salvar
		} catch (error) {
			console.error('Erro ao salvar financiamento:', error);
			toast.error(error instanceof Error ? error.message : 'Erro ao salvar financiamento');
		}
	};

	const handleDelete = (id: number) => {
		setDeleteFinanciamentoId(id);
		setConfirmModalOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (deleteFinanciamentoId === null) return;
		try {
			await excluirFinanciamento(deleteFinanciamentoId);
			await carregarFinanciamentos();
			setConfirmModalOpen(false);
			toast.success('Financiamento excluído com sucesso!');
		} catch (error) {
			console.error('Erro ao excluir financiamento:', error);
			toast.error('Erro ao excluir financiamento');
		}
	};

	const getBancoLogo = (codigo: string) => {
		return BancoLogos[codigo] || defaultIcon;
	};

	const getBancoNome = (idBanco: number | null) => {
		const banco = bancos.find((b) => b.id === idBanco);
		return banco?.nome || 'Banco não encontrado';
	};

	const getPessoaNome = (idPessoa: number | null) => {
		const pessoa = pessoas.find((p) => p.id === idPessoa);
		return pessoa?.nome || 'Pessoa não encontrada';
	};

	const getTipoParcelamento = (parcelasList: ParcelaFinanciamento[]) => {
		if (!parcelasList || parcelasList.length === 0) return '';

		const primeira = new Date(parcelasList[0].dt_vencimento);
		const ultima = new Date(parcelasList[parcelasList.length - 1].dt_vencimento);

		const diffMeses = (ultima.getFullYear() - primeira.getFullYear()) * 12 + (ultima.getMonth() - primeira.getMonth());

		return diffMeses > 12 ? 'Anual' : 'Mensal';
	};

	const calcularEstimativaJurosMensal = (financiamento: Financiamento) => {
		if (!financiamento.parcelasList || financiamento.parcelasList.length === 0) return 0;

		const primeira = new Date(financiamento.parcelasList[0].dt_vencimento);
		const ultima = new Date(financiamento.parcelasList[financiamento.parcelasList.length - 1].dt_vencimento);
		
		const totalMeses = (ultima.getFullYear() - primeira.getFullYear()) * 12 + (ultima.getMonth() - primeira.getMonth()) + 1;
		
		// Calcula o valor total das parcelas
		const valorTotalParcelas = financiamento.parcelasList.reduce((total, parcela) => total + parcela.valor, 0);
		
		// Calcula o valor dos juros (diferença entre o total das parcelas e o valor do financiamento)
		const valorJuros = valorTotalParcelas - financiamento.valor;
		
		// Retorna o valor médio de juros por mês
		return valorJuros / totalMeses;
	};

	const temParcelasVencidas = (parcelasList: ParcelaFinanciamento[]) => {
		return parcelasList?.some(
			(p) => p.status === 'Vencido' || (p.status === 'Aberto' && new Date(p.dt_vencimento) < new Date())
		);
	};

	const filtered = financiamentos.filter((f) => {
		const searchLower = searchTerm.toLowerCase();
		const bancoNome = f.idBanco ? getBancoNome(f.idBanco).toLowerCase() : '';
		const pessoaNome = f.idPessoa ? getPessoaNome(f.idPessoa).toLowerCase() : '';

		const matchesSearch =
			f.responsavel.toLowerCase().includes(searchLower) ||
			f.numeroContrato.toLowerCase().includes(searchLower) ||
			bancoNome.includes(searchLower) ||
			pessoaNome.includes(searchLower);

		// Verifica se o financiamento está completamente liquidado
		const isCompleto = f.parcelasList?.every(p => p.status === 'Liquidado');

		if (filterMode === 'vencidas') {
			const hasVencidas = f.parcelasList?.some(
				(p) => p.status === 'Vencido' || (p.status === 'Aberto' && new Date(p.dt_vencimento) < new Date())
			);
			return matchesSearch && hasVencidas && !isCompleto;
		}

		// Se estiver mostrando completados, filtra os financiamentos não completos
		if (showCompleted) {
			return matchesSearch && !isCompleto;
		}

		// Se não estiver mostrando completados, filtra eles
		return matchesSearch && !isCompleto;
	});

	// Separa os financiamentos completados
	const financiamentosCompletos = financiamentos.filter(f => {
		const searchLower = searchTerm.toLowerCase();
		const bancoNome = f.idBanco ? getBancoNome(f.idBanco).toLowerCase() : '';
		const pessoaNome = f.idPessoa ? getPessoaNome(f.idPessoa).toLowerCase() : '';

		const matchesSearch =
			f.responsavel.toLowerCase().includes(searchLower) ||
			f.numeroContrato.toLowerCase().includes(searchLower) ||
			bancoNome.includes(searchLower) ||
			pessoaNome.includes(searchLower);

		return matchesSearch && f.parcelasList?.every(p => p.status === 'Liquidado');
	});

	const toggleFinanciamento = (id: number) => {
		setExpandedFinanciamentos((prev) => (prev.includes(id) ? prev.filter((finId) => finId !== id) : [...prev, id]));
	};

	const handleLiquidarParcela = async () => {
		if (!selectedParcela || !liquidationDate) return;

		try {
			const parcelaAtualizada = {
				...selectedParcela,
				status: 'Liquidado',
				dt_liquidacao: liquidationDate,
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);
			await carregarFinanciamentos();

			// Verifica se todas as parcelas do financiamento foram liquidadas
			const financiamento = financiamentos.find(f => f.id === selectedParcela.idFinanciamento);
			if (financiamento) {
				const todasParcelasLiquidadas = financiamento.parcelasList?.every(p => 
					p.status === 'Liquidado' || p.id === selectedParcela.id
				);

				if (todasParcelasLiquidadas) {
					toast.success('🎉 Contrato liquidado por completo, Parabéns!');
				}
			}

			setLiquidationModalOpen(false);
			setSelectedParcela(null);
			setLiquidationDate('');
			toast.success('Parcela liquidada com sucesso!');
		} catch (error) {
			console.error('Erro ao liquidar parcela:', error);
			toast.error('Erro ao liquidar parcela');
		}
	};

	const handleEstornarParcela = async (parcela: ParcelaFinanciamento) => {
		setParcelaToEstornar(parcela);
		setShowEstornoConfirmModal(true);
	};

	const handleConfirmEstorno = async () => {
		if (!parcelaToEstornar) return;

		try {
			const parcelaAtualizada = {
				...parcelaToEstornar,
				status: 'Aberto',
				dt_liquidacao: null,
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);
			await carregarFinanciamentos();
			setShowEstornoConfirmModal(false);
			setParcelaToEstornar(null);
			toast.success('Parcela estornada com sucesso!');
		} catch (error) {
			console.error('Erro ao estornar parcela:', error);
			toast.error('Erro ao estornar parcela');
		}
	};

	const renderParcelasView = () => {
		if (isLoading) {
			return (
				<div className="flex justify-center items-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
				</div>
			);
		}

		if (filtered.length === 0 && (!showCompleted || financiamentosCompletos.length === 0)) {
			return (
				<div className="col-span-full flex flex-col items-center gap-2">
					<img src={noData} alt="Sem dados" className="w-64 h-64 object-contain" />
					<p className="text-gray-700 font-bold text-lg">Nenhum financiamento encontrado.</p>
				</div>
			);
		}

		return (
			<div className="space-y-4">
				{filtered.map((fin) => (
					<div key={fin.id} className="bg-white border rounded-lg shadow-md">
						<div
							className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
							onClick={() => toggleFinanciamento(fin.id)}
						>
							<div className="flex items-center gap-3">
								{fin.idBanco ? (
									<img
										src={getBancoLogo(bancos.find((b) => b.id === fin.idBanco)?.codigo || '')}
										alt="Banco"
										className="w-12 h-12 object-contain"
									/>
								) : fin.idPessoa ? (
									<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
										{getPessoaNome(fin.idPessoa)[0].toUpperCase()}
									</div>
								) : (
									<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
								)}
								<div>
									<p className="font-bold text-lg text-primary">{fin.idBanco ? getBancoNome(fin.idBanco) : getPessoaNome(fin.idPessoa)}</p>
									<p className="text-sm text-gray-600">Contrato: {fin.numeroContrato} | Responsável: {fin.responsavel}</p>
								</div>
							</div>
							<div className="flex items-center gap-4">
								<div className="text-right">
									<div className="flex items-center justify-end gap-2">
										{temParcelasVencidas(fin.parcelasList) && (
											<FontAwesomeIcon
												icon={faTriangleExclamation}
												className="text-red-500 cursor-help"
												title="Contrato com parcelas vencidas"
											/>
										)}
										<p className="font-semibold text-primary">{formatarMoeda(fin.valor)}</p>
									</div>
									<p className="text-sm text-gray-600">
										{fin.parcelasList ? `${fin.parcelasList.length}x ${getTipoParcelamento(fin.parcelasList)}` : '0x'}
									</p>
								</div>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setSelectedFinanciamento(fin);
										setModalParcelasOpen(true);
									}}
									className="text-primary text-lg border-l pl-4 border-gray-700 hover:text-orange-600"
									title="Gerenciar parcelas"
								>
									<FontAwesomeIcon icon={faMoneyCheckAlt} />
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setEditingFinanciamento(fin);
										setModalFinanciamento(true);
									}}
									className="text-primary text-lg hover:text-orange-600"
								>
									<FontAwesomeIcon icon={faEdit} />
								</button>
								<FontAwesomeIcon
									icon={faChevronDown}
									className={`transform transition-transform ${expandedFinanciamentos.includes(fin.id) ? 'rotate-180' : ''}`}
								/>
							</div>
						</div>

						{expandedFinanciamentos.includes(fin.id) && (
							<div className="border-t">
								<div className="p-4">
									<table className="w-full">
										<thead className="bg-gray-50">
											<tr>
												<th className="p-2 text-left">Parcela</th>
												<th className="p-2 text-left">Vencimento</th>
												<th className="p-2 text-left">Valor</th>
												<th className="p-2 text-left">Status</th>
												<th className="p-2 text-left">Data Liquidação</th>
												<th className="p-2 pr-10 text-right">Ações</th>
											</tr>
										</thead>
										<tbody>
											
											{fin.parcelasList?.map((parcela) => (
												<tr key={parcela.id} className="border-t">
													<td className="p-2">{parcela.numParcela}</td>
													<td className="p-2">{new Date(parcela.dt_vencimento).toLocaleDateString()}</td>
													<td className="p-2">R$ {formatarMoeda(parcela.valor)}</td>
													<td className="p-2">
														<span
															className={`px-2 py-1 rounded font-semibold text-sm ${
																parcela.status === 'Liquidado'
																	? 'bg-green-100 text-green-800'
																	: parcela.status === 'Vencido'
																	? 'bg-red-100 text-red-800'
																	: 'bg-yellow-100 text-yellow-800'
															}`}
														>
															{parcela.status}
														</span>
													</td>
													<td className="p-2">
														{parcela.status === 'Liquidado' ? (
															<span className="text-sm text-gray-600">
																{new Date(parcela.dt_liquidacao!).toLocaleDateString()}
															</span>
														) : (
															<span className="text-sm text-gray-400">-</span>
														)}
													</td>
													<td className="p-2 pr-10 text-right">
														<div className="flex justify-end">
															{parcela.status === 'Liquidado' ? (
																<button
																	onClick={() => handleEstornarParcela(parcela)}
																	className="bg-orange-400 hover:bg-yellow-500 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
																	title="Estornar o movimento"
																>
																	<FontAwesomeIcon icon={faUndo} />
																</button>
															) : (
																<button
																	onClick={() => {
																		setSelectedParcela(parcela);
																		setLiquidationDate(new Date().toISOString().split('T')[0]);
																		setLiquidationModalOpen(true);
																	}}
																	className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
																	title="Liquidar parcela"
																>
																	<FontAwesomeIcon icon={faMoneyBillWave} />
																</button>
															)}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				))}

				{financiamentosCompletos.length > 0 && !showCompleted && (
					<div className="mt-8 flex justify-center">
						<button
							onClick={() => setShowCompleted(true)}
							className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded flex items-center gap-2"
						>
							<FontAwesomeIcon icon={faCheck} />
							Ver {financiamentosCompletos.length} Contrato{financiamentosCompletos.length > 1 ? 's' : ''} Completado{financiamentosCompletos.length > 1 ? 's' : ''}
						</button>
					</div>
				)}

				{showCompleted && financiamentosCompletos.length > 0 && (
					<div className="mt-8">
						<div className="flex items-center gap-4 mb-4">
							<div className="h-px bg-gray-300 flex-1"></div>
							<h2 className="text-lg font-semibold text-gray-700 whitespace-nowrap">
								Contratos Completados
							</h2>
							<div className="h-px bg-gray-300 flex-1"></div>
						</div>
						<div className="space-y-4">
							{financiamentosCompletos.map((fin) => (
								<div key={fin.id} className="bg-white border rounded-lg shadow-md">
									<div
										className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
										onClick={() => toggleFinanciamento(fin.id)}
									>
										<div className="flex items-center gap-3">
											{fin.idBanco ? (
												<img
													src={getBancoLogo(bancos.find((b) => b.id === fin.idBanco)?.codigo || '')}
													alt="Banco"
													className="w-12 h-12 object-contain"
												/>
											) : fin.idPessoa ? (
												<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
													{getPessoaNome(fin.idPessoa)[0].toUpperCase()}
												</div>
											) : (
												<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
											)}
											<div>
												<p className="font-bold text-lg text-primary">{fin.idBanco ? getBancoNome(fin.idBanco) : getPessoaNome(fin.idPessoa)}</p>
												<p className="text-sm text-gray-600">Contrato: {fin.numeroContrato} | Responsável: {fin.responsavel}</p>
											</div>
										</div>
										<div className="flex items-center gap-4">
											<div className="text-right">
												<div className="flex items-center justify-end gap-2">
													<p className="font-semibold text-primary">{formatarMoeda(fin.valor)}</p>
												</div>
												<p className="text-sm text-gray-600">
													{fin.parcelasList ? `${fin.parcelasList.length}x ${getTipoParcelamento(fin.parcelasList)}` : '0x'}
												</p>
											</div>
											<button
												onClick={(e) => {
													e.stopPropagation();
													setSelectedFinanciamento(fin);
													setModalParcelasOpen(true);
												}}
												className="text-primary text-lg border-l pl-4 border-gray-700 hover:text-orange-600"
												title="Gerenciar parcelas"
											>
												<FontAwesomeIcon icon={faMoneyCheckAlt} />
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													setEditingFinanciamento(fin);
													setModalFinanciamento(true);
												}}
												className="text-primary text-lg border-l pl-4 border-gray-700 hover:text-orange-600"
											>
												<FontAwesomeIcon icon={faEdit} />
											</button>
											<FontAwesomeIcon
												icon={faChevronDown}
												className={`transform transition-transform ${expandedFinanciamentos.includes(fin.id) ? 'rotate-180' : ''}`}
											/>
										</div>
									</div>

									{expandedFinanciamentos.includes(fin.id) && (
										<div className="border-t">
											<div className="p-4">
												<table className="w-full">
													<thead className="bg-gray-50">
														<tr>
															<th className="p-2 text-left">Parcela</th>
															<th className="p-2 text-left">Vencimento</th>
															<th className="p-2 text-left">Valor</th>
															<th className="p-2 text-left">Status</th>
															<th className="p-2 text-left">Data Liquidação</th>
															<th className="p-2 pr-10 text-right">Ações</th>
														</tr>
													</thead>
													<tbody>
														{fin.parcelasList?.map((parcela) => (
															<tr key={parcela.id} className="border-t">
																<td className="p-2">{parcela.numParcela}</td>
																<td className="p-2">{new Date(parcela.dt_vencimento).toLocaleDateString()}</td>
																<td className="p-2">R$ {formatarMoeda(parcela.valor)}</td>
																<td className="p-2">
																	<span
																		className={`px-2 py-1 rounded font-semibold text-sm ${
																			parcela.status === 'Liquidado'
																				? 'bg-green-100 text-green-800'
																				: parcela.status === 'Vencido'
																				? 'bg-red-100 text-red-800'
																				: 'bg-yellow-100 text-yellow-800'
																		}`}
																	>
																		{parcela.status}
																	</span>
																</td>
																<td className="p-2">
																	{parcela.status === 'Liquidado' ? (
																		<span className="text-sm text-gray-600">
																			{new Date(parcela.dt_liquidacao!).toLocaleDateString()}
																		</span>
																	) : (
																		<span className="text-sm text-gray-400">-</span>
																	)}
																</td>
																<td className="p-2 pr-10 text-right">
																	<div className="flex justify-end">
																		{parcela.status === 'Liquidado' ? (
																			<button
																				onClick={() => handleEstornarParcela(parcela)}
																				className="bg-orange-400 hover:bg-yellow-500 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
																				title="Estornar o movimento"
																			>
																				<FontAwesomeIcon icon={faUndo} />
																			</button>
																		) : (
																			<button
																				onClick={() => {
																					setSelectedParcela(parcela);
																					setLiquidationDate(new Date().toISOString().split('T')[0]);
																					setLiquidationModalOpen(true);
																				}}
																				className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
																				title="Liquidar parcela"
																			>
																				<FontAwesomeIcon icon={faMoneyBillWave} />
																			</button>
																		)}
																	</div>
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

	const handleSaveFinanciamento = async (financiamento: Financiamento) => {
		try {
			await salvarFinanciamento(financiamento);
			await carregarFinanciamentos();
			toast.success('Financiamento atualizado com sucesso!');
		} catch (error) {
			console.error('Erro ao salvar financiamento:', error);
			toast.error('Erro ao salvar financiamento');
		}
	};

	return (
		<div>
			<div className="flex justify-between items-end gap-5 mb-4 border-b pb-4">
				<div className="flex items-center gap-4 flex-1">
					<div className="relative w-full max-w-md">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
							<FontAwesomeIcon icon={faSearch} />
						</span>
						<input
							type="text"
							className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full"
							placeholder="Pesquisar por responsável, contrato, banco ou pessoa"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<button
						onClick={() => setViewMode(viewMode === 'cards' ? 'parcelas' : 'cards')}
						className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded flex items-center gap-2"
					>
						<FontAwesomeIcon icon={viewMode === 'cards' ? faList : faTable} />
						{viewMode === 'cards' ? 'Visão de Parcelas' : 'Visão de Cards'}
					</button>
				</div>

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-4">
						<label className={`flex items-center gap-2 cursor-pointer transition-all ${filterMode === 'todos' ? '' : 'text-gray-500'}`}>
							<input
								type="radio"
								name="filterMode"
								value="todos"
								checked={filterMode === 'todos'}
								onChange={() => setFilterMode('todos')}
								className="hidden"
							/>
							<div
								className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
									filterMode === 'todos' ? 'bg-red-500 border-red-500' : 'border-gray-400'
								}`}
								style={{ padding: '0.60rem' }}
							>
								{filterMode === 'todos' && (
									<span className="text-white text-md">
										<FontAwesomeIcon icon={faCheck} />
									</span>
								)}
							</div>
							<span>Mostrar Todos</span>
						</label>

						<label className={`flex items-center gap-2 cursor-pointer transition-all ${filterMode === 'vencidas' ? '' : 'text-gray-500'}`}>
							<input
								type="radio"
								name="filterMode"
								value="vencidas"
								checked={filterMode === 'vencidas'}
								onChange={() => setFilterMode('vencidas')}
								className="hidden"
							/>
							<div
								className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
									filterMode === 'vencidas' ? 'bg-red-500 border-red-500' : 'border-gray-400'
								}`}
								style={{ padding: '0.60rem' }}
							>
								{filterMode === 'vencidas' && (
									<span className="text-white text-md">
										<FontAwesomeIcon icon={faCheck} />
									</span>
								)}
							</div>
							<span>
								Vencidas{' '}
								<span className="text-lg font-semibold text-red-600">
									(
									{
										financiamentos.filter((f) =>
											f.parcelasList?.some(
												(p) => p.status === 'Vencido' || (p.status === 'Aberto' && new Date(p.dt_vencimento) < new Date())
											)
										).length
									}
									)
								</span>
							</span>
						</label>
					</div>
          |
					<button
						className="bg-primary text-white font-bold py-2 px-4 flex items-center rounded hover:bg-orange-400"
						onClick={() => setModalFinanciamento(true)}
					>
						Novo Financiamento <FontAwesomeIcon icon={faPlus} className="ml-3" />
					</button>
				</div>
			</div>

			{viewMode === 'cards' ? (
				isLoading ? (
					<div className="flex justify-center items-center h-64">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
					</div>
				) : filtered.length === 0 ? (
					<div className="col-span-full flex flex-col items-center gap-2">
						<img src={noData} alt="Sem dados" className="w-64 h-64 object-contain" />
						<p className="text-gray-700 font-bold text-lg">Nenhum financiamento encontrado.</p>
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{filtered.map((fin) => (
								<div key={fin.id} className="bg-white relative border rounded-lg pb-0 p-4 shadow-md hover:bg-gray-50 transition">
									{/* Menu de ações */}
									<div className="absolute top-3 right-0 cursor-pointer" ref={(el) => (menuRefs.current[fin.id] = el)}>
										<FontAwesomeIcon
											icon={faEllipsisV}
											className="text-gray-600 w-8 mr-1 text-lg"
											onClick={(e) => {
												e.stopPropagation();
												setActiveMenu(activeMenu === fin.id ? null : fin.id);
											}}
										/>
										{activeMenu === fin.id && (
											<div
												className="absolute font-medium right-0 bg-white shadow-md rounded-md w-28 mt-2 z-10"
												onClick={(e) => e.stopPropagation()}
											>
												<button
													className="block w-full text-left px-3 py-2 hover:bg-gray-100"
													onClick={(e) => {
														e.stopPropagation();
														setActiveMenu(null);
														setEditingFinanciamento(fin);
														setModalFinanciamento(true);
													}}
												>
													<FontAwesomeIcon icon={faEdit} className="mr-2" />
													Editar
												</button>
												<button
													className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100"
													onClick={(e) => {
														e.stopPropagation();
														setActiveMenu(null);
														handleDelete(fin.id);
													}}
												>
													<FontAwesomeIcon icon={faTrash} className="mr-2" />
													Excluir
												</button>
											</div>
										)}
									</div>

									<div className="flex items-center gap-3 mb-4">
										{fin.idBanco ? (
											<img
												src={getBancoLogo(bancos.find((b) => b.id === fin.idBanco)?.codigo || '')}
												alt="Banco"
												className="w-12 h-12 object-contain"
											/>
										) : fin.idPessoa ? (
											<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
												{getPessoaNome(fin.idPessoa)[0].toUpperCase()}
											</div>
										) : (
											<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
										)}
										<div>
											<p className="font-bold text-lg text-primary">
												{fin.idBanco ? getBancoNome(fin.idBanco) : getPessoaNome(fin.idPessoa)}
											</p>
											<p className="text-sm text-gray-600">Contrato: {fin.numeroContrato}</p>
										</div>
									</div>

									<div className="space-y-2 text-sm">
										<div className="flex justify-between items-center">
											<span className="text-gray-600">Valor:</span>
											<span className="font-semibold text-primary">{formatarMoeda(fin.valor)}</span>
										</div>

										<div className="flex justify-between items-center">
											<span className="text-gray-600">Período:</span>
											<span className="font-semibold">
												{fin.parcelasList && fin.parcelasList.length > 0
													? `${new Date(fin.parcelasList[0].dt_vencimento).toLocaleDateString()} à ${new Date(
															fin.parcelasList[fin.parcelasList.length - 1].dt_vencimento
												  ).toLocaleDateString()}`
													: 'Sem parcelas'}
											</span>
										</div>

										<div className="flex justify-between items-center">
											<span className="text-gray-600">Parcelas:</span>
											<span className="font-semibold">
												{fin.parcelasList ? `${fin.parcelasList.length}x ${getTipoParcelamento(fin.parcelasList)}` : '0x'}
											</span>
										</div>

										<div className="flex justify-between items-center">
											<span className="text-gray-600">Responsável:</span>
											<span className="font-semibold">{fin.responsavel}</span>
										</div>

										
									</div>

									<button 
										onClick={() => {
											setSelectedFinanciamento(fin);
											setModalParcelasOpen(true);
										}}
										className="mt-4 py-2 border-t w-full text-orange-600 hover:underline text-sm font-semibold"
									>
										Ver parcelas
									</button>
								</div>
							))}
						</div>

						{financiamentosCompletos.length > 0 && !showCompleted && (
							<div className="mt-8 flex justify-center">
								<button
									onClick={() => setShowCompleted(true)}
									className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded flex items-center gap-2"
								>
									<FontAwesomeIcon icon={faCheck} />
									Ver {financiamentosCompletos.length} Contrato{financiamentosCompletos.length > 1 ? 's' : ''} Completado{financiamentosCompletos.length > 1 ? 's' : ''}
								</button>
							</div>
						)}

						{showCompleted && financiamentosCompletos.length > 0 && (
							<div className="mt-8">
								<div className="flex items-center gap-4 mb-4">
									<div className="h-px bg-gray-300 flex-1"></div>
									<h2 className="text-lg font-semibold text-gray-700 whitespace-nowrap">
										Contratos Completados
									</h2>
									<div className="h-px bg-gray-300 flex-1"></div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
									{financiamentosCompletos.map((fin) => (
										<div key={fin.id} className="bg-white relative border rounded-lg pb-0 p-4 shadow-md hover:bg-gray-50 transition">
											{/* Menu de ações */}
											<div className="absolute top-3 right-0 cursor-pointer" ref={(el) => (menuRefs.current[fin.id] = el)}>
												<FontAwesomeIcon
													icon={faEllipsisV}
													className="text-gray-600 w-8 mr-1 text-lg"
													onClick={(e) => {
														e.stopPropagation();
														setActiveMenu(activeMenu === fin.id ? null : fin.id);
													}}
												/>
												{activeMenu === fin.id && (
													<div
														className="absolute font-medium right-0 bg-white shadow-md rounded-md w-28 mt-2 z-10"
														onClick={(e) => e.stopPropagation()}
													>
														<button
															className="block w-full text-left px-3 py-2 hover:bg-gray-100"
															onClick={(e) => {
																e.stopPropagation();
																setActiveMenu(null);
																setEditingFinanciamento(fin);
																setModalFinanciamento(true);
															}}
														>
															<FontAwesomeIcon icon={faEdit} className="mr-2" />
															Editar
														</button>
														<button
															className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100"
															onClick={(e) => {
																e.stopPropagation();
																setActiveMenu(null);
																handleDelete(fin.id);
															}}
														>
															<FontAwesomeIcon icon={faTrash} className="mr-2" />
															Excluir
														</button>
													</div>
												)}
											</div>

											<div className="flex items-center gap-3 mb-4">
												{fin.idBanco ? (
													<img
														src={getBancoLogo(bancos.find((b) => b.id === fin.idBanco)?.codigo || '')}
														alt="Banco"
														className="w-12 h-12 object-contain"
													/>
												) : fin.idPessoa ? (
													<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
														{getPessoaNome(fin.idPessoa)[0].toUpperCase()}
													</div>
												) : (
													<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
												)}
												<div>
													<p className="font-bold text-lg text-primary">
														{fin.idBanco ? getBancoNome(fin.idBanco) : getPessoaNome(fin.idPessoa)}
													</p>
													<p className="text-sm text-gray-600">Contrato: {fin.numeroContrato}</p>
												</div>
											</div>

											<div className="space-y-2 text-sm">
												<div className="flex justify-between items-center">
													<span className="text-gray-600">Valor:</span>
													<span className="font-semibold text-primary">{formatarMoeda(fin.valor)}</span>
												</div>

												<div className="flex justify-between items-center">
													<span className="text-gray-600">Período:</span>
													<span className="font-semibold">
														{fin.parcelasList && fin.parcelasList.length > 0
															? `${new Date(fin.parcelasList[0].dt_vencimento).toLocaleDateString()} à ${new Date(
																	fin.parcelasList[fin.parcelasList.length - 1].dt_vencimento
															  ).toLocaleDateString()}`
															: 'Sem parcelas'}
													</span>
												</div>

												<div className="flex justify-between items-center">
													<span className="text-gray-600">Parcelas:</span>
													<span className="font-semibold">
														{fin.parcelasList ? `${fin.parcelasList.length}x ${getTipoParcelamento(fin.parcelasList)}` : '0x'}
													</span>
												</div>

												<div className="flex justify-between items-center">
													<span className="text-gray-600">Responsável:</span>
													<span className="font-semibold">{fin.responsavel}</span>
												</div>

											
											</div>

											<button 
												onClick={() => {
													setSelectedFinanciamento(fin);
													setModalParcelasOpen(true);
												}}
												className="mt-4 py-2 border-t w-full text-orange-600 hover:underline text-sm font-semibold"
											>
												Ver parcelas
											</button>
										</div>
									))}
								</div>
							</div>
						)}
					</>
				)
			) : (
				renderParcelasView()
			)}
			<ModalFinanciamento
				isOpen={modalFinanciamento}
				onClose={() => {
					setModalFinanciamento(false);
					setEditingFinanciamento(null);
				}}
				onSave={handleSave}
				pessoas={pessoas}
				bancos={bancos}
				financiamentoData={editingFinanciamento}
			/>

			{selectedFinanciamento && (
				<ModalParcelas
					isOpen={modalParcelasOpen}
					onClose={() => {
						setModalParcelasOpen(false);
						setSelectedFinanciamento(null);
					}}
					financiamento={selectedFinanciamento}
					onSave={handleSaveFinanciamento}
					bancos={bancos}
					pessoas={pessoas}
				/>
			)}

			<DialogModal
				isOpen={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={handleDeleteConfirm}
				title="Atenção"
				type="warn"
				message="Tem certeza que deseja excluir este financiamento?"
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			<DialogModal
				isOpen={liquidationModalOpen}
				onClose={() => {
					setLiquidationModalOpen(false);
					setSelectedParcela(null);
					setLiquidationDate('');
				}}
				onConfirm={handleLiquidarParcela}
				title="Liquidar Parcela"
				type="info"
				message={
					<div className="space-y-4">
						<p>Selecione a data de liquidação da parcela:</p>
						<input
							type="date"
							value={liquidationDate}
							onChange={(e) => setLiquidationDate(e.target.value)}
							className="w-full p-2 border rounded"
						/>
					</div>
				}
				confirmLabel="Liquidar"
				cancelLabel="Cancelar"
			/>

			{/* Modal de Confirmação de Estorno */}
			<DialogModal
				isOpen={showEstornoConfirmModal}
				onClose={() => {
					setShowEstornoConfirmModal(false);
					setParcelaToEstornar(null);
				}}
				onConfirm={handleConfirmEstorno}
				title="Atenção"
				type="warn"
				message="Tem certeza que deseja estornar esta parcela? Esta ação não pode ser desfeita."
				confirmLabel="Estornar"
				cancelLabel="Cancelar"
			/>
		</div>
	);
};

export default ListFinanciamentos;
