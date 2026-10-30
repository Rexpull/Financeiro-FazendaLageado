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
	faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import defaultIcon from '../../../assets/img/icon-Bancos/default.png';
import noData from '/frontend/src/assets/img/noData.svg';
import ModalFinanciamento from './ModalFinanciamento';
import { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import { financiamentoTemParcelasVencidas } from '../../../Utils/financiamentoParcelaStatus';
import { listarFinanciamentos, excluirFinanciamento } from '../../../services/financiamentoService';
import { salvarParcelaFinanciamento } from '../../../services/financiamentoParcelasService';
import { toast } from 'react-toastify';
import { formatarDataISO, hojeISO } from '../../../Utils/dataSemFuso';
import { brl } from '../../../Utils/formatos';
import {
	descricaoParcela,
	descricaoParcelamento,
	mensagemEstorno,
	mensagemExcluirContrato,
	reabrirParcela,
	resumoParcelas,
} from './parcelaRegras';
import { listarBancos } from '../../../services/bancoService';
import { listarPessoas } from '../../../services/pessoaService';
import { Banco } from '../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../backend/src/models/Pessoa';
import DialogModal from '../../../components/DialogModal';
import ModalParcelas from './ModalParcelas';
import ModalRenegociacao from './ModalRenegociacao';
import {
	podeRenegociar,
	renegociadoEncerrado,
	rotuloOrigem,
	rotuloRenegociado,
} from './renegociacaoRegras';

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

/** "15/03/2026 a 15/05/2026" (first and last due dates), or "Sem parcelas". */
const periodoParcelas = (parcelas: ParcelaFinanciamento[] | undefined) => {
	const datas = (parcelas ?? []).map((p) => String(p.dt_vencimento ?? '').slice(0, 10)).filter(Boolean).sort();
	return datas.length > 0 ? `${formatarDataISO(datas[0])} a ${formatarDataISO(datas[datas.length - 1])}` : 'Sem parcelas';
};

const ListFinanciamentos: React.FC = () => {
	const [searchTerm, setSearchTerm] = useState('');
	const [modalFinanciamento, setModalFinanciamento] = useState(false);
	const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [bancos, setBancos] = useState<Banco[]>([]);
	const [pessoas, setPessoas] = useState<Pessoa[]>([]);
	const [activeMenu, setActiveMenu] = useState<number | null>(null);
	const [contratoParaExcluir, setContratoParaExcluir] = useState<Financiamento | null>(null);
	const [editingFinanciamento, setEditingFinanciamento] = useState<Financiamento | null>(null);
	const [viewMode, setViewMode] = useState<'cards' | 'parcelas'>('cards');
	const [expandedFinanciamentos, setExpandedFinanciamentos] = useState<number[]>([]);
	const [filterMode, setFilterMode] = useState<'todos' | 'vencidas'>('todos');
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationDate, setLiquidationDate] = useState('');
	const [modalParcelasOpen, setModalParcelasOpen] = useState(false);
	const [selectedFinanciamento, setSelectedFinanciamento] = useState<Financiamento | null>(null);
	const [parcelaToEstornar, setParcelaToEstornar] = useState<ParcelaFinanciamento | null>(null);
	const [showCompleted, setShowCompleted] = useState(false);
	const [contratoRenegociar, setContratoRenegociar] = useState<Financiamento | null>(null);
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

	/** `silencioso`: refresh after an action without replacing the list by the spinner. */
	const carregarFinanciamentos = async (silencioso = false) => {
		try {
			if (!silencioso) setIsLoading(true);
			const data = await listarFinanciamentos();
			setFinanciamentos(data);
		} catch (error) {
			console.error('Erro ao carregar financiamentos:', error);
			toast.error('Erro ao carregar financiamentos');
		} finally {
			if (!silencioso) setIsLoading(false);
		}
	};

	// ModalFinanciamento already saved the contract and its installments (and showed the toast): only reload
	const handleSave = async () => {
		await carregarFinanciamentos(true);
	};

	const handleDelete = (fin: Financiamento) => {
		setContratoParaExcluir(fin);
	};

	const handleDeleteConfirm = async () => {
		if (!contratoParaExcluir) return;
		try {
			await excluirFinanciamento(contratoParaExcluir.id);
			setContratoParaExcluir(null);
			await carregarFinanciamentos(true);
			toast.success('Financiamento excluído com sucesso!');
		} catch (error) {
			console.error('Erro ao excluir financiamento:', error);
			setContratoParaExcluir(null);
			// shows the API message, e.g. "Este financiamento tem 3 lançamentos bancários vinculados. ..."
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao excluir financiamento');
		}
	};

	const getBancoLogo = (codigo: string) => {
		return BancoLogos[codigo] || defaultIcon;
	};

	const getBancoNome = (idBanco: number | null) => {
		const banco = bancos.find((b) => b.id === idBanco);
		return banco?.nome || 'Banco não encontrado';
	};

	const getPessoaNome = (idPessoa: number | null | undefined) => {
		const pessoa = pessoas.find((p) => p.id === idPessoa);
		return pessoa?.nome || 'Pessoa não encontrada';
	};

	const nomeCredor = (fin: Financiamento) => (fin.idBanco ? getBancoNome(fin.idBanco) : getPessoaNome(fin.idPessoa));

	const matchesSearch = (f: Financiamento) => {
		const searchLower = searchTerm.toLowerCase();
		const bancoNome = f.idBanco ? getBancoNome(f.idBanco).toLowerCase() : '';
		const pessoaNome = f.idPessoa ? getPessoaNome(f.idPessoa).toLowerCase() : '';
		return (
			f.responsavel.toLowerCase().includes(searchLower) ||
			f.numeroContrato.toLowerCase().includes(searchLower) ||
			bancoNome.includes(searchLower) ||
			pessoaNome.includes(searchLower)
		);
	};

	// a contract without installments (e.g. incomplete) is NOT liquidated ([].every() is true);
	// a contract renegotiated into another one, with nothing left to pay, is closed too ("Renegociado")
	const isCompleto = (f: Financiamento) =>
		renegociadoEncerrado(f) || ((f.parcelasList?.length ?? 0) > 0 && f.parcelasList!.every((p) => p.status === 'Liquidado'));

	const filtered = financiamentos.filter((f) => {
		if (!matchesSearch(f) || isCompleto(f)) return false;
		return filterMode === 'vencidas' ? financiamentoTemParcelasVencidas(f.parcelasList) : true;
	});

	// Separa os financiamentos completados
	const financiamentosCompletos = financiamentos.filter((f) => matchesSearch(f) && isCompleto(f));
	const temRenegociadosEncerrados = financiamentosCompletos.some(renegociadoEncerrado);

	const qtdComVencidas = financiamentos.filter((f) => financiamentoTemParcelasVencidas(f.parcelasList)).length;

	const toggleFinanciamento = (id: number) => {
		setExpandedFinanciamentos((prev) => (prev.includes(id) ? prev.filter((finId) => finId !== id) : [...prev, id]));
	};

	const abrirLiquidacao = (parcela: ParcelaFinanciamento) => {
		setSelectedParcela(parcela);
		setLiquidationDate(hojeISO());
		setLiquidationModalOpen(true);
	};

	const fecharLiquidacao = () => {
		setLiquidationModalOpen(false);
		setSelectedParcela(null);
		setLiquidationDate('');
	};

	// Throwing keeps the dialog open (DialogModal only closes when onConfirm resolves)
	const handleLiquidarParcela = async () => {
		if (!selectedParcela) return;
		if (!liquidationDate) {
			toast.warning('Informe a data de liquidação.');
			throw new Error('Data de liquidação não informada');
		}

		const parcelaAtualizada = {
			...selectedParcela,
			status: 'Liquidado' as const,
			dt_liquidacao: liquidationDate,
		};
		try {
			await salvarParcelaFinanciamento(parcelaAtualizada);
		} catch (error) {
			console.error('Erro ao liquidar parcela:', error);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao liquidar parcela');
			throw error;
		}

		// Verifica se todas as parcelas do financiamento foram liquidadas
		const financiamento = financiamentos.find((f) => f.id === selectedParcela.idFinanciamento);
		const todasParcelasLiquidadas = financiamento?.parcelasList?.every(
			(p) => p.status === 'Liquidado' || p.id === selectedParcela.id,
		);

		fecharLiquidacao();
		toast.success('Parcela liquidada com sucesso!');
		if (todasParcelasLiquidadas) {
			toast.success('🎉 Contrato liquidado por completo, Parabéns!');
		}
		await carregarFinanciamentos(true);
	};

	const handleConfirmEstorno = async () => {
		if (!parcelaToEstornar) return;
		// Back to Vencido/Aberto, without liquidation date and unlinked from the paying movement
		const parcelaAtualizada = reabrirParcela(parcelaToEstornar);
		try {
			await salvarParcelaFinanciamento(parcelaAtualizada);
		} catch (error) {
			console.error('Erro ao estornar parcela:', error);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao estornar parcela');
			throw error;
		}
		setParcelaToEstornar(null);
		toast.success('Parcela estornada com sucesso!');
		await carregarFinanciamentos(true);
	};

	const abrirParcelas = (fin: Financiamento) => {
		setSelectedFinanciamento(fin);
		setModalParcelasOpen(true);
	};

	const abrirEdicao = (fin: Financiamento) => {
		setEditingFinanciamento(fin);
		setModalFinanciamento(true);
	};

	const renderAvatar = (fin: Financiamento) =>
		fin.idBanco ? (
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
		);

	const renderIconeVencidas = (fin: Financiamento, className = '') =>
		financiamentoTemParcelasVencidas(fin.parcelasList) && (
			<FontAwesomeIcon
				icon={faTriangleExclamation}
				className={`text-red-500 ${className}`}
				title="Contrato com parcelas vencidas"
				data-testid="financiamento-overdue-icon"
			/>
		);

	/** "Renegociado → nº novo", "Origem: nº antigo", "Aditivo em dd/mm/aaaa". */
	const renderBadgesRenegociacao = (fin: Financiamento) => {
		const renegociado = rotuloRenegociado(fin);
		const origem = rotuloOrigem(fin);
		if (!renegociado && !origem && !fin.ultimoAditivoEm) return null;
		return (
			<span className="flex flex-wrap gap-1 mt-1">
				{renegociado && (
					<span
						className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800"
						title={`Renegociado em ${formatarDataISO(fin.renegociadoEm)}: as parcelas que estavam a vencer foram para o novo contrato`}
					>
						{renegociado}
					</span>
				)}
				{origem && (
					<span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800" title="Contrato criado na renegociação deste">
						{origem}
					</span>
				)}
				{fin.ultimoAditivoEm && (
					<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800" title="Último aditivo deste contrato">
						Aditivo em {formatarDataISO(fin.ultimoAditivoEm)}
					</span>
				)}
			</span>
		);
	};

	const renderTabelaParcelas = (fin: Financiamento) => (
		<div className="border-t">
			<div className="p-4 overflow-x-auto">
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
								<td className="p-2">{formatarDataISO(parcela.dt_vencimento)}</td>
								<td className="p-2">{brl(parcela.valor)}</td>
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
										<span className="text-sm text-gray-600">{formatarDataISO(parcela.dt_liquidacao)}</span>
									) : (
										<span className="text-sm text-gray-400">-</span>
									)}
								</td>
								<td className="p-2 pr-10 text-right">
									<div className="flex justify-end">
										{parcela.status === 'Liquidado' ? (
											<button
												onClick={() => setParcelaToEstornar(parcela)}
												className="bg-orange-400 hover:bg-yellow-500 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
												title="Estornar a liquidação"
												aria-label={`Estornar a liquidação da parcela ${parcela.numParcela}`}
											>
												<FontAwesomeIcon icon={faUndo} />
											</button>
										) : (
											<button
												onClick={() => abrirLiquidacao(parcela)}
												className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
												title="Liquidar parcela"
												aria-label={`Liquidar a parcela ${parcela.numParcela}`}
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
	);

	/** One contract in the "Visão de Parcelas" (expandable row with its installments). */
	const renderLinhaContrato = (fin: Financiamento, liquidado: boolean) => {
		const resumo = resumoParcelas(fin, fin.parcelasList);
		const expandido = expandedFinanciamentos.includes(fin.id);
		return (
			<div key={fin.id} className="bg-white border rounded-lg shadow-md">
				<div
					className="p-4 cursor-pointer hover:bg-gray-50 flex flex-wrap gap-3 justify-between items-center"
					onClick={() => toggleFinanciamento(fin.id)}
				>
					<div className="flex items-center gap-3">
						{renderAvatar(fin)}
						<div>
							<p className="font-bold text-lg text-primary">{nomeCredor(fin)}</p>
							<p className="text-sm text-gray-600">
								Contrato: {fin.numeroContrato} | Responsável: {fin.responsavel}
							</p>
							{renderBadgesRenegociacao(fin)}
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="text-right">
							<div className="flex items-center justify-end gap-2">
								{!liquidado && renderIconeVencidas(fin, 'cursor-help')}
								<p className="font-semibold text-primary" title="Valor contratado">
									{brl(resumo.contratado)}
								</p>
							</div>
							<p className="text-sm text-gray-600">
								{descricaoParcelamento(fin.parcelasList)} · Em aberto ({resumo.qtdEmAberto}): {brl(resumo.emAberto)}
							</p>
						</div>
						<button
							onClick={(e) => {
								e.stopPropagation();
								abrirParcelas(fin);
							}}
							className="text-primary text-lg border-l pl-4 border-gray-700 hover:text-orange-600"
							title="Gerenciar parcelas"
							aria-label={`Gerenciar parcelas do contrato ${fin.numeroContrato}`}
						>
							<FontAwesomeIcon icon={faMoneyCheckAlt} />
						</button>
						{podeRenegociar(fin) && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									setContratoRenegociar(fin);
								}}
								className="text-primary text-lg hover:text-orange-600"
								title="Renegociar contrato"
								aria-label={`Renegociar o contrato ${fin.numeroContrato}`}
							>
								<FontAwesomeIcon icon={faHandshake} />
							</button>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation();
								abrirEdicao(fin);
							}}
							className="text-primary text-lg hover:text-orange-600"
							title="Editar contrato"
							aria-label={`Editar o contrato ${fin.numeroContrato}`}
						>
							<FontAwesomeIcon icon={faEdit} />
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleDelete(fin);
							}}
							className="text-red-500 text-lg hover:text-red-700"
							title="Excluir contrato"
							aria-label={`Excluir o contrato ${fin.numeroContrato}`}
						>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						<button
							onClick={(e) => {
								e.stopPropagation();
								toggleFinanciamento(fin.id);
							}}
							className="text-gray-700"
							aria-expanded={expandido}
							aria-label={expandido ? 'Esconder parcelas' : 'Mostrar parcelas'}
							title={expandido ? 'Esconder parcelas' : 'Mostrar parcelas'}
						>
							<FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform ${expandido ? 'rotate-180' : ''}`} />
						</button>
					</div>
				</div>

				{expandido && renderTabelaParcelas(fin)}
			</div>
		);
	};

	/** One contract card ("Visão de Cards"). */
	const renderCard = (fin: Financiamento, liquidado: boolean) => {
		const resumo = resumoParcelas(fin, fin.parcelasList);
		const menuAberto = activeMenu === fin.id;
		return (
			<div key={fin.id} className="bg-white relative border rounded-lg pb-0 p-4 shadow-md hover:bg-gray-50 transition">
				{/* Menu de ações */}
				<div className="absolute top-3 right-0" ref={(el) => { menuRefs.current[fin.id] = el; }}>
					<button
						type="button"
						className="text-gray-600 w-8 mr-1 text-lg hover:text-gray-900"
						aria-label={`Ações do contrato ${fin.numeroContrato}`}
						title="Ações"
						aria-haspopup="menu"
						aria-expanded={menuAberto}
						onClick={(e) => {
							e.stopPropagation();
							setActiveMenu(menuAberto ? null : fin.id);
						}}
					>
						<FontAwesomeIcon icon={faEllipsisV} />
					</button>
					{menuAberto && (
						<div
							className="absolute font-medium right-0 bg-white shadow-md rounded-md w-36 mt-2 z-10"
							role="menu"
							onClick={(e) => e.stopPropagation()}
						>
							{podeRenegociar(fin) && (
								<button
									role="menuitem"
									className="block w-full text-left px-3 py-2 hover:bg-gray-100"
									onClick={(e) => {
										e.stopPropagation();
										setActiveMenu(null);
										setContratoRenegociar(fin);
									}}
								>
									<FontAwesomeIcon icon={faHandshake} className="mr-2" />
									Renegociar
								</button>
							)}
							<button
								role="menuitem"
								className="block w-full text-left px-3 py-2 hover:bg-gray-100"
								onClick={(e) => {
									e.stopPropagation();
									setActiveMenu(null);
									abrirEdicao(fin);
								}}
							>
								<FontAwesomeIcon icon={faEdit} className="mr-2" />
								Editar
							</button>
							<button
								role="menuitem"
								className="block w-full text-left px-3 py-2 text-red-500 hover:bg-gray-100"
								onClick={(e) => {
									e.stopPropagation();
									setActiveMenu(null);
									handleDelete(fin);
								}}
							>
								<FontAwesomeIcon icon={faTrash} className="mr-2" />
								Excluir
							</button>
						</div>
					)}
				</div>

				<div className="flex items-center gap-3 mb-4 pr-6">
					{renderAvatar(fin)}
					<div>
						<p className="font-bold text-lg text-primary">{nomeCredor(fin)}</p>
						<p className="text-sm text-gray-600">Contrato: {fin.numeroContrato}</p>
						{renderBadgesRenegociacao(fin)}
					</div>
				</div>

				<div className="space-y-2 text-sm">
					<div className="flex justify-between items-center">
						<span className="text-gray-600">Contratado:</span>
						<span className="font-semibold text-primary flex items-center gap-2">
							{!liquidado && renderIconeVencidas(fin, 'shrink-0')}
							{brl(resumo.contratado)}
						</span>
					</div>
					{resumo.juros > 0 && <div className="flex justify-end text-xs text-gray-500 -mt-1">+ {brl(resumo.juros)} de juros</div>}

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Parcelas (soma):</span>
						<span className="font-semibold">{brl(resumo.somaParcelas)}</span>
					</div>

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Pago:</span>
						<span className="font-semibold text-green-700">{brl(resumo.pago)}</span>
					</div>

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Em aberto ({resumo.qtdEmAberto}):</span>
						<span className="font-semibold text-red-700">{brl(resumo.emAberto)}</span>
					</div>

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Parcelamento:</span>
						<span className="font-semibold">{descricaoParcelamento(fin.parcelasList)}</span>
					</div>

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Período:</span>
						<span className="font-semibold">{periodoParcelas(fin.parcelasList)}</span>
					</div>

					<div className="flex justify-between items-center">
						<span className="text-gray-600">Responsável:</span>
						<span className="font-semibold">{fin.responsavel}</span>
					</div>

					{/* No "parcelas ≠ contratado + juros" warning here: contracts imported from the spreadsheet only have the
					    parcelas still due, so it would show on almost every card. It stays in Gerenciar parcelas / edit. */}
				</div>

				<button
					onClick={() => abrirParcelas(fin)}
					className={`mt-4 py-2 border-t w-full hover:underline text-sm font-semibold ${
						renegociadoEncerrado(fin)
							? 'text-purple-700 border-purple-200'
							: liquidado
							? 'text-green-600 border-green-300'
							: 'text-orange-600'
					}`}
				>
					Ver parcelas
				</button>
			</div>
		);
	};

	const renderBotaoLiquidados = () =>
		financiamentosCompletos.length > 0 &&
		!showCompleted && (
			<div className="mt-8 flex justify-center">
				<button
					onClick={() => setShowCompleted(true)}
					className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded flex items-center gap-2"
				>
					<FontAwesomeIcon icon={faCheck} />
					Ver {financiamentosCompletos.length} Contrato{financiamentosCompletos.length > 1 ? 's' : ''}{' '}
					{temRenegociadosEncerrados ? 'Encerrado' : 'Liquidado'}
					{financiamentosCompletos.length > 1 ? 's' : ''}
				</button>
			</div>
		);

	const renderTituloLiquidados = () => (
		<div className="flex items-center gap-4 mb-4">
			<div className="h-px bg-gray-300 flex-1"></div>
			<h2 className="text-lg font-semibold text-gray-700 whitespace-nowrap">
				{temRenegociadosEncerrados ? 'Contratos encerrados (liquidados ou renegociados)' : 'Contratos Liquidados'}
			</h2>
			<div className="h-px bg-gray-300 flex-1"></div>
		</div>
	);

	const renderCarregando = () => (
		<div className="flex justify-center items-center h-64">
			<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
		</div>
	);

	const renderVazio = () => (
		<div className="col-span-full flex flex-col items-center gap-2">
			<img src={noData} alt="Sem dados" className="w-64 h-64 object-contain" />
			<p className="text-gray-700 font-bold text-lg">
				{filterMode === 'vencidas'
					? 'Nenhum contrato com parcelas vencidas.'
					: financiamentosCompletos.length > 0
					? 'Nenhum contrato em aberto.'
					: 'Nenhum financiamento encontrado.'}
			</p>
		</div>
	);

	// The "Ver N Contratos Liquidados" button stays reachable even when no open contract is listed
	const renderParcelasView = () => {
		if (isLoading) return renderCarregando();

		return (
			<div className="space-y-4">
				{filtered.length === 0 ? renderVazio() : filtered.map((fin) => renderLinhaContrato(fin, false))}

				{renderBotaoLiquidados()}

				{showCompleted && financiamentosCompletos.length > 0 && (
					<div className="mt-8">
						{renderTituloLiquidados()}
						<div className="space-y-4">{financiamentosCompletos.map((fin) => renderLinhaContrato(fin, true))}</div>
					</div>
				)}
			</div>
		);
	};

	const renderCardsView = () => {
		if (isLoading) return renderCarregando();

		return (
			<>
				{filtered.length === 0 ? (
					renderVazio()
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map((fin) => renderCard(fin, false))}</div>
				)}

				{renderBotaoLiquidados()}

				{showCompleted && financiamentosCompletos.length > 0 && (
					<div className="mt-8">
						{renderTituloLiquidados()}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{financiamentosCompletos.map((fin) => renderCard(fin, true))}
						</div>
					</div>
				)}
			</>
		);
	};

	/** Radio drawn as a circle; the real input stays keyboard-reachable (sr-only + focus ring on the circle). */
	const renderFiltro = (valor: 'todos' | 'vencidas', corAtiva: string, rotulo: React.ReactNode) => (
		<label className={`flex items-center gap-2 cursor-pointer transition-all ${filterMode === valor ? '' : 'text-gray-500'}`}>
			<input
				type="radio"
				name="filterMode"
				value={valor}
				checked={filterMode === valor}
				onChange={() => setFilterMode(valor)}
				className="peer sr-only"
			/>
			<div
				className={`w-3 h-3 flex items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-blue-400 ${
					filterMode === valor ? corAtiva : 'border-gray-400'
				}`}
				style={{ padding: '0.60rem' }}
				aria-hidden="true"
			>
				{filterMode === valor && (
					<span className="text-white text-md">
						<FontAwesomeIcon icon={faCheck} />
					</span>
				)}
			</div>
			<span>{rotulo}</span>
		</label>
	);

	return (
		<div>
			<div className="flex flex-wrap justify-between items-end gap-5 mb-4 border-b pb-4">
				<div className="flex items-center gap-4 flex-1">
					<div className="relative w-full max-w-md">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
							<FontAwesomeIcon icon={faSearch} />
						</span>
						<input
							type="text"
							className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full"
							placeholder="Pesquisar por responsável, contrato, banco ou pessoa"
							aria-label="Pesquisar financiamentos"
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
					<div className="flex items-center gap-4" role="radiogroup" aria-label="Filtrar contratos">
						{renderFiltro('todos', 'bg-gray-600 border-gray-600', 'Mostrar Todos')}
						{renderFiltro(
							'vencidas',
							'bg-red-500 border-red-500',
							<>
								Com parcelas vencidas <span className="text-lg font-semibold text-red-600">({qtdComVencidas})</span>
							</>,
						)}
					</div>

					<button
						className="bg-primary text-white font-bold py-2 px-4 flex items-center rounded hover:bg-orange-400"
						onClick={() => setModalFinanciamento(true)}
					>
						Novo Financiamento <FontAwesomeIcon icon={faPlus} className="ml-3" />
					</button>
				</div>
			</div>

			{viewMode === 'cards' ? renderCardsView() : renderParcelasView()}

			<ModalFinanciamento
				isOpen={modalFinanciamento}
				onClose={(gravacaoIncompleta) => {
					setModalFinanciamento(false);
					setEditingFinanciamento(null);
					// left after a partial save: the contract exists, show it
					if (gravacaoIncompleta) carregarFinanciamentos(true);
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
						// Liquidar/Estornar inside the modal are saved immediately: never leave the list stale
						carregarFinanciamentos(true);
					}}
					financiamento={selectedFinanciamento}
					// the installments are already saved by the modal and onClose (called right before) reloads the list
					onSave={() => undefined}
					bancos={bancos}
					pessoas={pessoas}
				/>
			)}

			{contratoRenegociar && (
				<ModalRenegociacao
					isOpen
					onClose={() => setContratoRenegociar(null)}
					onSaved={() => {
						carregarFinanciamentos(true);
					}}
					financiamento={contratoRenegociar}
					bancos={bancos}
					pessoas={pessoas}
					nomeCredor={nomeCredor(contratoRenegociar)}
				/>
			)}

			<DialogModal
				isOpen={contratoParaExcluir != null}
				onClose={() => setContratoParaExcluir(null)}
				onConfirm={handleDeleteConfirm}
				title="Excluir contrato?"
				type="warn"
				message={contratoParaExcluir ? mensagemExcluirContrato(contratoParaExcluir, nomeCredor(contratoParaExcluir)) : ''}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			<DialogModal
				isOpen={liquidationModalOpen}
				onClose={fecharLiquidacao}
				onConfirm={handleLiquidarParcela}
				title="Liquidar Parcela"
				type="info"
				message={
					<div className="space-y-3 text-left">
						{selectedParcela && (
							<p className="font-medium">
								{descricaoParcela(
									selectedParcela,
									financiamentos.find((f) => f.id === selectedParcela.idFinanciamento)?.parcelasList?.length,
								)}
							</p>
						)}
						<label htmlFor="lf-data-liquidacao" className="block text-sm">
							Data da liquidação (pagamento)
						</label>
						<input
							id="lf-data-liquidacao"
							type="date"
							value={liquidationDate}
							onChange={(e) => setLiquidationDate(e.target.value)}
							className="w-full p-2 border rounded"
						/>
						{!liquidationDate && <p className="text-red-600 text-xs">Informe a data de liquidação.</p>}
					</div>
				}
				confirmLabel="Liquidar"
				cancelLabel="Cancelar"
			/>

			{/* Modal de Confirmação de Estorno */}
			<DialogModal
				isOpen={parcelaToEstornar != null}
				onClose={() => setParcelaToEstornar(null)}
				onConfirm={handleConfirmEstorno}
				title="Estornar a liquidação?"
				type="warn"
				message={parcelaToEstornar ? mensagemEstorno(parcelaToEstornar) : ''}
				confirmLabel="Estornar"
				cancelLabel="Cancelar"
			/>
		</div>
	);
};

export default ListFinanciamentos;
