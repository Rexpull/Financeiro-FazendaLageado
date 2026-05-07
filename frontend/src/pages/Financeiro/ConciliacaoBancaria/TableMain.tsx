import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import DialogModal from '../../../components/DialogModal';
import LancamentoManual from './Modals/LancarManual';
import ImportOFXModal from './Modals/ImportOFXModal';
import FiltroMovimentosModal from './Modals/FiltroMovimentos';
import SelectContaCorrente from './Modals/SelectContaCorrente';
import DetalhamentoMovimento from './Modals/DetalhamentoMovimento';
import Transferir from './Modals/Transferir';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faSearch,
	faPlus,
	faChevronLeft,
	faChevronRight,
	faTrash,
	faPencil,
	faFileArchive,
	faFileExcel,
	faFilePdf,
	faExchange,
	faExchangeAlt,
	faChevronDown,
	faBank,
	faEllipsisV,
	faInfo,
	faInfoCircle,
	faUndo,
} from '@fortawesome/free-solid-svg-icons';
import {
	listarMovimentosBancarios,
	listarMovimentosBancariosPaginado,
	exportarMovimentosBancariosExcel,
	exportarMovimentosBancariosPDF,
	salvarMovimentoBancario,
	excluirMovimentoBancario,
	excluirTodosMovimentosBancarios,
	atualizarStatusIdeagro,
	transferirMovimentoBancario,
	buscarMovimentoBancarioById,
	buscarMovimentosPorIds,
	atualizarContaMovimentosOFX,
} from '../../../services/movimentoBancarioService';
import { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';
import {
	excluirParcelaFinanciamento,
	listarParcelaFinanciamentos,
	salvarParcelaFinanciamento,
	verificarParcelasAssociadas,
} from '../../../services/financiamentoParcelasService';
import { listarPlanoContas } from '../../../services/planoContasService';
import { listarCentroCustos } from '../../../services/centroCustosService';
import { CentroCustos } from '../../../../../backend/src/models/CentroCustos';
import { Tooltip } from 'react-tooltip';
import ConciliarPlano from './Modals/ConciliarPlano';
import { formatarData } from '../../../Utils/formatarData';
import { buscarBancoById } from '../../../services/bancoService';
import { buscarPessoaById } from '../../../services/pessoaService';
import { toast } from 'react-toastify';
import { TotalizadoresOFX } from '../../../Utils/parseOfxFile';
import ConciliacaoOFXModal from './ConciliacaoOFX';
import {
	idCentroCustosEfetivo,
	idPlanoContasEfetivo,
	isCentroRateioMultiplo,
	isFinanciamentoVinculadoContrato,
	isPlanoRateioMultiplo,
	TEXTO_COLUNA_UNICA_FINANCIAMENTO,
	textoCentroPadrao,
	textoPlanoDespesa,
	textoPlanoTransferencia,
} from './conciliacaoLabels';
import { useLocation } from 'react-router-dom';
import { listarHistoricoImportacoes, limparHistoricoImportacoes } from '../../../services/historicoImportacaoOFXService';

const MovimentoBancarioTable: React.FC = () => {
	const location = useLocation();
	const [movimentos, setMovimentos] = useState<MovimentoBancario[]>([]);
	const [filteredMovimentos, setFilteredMovimentos] = useState<MovimentoBancario[]>([]);
	const [modalIsOpen, setModalIsOpen] = useState(false);
	const [acoesMenu, setAcoesMenu] = useState(false);
	const [modalImportOFXIsOpen, setModalImportOFXIsOpen] = useState(false);
	const [modalFiltroMovimentosIsOpen, setModalFiltroMovimentosIsOpen] = useState(false);
	const [modalContaIsOpen, setModalContaIsOpen] = useState(false);
	const [modalTransferirIsOpen, setModalTransferirIsOpen] = useState(false);
	const [contaSelecionada, setContaSelecionada] = useState(() => {
		const storedConta = localStorage.getItem('contaSelecionada');
		return storedConta ? JSON.parse(storedConta) : null;
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [confirmDeleteParcelaModalOpen, setConfirmDeleteParcelaModalOpen] = useState(false);
	const [confirmDeleteAllModalOpen, setConfirmDeleteAllModalOpen] = useState(false);
	const [confirmLimparConciliacaoModalOpen, setConfirmLimparConciliacaoModalOpen] = useState(false);
	const [deleteMovimentoId, setDeleteMovimentoId] = useState<number | null>(null);
	const [limparConciliacaoMovimentoId, setLimparConciliacaoMovimentoId] = useState<number | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuAtivoId, setMenuAtivoId] = useState<number | null>(null);
	const [planos, setPlanos] = useState<any[]>([]);
	const [centrosDisponiveis, setCentrosDisponiveis] = useState<CentroCustos[]>([]);
	const [isExporting, setIsExporting] = useState(false);

	const [dataInicio, setDataInicio] = useState<string>('');
	const [dataFim, setDataFim] = useState<string>('');
	const [statusFiltro, setStatusFiltro] = useState<string>('todos');
	const [planosFiltroIds, setPlanosFiltroIds] = useState<number[] | undefined>(undefined);
	const [centrosFiltroIds, setCentrosFiltroIds] = useState<number[] | undefined>(undefined);
	const [planosSelecao, setPlanosSelecao] = useState<any[]>([]);
	const [centrosSelecao, setCentrosSelecao] = useState<any[]>([]);
	const [historicoContem, setHistoricoContem] = useState<string>('');
	const [valorBusca, setValorBusca] = useState<string>('');

	const [modalConciliaIsOpen, setModalConciliaIsOpen] = useState(false);
	const [movimentoParaConciliar, setMovimentoParaConciliar] = useState<MovimentoBancario | null>(null);

	const [modalDetalheOpen, setModalDetalheOpen] = useState(false);
	const [movimentoSelecionado, setMovimentoSelecionado] = useState<MovimentoBancario | null>(null);

	const [historicoImportacoes, setHistoricoImportacoes] = useState<any[]>([]);
	const [dropdownHistoricoAberto, setDropdownHistoricoAberto] = useState(false);
	const [modalConciliacaoHistoricoIsOpen, setModalConciliacaoHistoricoIsOpen] = useState(false);
	const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
	const [progressoCarregamentoHistorico, setProgressoCarregamentoHistorico] = useState(0);
	const [historicoSelecionado, setHistoricoSelecionado] = useState<{
		movimentos: MovimentoBancario[];
		totalizadores: TotalizadoresOFX;
		idContaCorrente: number;
	} | null>(null);

	// Modal de confirmação para limpar histórico
	const [modalConfirmarLimparHistoricoIsOpen, setModalConfirmarLimparHistoricoIsOpen] = useState(false);

	// Estados para edição de conta do histórico OFX
	const [modalEditarContaIsOpen, setModalEditarContaIsOpen] = useState(false);
	const [historicoParaEditarConta, setHistoricoParaEditarConta] = useState<any | null>(null);

	// Estados para seleção múltipla e conciliação em lote
	const [movimentosSelecionados, setMovimentosSelecionados] = useState<MovimentoBancario[]>([]);
	const [tipoMovimentoSelecionado, setTipoMovimentoSelecionado] = useState<'C' | 'D' | null>(null);
	/** Lista efetiva no modal de conciliação: um movimento ao abrir pela linha; todos os selecionados só pelo botão "Conciliar n Movimento(s)". */
	const [movimentosConciliacaoModal, setMovimentosConciliacaoModal] = useState<MovimentoBancario[]>([]);

	// 🔹 Paginação
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(15);
	const [totalPages, setTotalPages] = useState(1);
	const [totalMovimentos, setTotalMovimentos] = useState(0);
	const [hasNext, setHasNext] = useState(false);
	const [hasPrev, setHasPrev] = useState(false);

	// 🔹 Capturar dados da navegação quando vier de notificação
	useEffect(() => {
		if (location.state?.fromNotification && location.state?.contaSelecionada) {
			const contaDaNotificacao = location.state.contaSelecionada;

			// Atualizar a conta selecionada
			setContaSelecionada(contaDaNotificacao);
			localStorage.setItem('contaSelecionada', JSON.stringify(contaDaNotificacao));

			// Se vier com filtro de pendentes, aplicar automaticamente
			if (location.state?.filtroPendentes) {
				setStatusFiltro('pendentes');
			}

			// Limpar o state da navegação para evitar reaplicação
			window.history.replaceState({}, document.title);

			console.log('✅ Conta selecionada automaticamente da notificação:', contaDaNotificacao);
		}
	}, [location.state]);

	// useEffect para definir datas iniciais (mês atual)
	useEffect(() => {
		const now = new Date();
		const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
		const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
		console.log('📅 Definindo datas iniciais:', { inicio, fim });
		setDataInicio(inicio);
		setDataFim(fim);
	}, []);

	useEffect(() => {
		const carregarHistorico = async () => {
			try {
				const usuarioLogado = JSON.parse(localStorage.getItem('user') || '{}');
				const idUsuario = usuarioLogado.id;

				if (idUsuario) {
					const historico = await listarHistoricoImportacoes(idUsuario);
					setHistoricoImportacoes(historico);
				} else {
					console.warn('⚠️ Usuário não logado, histórico não será carregado');
					setHistoricoImportacoes([]);
				}
			} catch (error) {
				console.error('❌ Erro ao carregar histórico:', error);
				setHistoricoImportacoes([]);
			}
		};

		carregarHistorico();
	}, [modalImportOFXIsOpen]);

	// useEffect para carregar planos de contas
	useEffect(() => {
		listarPlanoContas().then((planos) => setPlanos(planos));
		listarCentroCustos().then((centros) => setCentrosDisponiveis(centros));
	}, []);

	// useEffect principal para carregar dados quando conta e filtros estiverem prontos
	useEffect(() => {
		if (contaSelecionada && dataInicio && dataFim) {
			console.log('🚀 Carregando dados iniciais:', {
				contaId: contaSelecionada.id,
				dataInicio,
				dataFim,
				statusFiltro,
				itemsPerPage,
			});
			fetchMovimentos(1);
		}
	}, [contaSelecionada, dataInicio, dataFim, statusFiltro, itemsPerPage, planosFiltroIds, centrosFiltroIds, historicoContem, valorBusca]);

	useEffect(() => {
		if (!contaSelecionada) {
			setModalContaIsOpen(true);
		}
	}, [contaSelecionada]);

	const handleSelectConta = (conta: any) => {
		setContaSelecionada(conta);
		localStorage.setItem('contaSelecionada', JSON.stringify(conta));
		let contaAtt = localStorage.getItem('contaSelecionada');

		const parsedConta = contaAtt ? JSON.parse(contaAtt) : null;
		console.log(parsedConta);
		console.log(movimentos);
		setFilteredMovimentos(movimentos.filter((m) => m.idContaCorrente === parsedConta?.id));
	};

	const fetchMovimentos = async (page: number = 1) => {
		setIsLoading(true);
		try {
			if (!contaSelecionada) {
				console.log('⚠️ Conta não selecionada, limpando dados');
				setMovimentos([]);
				setFilteredMovimentos([]);
				setTotalPages(0);
				setTotalMovimentos(0);
				setHasNext(false);
				setHasPrev(false);
				return;
			}

			if (!dataInicio || !dataFim) {
				console.log('⚠️ Datas não definidas ainda, aguardando...', { dataInicio, dataFim });
				return;
			}

			console.log('🔍 Buscando movimentos com filtros:', {
				page,
				itemsPerPage,
				contaId: contaSelecionada.id,
				dataInicio,
				dataFim,
				statusFiltro,
			});

			const result = await listarMovimentosBancariosPaginado(
				page,
				itemsPerPage,
				contaSelecionada.id,
				dataInicio,
				dataFim,
				statusFiltro,
				planosFiltroIds,
				centrosFiltroIds,
				historicoContem || undefined,
				valorBusca || undefined,
			);

			console.log('📊 Resultado da busca:', result);

			setMovimentos(result.movimentos);
			setFilteredMovimentos(result.movimentos);
			setTotalPages(result.totalPages);
			setTotalMovimentos(result.total);
			setHasNext(result.hasNext);
			setHasPrev(result.hasPrev);
			setCurrentPage(result.currentPage);
		} catch (error) {
			console.error('❌ Erro ao buscar Movimentos Bancários:', error);
			// Em caso de erro, limpar os dados
			setMovimentos([]);
			setFilteredMovimentos([]);
			setTotalPages(0);
			setTotalMovimentos(0);
			setHasNext(false);
			setHasPrev(false);
		} finally {
			setIsLoading(false);
		}
	};

	const exportarParaExcel = async () => {
		try {
			setAcoesMenu(false);
			setIsExporting(true);

			const blob = await exportarMovimentosBancariosExcel(contaSelecionada?.id, dataInicio, dataFim, statusFiltro);

			// Criar link para download
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `MovimentosBancarios_${dataInicio}_a_${dataFim}.xlsx`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel. Verifique os dados e tente novamente.');
		} finally {
			setIsExporting(false);
		}
	};

	const exportarParaPDF = async () => {
		try {
			setAcoesMenu(false);
			setIsExporting(true);

			const blob = await exportarMovimentosBancariosPDF(contaSelecionada?.id, dataInicio, dataFim, statusFiltro);

			// Criar link para download
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `MovimentosBancarios_${dataInicio}_a_${dataFim}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			toast.success('PDF gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar PDF:', error);
			toast.error('Erro ao gerar o PDF. Verifique os dados e tente novamente.');
		} finally {
			setIsExporting(false);
		}
	};

	const handleImportFile = (file: File) => {
		console.log('Arquivo importado:', file);
		// Aqui você pode processar o arquivo OFX
	};

	const handleSearchFilters = (filters: {
		dataInicio: string;
		dataFim: string;
		status: string;
		planosIds?: number[];
		centrosIds?: number[];
		planosSelecionados?: any[];
		centrosSelecionados?: any[];
		historicoContem?: string;
		valorBusca?: string;
	}) => {
		console.log('🔍 Aplicando filtros:', filters);
		setDataInicio(filters.dataInicio);
		setDataFim(filters.dataFim);
		setStatusFiltro(filters.status);
		setPlanosFiltroIds(filters.planosIds);
		setCentrosFiltroIds(filters.centrosIds);
		setPlanosSelecao(filters.planosSelecionados || []);
		setCentrosSelecao(filters.centrosSelecionados || []);
		setHistoricoContem(filters.historicoContem?.trim() || '');
		setValorBusca(filters.valorBusca?.trim() || '');
		setCurrentPage(1);
		// O useEffect vai detectar a mudança e chamar fetchMovimentos automaticamente
	};

	const handleTransferir = async (data: any) => {
		try {
			const usuario = JSON.parse(localStorage.getItem('user') || '{}');
			const contaDestino = data.contas.find((c: any) => c.id === parseInt(data.idContaDestino));
			if (!contaDestino) throw new Error('Conta destino não encontrada');

			const payload = {
				contaOrigemId: data.contaOrigem.id,
				contaOrigemDescricao: `${data.contaOrigem.responsavel} | ${data.contaOrigem.bancoNome} | ${data.contaOrigem.numConta}`,
				contaDestinoId: parseInt(data.idContaDestino),
				contaDestinoDescricao: `${contaDestino.responsavel} | ${contaDestino.bancoNome} | ${contaDestino.numConta}`,
				valor: data.valor,
				descricao: data.descricao,
				data: new Date(data.data).toISOString(),
				idUsuario: usuario?.id,
			};

			console.log('Enviando payload:', payload);
			await transferirMovimentoBancario(payload);

			setModalTransferirIsOpen(false);
			fetchMovimentos(currentPage);
		} catch (error) {
			console.error('Erro ao transferir:', error);
		}
	};

	const openModalConcilia = async (movimento: MovimentoBancario) => {
		try {
			const movimentoCompleto = await buscarMovimentoBancarioById(movimento.id);
			console.log('Movimento completo:', movimentoCompleto);
			setMovimentoParaConciliar(movimentoCompleto);
			setMovimentosConciliacaoModal([movimentoCompleto]);
			setTimeout(() => {
				setModalConciliaIsOpen(true);
			}, 0);
		} catch (error) {
			console.error('Erro ao buscar dados completos:', error);
		}
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setAcoesMenu(false);
			}
		};

		if (acoesMenu) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [acoesMenu]);

	useEffect(() => {
		const handleClickOutsideMenuAtivo = (event: MouseEvent) => {
			const target = event.target as Node;

			// Evita fechar quando clicar no botão que abre o menu
			const isButton = (target as HTMLElement).closest('button');

			if (menuRef.current && !menuRef.current.contains(target) && !isButton) {
				setMenuAtivoId(null);
			}
		};

		if (menuAtivoId !== null) {
			document.addEventListener('mousedown', handleClickOutsideMenuAtivo);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutsideMenuAtivo);
		};
	}, [menuAtivoId]);

	const openModal = (movimento?: MovimentoBancario) => {
		setModalIsOpen(true);
	};

	const handleSave = async (formData: any) => {
		setIsSaving(true);
		try {
			const usuario = JSON.parse(localStorage.getItem('user') || '{}');
			const movimentoCompleto = {
				...formData,
				valor: parseFloat((formData.valor || '0').replace(',', '.')),
				dtMovimento: new Date(formData.dtMovimento).toISOString(),
				idPlanoContas: parseInt(formData.idPlanoContas),
				idContaCorrente: formData.idContaCorrente,
				historico: formData.historico,
				criadoEm: new Date().toISOString(),
				atualizadoEm: new Date().toISOString(),
				idUsuario: usuario?.id,
				identificadorOfx: formData.identificadorOfx || crypto.randomUUID(),
				idCentroCustos: parseInt(formData.idCentroCustos),
			};
			console.log('Movimento a ser salvo:', movimentoCompleto);

			const movimentoSalvo = await salvarMovimentoBancario(movimentoCompleto);

			console.log('movimentoSalvo', movimentoSalvo);

			if (movimentoSalvo !== undefined && movimentoSalvo !== null) {
				setMovimentos((prev) => [...prev, movimentoSalvo]);
			}

			setModalIsOpen(false);
			fetchMovimentos(currentPage);
		} catch (error) {
			console.error('Erro ao salvar movimento bancário:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteConfirm = async () => {
		if (deleteMovimentoId === null) return;
		try {
			await excluirMovimentoBancario(deleteMovimentoId);
			setMovimentos((prev) => prev.filter((movimento) => movimento.id !== deleteMovimentoId));
			setConfirmModalOpen(false);
		} catch (error) {
			console.error('Erro ao excluir movimento bancário:', error);
		}
	};

	const handleDeleteAllConfirm = async () => {
		if (!contaSelecionada?.id) {
			console.error(`❌ Conta selecionada inválida:`, contaSelecionada);
			return;
		}

		console.log(`🚀 Iniciando exclusão em massa para conta:`, contaSelecionada);

		try {
			setIsSaving(true);
			const resultado = await excluirTodosMovimentosBancarios(contaSelecionada.id);

			// Limpar todos os movimentos da conta atual
			setMovimentos([]);
			setFilteredMovimentos([]);

			setConfirmDeleteAllModalOpen(false);
			console.log(`✅ Exclusão em massa concluída: ${resultado.excluidos} movimentos excluídos`);
		} catch (error) {
			console.error('❌ Erro ao excluir movimentos em massa:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		const temParcelas = await verificarParcelasAssociadas(id);
		setDeleteMovimentoId(id);

		if (temParcelas) {
			setConfirmDeleteParcelaModalOpen(true);
		} else {
			setConfirmModalOpen(true);
		}
	};

	const handleLimparConciliacao = async (id: number) => {
		setLimparConciliacaoMovimentoId(id);
		setConfirmLimparConciliacaoModalOpen(true);
	};

	const handleLimparConciliacaoConfirm = async () => {
		if (limparConciliacaoMovimentoId === null) return;

		try {
			setIsSaving(true);
			// Buscar o movimento completo
			const movimentoCompleto = await buscarMovimentoBancarioById(limparConciliacaoMovimentoId);

			// Limpar todos os campos de conciliação
			const movimentoLimpo: MovimentoBancario = {
				...movimentoCompleto,
				idPlanoContas: null,
				idCentroCustos: null,
				idPessoa: null,
				resultadoList: [],
				centroCustosList: undefined,
				modalidadeMovimento: 'padrao',
			};

			await salvarMovimentoBancario(movimentoLimpo);

			// Atualizar a lista
			await fetchMovimentos(currentPage);

			setConfirmLimparConciliacaoModalOpen(false);
			setLimparConciliacaoMovimentoId(null);
			toast.success('Conciliação limpa com sucesso!');
		} catch (error) {
			console.error('Erro ao limpar conciliação:', error);
			toast.error('Erro ao limpar conciliação');
		} finally {
			setIsSaving(false);
		}
	};

	const formatarMoeda = (valor: number) => {
		return valor.toLocaleString('pt-BR', {
			style: 'currency',
			currency: 'BRL',
		});
	};

	const handleStatusChange = async (id: number, novoStatus: boolean) => {
		try {
			await atualizarStatusIdeagro(id, novoStatus);

			await fetchMovimentos(currentPage);
		} catch (error) {
			console.error('Erro ao atualizar status do movimento:', error);
		}
	};

	const atualizarListasMovimentos = (novaLista: MovimentoBancario[]) => {
		setMovimentos(novaLista);
		setFilteredMovimentos(novaLista);
	};

	const handleConcilia = async (data: any) => {
		try {
			// Armazenar a página atual em uma constante
			const paginaAtual = currentPage;

			const movimentoAtualizado: MovimentoBancario = {
				...movimentoParaConciliar!,
				idPlanoContas: data.idPlanoContas,
				modalidadeMovimento: data.modalidadeMovimento,
				idPessoa: data.idPessoa ?? null,
				idCentroCustos: data.idCentroCustos ?? null,
			};

			// Incluir centroCustosList se presente
			if (data.centroCustosList !== undefined) {
				movimentoAtualizado.centroCustosList = data.centroCustosList;
			}

			if (data.modalidadeMovimento === 'padrao') {
				movimentoAtualizado.idBanco = undefined;
				movimentoAtualizado.parcelado = false;
				movimentoAtualizado.numeroDocumento = undefined;
				movimentoAtualizado.idFinanciamento = undefined;
			}

			if (data.modalidadeMovimento === 'financiamento') {
				movimentoAtualizado.idBanco = data.idBanco ?? undefined;
				movimentoAtualizado.idPessoa = data.idPessoa ?? null;
				movimentoAtualizado.numeroDocumento = data.numeroDocumento ?? undefined;
				movimentoAtualizado.parcelado = data.parcelado ?? false;
				movimentoAtualizado.idFinanciamento = data.idFinanciamento ?? undefined;
				movimentoAtualizado.idCentroCustos = data.idCentroCustos ?? undefined;
				// Marcar como conciliado quando há financiamento associado
				if (data.idFinanciamento) {
					movimentoAtualizado.ideagro = true;
				}
			}

			if (data.modalidadeMovimento === 'transferencia') {
				movimentoAtualizado.idBanco = undefined;
				movimentoAtualizado.parcelado = false;
				movimentoAtualizado.numeroDocumento = undefined;
				movimentoAtualizado.idFinanciamento = undefined;
				movimentoAtualizado.idCentroCustos = undefined;
				movimentoAtualizado.resultadoList = [];
				// Limpar centroCustosList em transferências
				movimentoAtualizado.centroCustosList = undefined;
			}

			const movimentoSalvo = await salvarMovimentoBancario(movimentoAtualizado);

			// Atualizar apenas a lista principal de movimentos
			setMovimentos((prevMovimentos) => prevMovimentos.map((mov) => (mov.id === movimentoSalvo.id ? movimentoSalvo : mov)));

			setCurrentPage(paginaAtual);
			setModalConciliaIsOpen(false);
			setMovimentosConciliacaoModal([]);

			// Remove da seleção só o movimento conciliado (mantém outros checkboxes)
			setMovimentosSelecionados((prev) => {
				const next = prev.filter((m) => m.id !== movimentoSalvo.id);
				if (next.length === 0) {
					setTipoMovimentoSelecionado(null);
				}
				return next;
			});

			// Recarregar dados da página atual
			await fetchMovimentos(paginaAtual);
			// Garantir que o movimento recém-salvo use a resposta do save (evita tabela mostrar centro/plano antigo se a listagem vier em cache)
			setMovimentos((prev) => prev.map((mov) => (mov.id === movimentoSalvo.id ? movimentoSalvo : mov)));
			setFilteredMovimentos((prev) => prev.map((mov) => (mov.id === movimentoSalvo.id ? movimentoSalvo : mov)));
		} catch (error) {
			console.error('❌ Erro ao conciliar movimento:', error);
		}
	};

	const handleAtualizarContaHistorico = async (novaContaId: number) => {
		if (!historicoParaEditarConta) return;

		try {
			setIsSaving(true);
			console.log(`🔄 Atualizando conta de ${historicoParaEditarConta.idMovimentos.length} movimentos para conta ${novaContaId}`);

			const resultado = await atualizarContaMovimentosOFX(historicoParaEditarConta.idMovimentos, novaContaId);

			console.log(`✅ ${resultado.atualizados} movimentos atualizados com sucesso`);
			toast.success(` movimentos atualizados para a nova conta!`);

			// Fechar modal e limpar estados
			setModalEditarContaIsOpen(false);
			setHistoricoParaEditarConta(null);

			// Recarregar movimentos para refletir as mudanças
			await fetchMovimentos(currentPage);
		} catch (error) {
			console.error('❌ Erro ao atualizar conta dos movimentos:', error);
			toast.error('Erro ao atualizar conta dos movimentos');
		} finally {
			setIsSaving(false);
		}
	};

	const handleSelecionarMovimento = (movimento: MovimentoBancario) => {
		if (!tipoMovimentoSelecionado) {
			setTipoMovimentoSelecionado(movimento.tipoMovimento || null);
			setMovimentosSelecionados([movimento]);
		} else if (tipoMovimentoSelecionado === movimento.tipoMovimento) {
			const jaSelecionado = movimentosSelecionados.some((m) => m.id === movimento.id);
			if (jaSelecionado) {
				const novosSelecionados = movimentosSelecionados.filter((m) => m.id !== movimento.id);
				setMovimentosSelecionados(novosSelecionados);
				if (novosSelecionados.length === 0) {
					setTipoMovimentoSelecionado(null);
				}
			} else {
				setMovimentosSelecionados([...movimentosSelecionados, movimento]);
			}
		} else {
			toast.warning('Não é possível selecionar movimentos de tipos diferentes (Crédito/Débito)');
		}
	};

	const handleSelecionarTodos = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.checked) {
			if (currentItems.length === 0) {
				console.warn('Nenhum movimento disponível para seleção');
				e.target.checked = false;
				return;
			}

			const primeiroMovimento = currentItems[0];

			if (!primeiroMovimento || !primeiroMovimento.tipoMovimento) {
				console.warn('Primeiro movimento inválido:', primeiroMovimento);
				e.target.checked = false;
				return;
			}

			const todosMesmoTipo = currentItems.every((m) => m && m.tipoMovimento === primeiroMovimento.tipoMovimento);

			if (todosMesmoTipo) {
				setTipoMovimentoSelecionado(primeiroMovimento.tipoMovimento);
				setMovimentosSelecionados(currentItems);
			} else {
				toast.warning('Não é possível selecionar movimentos de tipos diferentes (Crédito/Débito)');
				e.target.checked = false;
			}
		} else {
			setMovimentosSelecionados([]);
			setTipoMovimentoSelecionado(null);
		}
	};

	const handleConciliarSelecionados = () => {
		if (movimentosSelecionados.length > 0) {
			setMovimentoParaConciliar(movimentosSelecionados[0]);
			setMovimentosConciliacaoModal(movimentosSelecionados);
			setModalConciliaIsOpen(true);
		}
	};

	const handleConciliaMultiplos = async (data: any) => {
		try {
			const movimentosAtualizados: MovimentoBancario[] = [];
			const erros: number[] = [];

			// Verificar se data é um array de movimentos (quando há rateio por porcentagem)
			const movimentosParaProcessar = Array.isArray(data) ? data : movimentosConciliacaoModal;

			console.log('🔍 DEBUG - handleConciliaMultiplos:');
			console.log('  - data é array?', Array.isArray(data));
			console.log('  - movimentosParaProcessar:', movimentosParaProcessar);

			for (const movimento of movimentosParaProcessar) {
				try {
					let movimentoAtualizado: MovimentoBancario;

					if (Array.isArray(data)) {
						// Se data é um array, os movimentos já vêm preparados com resultadoList e centroCustosList
						console.log('  - Movimento (array):', movimento.id, 'centroCustosList:', movimento.centroCustosList);
						movimentoAtualizado = movimento as MovimentoBancario;
					} else {
						// Se data é um objeto simples, construir o movimento
						movimentoAtualizado = {
							...movimento,
							modalidadeMovimento: data.modalidadeMovimento,
							idPlanoContas: data.idPlanoContas || undefined,
							idPessoa: data.idPessoa || null,
							idBanco: data.idBanco || undefined,
							numeroDocumento: data.numeroDocumento || undefined,
							parcelado: data.parcelado || false,
							idFinanciamento: data.idFinanciamento || undefined,
							idUsuario: movimento.idUsuario || undefined,
							idCentroCustos: data.idCentroCustos || undefined,
						};

						// Incluir centroCustosList se presente
						if (data.centroCustosList !== undefined) {
							movimentoAtualizado.centroCustosList = data.centroCustosList;
						}
					}

					console.log(
						'  - movimentoAtualizado antes de salvar:',
						movimentoAtualizado.id,
						'centroCustosList:',
						movimentoAtualizado.centroCustosList,
					);
					const resultadoSalvo = await salvarMovimentoBancario(movimentoAtualizado);
					movimentosAtualizados.push(resultadoSalvo);
				} catch (error) {
					console.error(`Erro ao conciliar movimento ${movimento.id}:`, error);
					erros.push(movimento.id);
				}
			}

			// Remove da seleção os movimentos que foram conciliados neste fluxo
			const idsProcessados = movimentosParaProcessar.map((m) => m.id);
			setMovimentosSelecionados((prev) => {
				const next = prev.filter((m) => !idsProcessados.includes(m.id));
				if (next.length === 0) {
					setTipoMovimentoSelecionado(null);
				}
				return next;
			});

			// Fecha o modal
			setMovimentoParaConciliar(null);
			setMovimentosConciliacaoModal([]);
			setModalConciliaIsOpen(false);

			// Recarrega a página atual
			await fetchMovimentos(currentPage);

			// Exibe mensagens de feedback
			if (erros.length > 0) {
				toast.error(`Erro ao conciliar ${erros.length} movimento(s).`);
			}
			if (movimentosAtualizados.length > 0) {
				toast.success(`${movimentosAtualizados.length} movimento(s) conciliado(s) com sucesso!`);
			}
		} catch (error) {
			console.error('Erro ao conciliar movimentos:', error);
			toast.error('Erro ao conciliar movimentos.');
		}
	};

	const currentItems = filteredMovimentos;

	const linhasResumoFiltrosVazio = useMemo(() => {
		const fmtData = (s: string) => {
			const raw = s.split('T')[0];
			const p = raw.split('-').map(Number);
			if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return s;
			const [y, m, d] = p;
			return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
		};

		const linhas: string[] = [];

		if (contaSelecionada) {
			linhas.push(`Conta: ${contaSelecionada.numConta} — ${contaSelecionada.bancoNome} — ${contaSelecionada.responsavel}`);
		}

		if (dataInicio && dataFim) {
			linhas.push(`Período: ${fmtData(dataInicio)} a ${fmtData(dataFim)}`);
		} else if (dataInicio) {
			linhas.push(`A partir de: ${fmtData(dataInicio)}`);
		} else if (dataFim) {
			linhas.push(`Até: ${fmtData(dataFim)}`);
		}

		linhas.push(statusFiltro === 'pendentes' ? 'Status: apenas pendentes' : 'Status: mostrar todos');

		if (planosFiltroIds?.length) {
			const nomes = planosFiltroIds.map((id) => planos.find((p) => p.id === id)?.descricao).filter(Boolean) as string[];
			if (nomes.length) {
				linhas.push(`Planos de contas: ${nomes.join(', ')}`);
			}
		}

		if (centrosFiltroIds?.length) {
			const nomes = centrosFiltroIds.map((id) => centrosDisponiveis.find((c) => c.id === id)?.descricao).filter(Boolean) as string[];
			if (nomes.length) {
				linhas.push(`Centros de custos: ${nomes.join(', ')}`);
			}
		}

		return linhas;
	}, [contaSelecionada, dataInicio, dataFim, statusFiltro, planosFiltroIds, centrosFiltroIds, planos, centrosDisponiveis]);

	return (
		<div>
			{/* Loading bloqueante para histórico */}
			{isLoadingHistorico && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
					<div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4 w-full max-w-sm shadow-lg">
						<div className="loader"></div>
						<p className="text-gray-800 font-semibold text-center">Carregando movimentos do extrato...</p>
						<div className="w-full">
							<div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
								<div
									className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
									style={{ width: `${progressoCarregamentoHistorico}%` }}
								/>
							</div>
							<p className="text-center text-sm font-bold text-gray-700 mt-2 tabular-nums">{progressoCarregamentoHistorico}%</p>
						</div>
					</div>
				</div>
			)}

			<div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 lg:gap-5 mb-4">
				<div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 relative w-full lg:w-auto" ref={menuRef}>
					<div className="relative w-auto whitespace-nowrap">
						<button
							className="bg-gray-50 font-bold h-10 px-4 pt-0 pb-0 flex items-center rounded-md border border-gray-300 hover:bg-gray-100"
							onClick={() => setModalContaIsOpen(true)}
						>
							{contaSelecionada
								? `${contaSelecionada.numConta} - ${contaSelecionada.bancoNome} - ${contaSelecionada.responsavel}`
								: 'Selecionar Conta'}

							<FontAwesomeIcon style={{ marginLeft: '10px' }} icon={faBank} />
						</button>
					</div>
					<div className="relative w-auto whitespace-nowrap">
						<div className="relative w-auto whitespace-nowrap">
							<button
								className="bg-gray-50 font-bold h-8 px-4 pt-0 pb-0 flex items-center rounded-lg border border-gray-300 hover:bg-gray-100"
								onClick={() => setAcoesMenu(!acoesMenu)}
							>
								Ações <FontAwesomeIcon icon={faChevronDown} className="ml-3" />
							</button>
						</div>
						{acoesMenu && (
							<div
								className="absolute flex flex-col bg-white shadow-md font-medium rounded-md border p-1 mt-2 z-10"
								style={{ width: '9rem' }}
							>
								<button onClick={() => setModalTransferirIsOpen(true)}>
									<p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100">
										<FontAwesomeIcon icon={faExchange} className="mr-2" />
										Transferir
									</p>
								</button>
								<button onClick={() => setConfirmDeleteAllModalOpen(true)}>
									<p className="font-bold text-sm rounded text-left text-red-600 mb-1 px-2 py-1 hover:bg-red-50">
										<FontAwesomeIcon icon={faTrash} className="mr-2" />
										Excluir Todos
									</p>
								</button>
								<button onClick={exportarParaPDF} disabled={filteredMovimentos && filteredMovimentos.length <= 0}>
									<p className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100">
										<FontAwesomeIcon icon={faFilePdf} className="mr-2" />
										Imprimir PDF
									</p>
								</button>
								<button onClick={exportarParaExcel} disabled={filteredMovimentos && filteredMovimentos.length <= 0}>
									<p className="font-bold text-sm rounded text-left text-gray-800 px-2 py-1 hover:bg-gray-100">
										<FontAwesomeIcon icon={faFileExcel} className="mr-2" />
										Imprimir Excel
									</p>
								</button>
							</div>
						)}
					</div>
				</div>
				<div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 w-full">
					<button
						className="bg-gray-200 text-black font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-gray-300 text-sm sm:text-base"
						onClick={() => setModalFiltroMovimentosIsOpen(true)}
					>
						<span className="hidden sm:inline">Pesquisar</span>
						<span className="sm:hidden">Filtrar</span>
						<FontAwesomeIcon icon={faSearch} className="ml-2 sm:ml-3 font-bold" />
					</button>
					<button
						className="bg-suport text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400 text-sm sm:text-base"
						onClick={() => openModal()}
					>
						<span className="hidden sm:inline">Lançar Manual</span>
						<span className="sm:hidden">Lançar</span>
						<FontAwesomeIcon icon={faPlus} className="ml-2 sm:ml-3 font-bold" />
					</button>
					<div className="flex relative">
						<button
							className="bg-primary text-white font-bold px-4 py-2 flex items-center rounded-l hover:bg-orange-500 text-sm sm:text-base"
							onClick={() => setModalImportOFXIsOpen(true)}
						>
							<span className="hidden sm:inline">Buscar OFX</span>
							<span className="sm:hidden">OFX</span>
							<FontAwesomeIcon icon={faFileArchive} className="ml-2 sm:ml-3" />
						</button>
						<button
							className="rounded-r-md font-bold text-white bg-primary border-l-2 border-gray-300 text-lg px-2 py-2 flex items-center"
							onClick={() => setDropdownHistoricoAberto(!dropdownHistoricoAberto)}
						>
							<FontAwesomeIcon icon={faChevronDown} />
						</button>

						{dropdownHistoricoAberto && (
							<div className="absolute top-10 right-0 mt-1 bg-white border rounded shadow-lg z-50 w-80 max-w-[calc(100vw-2rem)]">
								<div className="text-xs font-semibold text-gray-500 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
									<span>Últimas Importações</span>
									<button
										onClick={() => setModalConfirmarLimparHistoricoIsOpen(true)}
										className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
										title="Remove apenas o registro das importações; os movimentos continuam no sistema."
									>
										Limpar
									</button>
								</div>
								{historicoImportacoes.length === 0 ? (
									<div className="text-sm text-gray-600 px-4 py-2">Nenhum histórico encontrado.</div>
								) : (
									historicoImportacoes.map((item, index) => (
										<div key={index} className="block w-full text-left text-sm border-b border-gray-200 px-4 py-2 hover:bg-gray-100">
											<div className="flex justify-between items-start gap-2">
												<button
													onClick={async () => {
														try {
															setProgressoCarregamentoHistorico(0);
															setIsLoadingHistorico(true);
															setDropdownHistoricoAberto(false);

															const movimentosAtualizados = await buscarMovimentosPorIds(item.idMovimentos, (pct) =>
																setProgressoCarregamentoHistorico(pct),
															);

															setHistoricoSelecionado({
																movimentos: movimentosAtualizados,
																totalizadores: item.totalizadores,
																idContaCorrente: item.idContaCorrente,
															});
															setModalConciliacaoHistoricoIsOpen(true);
														} catch (error) {
															console.error('Erro ao buscar movimentos atualizados:', error);
															toast.error('Erro ao carregar movimentos do histórico');
														} finally {
															setIsLoadingHistorico(false);
															setProgressoCarregamentoHistorico(0);
														}
													}}
													className="flex-1 text-left min-w-0"
												>
													<div className="font-semibold truncate">{item.nomeArquivo}</div>
													<div className="flex justify-between items-center mt-1">
														<div className="text-xs text-gray-500">{new Date(item.dataImportacao).toLocaleString('pt-BR')}</div>
														<div className="text-xs text-gray-400">{item.idMovimentos.length} movimentos</div>
													</div>
												</button>
												<button
													onClick={() => {
														setHistoricoParaEditarConta(item);
														setModalEditarContaIsOpen(true);
														setDropdownHistoricoAberto(false);
													}}
													className="flex-shrink-0 p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
													title="Editar conta"
												>
													<FontAwesomeIcon icon={faPencil} size="sm" />
												</button>
											</div>
										</div>
									))
								)}
							</div>
						)}
					</div>
				</div>
			</div>
			<div className="bg-gray-50 shadow-md rounded-lg border border-gray-200">
				{isLoading ? (
					<div className="flex justify-center items-center h-64">
						<div className="loader"></div>
					</div>
				) : (
					<>
						{/* Tabela Desktop */}
						<div className="hidden lg:block overflow-x-auto">
							<table className="w-full border-collapse min-w-[900px]">
								<thead>
									<tr className="bg-gray-200">
										<th className="p-2 text-center w-12 min-w-[48px]">
											<input
												type="checkbox"
												checked={currentItems.length > 0 && currentItems.every((m) => movimentosSelecionados.some((ms) => ms.id === m.id))}
												onChange={handleSelecionarTodos}
												className="w-4 h-4"
											/>
										</th>
										<th className="pl-5 p-2 text-left truncate min-w-[140px]">Data do Movimento</th>
										<th className="p-2 text-left min-w-[200px]">Histórico</th>
										<th className="p-2 text-center min-w-[180px]">Plano de Contas</th>
										<th className="p-2 text-center min-w-[180px]">Centro de Custos</th>
										<th className="p-2 text-center min-w-[120px]">Valor R$</th>
									</tr>
								</thead>
								<tbody>
									{currentItems.length === 0 ? (
										<tr>
											<td colSpan={7} className="border-b p-0">
												<div className="flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
													<p className="text-gray-600 text-lg font-medium m-0">Nenhum movimento encontrado!</p>
													<div className="text-xs sm:text-sm text-gray-500 max-w-2xl leading-relaxed">
														{linhasResumoFiltrosVazio.map((linha, idx) => (
															<p key={idx} className="m-0">
																{linha}
															</p>
														))}
													</div>
												</div>
											</td>
										</tr>
									) : (
										currentItems.map((movBancario) => (
											<tr key={movBancario.id} className="border-b">
												<td className="p-2 text-center">
													<input
														type="checkbox"
														checked={movimentosSelecionados.some((m) => m.id === movBancario.id)}
														onChange={() => handleSelecionarMovimento(movBancario)}
														className="w-4 h-4"
														disabled={tipoMovimentoSelecionado !== null && tipoMovimentoSelecionado !== movBancario.tipoMovimento}
													/>
												</td>
												<td className="pl-5 p-2 text-left truncate min-w-[140px]">{formatarData(movBancario.dtMovimento)}</td>
												<td className="p-2 text-left min-w-[200px] max-w-[300px] truncate">
													<span id={`tooltip-${movBancario.id}`}>{movBancario.historico}</span>
													<Tooltip anchorId={`tooltip-${movBancario.id}`} place="top" content={movBancario.historico} />
												</td>
												{movBancario.modalidadeMovimento === 'transferencia' ? (
													<td
														colSpan={2}
														className={`p-2 text-center truncate min-w-[180px] max-w-[440px] cursor-pointer underline hover:text-gray-500 ${
															isPlanoRateioMultiplo(movBancario)
																? 'text-blue-600 font-semibold'
																: !planos.find((p) => p.id === idPlanoContasEfetivo(movBancario))
																	? 'text-orange-500 font-semibold'
																	: 'text-gray-900'
														}`}
														style={{ textUnderlineOffset: '2px' }}
														onClick={() => openModalConcilia(movBancario)}
														title="Movimentações sem efeito financeiro — clique para editar a conciliação"
													>
														{textoPlanoTransferencia(movBancario, planos)}
													</td>
												) : isFinanciamentoVinculadoContrato(movBancario) ? (
													<td
														colSpan={2}
														className="p-2 text-center truncate min-w-[180px] max-w-[440px] cursor-pointer underline hover:text-gray-500 text-blue-600 font-medium"
														style={{ textUnderlineOffset: '2px' }}
														onClick={() => openModalConcilia(movBancario)}
														title="Financiamento vinculado ao contrato — clique para editar a conciliação"
													>
														{TEXTO_COLUNA_UNICA_FINANCIAMENTO}
													</td>
												) : (
													<>
														{/* Coluna Plano de Contas */}
														<td
															className={`p-2 text-center min-w-[180px] max-w-[220px] truncate ${
																movBancario.tipoMovimento === 'D'
																	? 'cursor-pointer underline hover:text-gray-500' +
																		(isPlanoRateioMultiplo(movBancario)
																			? ' text-blue-600 font-semibold'
																			: !isFinanciamentoVinculadoContrato(movBancario) &&
																				  !planos.find((p) => p.id === idPlanoContasEfetivo(movBancario))
																				? ' text-orange-500 font-semibold'
																				: '')
																	: 'text-gray-400'
															}`}
															style={{ textUnderlineOffset: '2px' }}
															onClick={() => movBancario.tipoMovimento === 'D' && openModalConcilia(movBancario)}
															title={movBancario.tipoMovimento === 'C' ? 'Receitas não usam Plano de Contas' : ''}
														>
															{movBancario.tipoMovimento === 'D' ? textoPlanoDespesa(movBancario, planos) : '-'}
														</td>
														{/* Coluna Centro de Custos */}
														<td
															className={`p-2 text-center truncate min-w-[180px] max-w-[220px] ${
																movBancario.modalidadeMovimento === 'financiamento'
																	? 'cursor-pointer underline hover:text-gray-500 text-blue-600'
																	: `cursor-pointer underline hover:text-gray-500 ${
																			isCentroRateioMultiplo(movBancario)
																				? 'text-blue-600 font-semibold'
																				: !centrosDisponiveis.find((c) => c.id === idCentroCustosEfetivo(movBancario)) &&
																					  !(movBancario.centroCustosList && movBancario.centroCustosList.length > 0)
																					? 'text-orange-500 font-semibold'
																					: ''
																		}`
															}`}
															style={{ textUnderlineOffset: '2px' }}
															onClick={() => openModalConcilia(movBancario)}
															title={movBancario.modalidadeMovimento === 'financiamento' ? 'Clique para editar conciliação' : ''}
														>
															{movBancario.modalidadeMovimento === 'financiamento'
																? TEXTO_COLUNA_UNICA_FINANCIAMENTO
																: textoCentroPadrao(movBancario, centrosDisponiveis)}
														</td>
													</>
												)}
												<td
													className={`p-2 text-center font-semibold capitalize ${
														movBancario.valor >= 0 ? 'text-green-600' : 'text-red-600'
													}`}
												>
													{formatarMoeda(movBancario.valor)}
												</td>
												<td className="p-2 justify-end mr-1 capitalize flex items-center gap-6 relative">
													<button
														className="text-gray-700 hover:text-black px-2"
														onClick={() => setMenuAtivoId(menuAtivoId === movBancario.id ? null : movBancario.id)}
													>
														<FontAwesomeIcon icon={faEllipsisV} />
													</button>

													{menuAtivoId === movBancario.id && (
														<div className="absolute right-5 top-6 z-10 bg-white border rounded shadow-md text-sm w-33 font-semibold">
															<button
																className="w-full px-4 py-2 hover:bg-gray-100 text-left text-blue-600"
																style={{ textWrap: 'nowrap' }}
																onClick={() => {
																	setMovimentoSelecionado(movBancario);
																	setModalDetalheOpen(true);
																}}
															>
																<FontAwesomeIcon icon={faInfoCircle} className="mr-1" /> Informação
															</button>
															{movBancario.idPlanoContas && (
																<button
																	className="w-full px-4 py-2 hover:bg-orange-100 text-left text-orange-600"
																	onClick={() => {
																		handleLimparConciliacao(movBancario.id);
																		setMenuAtivoId(null);
																	}}
																>
																	<FontAwesomeIcon icon={faUndo} className="mr-1" /> Limpar
																</button>
															)}
															<button
																className="w-full px-4 py-2 hover:bg-red-100 text-left text-red-600"
																onClick={() => handleDelete(movBancario.id)}
															>
																<FontAwesomeIcon icon={faTrash} className="mr-1" /> Excluir
															</button>
														</div>
													)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* Cards Mobile */}
						<div className="lg:hidden">
							{currentItems.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
									<p className="text-gray-600 text-lg font-medium m-0">Nenhum movimento encontrado!</p>
									<div className="text-xs sm:text-sm text-gray-500 max-w-2xl leading-relaxed">
										{linhasResumoFiltrosVazio.map((linha, idx) => (
											<p key={idx} className="m-0">
												{linha}
											</p>
										))}
									</div>
								</div>
							) : (
								<div className="space-y-3 p-4">
									{currentItems.map((movBancario) => (
										<div key={movBancario.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
											{/* Header do card */}
											<div className="flex justify-between items-start mb-3">
												<div className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={movimentosSelecionados.some((m) => m.id === movBancario.id)}
														onChange={() => handleSelecionarMovimento(movBancario)}
														className="w-4 h-4"
														disabled={tipoMovimentoSelecionado !== null && tipoMovimentoSelecionado !== movBancario.tipoMovimento}
													/>
													<div className="flex-1">
														<div className="text-sm font-medium text-gray-900">{formatarData(movBancario.dtMovimento)}</div>
														<div className="text-xs text-gray-500 mt-1">{movBancario.historico}</div>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<label className="relative inline-flex items-center cursor-pointer">
														<input
															type="checkbox"
															className="sr-only peer"
															checked={movBancario.ideagro}
															onChange={() => handleStatusChange(movBancario.id, !movBancario.ideagro)}
														/>
														<div className="w-8 h-4 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
													</label>
													<button
														className="text-gray-700 hover:text-black p-1"
														onClick={() => setMenuAtivoId(menuAtivoId === movBancario.id ? null : movBancario.id)}
													>
														<FontAwesomeIcon icon={faEllipsisV} />
													</button>
												</div>
											</div>

											{/* Conteúdo do card */}
											{movBancario.modalidadeMovimento === 'transferencia' ? (
												<div className="mb-3">
													<div className="text-xs text-gray-500">Sem efeito financeiro</div>
													<div
														className={`text-sm cursor-pointer underline hover:text-gray-500 ${
															isPlanoRateioMultiplo(movBancario)
																? 'text-blue-600 font-semibold'
																: !planos.find((p) => p.id === idPlanoContasEfetivo(movBancario))
																	? 'text-orange-500 font-semibold'
																	: ''
														}`}
														onClick={() => openModalConcilia(movBancario)}
														title="Movimentações sem efeito financeiro — clique para editar a conciliação"
													>
														{textoPlanoTransferencia(movBancario, planos)}
													</div>
												</div>
											) : isFinanciamentoVinculadoContrato(movBancario) ? (
												<div className="mb-3">
													<div className="text-xs text-gray-500">Classificação</div>
													<div
														className="text-sm cursor-pointer underline hover:text-gray-500 text-blue-600"
														onClick={() => openModalConcilia(movBancario)}
														title="Financiamento vinculado ao contrato — clique para editar a conciliação"
													>
														{TEXTO_COLUNA_UNICA_FINANCIAMENTO}
													</div>
												</div>
											) : (
												<div className="grid grid-cols-2 gap-3 mb-3">
													{/* Plano de Contas */}
													<div>
														<div className="text-xs text-gray-500">Plano de Contas</div>
														<div
															className={`text-sm ${movBancario.tipoMovimento === 'D' ? 'cursor-pointer underline hover:text-gray-500' : 'text-gray-400'} ${
																movBancario.tipoMovimento === 'D' && isPlanoRateioMultiplo(movBancario)
																	? 'text-blue-600 font-semibold'
																	: movBancario.tipoMovimento === 'D' &&
																		  !isFinanciamentoVinculadoContrato(movBancario) &&
																		  !planos.find((p) => p.id === idPlanoContasEfetivo(movBancario))
																		? 'text-orange-500 font-semibold'
																		: ''
															}`}
															onClick={() => movBancario.tipoMovimento === 'D' && openModalConcilia(movBancario)}
															title={movBancario.tipoMovimento === 'C' ? 'Receitas não usam Plano de Contas' : ''}
														>
															{movBancario.tipoMovimento === 'D' ? textoPlanoDespesa(movBancario, planos) : '-'}
														</div>
													</div>
													{/* Centro de Custos */}
													<div>
														<div className="text-xs text-gray-500">Centro de Custos</div>
														<div
															className={`text-sm ${
																movBancario.modalidadeMovimento === 'financiamento'
																	? 'cursor-pointer underline hover:text-gray-500 text-blue-600'
																	: `cursor-pointer underline hover:text-gray-500 ${
																			isCentroRateioMultiplo(movBancario)
																				? 'text-blue-600 font-semibold'
																				: !centrosDisponiveis.find((c) => c.id === idCentroCustosEfetivo(movBancario)) &&
																					  !(movBancario.centroCustosList && movBancario.centroCustosList.length > 0)
																					? 'text-orange-500 font-semibold'
																					: ''
																		}`
															}`}
															onClick={() => openModalConcilia(movBancario)}
															title={movBancario.modalidadeMovimento === 'financiamento' ? 'Clique para editar conciliação' : ''}
														>
															{movBancario.modalidadeMovimento === 'financiamento'
																? TEXTO_COLUNA_UNICA_FINANCIAMENTO
																: textoCentroPadrao(movBancario, centrosDisponiveis)}
														</div>
													</div>
												</div>
											)}
											<div>
												<div className="text-xs text-gray-500">Valor</div>
												<div className={`text-sm font-semibold ${movBancario.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
													{formatarMoeda(movBancario.valor)}
												</div>
											</div>

											{/* Menu de ações mobile */}
											{menuAtivoId === movBancario.id && (
												<div className="mt-3 pt-3 border-t border-gray-200">
													<div className="flex gap-2 flex-wrap">
														<button
															className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center justify-center gap-2"
															onClick={() => {
																setMovimentoSelecionado(movBancario);
																setModalDetalheOpen(true);
																setMenuAtivoId(null);
															}}
														>
															<FontAwesomeIcon icon={faInfoCircle} />
															Informação
														</button>
														{movBancario.idPlanoContas ||
															(movBancario.resultadoList && movBancario.resultadoList.length > 0 && (
																<button
																	className="flex-1 px-3 py-2 text-sm bg-orange-50 text-orange-600 rounded hover:bg-orange-100 flex items-center justify-center gap-2"
																	onClick={() => {
																		handleLimparConciliacao(movBancario.id);
																		setMenuAtivoId(null);
																	}}
																>
																	<FontAwesomeIcon icon={faUndo} />
																	Limpar
																</button>
															))}
														<button
															className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center justify-center gap-2"
															onClick={() => {
																handleDelete(movBancario.id);
																setMenuAtivoId(null);
															}}
														>
															<FontAwesomeIcon icon={faTrash} />
															Excluir
														</button>
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
						{/* 🔹 Paginação */}
						<div className="flex flex-col sm:flex-row justify-between items-center my-4 mx-2 gap-3">
							<span className="text-gray-800 text-sm sm:text-base">
								{totalMovimentos} <span className="text-xs sm:text-sm">Registros</span>
							</span>

							<div className="flex items-center gap-2">
								<button
									className="px-2 sm:px-3 py-1 border rounded text-sm"
									disabled={!hasPrev || isLoading}
									onClick={() => {
										console.log('⬅️ Navegando para página anterior:', currentPage - 1);
										fetchMovimentos(currentPage - 1);
									}}
								>
									<FontAwesomeIcon icon={faChevronLeft} />
								</button>

								<span className="px-2 sm:px-3 py-1 text-sm">
									{currentPage} / {totalPages}
								</span>

								<button
									className="px-2 sm:px-3 py-1 border rounded text-sm"
									disabled={!hasNext || isLoading}
									onClick={() => {
										console.log('➡️ Navegando para próxima página:', currentPage + 1);
										fetchMovimentos(currentPage + 1);
									}}
								>
									<FontAwesomeIcon icon={faChevronRight} />
								</button>

								<select
									className="border border-gray-400 p-1 rounded text-sm"
									value={itemsPerPage}
									onChange={(e) => {
										console.log('🔄 Alterando itemsPerPage para:', e.target.value);
										setItemsPerPage(Number(e.target.value));
										setCurrentPage(1);
										// O useEffect vai detectar a mudança e chamar fetchMovimentos automaticamente
									}}
								>
									{[5, 10, 15, 30, 50, 100].map((size) => (
										<option key={size} value={size}>
											{size}
										</option>
									))}
								</select>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Botão fixo de conciliação em lote */}
			{movimentosSelecionados.length > 0 && (
				<div
					className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50"
					style={{ boxShadow: '0px -2px 10px 0px rgba(0, 0, 0, 0.1)' }}
				>
					<div className="container mx-auto flex justify-between items-center">
						<span className="text-gray-600 font-semibold text-lg">{movimentosSelecionados.length} movimento(s) selecionado(s)</span>
						<button
							onClick={handleConciliarSelecionados}
							className="bg-blue-600 text-white text-lg px-6 py-2 font-semibold rounded-lg hover:bg-blue-700 transition-colors"
						>
							Conciliar {movimentosSelecionados.length} Movimento(s)
						</button>
					</div>
				</div>
			)}

			<LancamentoManual isOpen={modalIsOpen} onClose={() => setModalIsOpen(false)} handleSave={handleSave} isSaving={isSaving} />

			<ImportOFXModal isOpen={modalImportOFXIsOpen} onClose={() => setModalImportOFXIsOpen(false)} handleImport={handleImportFile} />

			<FiltroMovimentosModal
				isOpen={modalFiltroMovimentosIsOpen}
				onClose={() => setModalFiltroMovimentosIsOpen(false)}
				handleSearch={handleSearchFilters}
				dataInicio={dataInicio}
				dataFim={dataFim}
				status={statusFiltro}
				planosIniciais={planosSelecao}
				centrosIniciais={centrosSelecao}
				historicoContemInicial={historicoContem}
				valorBuscaInicial={valorBusca}
			/>

			<DialogModal
				isOpen={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={handleDeleteConfirm}
				title="Atenção"
				type="warn"
				message="Tem certeza que deseja excluir este Movimento Bancário?"
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			<DialogModal
				isOpen={confirmDeleteAllModalOpen}
				onClose={() => setConfirmDeleteAllModalOpen(false)}
				onConfirm={handleDeleteAllConfirm}
				title="⚠️ ATENÇÃO - EXCLUSÃO EM MASSA"
				type="error"
				message={`Tem CERTEZA ABSOLUTA que deseja excluir TODOS os movimentos bancários da conta "${contaSelecionada?.numConta} - ${contaSelecionada?.bancoNome}"?\n\nEsta ação é IRREVERSÍVEL e excluirá:\n• Todos os movimentos bancários\n• Todos os resultados relacionados\n• Todas as parcelas de financiamento associadas`}
				confirmLabel="EXCLUIR TODOS"
				cancelLabel="Cancelar"
			/>

			<DialogModal
				isOpen={confirmLimparConciliacaoModalOpen}
				onClose={() => {
					setConfirmLimparConciliacaoModalOpen(false);
					setLimparConciliacaoMovimentoId(null);
				}}
				onConfirm={handleLimparConciliacaoConfirm}
				title="Limpar"
				type="warn"
				message="Tem certeza que deseja limpar a conciliação deste movimento? O movimento ficará pendente novamente."
				confirmLabel="Limpar"
				cancelLabel="Cancelar"
			/>

			<DialogModal
				isOpen={confirmDeleteParcelaModalOpen}
				onClose={() => setConfirmDeleteParcelaModalOpen(false)}
				onConfirm={async () => {
					if (deleteMovimentoId !== null) {
						const temParcelas = await verificarParcelasAssociadas(deleteMovimentoId);

						if (temParcelas) {
							const parcelas = await listarParcelaFinanciamentos();
							for (const parcela of parcelas.filter((p) => p.idMovimentoBancario === deleteMovimentoId)) {
								await excluirParcelaFinanciamento(parcela.id);
							}
						}

						await excluirMovimentoBancario(deleteMovimentoId);

						setMovimentos((prev) => prev.filter((movimento) => movimento.id !== deleteMovimentoId));
						setConfirmDeleteParcelaModalOpen(false);
					}
				}}
				title="Atenção"
				type="warn"
				message="Este movimento possui parcelas associadas. Se continuar, as parcelas também serão excluídas. Deseja continuar?"
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			<SelectContaCorrente isOpen={modalContaIsOpen} onClose={() => setModalContaIsOpen(false)} onSelect={handleSelectConta} />

			<Transferir isOpen={modalTransferirIsOpen} onClose={() => setModalTransferirIsOpen(false)} onTransferir={handleTransferir} />

			<DetalhamentoMovimento isOpen={modalDetalheOpen} onClose={() => setModalDetalheOpen(false)} movimento={movimentoSelecionado} />

			<ConciliarPlano
				isOpen={modalConciliaIsOpen}
				onClose={() => {
					setModalConciliaIsOpen(false);
					setMovimentoParaConciliar(null);
					setMovimentosConciliacaoModal([]);
					fetchMovimentos(currentPage);
				}}
				movimento={movimentoParaConciliar || ({} as MovimentoBancario)}
				planos={planos}
				handleConcilia={handleConcilia}
				movimentosSelecionados={movimentosConciliacaoModal}
				onConciliaMultiplos={handleConciliaMultiplos}
			/>

			{historicoSelecionado && (
				<ConciliacaoOFXModal
					isOpen={modalConciliacaoHistoricoIsOpen}
					onClose={() => {
						setModalConciliacaoHistoricoIsOpen(false);
						setHistoricoSelecionado(null);
					}}
					movimentos={historicoSelecionado.movimentos}
					totalizadores={historicoSelecionado.totalizadores}
					idContaCorrenteExtrato={historicoSelecionado.idContaCorrente}
				/>
			)}

			{isExporting && (
				<div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 cursor-wait">
					<div className="bg-white px-6 py-4 rounded shadow-md flex items-center gap-4">
						<div className="loaderExcel border-4 border-orange-500 border-t-transparent rounded-full w-8 h-8 animate-spin"></div>
						<span className="text-orange-500 font-semibold text-2xl">Exportando Excel</span>
					</div>
				</div>
			)}

			{/* Modal de confirmação para limpar histórico */}
			<DialogModal
				isOpen={modalConfirmarLimparHistoricoIsOpen}
				onClose={() => setModalConfirmarLimparHistoricoIsOpen(false)}
				onConfirm={async () => {
					try {
						const usuarioLogado = JSON.parse(localStorage.getItem('user') || '{}');
						const idUsuario = usuarioLogado.id;

						if (idUsuario) {
							await limparHistoricoImportacoes(idUsuario);
							setHistoricoImportacoes([]);
							setDropdownHistoricoAberto(false);
							setModalConfirmarLimparHistoricoIsOpen(false);
							toast.success('Histórico de importações limpo com sucesso!');
						} else {
							toast.error('Usuário não identificado. Não foi possível limpar o histórico.');
						}
					} catch (error) {
						console.error('❌ Erro ao limpar histórico:', error);
						toast.error('Erro ao limpar histórico de importações');
					}
				}}
				title="Confirmar Limpeza"
				type="warn"
				message={
					'Tem certeza que deseja limpar todo o histórico de importações OFX? Esta ação não pode ser desfeita. Atenção: isso remove apenas o registro das importações; os movimentos bancários já importados continuarão no sistema. Para excluir os movimentos da conta, use "Excluir todos" na listagem.'
				}
				confirmLabel="Sim, Limpar"
				cancelLabel="Cancelar"
			/>

			{/* Modal para editar conta do histórico OFX */}
			<SelectContaCorrente
				isOpen={modalEditarContaIsOpen}
				onClose={() => {
					setModalEditarContaIsOpen(false);
					setHistoricoParaEditarConta(null);
				}}
				onSelect={(conta) => {
					handleAtualizarContaHistorico(conta.id);
				}}
			/>
		</div>
	);
};

export default MovimentoBancarioTable;
