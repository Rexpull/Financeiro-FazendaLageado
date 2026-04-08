import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faEquals, faMinus, faSearch, faSort, faSortDown, faSortUp, faTimes } from '@fortawesome/free-solid-svg-icons';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import { getBancoLogo } from '../../../Utils/bancoUtils';
import { buscarMovimentoBancarioById, salvarMovimentoBancario } from '../../../services/movimentoBancarioService';
import { listarContas } from '../../../services/contaCorrenteService';
import { listarPlanoContas } from '../../../services/planoContasService';
import { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';
import ConciliarPlano from './Modals/ConciliarPlano';
import { formatarData, formatarDataSemHora } from '../../../Utils/formatarData';
import { toast } from 'react-toastify';
import MultiSelectDropdown from '../../../components/MultiSelectDropdown';
import { listarCentroCustos } from '../../../services/centroCustosService';
import { PlanoConta } from '../../../../../backend/src/models/PlanoConta';
import { CentroCustos } from '../../../../../backend/src/models/CentroCustos';


Modal.setAppElement('#root');

type ColunaOrdenacaoOFX = 'data' | 'historico' | 'plano' | 'centro' | 'valor';

type ConciliacaoOFXModalProps = {
	isOpen: boolean;
	onClose: () => void;
	movimentos: MovimentoBancario[];
	totalizadores: {
		receitas: number;
		despesas: number;
		liquido: number;
		saldoFinal?: number;
		dtInicialExtrato: string;
		dtFinalExtrato: string;
	};
	/** Conta à qual o extrato pertence (ex.: ao reabrir pelo histórico de importações). Se omitido, usa a conta em localStorage (fluxo após importação). */
	idContaCorrenteExtrato?: number | null;
};

const ConciliacaoOFXModal = ({
	isOpen,
	onClose,
	movimentos,
	totalizadores,
	idContaCorrenteExtrato,
}: ConciliacaoOFXModalProps) => {
	const [contaSelecionada, setContaSelecionada] = useState<any | null>(null);
	const [status, setStatus] = useState<string>('todos');
	const [modalConciliaIsOpen, setModalConciliaIsOpen] = useState(false);
	const [movimentoParaConciliar, setMovimentoParaConciliar] = useState<MovimentoBancario | null>(null);
	const [planos, setPlanos] = useState<PlanoConta[]>([]);
	const [movimentosSendoConciliados, setMovimentosSendoConciliados] = useState<MovimentoBancario[]>([]);
	const [filtroDescricao, setFiltroDescricao] = useState('');
	const [filtroValor, setFiltroValor] = useState('');
	const [filtroDataInicio, setFiltroDataInicio] = useState('');
	const [filtroDataFim, setFiltroDataFim] = useState('');
	const [dropdownAberto, setDropdownAberto] = useState(false);
	const [movimentosSelecionados, setMovimentosSelecionados] = useState<MovimentoBancario[]>([]);
	const [tipoMovimentoSelecionado, setTipoMovimentoSelecionado] = useState<'C' | 'D' | null>(null);
	const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoConta[]>([]);
	const [centrosDisponiveis, setCentrosDisponiveis] = useState<CentroCustos[]>([]);
	const [planosSelecionados, setPlanosSelecionados] = useState<PlanoConta[]>([]);
	const [centrosSelecionados, setCentrosSelecionados] = useState<CentroCustos[]>([]);
	const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacaoOFX>('data');
	const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');
	const formatarISOParaInput = (iso: string): string => {
		if (!iso || isNaN(new Date(iso).getTime())) {
			return '';
		}
		return new Date(iso).toISOString().split('T')[0];
	};
	const filtroAtivo =
		filtroDescricao.trim() !== '' ||
		filtroValor.trim() !== '' ||
		filtroDataInicio !== formatarISOParaInput(totalizadores.dtInicialExtrato) ||
		filtroDataFim !== formatarISOParaInput(totalizadores.dtFinalExtrato) ||
		planosSelecionados.length > 0 ||
		centrosSelecionados.length > 0;

	const limparFiltros = () => {
		setFiltroDescricao('');
		setFiltroValor('');
		setFiltroDataInicio('');
		setFiltroDataFim('');
		setPlanosSelecionados([]);
		setCentrosSelecionados([]);
	};

	const adicionarPlano = (plano: PlanoConta) => {
		setPlanosSelecionados([...planosSelecionados, plano]);
	};

	const removerPlano = (id: number) => {
		setPlanosSelecionados(planosSelecionados.filter(p => p.id !== id));
	};

	const adicionarCentro = (centro: CentroCustos) => {
		setCentrosSelecionados([...centrosSelecionados, centro]);
	};

	const removerCentro = (id: number) => {
		setCentrosSelecionados(centrosSelecionados.filter(c => c.id !== id));
	};

	useEffect(() => {
		listarPlanoContas().then((planos) => {
			setPlanos(planos);
			setPlanosDisponiveis(planos.filter((p) => p.nivel === 3));
		});
		listarCentroCustos().then((centros) => {
			setCentrosDisponiveis(centros);
		});
	}, []);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		let cancelled = false;

		const aplicarContaDoExtrato = async () => {
			let conta: any = null;

			if (idContaCorrenteExtrato != null && idContaCorrenteExtrato > 0) {
				try {
					const contas = await listarContas();
					conta = contas.find((c: any) => c.id === idContaCorrenteExtrato) ?? null;
				} catch (e) {
					console.error('Erro ao listar contas para o extrato:', e);
				}
			} else {
				const storedConta = localStorage.getItem('contaSelecionada');
				if (storedConta) {
					try {
						conta = JSON.parse(storedConta);
					} catch {
						conta = null;
					}
				}
			}

			if (cancelled) {
				return;
			}

			setContaSelecionada(conta);

			setFiltroDataInicio(formatarISOParaInput(totalizadores.dtInicialExtrato));
			setFiltroDataFim(formatarISOParaInput(totalizadores.dtFinalExtrato));
			setMovimentosSendoConciliados(movimentos);
			setStatus('todos');
			setColunaOrdenacao('data');
			setDirecaoOrdenacao('asc');
		};

		void aplicarContaDoExtrato();

		return () => {
			cancelled = true;
		};
	}, [
		isOpen,
		idContaCorrenteExtrato,
		movimentos,
		totalizadores.dtInicialExtrato,
		totalizadores.dtFinalExtrato,
	]);

	useEffect(() => {
		const handleClickFora = (event) => {
			if (!event.target.closest('.dropdown-filtros')) {
				setDropdownAberto(false);
			}
		};

		if (dropdownAberto) {
			document.addEventListener('mousedown', handleClickFora);
		} else {
			document.removeEventListener('mousedown', handleClickFora);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickFora);
		};
	}, [dropdownAberto]);

	const isMovimentoPendente = useCallback((mov: MovimentoBancario) => {
		if (mov.tipoMovimento === 'C') {
			const temCentroUnico = mov.idCentroCustos !== null && mov.idCentroCustos !== undefined;
			const temCentroCustosList = mov.centroCustosList && mov.centroCustosList.length > 0;
			return !temCentroUnico && !temCentroCustosList;
		}

		const temPlanoUnico = mov.idPlanoContas !== null && mov.idPlanoContas !== undefined;
		const temResultadoList = mov.resultadoList && mov.resultadoList.length > 0;
		return !temPlanoUnico && !temResultadoList;
	}, []);

	const movimentosFiltrados = useMemo(() => {
		return (status === 'pendentes' ? movimentosSendoConciliados.filter(isMovimentoPendente) : movimentosSendoConciliados).filter((m) => {
			if (!m || !m.historico) {
				console.warn('Movimento inválido encontrado:', m);
				return false;
			}

			const descricaoMatch = filtroDescricao === '' || m.historico.toLowerCase().includes(filtroDescricao.toLowerCase());
			const valorMatch = filtroValor === '' || formatarMoeda(m.valor, 2).includes(filtroValor);
			const dataMatch =
				(!filtroDataInicio || new Date(m.dtMovimento) >= new Date(filtroDataInicio)) &&
				(!filtroDataFim || new Date(m.dtMovimento) <= new Date(filtroDataFim));

			const planoMatch = planosSelecionados.length === 0 || planosSelecionados.some((p) => p.id === m.idPlanoContas);
			const centroMatch = centrosSelecionados.length === 0 || centrosSelecionados.some((c) => c.id === m.idCentroCustos);

			return descricaoMatch && valorMatch && dataMatch && planoMatch && centroMatch;
		});
	}, [
		movimentosSendoConciliados,
		status,
		isMovimentoPendente,
		filtroDescricao,
		filtroValor,
		filtroDataInicio,
		filtroDataFim,
		planosSelecionados,
		centrosSelecionados,
	]);

	const textoPlanoOrdenacao = (mov: MovimentoBancario) => {
		if (mov.tipoMovimento !== 'D') {
			return '\u0000';
		}
		if (mov.resultadoList && mov.resultadoList.length > 1) {
			return 'Múltiplos Planos';
		}
		return planos.find((p) => p.id === mov.idPlanoContas)?.descricao || 'Selecione um Plano de Contas';
	};

	const textoCentroOrdenacao = (mov: MovimentoBancario) => {
		if (mov.centroCustosList && mov.centroCustosList.length > 1) {
			return 'Múltiplos Centros';
		}
		if (mov.centroCustosList && mov.centroCustosList.length > 0) {
			return (
				centrosDisponiveis.find((c) => c.id === mov.centroCustosList![0].idCentroCustos)?.descricao ||
				`Centro ${mov.centroCustosList[0].idCentroCustos}`
			);
		}
		return centrosDisponiveis.find((c) => c.id === mov.idCentroCustos)?.descricao || 'Selecione o Centro de Custos';
	};

	const movimentosOrdenados = useMemo(() => {
		const cmp = (a: MovimentoBancario, b: MovimentoBancario): number => {
			let r = 0;
			switch (colunaOrdenacao) {
				case 'data':
					r = new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime();
					break;
				case 'historico':
					r = (a.historico || '').localeCompare(b.historico || '', 'pt-BR', { sensitivity: 'base' });
					break;
				case 'plano':
					r = textoPlanoOrdenacao(a).localeCompare(textoPlanoOrdenacao(b), 'pt-BR', { sensitivity: 'base' });
					break;
				case 'centro':
					r = textoCentroOrdenacao(a).localeCompare(textoCentroOrdenacao(b), 'pt-BR', { sensitivity: 'base' });
					break;
				case 'valor':
					r = a.valor - b.valor;
					break;
				default:
					r = 0;
			}
			if (r !== 0) {
				return direcaoOrdenacao === 'asc' ? r : -r;
			}
			return (a.id ?? 0) - (b.id ?? 0);
		};
		return [...movimentosFiltrados].sort(cmp);
	}, [movimentosFiltrados, colunaOrdenacao, direcaoOrdenacao, planos, centrosDisponiveis]);

	const alternarOrdenacaoColuna = (col: ColunaOrdenacaoOFX) => {
		if (col === colunaOrdenacao) {
			setDirecaoOrdenacao((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setColunaOrdenacao(col);
			setDirecaoOrdenacao('asc');
		}
	};

	const iconeOrdenacaoColuna = (col: ColunaOrdenacaoOFX) => {
		if (colunaOrdenacao !== col) {
			return faSort;
		}
		return direcaoOrdenacao === 'asc' ? faSortUp : faSortDown;
	};

	const openModalConcilia = async (movimento: MovimentoBancario) => {
		try {
			setMovimentoParaConciliar(movimento);
			console.log('Movimento para conciliar:', movimento);
			setTimeout(() => {
				setModalConciliaIsOpen(true);
			}, 0);
		} catch (error) {
			console.error('Erro ao buscar dados completos:', error);
		}
	};

	const handleConcilia = async (data: any) => {
		try {
			console.log('data:', data);
			const movimentoAtualizado: MovimentoBancario = {
				...movimentoParaConciliar!,
				idPlanoContas: movimentoParaConciliar!.tipoMovimento === 'C' ? undefined : (data.idPlanoContas || undefined),
				modalidadeMovimento: data.modalidadeMovimento,
				idPessoa: data.idPessoa || undefined,
				idCentroCustos: data.idCentroCustos || undefined,
			};

			// Incluir centroCustosList se presente
			if (data.centroCustosList !== undefined) {
				movimentoAtualizado.centroCustosList = data.centroCustosList;
			}
			
			// Para receitas, garantir que resultadoList está vazio
			if (movimentoParaConciliar!.tipoMovimento === 'C') {
				movimentoAtualizado.resultadoList = [];
			}

			if (data.modalidadeMovimento === 'padrao') {
				movimentoAtualizado.idBanco = undefined;
				movimentoAtualizado.parcelado = false;
				movimentoAtualizado.numeroDocumento = undefined;
				movimentoAtualizado.idFinanciamento = undefined;
			}

			if (data.modalidadeMovimento === 'financiamento') {
				movimentoAtualizado.idBanco = data.idBanco || undefined;
				movimentoAtualizado.idPessoa = data.idPessoa || undefined;
				movimentoAtualizado.numeroDocumento = data.numeroDocumento || undefined;
				movimentoAtualizado.parcelado = data.parcelado || false;
				movimentoAtualizado.idFinanciamento = data.idFinanciamento || undefined;
				movimentoAtualizado.idCentroCustos = data.idCentroCustos || undefined;
				// Marcar como conciliado quando há financiamento associado
				if (data.idFinanciamento) {
					movimentoAtualizado.ideagro = true;
				}
			}

			if(data.modalidadeMovimento === 'transferencia') {	
				movimentoAtualizado.resultadoList = [];
				movimentoAtualizado.idFinanciamento = undefined;
				movimentoAtualizado.idBanco = undefined;
				movimentoAtualizado.parcelado = false;
				movimentoAtualizado.numeroDocumento = undefined;
				movimentoAtualizado.idCentroCustos = undefined;
			}

			console.log('Movimento atualizado:', movimentoAtualizado);
			const resultadoSalvo = await salvarMovimentoBancario(movimentoAtualizado);

			// Atualizar apenas o movimento específico na lista
			const novaLista = movimentosSendoConciliados.map((m) => {
				if (m.id === movimentoAtualizado.id || m.identificadorOfx === movimentoAtualizado.identificadorOfx) {
					return {
						...m,
						idPlanoContas: m.tipoMovimento === 'C' ? undefined : resultadoSalvo.idPlanoContas,
						modalidadeMovimento: resultadoSalvo.modalidadeMovimento,
						idPessoa: resultadoSalvo.idPessoa,
						idBanco: resultadoSalvo.idBanco,
						parcelado: resultadoSalvo.parcelado,
						numeroDocumento: resultadoSalvo.numeroDocumento,
						idFinanciamento: resultadoSalvo.idFinanciamento,
						idCentroCustos: resultadoSalvo.idCentroCustos,
						centroCustosList: resultadoSalvo.centroCustosList,
						resultadoList: m.tipoMovimento === 'C' ? [] : (resultadoSalvo.resultadoList || []),
						planosDescricao: m.tipoMovimento === 'C' ? '' : (planos.find((p) => p.id === data.idPlanoContas)?.descricao || ''),
					};
				}
				return m;
			});

			novaLista.sort((a, b) => new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime());
			setMovimentosSendoConciliados(novaLista);
			setMovimentoParaConciliar(null);
			setModalConciliaIsOpen(false);
		} catch (error) {
			console.error('Erro ao conciliar movimento:', error);
		}
	};

	const handleSelecionarMovimento = (movimento: MovimentoBancario) => {
		if (!tipoMovimentoSelecionado) {
			setTipoMovimentoSelecionado(movimento.tipoMovimento || null);
			setMovimentosSelecionados([movimento]);
		} else if (tipoMovimentoSelecionado === movimento.tipoMovimento) {
			const jaSelecionado = movimentosSelecionados.some(m => m.id === movimento.id);
			if (jaSelecionado) {
				const novosSelecionados = movimentosSelecionados.filter(m => m.id !== movimento.id);
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
			if (movimentosOrdenados.length === 0) {
				console.warn('Nenhum movimento disponível para seleção');
				e.target.checked = false;
				return;
			}

			const primeiroMovimento = movimentosOrdenados[0];

			if (!primeiroMovimento || !primeiroMovimento.tipoMovimento) {
				console.warn('Primeiro movimento inválido:', primeiroMovimento);
				e.target.checked = false;
				return;
			}

			const todosMesmoTipo = movimentosOrdenados.every((m) => m && m.tipoMovimento === primeiroMovimento.tipoMovimento);

			if (todosMesmoTipo) {
				setTipoMovimentoSelecionado(primeiroMovimento.tipoMovimento);
				setMovimentosSelecionados(movimentosOrdenados);
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
			setModalConciliaIsOpen(true);
		}
	};

	const handleConciliaMultiplos = async (data: any) => {
		try {
			const movimentosAtualizados: MovimentoBancario[] = [];
			const erros: number[] = [];

			// Com rateio por %, ConciliarPlano envia um array: um movimento completo por linha (resultadoList + centroCustosList).
			// Sem rateio %, envia um único objeto `dados` e iteramos movimentosSelecionados (igual TableMain).
			const movimentosParaProcessar = Array.isArray(data) ? data : movimentosSelecionados;

			for (const movimento of movimentosParaProcessar) {
				try {
					let movimentoAtualizado: MovimentoBancario;

					if (Array.isArray(data)) {
						movimentoAtualizado = movimento as MovimentoBancario;
					} else {
						movimentoAtualizado = {
							...movimento,
							modalidadeMovimento: data.modalidadeMovimento,
							idPlanoContas: movimento.tipoMovimento === 'C' ? undefined : (data.idPlanoContas || undefined),
							idPessoa: data.idPessoa || undefined,
							idBanco: data.idBanco || undefined,
							numeroDocumento: data.numeroDocumento || undefined,
							parcelado: data.parcelado || false,
							idFinanciamento: data.idFinanciamento || undefined,
							idUsuario: movimento.idUsuario || undefined,
							idCentroCustos: data.idCentroCustos || undefined,
							resultadoList: movimento.tipoMovimento === 'C' ? [] : (data.resultadoList || []),
						};
						if (data.centroCustosList !== undefined) {
							movimentoAtualizado.centroCustosList = data.centroCustosList;
						}
					}

					const resultadoSalvo = await salvarMovimentoBancario(movimentoAtualizado);
					movimentosAtualizados.push(resultadoSalvo);
				} catch (error) {
					console.error(`Erro ao conciliar movimento ${movimento.id}:`, error);
					erros.push(movimento.id);
				}
			}

			// Atualiza a lista de movimentos apenas com os campos alterados
			const movimentosAtualizadosList = movimentosSendoConciliados.map((mov) => {
				const atualizado = movimentosAtualizados.find(
					(m) => m.id === mov.id || m.identificadorOfx === mov.identificadorOfx,
				);

				if (atualizado) {
					const idPlanoRef =
						mov.tipoMovimento === 'C' ? undefined : atualizado.idPlanoContas ?? atualizado.resultadoList?.[0]?.idPlanoContas;
					return {
						...mov,
						idPlanoContas: mov.tipoMovimento === 'C' ? undefined : atualizado.idPlanoContas,
						modalidadeMovimento: atualizado.modalidadeMovimento,
						idPessoa: atualizado.idPessoa,
						idBanco: atualizado.idBanco,
						numeroDocumento: atualizado.numeroDocumento,
						parcelado: atualizado.parcelado,
						idFinanciamento: atualizado.idFinanciamento,
						idCentroCustos: atualizado.idCentroCustos,
						centroCustosList: atualizado.centroCustosList,
						resultadoList: mov.tipoMovimento === 'C' ? [] : (atualizado.resultadoList || []),
						planosDescricao:
							mov.tipoMovimento === 'C' ? '' : (planos.find((p) => p.id === idPlanoRef)?.descricao || ''),
					};
				}
				return mov;
			});

			setMovimentosSendoConciliados(movimentosAtualizadosList.sort((a, b) => 
				new Date(a.dtMovimento).getTime() - new Date(b.dtMovimento).getTime()
			));

			// Limpa a seleção
			setMovimentosSelecionados([]);
			setTipoMovimentoSelecionado(null);

			// Fecha o modal
			setMovimentoParaConciliar(null);
			setModalConciliaIsOpen(false);

			// Exibe mensagens de feedback
			if (erros.length > 0) {
				toast.error(`Erro ao conciliar ${erros.length} movimento(s). Verifique o console para mais detalhes.`);
			}
			if (movimentosAtualizados.length > 0) {
				toast.success(`${movimentosAtualizados.length} movimento(s) conciliado(s) com sucesso!`);
			}
		} catch (error) {
			console.error('Erro ao conciliar movimentos:', error);
			toast.error('Erro ao conciliar movimentos. Verifique o console para mais detalhes.');
		}
	};

	return (
		<div className="flex flex-col h-full">
			<Modal
				isOpen={isOpen}
				onRequestClose={onClose}
				shouldCloseOnOverlayClick={false}
				shouldCloseOnEsc={false}
				className="bg-white rounded-lg shadow-lg w-full mx-auto h-full"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			>
				{/* Cabeçalho */}
				<div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-t-lg border-b">
					<h2 className="text-xl font-semibold text-gray-800">Conciliação de Movimentos OFX - {movimentosSendoConciliados.length}</h2>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
						<FontAwesomeIcon icon={faTimes} size="xl" />
					</button>
				</div>

				<div className="h-full overflow-y-auto p-4 flex flex-col items-center gap-4 w-full">
					<div className="flex w-full justify-between items-center">
						<span className="font-bold text-2xl">Resumo do Extrato</span>
						{/* 🔹 Filtro por Status */}
						<div className="flex items-center justify-center gap-6">
							{filtroAtivo && (
								<button onClick={limparFiltros} className="text-blue-600 font-semibold text-md underline ml-4 :hover:text-blue-800">
									Limpar Filtros
								</button>
							)}
							<div className="relative">
								<button
									className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
									onClick={() => setDropdownAberto(!dropdownAberto)}
								>
									Filtrar Movimentos
									<FontAwesomeIcon icon={faSearch} />
								</button>

								{dropdownAberto && (
									<div className="absolute right-0 mt-2 w-[600px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4 space-y-3 dropdown-filtros">
										{/* Linha 1: Descrição e Valor */}
										<div className="grid grid-cols-2 gap-3">
											<div className="flex flex-col">
												<label className="font-medium text-gray-700 mb-1">Descrição</label>
												<input
													type="text"
													value={filtroDescricao}
													placeholder="Digite a descrição"
													onChange={(e) => setFiltroDescricao(e.target.value)}
													className="border rounded px-2 py-1"
												/>
											</div>

											<div className="flex flex-col">
												<label className="font-medium text-gray-700 mb-1">Valor</label>
												<input
													name="valor"
													className="w-full p-2 bg-white border border-gray-300 rounded"
													placeholder="R$ 0,00"
													value={filtroValor}
													onChange={(e) => setFiltroValor(e.target.value)}
												/>
											</div>
										</div>

										{/* Linha 2: Data Inicial e Data Final */}
										<div className="grid grid-cols-2 gap-3">
											<div className="flex flex-col">
												<label className="font-medium text-gray-700 mb-1">Data Inicial</label>
												<input
													type="date"
													value={filtroDataInicio}
													onChange={(e) => setFiltroDataInicio(e.target.value)}
													className="border rounded px-2 py-1"
												/>
											</div>

											<div className="flex flex-col">
												<label className="font-medium text-gray-700 mb-1">Data Final</label>
												<input
													type="date"
													value={filtroDataFim}
													onChange={(e) => setFiltroDataFim(e.target.value)}
													className="border rounded px-2 py-1"
												/>
											</div>
										</div>

										{/* Linha 3: Planos de Contas */}
										<div className="flex flex-col">
											<label className="font-medium text-gray-700 mb-1">
												Planos de Contas <span className="text-gray-500">(opcional)</span>
											</label>
											<MultiSelectDropdown
												items={planosDisponiveis}
												selectedItems={planosSelecionados}
												onSelect={adicionarPlano}
												onRemove={removerPlano}
												placeholder="Clique para selecionar planos de contas..."
												searchPlaceholder="Buscar plano de contas..."
											/>
										</div>

										{/* Linha 4: Centro de Custos */}
										<div className="flex flex-col">
											<label className="font-medium text-gray-700 mb-1">
												Centro de Custos <span className="text-gray-500">(opcional)</span>
											</label>
											<MultiSelectDropdown
												items={centrosDisponiveis}
												selectedItems={centrosSelecionados}
												onSelect={adicionarCentro}
												onRemove={removerCentro}
												placeholder="Clique para selecionar centros de custos..."
												searchPlaceholder="Buscar centro de custos..."
											/>
										</div>
									</div>
								)}
							</div>
							|
							<label className={`flex items-center gap-2 cursor-pointer transition-all ${status === 'todos' ? '' : 'text-gray-500'}`}>
								<input
									type="radio"
									name="status"
									value="todos"
									checked={status === 'todos'}
									onChange={() => setStatus('todos')}
									className="hidden"
								/>
								<div
									className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
										status === 'todos' ? 'bg-red-500 border-red-500' : 'border-gray-400'
									}`}
									style={{ padding: '0.60rem' }}
								>
									{status === 'todos' && (
										<span className="text-white text-md">
											<FontAwesomeIcon icon={faCheck} />
										</span>
									)}
								</div>
								<span>Mostrar todos</span>
							</label>
							<label className={`flex items-center gap-2 cursor-pointer transition-all ${status === 'pendentes' ? '' : 'text-gray-500'}`}>
								<input
									type="radio"
									name="status"
									value="pendentes"
									checked={status === 'pendentes'}
									onChange={() => setStatus('pendentes')}
									className="hidden"
								/>
								<div
									className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
										status === 'pendentes' ? 'bg-red-500 border-red-500' : 'border-gray-400'
									}`}
									style={{ padding: '0.60rem' }}
								>
									{status === 'pendentes' && (
										<span className="text-white text-md">
											<FontAwesomeIcon icon={faCheck} />
										</span>
									)}
								</div>
								<span>
									Pendentes{' '}
									<span className="text-lg font-semibold text-orange-600">
										({(movimentos as MovimentoBancario[]).filter(isMovimentoPendente).length})
									</span>
								</span>
							</label>
						</div>
					</div>

					{/* Totalizadores */}
					<div className="px-4 pt-2 pb-3 border rounded-lg w-full border-gray-300">
						<div className="flex justify-between items-start">
							<div className="flex items-center gap-4">
								<img src={getBancoLogo(contaSelecionada ? contaSelecionada.bancoCodigo : '')} alt="Logo Banco" className="w-12 h-12" />
								<div className="flex flex-col items-start">
									<span className="font-bold text-xl">{contaSelecionada ? contaSelecionada.bancoNome : ''} </span>
									<span className="text-md font-medium text-gray-600">
										{contaSelecionada ? contaSelecionada.numConta : ''} - {contaSelecionada ? contaSelecionada.responsavel : ''}{' '}
									</span>
								</div>
							</div>
							<div className="flex flex-col items-end">
								<span className="font-bold text-grey-900" style={{ lineHeight: '20px' }}>
									Período do Arquivo
								</span>
								<span className="text-sm font-medium text-gray-600">
									{formatarDataSemHora(totalizadores.dtInicialExtrato)} à {formatarDataSemHora(totalizadores.dtFinalExtrato)}
								</span>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-center text-lg font-bold">
							<div className="flex flex-col items-center">
								<span className="text-gray-600" style={{ fontSize: '0.950rem' }}>
									Valor das Receitas do Extrato
								</span>
								<span className="text-2xl font-bold text-blue-600">R$ {formatarMoeda(totalizadores.receitas, 2)}</span>
							</div>
							<div className="totalMinus">
								<FontAwesomeIcon icon={faMinus} />
							</div>
							<div className="flex flex-col items-center">
								<span className="text-gray-600" style={{ fontSize: '0.950rem' }}>
									Valor das Despesas do Extrato
								</span>
								<span className="text-2xl font-bold text-orange-600">R$ {formatarMoeda(totalizadores.despesas, 2)}</span>
							</div>
							<div className="totalEquals">
								<FontAwesomeIcon icon={faEquals} />
							</div>
							<div className="flex flex-col items-center">
								<span className="text-gray-600" style={{ fontSize: '0.950rem' }}>
									Valor Líquido do Extrato
								</span>
								<span
									className="text-2xl font-bold text-gray-600"
									style={{
										textDecoration: 'underline',
										textDecorationThickness: '3px',
										textDecorationColor: '#00c100',
										textUnderlineOffset: '4px',
									}}
								>
									R$ {formatarMoeda(totalizadores.liquido, 2)}
								</span>
							</div>
						</div>
					</div>

					{/* Tabela de Movimentos */}
					<div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200 w-full" style={{ marginBottom: '50px' }}>
						<div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '100%' }}>
							<table className="w-full border-collapse min-w-[900px]">
								<thead className="bg-gray-200 sticky top-0 z-10">
									<tr className="bg-gray-200">
										<th className="p-2 text-center w-12 min-w-[48px]">
											<input
												type="checkbox"
												checked={
													movimentosOrdenados.length > 0 &&
													movimentosOrdenados.every((m) => movimentosSelecionados.some((ms) => ms.id === m.id))
												}
												onChange={handleSelecionarTodos}
												className="w-4 h-4"
											/>
										</th>
										<th
											className="p-2 text-left min-w-[140px] cursor-pointer select-none hover:bg-gray-300/70 transition-colors"
											onClick={() => alternarOrdenacaoColuna('data')}
											title="Ordenar por data"
										>
											<span className="inline-flex items-center gap-1.5">
												Data
												<FontAwesomeIcon
													icon={iconeOrdenacaoColuna('data')}
													className={`text-xs ${colunaOrdenacao === 'data' ? 'text-gray-800' : 'text-gray-400'}`}
												/>
											</span>
										</th>
										<th
											className="p-2 text-left min-w-[200px] cursor-pointer select-none hover:bg-gray-300/70 transition-colors"
											onClick={() => alternarOrdenacaoColuna('historico')}
											title="Ordenar por histórico"
										>
											<span className="inline-flex items-center gap-1.5">
												Histórico
												<FontAwesomeIcon
													icon={iconeOrdenacaoColuna('historico')}
													className={`text-xs ${colunaOrdenacao === 'historico' ? 'text-gray-800' : 'text-gray-400'}`}
												/>
											</span>
										</th>
										<th
											className="p-2 text-center min-w-[180px] cursor-pointer select-none hover:bg-gray-300/70 transition-colors"
											onClick={() => alternarOrdenacaoColuna('plano')}
											title="Ordenar por plano de contas"
										>
											<span className="inline-flex items-center justify-center gap-1.5 w-full">
												Plano de Contas
												<FontAwesomeIcon
													icon={iconeOrdenacaoColuna('plano')}
													className={`text-xs ${colunaOrdenacao === 'plano' ? 'text-gray-800' : 'text-gray-400'}`}
												/>
											</span>
										</th>
										<th
											className="p-2 text-center min-w-[180px] cursor-pointer select-none hover:bg-gray-300/70 transition-colors"
											onClick={() => alternarOrdenacaoColuna('centro')}
											title="Ordenar por centro de custos"
										>
											<span className="inline-flex items-center justify-center gap-1.5 w-full">
												Centro de Custos
												<FontAwesomeIcon
													icon={iconeOrdenacaoColuna('centro')}
													className={`text-xs ${colunaOrdenacao === 'centro' ? 'text-gray-800' : 'text-gray-400'}`}
												/>
											</span>
										</th>
										<th
											className="p-2 text-center min-w-[120px] cursor-pointer select-none hover:bg-gray-300/70 transition-colors"
											onClick={() => alternarOrdenacaoColuna('valor')}
											title="Ordenar por valor"
										>
											<span className="inline-flex items-center justify-center gap-1.5 w-full">
												Valor
												<FontAwesomeIcon
													icon={iconeOrdenacaoColuna('valor')}
													className={`text-xs ${colunaOrdenacao === 'valor' ? 'text-gray-800' : 'text-gray-400'}`}
												/>
											</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{movimentosFiltrados.length === 0 ? (
										<tr>
											<td colSpan={6} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
												Nenhum movimento encontrado!
											</td>
										</tr>
									) : (
										movimentosOrdenados.map((mov) => (
											<tr key={mov.id ?? `ofx-${mov.identificadorOfx}`} className="border-b">
												<td className="p-2 text-center">
													<input
														type="checkbox"
														checked={movimentosSelecionados.some(m => m.id === mov.id)}
														onChange={() => handleSelecionarMovimento(mov)}
														className="w-4 h-4"
														disabled={tipoMovimentoSelecionado !== null && tipoMovimentoSelecionado !== mov.tipoMovimento}
													/>
												</td>
												<td className="p-2 text-left min-w-[140px]">{formatarData(mov.dtMovimento)}</td>
												<td className="p-2 text-left min-w-[200px] max-w-[300px] truncate" title={mov.historico}>
													{mov.historico}
												</td>
												{/* Coluna Plano de Contas */}
												<td
													className={`p-2 text-center truncate min-w-[180px] max-w-[220px] ${
														mov.tipoMovimento === 'D'
															? 'cursor-pointer underline hover:text-gray-500' + ((mov.resultadoList && mov.resultadoList.length > 1)
																? ' text-blue-600 font-semibold'
																: !planos.find((p) => p.id === mov.idPlanoContas)
																? ' text-orange-500 font-semibold'
																: '')
															: 'text-gray-400'
													}`}
													style={{ textUnderlineOffset: '2px' }}
													onClick={() => mov.tipoMovimento === 'D' && openModalConcilia(mov)}
													title={mov.tipoMovimento === 'C' ? 'Receitas não usam Plano de Contas' : ''}
												>
													{mov.tipoMovimento === 'D'
														? ((mov.resultadoList && mov.resultadoList.length > 1)
															? 'Múltiplos Planos'
															: planos.find((p) => p.id === mov.idPlanoContas)?.descricao || 'Selecione um Plano de Contas')
														: '-'
													}
												</td>
												{/* Coluna Centro de Custos */}
												<td
													className={`p-2 text-center cursor-pointer underline truncate hover:text-gray-500 min-w-[180px] max-w-[220px] ${
														mov.centroCustosList && mov.centroCustosList.length > 1
															? 'text-blue-600 font-semibold'
															: !centrosDisponiveis.find((c) => c.id === mov.idCentroCustos) && !(mov.centroCustosList && mov.centroCustosList.length > 0)
															? 'text-orange-500 font-semibold'
															: ''
													}`}
													style={{ textUnderlineOffset: '2px' }}
													onClick={() => openModalConcilia(mov)}
												>
													{mov.centroCustosList && mov.centroCustosList.length > 1
															? 'Múltiplos Centros'
															: mov.centroCustosList && mov.centroCustosList.length > 0
															? centrosDisponiveis.find((c) => c.id === mov.centroCustosList![0].idCentroCustos)?.descricao || `Centro ${mov.centroCustosList[0].idCentroCustos}`
														: centrosDisponiveis.find((c) => c.id === mov.idCentroCustos)?.descricao || 'Selecione o Centro de Custos'
													}
												</td>

												<td className={`p-2 font-medium text-center ${mov.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
													R$ {formatarMoeda(mov.valor, 2)}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* Botão fixo de conciliação */}
				{movimentosSelecionados.length > 0 && (
					<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50" style={{ boxShadow: '0px -2px 10px 0px rgba(0, 0, 0, 0.1)' }}>
						<div className="container mx-auto flex justify-between items-center">
							<span className="text-gray-600 font-semibold text-lg">
								{movimentosSelecionados.length} movimento(s) selecionado(s)
							</span>
							<button
								onClick={handleConciliarSelecionados}
								className="bg-blue-600 text-white text-lg px-6 py-2 font-semibold rounded-lg hover:bg-blue-700 transition-colors"
							>
								Conciliar {movimentosSelecionados.length} Movimento(s)
							</button>
						</div>
					</div>
				)}

				{/* Rodapé */}
				<div className="p-4 flex justify-end border-t">
					<button className="bg-red-500 text-white font-semibold px-5 py-2 rounded hover:bg-red-600" onClick={onClose}>
						Fechar
					</button>
				</div>
			</Modal>

			{/* Modal de conciliação */}
			{movimentoParaConciliar && (
				<ConciliarPlano
					isOpen={!!movimentoParaConciliar}
					onClose={() => setMovimentoParaConciliar(null)}
					movimento={movimentoParaConciliar}
					planos={planos}
					handleConcilia={handleConcilia}
					movimentosSelecionados={movimentosSelecionados}
					onConciliaMultiplos={handleConciliaMultiplos}
				/>
			)}
		</div>
	);
};

export default ConciliacaoOFXModal;
