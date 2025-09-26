import React, { useEffect, useState, useRef } from 'react';
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
} from '@fortawesome/free-solid-svg-icons';
import {
	listarMovimentosBancarios,
	salvarMovimentoBancario,
	excluirMovimentoBancario,
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
import { Tooltip } from 'react-tooltip';
import ConciliarPlano from './Modals/ConciliarPlano';
import { formatarData } from '../../../Utils/formatarData';
import { buscarBancoById } from '../../../services/bancoService';
import { buscarPessoaById } from '../../../services/pessoaService';
import { toast } from 'react-toastify';
import { TotalizadoresOFX } from '../../../Utils/parseOfxFile';
import ConciliacaoOFXModal from './ConciliacaoOFX';
import { useLocation } from 'react-router-dom';
import { listarHistoricoImportacoes, limparHistoricoImportacoes } from '../../../services/historicoImportacaoOFXService';

const MovimentoBancarioTable: React.FC = () => {
	const location = useLocation();
	const [movimentos, setMovimentos] = useState<MovimentoBancario[]>([]);
	const [filteredMovimentos, setFilteredMovimentos] = useState<MovimentoBancario[]>([]);
	const [movimentosFiltradosComSaldo, setMovimentosFiltradosComSaldo] = useState<MovimentoBancario[]>([]);
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
	const [deleteMovimentoId, setDeleteMovimentoId] = useState<number | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuAtivoId, setMenuAtivoId] = useState<number | null>(null);
	const [planos, setPlanos] = useState<any[]>([]);
	const [isExporting, setIsExporting] = useState(false);

	const [dataInicio, setDataInicio] = useState<string>('');
	const [dataFim, setDataFim] = useState<string>('');
	const [statusFiltro, setStatusFiltro] = useState<string>('todos');

	const [modalConciliaIsOpen, setModalConciliaIsOpen] = useState(false);
	const [movimentoParaConciliar, setMovimentoParaConciliar] = useState<MovimentoBancario | null>(null);

	const [modalDetalheOpen, setModalDetalheOpen] = useState(false);
	const [movimentoSelecionado, setMovimentoSelecionado] = useState<MovimentoBancario | null>(null);

	const [historicoImportacoes, setHistoricoImportacoes] = useState<any[]>([]);
	const [dropdownHistoricoAberto, setDropdownHistoricoAberto] = useState(false);
	const [modalConciliacaoHistoricoIsOpen, setModalConciliacaoHistoricoIsOpen] = useState(false);
	const [historicoSelecionado, setHistoricoSelecionado] = useState<{
		movimentos: MovimentoBancario[];
		totalizadores: TotalizadoresOFX;
	} | null>(null);
	
	// Modal de confirmação para limpar histórico
	const [modalConfirmarLimparHistoricoIsOpen, setModalConfirmarLimparHistoricoIsOpen] = useState(false);
	
	// Estados para edição de conta do histórico OFX
	const [modalEditarContaIsOpen, setModalEditarContaIsOpen] = useState(false);
	const [historicoParaEditarConta, setHistoricoParaEditarConta] = useState<any | null>(null);

	// 🔹 Paginação
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(15);

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

	useEffect(() => {
		const now = new Date();
		const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
		const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
		console.log('setando inicio:' + inicio);
		console.log('setando fim:' + fim);
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

	useEffect(() => {
		if (contaSelecionada) {
			fetchMovimentos();
		}

		listarPlanoContas().then((planos) => setPlanos(planos));
	}, [contaSelecionada]);

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

	useEffect(() => {
		if (contaSelecionada && dataInicio && dataFim && movimentos.length > 0) {
			const lista = gerarListaComSaldos(dataInicio, dataFim);
			setFilteredMovimentos(lista);
			setMovimentosFiltradosComSaldo(lista);
			setCurrentPage(1);
			setIsLoading(false);
		}
	}, [contaSelecionada, dataInicio, dataFim, movimentos]);

	// useEffect adicional para garantir atualização quando movimentos mudarem
	useEffect(() => {
		if (contaSelecionada && dataInicio && dataFim && movimentos.length > 0) {
			const lista = gerarListaComSaldos(dataInicio, dataFim);
			
			if (statusFiltro === 'pendentes') {
				const apenasPendentes = lista.filter((m) => m.idPlanoContas === null || m.idPlanoContas === 0);
				setFilteredMovimentos(apenasPendentes);
				setMovimentosFiltradosComSaldo(apenasPendentes);
			} else {
				setFilteredMovimentos(lista);
				setMovimentosFiltradosComSaldo(lista);
			}
		}
	}, [movimentos, statusFiltro]);

	const fetchMovimentos = async () => {
		setIsLoading(true);
		try {
			const data = await listarMovimentosBancarios();
			atualizarListasMovimentos(data);
			setCurrentPage(1);
		} catch (error) {
			console.error('Erro ao buscar Movimentos Bancários:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const exportarParaExcel = async () => {
		try {
			setAcoesMenu(false);
			setIsExporting(true);
			console.log('movimentos sendo exportados pro Excel', movimentosFiltradosComSaldo);

			const dadosCompletos = await Promise.all(
				movimentosFiltradosComSaldo.filter((m) => m.id > 0).map((m) => buscarMovimentoBancarioById(m.id))
			);

			const dadosParaExportar = await Promise.all(
				dadosCompletos.map(async (mov) => {
					const multiplosPlanos = mov.resultadoList && mov.resultadoList.length > 1;
					const planoDescricao = multiplosPlanos ? 'Múltiplos Planos' : planos.find((p) => p.id === mov.idPlanoContas)?.descricao || '';

					let bancoNome = '';
					if (mov.idBanco) {
						const banco = await buscarBancoById(mov.idBanco);
						bancoNome = banco?.nome || '';
					}

					let pessoaNome = '';
					if (mov.idPessoa) {
						const pessoa = await buscarPessoaById(mov.idPessoa);
						pessoaNome = pessoa?.nome || '';
					}

					const pessoa = mov.idPessoa ? buscarPessoaById(mov.idPessoa) : '';

					return {
						'Data do Movimento': formatarData(mov.dtMovimento),
						Histórico: mov.historico,
						Tipo: mov.tipoMovimento === 'C' ? 'Crédito' : 'Débito',
						Modalidade: mov.modalidadeMovimento,
						'Plano de Contas': planoDescricao,
						Rateado: multiplosPlanos ? 'Sim' : 'Não',
						'Valor R$': mov.valor,
						IdeAgri: mov.ideagro ? 'Sim' : 'Não',
						Pessoa: pessoaNome,
						Banco: bancoNome,
						Parcelado: mov.parcelado ? 'Sim' : 'Não',
						'Nº Documento': mov.modalidadeMovimento === 'financiamento' ? mov.numeroDocumento : '',
					};
				})
			);

			const wb = XLSX.utils.book_new();
			const contaCorrente = `${contaSelecionada?.numConta} - ${contaSelecionada?.bancoNome} - ${contaSelecionada?.responsavel}`;
			const periodo = `${dataInicio} até ${dataFim}`;
			const dataExportacao = new Date().toLocaleString();

			const header = [
				['Exportado em:', dataExportacao],
				['Período:', periodo],
				['Conta Corrente:', contaCorrente],
				['Tipo de Consulta:', statusFiltro === 'pendentes' ? 'Apenas Pendentes' : 'Todos os Movimentos'],
				[],
			];

			const ws = XLSX.utils.aoa_to_sheet(header);

			XLSX.utils.sheet_add_json(ws, dadosParaExportar, {
				origin: 'A6',
				skipHeader: false,
			});

			XLSX.utils.book_append_sheet(wb, ws, 'Movimentos');
			XLSX.writeFile(wb, `MovimentosBancarios_${dataInicio}_a_${dataFim}.xlsx`);
			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel. Verifique os dados e tente novamente.');
		} finally {
			setIsExporting(false);
		}
	};

	const gerarListaComSaldos = (dataInicio: string, dataFim: string) => {
		if (!contaSelecionada) return [];

		const movimentosConta = movimentos
			.filter((m) => m.idContaCorrente === contaSelecionada.id)
			.sort((a, b) => new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime());

		const dataInicioDate = new Date(dataInicio + 'T00:00:00');
		const dataFimDate = new Date(dataFim + 'T23:59:59');

		const movimentosAnteriores = movimentosConta.filter((m) => new Date(m.dtMovimento) < dataInicioDate);
		const movimentosPeriodo = movimentosConta.filter(
			(m) => new Date(m.dtMovimento) >= dataInicioDate && new Date(m.dtMovimento) <= dataFimDate
		);

		const saldoAnterior = movimentosAnteriores.reduce((acc, m) => acc + m.valor, 0);

		let saldoAtual = saldoAnterior;

		const movimentosCalculados = movimentosPeriodo.map((mov) => {
			saldoAtual += mov.valor;
			return {
				...mov,
				saldo: saldoAtual,
			};
		});

		const saldoFinal = saldoAtual;

		const registroSaldoAnterior = {
			id: -1,
			dtMovimento: dataInicio.slice(0, 10) + ' 00:00:00',
			historico: 'Saldo Anterior',
			idPlanoContas: 0,
			valor: saldoAnterior,
			saldo: saldoAnterior,
			ideagro: false,
			idContaCorrente: contaSelecionada.id,
			identificadorOfx: '',
			criadoEm: new Date().toISOString(),
			atualizadoEm: new Date().toISOString(),
		};

		const registroSaldoFinal = {
			id: -2,
			dtMovimento: dataFim.slice(0, 10) + ' 23:59:59',
			historico: 'Saldo Final do período',
			idPlanoContas: 0,
			valor: saldoFinal,
			saldo: saldoFinal,
			ideagro: false,
			idContaCorrente: contaSelecionada.id,
			identificadorOfx: '',
			criadoEm: new Date().toISOString(),
			atualizadoEm: new Date().toISOString(),
		};

		return [registroSaldoAnterior, ...movimentosCalculados, registroSaldoFinal];
	};

	const handleImportFile = (file: File) => {
		console.log('Arquivo importado:', file);
		// Aqui você pode processar o arquivo OFX
	};

	const handleSearchFilters = (filters: { dataInicio: string; dataFim: string; status: string }) => {
		setDataInicio(filters.dataInicio);
		setDataFim(filters.dataFim);
		setStatusFiltro(filters.status);

		atualizarListasMovimentos(movimentos, filters);
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
			fetchMovimentos();
		} catch (error) {
			console.error('Erro ao transferir:', error);
		}
	};

	const openModalConcilia = async (movimento: MovimentoBancario) => {
		try {
			const movimentoCompleto = await buscarMovimentoBancarioById(movimento.id);
			console.log('Movimento completo:', movimentoCompleto);
			setMovimentoParaConciliar(movimentoCompleto);
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
			};
			console.log('Movimento a ser salvo:', movimentoCompleto);

			const movimentoSalvo = await salvarMovimentoBancario(movimentoCompleto);

			console.log('movimentoSalvo', movimentoSalvo);

			if (movimentoSalvo !== undefined && movimentoSalvo !== null) {
				setMovimentos((prev) => [...prev, movimentoSalvo]);
			}

			setModalIsOpen(false);
			fetchMovimentos();
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

	const handleDelete = async (id: number) => {
		const temParcelas = await verificarParcelasAssociadas(id);
		setDeleteMovimentoId(id);

		if (temParcelas) {
			setConfirmDeleteParcelaModalOpen(true);
		} else {
			setConfirmModalOpen(true);
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

			await fetchMovimentos();
		} catch (error) {
			console.error('Erro ao atualizar status do movimento:', error);
		}
	};

	const atualizarListasMovimentos = (novaLista: MovimentoBancario[], filtros?: { dataInicio: string; dataFim: string; status: string }) => {
		setMovimentos(novaLista);

		const dataInicioAtual = filtros?.dataInicio || dataInicio;
		const dataFimAtual = filtros?.dataFim || dataFim;
		const statusAtual = filtros?.status || statusFiltro;

		const listaComSaldos = gerarListaComSaldos(dataInicioAtual, dataFimAtual);

		if (statusAtual === 'pendentes') {
			const apenasPendentes = listaComSaldos.filter((m) => m.idPlanoContas === null || m.idPlanoContas === 0);
			setFilteredMovimentos(apenasPendentes);
			setMovimentosFiltradosComSaldo(apenasPendentes);
		} else {
			setFilteredMovimentos(listaComSaldos);
			setMovimentosFiltradosComSaldo(listaComSaldos);
		}
	};

	const handleConcilia = async (data: any) => {
		try {
			console.log('🔍 Iniciando conciliação com dados:', data);

			// Armazenar a página atual em uma constante
			const paginaAtual = currentPage;

			const movimentoAtualizado: MovimentoBancario = {
				...movimentoParaConciliar!,
				idPlanoContas: data.idPlanoContas,
				modalidadeMovimento: data.modalidadeMovimento,
				idPessoa: data.idPessoa ?? null,
			};

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
			}

			if (data.modalidadeMovimento === 'transferencia') {
				movimentoAtualizado.idBanco = undefined;
				movimentoAtualizado.parcelado = false;
				movimentoAtualizado.numeroDocumento = undefined;
				movimentoAtualizado.idFinanciamento = undefined;
				movimentoAtualizado.resultadoList = [];
			}

			const movimentoSalvo = await salvarMovimentoBancario(movimentoAtualizado);

			// Atualizar apenas a lista principal de movimentos
			// O useEffect cuidará de recalcular as listas filtradas
			setMovimentos((prevMovimentos) => 
				prevMovimentos.map((mov) => (mov.id === movimentoSalvo.id ? movimentoSalvo : mov))
			);

			setCurrentPage(paginaAtual);
			setModalConciliaIsOpen(false);
			
			console.log('✅ Movimento conciliado com sucesso:', movimentoSalvo);
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
			await listarMovimentosBancarios().then(data => {
				atualizarListasMovimentos(data);
			});
			
		} catch (error) {
			console.error('❌ Erro ao atualizar conta dos movimentos:', error);
			toast.error('Erro ao atualizar conta dos movimentos');
		} finally {
			setIsSaving(false);
		}
	};

	const indexOfLastItem = currentPage * itemsPerPage;
	const indexOfFirstItem = indexOfLastItem - itemsPerPage;
	const currentItems = movimentosFiltradosComSaldo.slice(indexOfFirstItem, indexOfLastItem);
	const totalPages = Math.ceil(movimentosFiltradosComSaldo.length / itemsPerPage);

	return (
		<div>
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
								<button>
									<p
										className="font-bold text-sm rounded text-left text-gray-800 mb-1 px-2 py-1 hover:bg-gray-100"
										style={{ opacity: '0.5' }}
									>
										<FontAwesomeIcon icon={faFilePdf} className="mr-2" />
										Imprimir PDF
									</p>
								</button>
								<button onClick={exportarParaExcel} disabled={movimentosFiltradosComSaldo && movimentosFiltradosComSaldo.length <= 2}>
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
									>
										Limpar
									</button>
								</div>
								{historicoImportacoes.length === 0 ? (
									<div className="text-sm text-gray-600 px-4 py-2">Nenhum histórico encontrado.</div>
								) : (
									historicoImportacoes.map((item, index) => (
										<div
											key={index}
											className="block w-full text-left text-sm border-b border-gray-200 px-4 py-2 hover:bg-gray-100"
										>
											<div className="flex justify-between items-start gap-2">
												<button
													onClick={async () => {
														try {
															// Busca os movimentos atualizados do banco de dados
															const movimentosAtualizados = await buscarMovimentosPorIds(item.idMovimentos);
															
															setHistoricoSelecionado({ 
																movimentos: movimentosAtualizados, 
																totalizadores: item.totalizadores 
															});
															setModalConciliacaoHistoricoIsOpen(true);
															setDropdownHistoricoAberto(false);
														} catch (error) {
															console.error('Erro ao buscar movimentos atualizados:', error);
															toast.error('Erro ao carregar movimentos do histórico');
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
							<table className="w-full border-collapse">
								<thead>
									<tr className="bg-gray-200">
										<th className="pl-5 p-2 text-left truncate">Data do Movimento</th>
										<th className="p-2 text-left">Histórico</th>
										<th className="p-2 text-center">Plano Contas</th>
										<th className="p-2 text-center">Valor R$</th>
										<th className="p-2 text-center">Saldo R$</th>
										<th className="p-2 pr-11 text-right">IdeAgri</th>
									</tr>
								</thead>
							<tbody>
								{currentItems.length === 2 ? (
									<tr>
										<td colSpan={6} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
											Nenhum movimento encontrado!
										</td>
									</tr>
								) : (
									currentItems.map((movBancario) => {
										const isSaldo = movBancario.id === -1 || movBancario.id === -2;
										return (
											<tr key={movBancario.id} className="border-b">
												<td className="pl-5 p-2 text-left truncate">{formatarData(movBancario.dtMovimento)}</td>
												<td className="p-2 text-left max-w-[490px] truncate">
													<span id={`tooltip-${movBancario.id}`}>{movBancario.historico}</span>
													<Tooltip anchorId={`tooltip-${movBancario.id}`} place="top" content={movBancario.historico} />
												</td>

												{!isSaldo ? (
													<>
														<td
															className={`p-2 text-center cursor-pointer underline truncate hover:text-gray-500 max-w-[220px] ${
																movBancario.resultadoList && movBancario.resultadoList.length > 1
																	? 'text-blue-600 font-semibold'
																	: !planos.find((p) => p.id === movBancario.idPlanoContas)
																	? 'text-orange-500 font-semibold'
																	: ''
															}`}
															style={{ textUnderlineOffset: '2px' }}
															onClick={() => openModalConcilia(movBancario)}
														>
															{movBancario.resultadoList && movBancario.resultadoList.length > 1
																? 'Múltiplos Planos'
																: planos.find((p) => p.id === movBancario.idPlanoContas)?.descricao || 'Selecione um Plano de Contas'}
														</td>
														<td
															className={`p-2 text-center font-semibold capitalize ${
																movBancario.valor >= 0 ? 'text-green-600' : 'text-red-600'
															}`}
														>
															{formatarMoeda(movBancario.valor)}
														</td>
														<td className="p-2 text-center capitalize">{formatarMoeda(movBancario.saldo)}</td>
														<td className="p-2 justify-end mr-1 capitalize flex items-center gap-6 relative">
															<label className="relative inline-flex items-center cursor-pointer">
																<input
																	type="checkbox"
																	className="sr-only peer"
																	checked={movBancario.ideagro}
																	onChange={() => handleStatusChange(movBancario.id, !movBancario.ideagro)}
																/>
																<div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
															</label>

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
																	<button
																		className="w-full px-4 py-2 hover:bg-red-100 text-left text-red-600"
																		onClick={() => handleDelete(movBancario.id)}
																	>
																		<FontAwesomeIcon icon={faTrash} className="mr-1" /> Excluir
																	</button>
																</div>
															)}
														</td>
													</>
												) : (
													<>
														<td className="p-2"></td>
														<td className="p-2"></td>
														<td
															className={`p-2 text-center font-semibold capitalize ${
																movBancario.saldo >= 0 ? 'text-green-600' : 'text-red-600'
															}`}
														>
															{formatarMoeda(movBancario.saldo)}
														</td>
													</>
												)}
											</tr>
										);
									})
								)}
							</tbody>
							</table>
						</div>

						{/* Cards Mobile */}
						<div className="lg:hidden">
							{currentItems.length === 2 ? (
								<div className="text-center py-8 text-gray-600 text-lg font-medium">
									Nenhum movimento encontrado!
								</div>
							) : (
								<div className="space-y-3 p-4">
									{currentItems.map((movBancario) => {
										const isSaldo = movBancario.id === -1 || movBancario.id === -2;
										return (
											<div key={movBancario.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
												{/* Header do card */}
												<div className="flex justify-between items-start mb-3">
													<div className="flex-1">
														<div className="text-sm font-medium text-gray-900">
															{formatarData(movBancario.dtMovimento)}
														</div>
														<div className="text-xs text-gray-500 mt-1">
															{movBancario.historico}
														</div>
													</div>
													{!isSaldo && (
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
													)}
												</div>

												{/* Conteúdo do card */}
												{!isSaldo ? (
													<>
														<div className="grid grid-cols-2 gap-3 mb-3">
															<div>
																<div className="text-xs text-gray-500">Plano de Contas</div>
																<div 
																	className={`text-sm cursor-pointer underline hover:text-gray-500 ${
																		movBancario.resultadoList && movBancario.resultadoList.length > 1
																			? 'text-blue-600 font-semibold'
																			: !planos.find((p) => p.id === movBancario.idPlanoContas)
																			? 'text-orange-500 font-semibold'
																			: ''
																	}`}
																	onClick={() => openModalConcilia(movBancario)}
																>
																	{movBancario.resultadoList && movBancario.resultadoList.length > 1
																		? 'Múltiplos Planos'
																		: planos.find((p) => p.id === movBancario.idPlanoContas)?.descricao || 'Selecione um Plano de Contas'}
																</div>
															</div>
															<div>
																<div className="text-xs text-gray-500">Valor</div>
																<div className={`text-sm font-semibold ${
																	movBancario.valor >= 0 ? 'text-green-600' : 'text-red-600'
																}`}>
																	{formatarMoeda(movBancario.valor)}
																</div>
															</div>
														</div>
														<div>
															<div className="text-xs text-gray-500">Saldo</div>
															<div className="text-sm font-medium">{formatarMoeda(movBancario.saldo)}</div>
														</div>
													</>
												) : (
													<div>
														<div className="text-xs text-gray-500">Saldo</div>
														<div className={`text-lg font-semibold ${
															movBancario.saldo >= 0 ? 'text-green-600' : 'text-red-600'
														}`}>
															{formatarMoeda(movBancario.saldo)}
														</div>
													</div>
												)}

												{/* Menu de ações mobile */}
												{menuAtivoId === movBancario.id && !isSaldo && (
													<div className="mt-3 pt-3 border-t border-gray-200">
														<div className="flex gap-2">
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
										);
									})}
								</div>
							)}
						</div>
						{/* 🔹 Paginação */}
						<div className="flex flex-col sm:flex-row justify-between items-center my-4 mx-2 gap-3">
							<span className="text-gray-800 text-sm sm:text-base">
								{movimentos.length} <span className="text-xs sm:text-sm">Registros</span>
							</span>

							<div className="flex items-center gap-2">
								<button
									className="px-2 sm:px-3 py-1 border rounded text-sm"
									disabled={currentPage === 1}
									onClick={() => setCurrentPage(currentPage - 1)}
								>
									<FontAwesomeIcon icon={faChevronLeft} />
								</button>

								<span className="px-2 sm:px-3 py-1 text-sm">
									{currentPage} / {totalPages}
								</span>

								<button
									className="px-2 sm:px-3 py-1 border rounded text-sm"
									disabled={currentPage === totalPages}
									onClick={() => setCurrentPage(currentPage + 1)}
								>
									<FontAwesomeIcon icon={faChevronRight} />
								</button>

								<select
									className="border border-gray-400 p-1 rounded text-sm"
									value={itemsPerPage}
									onChange={(e) => setItemsPerPage(Number(e.target.value))}
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
			<LancamentoManual isOpen={modalIsOpen} onClose={() => setModalIsOpen(false)} handleSave={handleSave} isSaving={isSaving} />

			<ImportOFXModal isOpen={modalImportOFXIsOpen} onClose={() => setModalImportOFXIsOpen(false)} handleImport={handleImportFile} />

			<FiltroMovimentosModal
				isOpen={modalFiltroMovimentosIsOpen}
				onClose={() => setModalFiltroMovimentosIsOpen(false)}
				handleSearch={handleSearchFilters}
				dataInicio={dataInicio}
				dataFim={dataFim}
				status={statusFiltro}
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
				onClose={() => setModalConciliaIsOpen(false)}
				movimento={movimentoParaConciliar || ({} as MovimentoBancario)}
				planos={planos}
				handleConcilia={handleConcilia}
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
				message="Tem certeza que deseja limpar todo o histórico de importações OFX? Esta ação não pode ser desfeita."
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
