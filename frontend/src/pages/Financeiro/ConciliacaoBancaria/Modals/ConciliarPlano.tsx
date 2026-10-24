import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faTimes,
	faSave,
	faCheck,
	faMoneyBillTransfer,
	faPlus,
	faEdit,
	faMoneyBillWave,
	faChevronDown,
	faChevronRight,
	faPen,
} from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { listarPlanoContas } from '../../../../services/planoContasService';
import { listarBancos } from '../../../../services/bancoService';
import { listarPessoas } from '../../../../services/pessoaService';
import { listarCentroCustos } from '../../../../services/centroCustosService';
import { listarParametros } from '../../../../services/parametroService';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { Parametro } from '../../../../../../backend/src/models/Parametro';
import { Banco } from '../../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../../backend/src/models/Pessoa';
import { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import { Resultado } from '../../../../../../backend/src/models/Resultado';
import ModalRateioCentroCustos from './ModalRateioCentroCustos';
import ModalRateioPlano from './ModalRateioPlano';
import ModalFinanciamento from '../../Financiamento/ModalFinanciamento';
import { listarFinanciamentos, salvarFinanciamento } from '../../../../services/financiamentoService';
import { Financiamento } from '../../../../../../backend/src/models/Financiamento';
import ModalParcelas from '../../Financiamento/ModalParcelas';
import DialogModal from '../../../../components/DialogModal';
import { toast } from 'react-toastify';
import { ParcelaFinanciamento } from '../../../../../../backend/src/models/ParcelaFinanciamento';
import { salvarParcelaFinanciamento } from '../../../../services/parcelaFinanciamentoService';
import { MovimentoCentroCustos } from '../../../../../../backend/src/models/MovimentoCentroCustos';
import type { MovimentoBancarioEdicao } from '../../../../services/movimentoBancarioService';
import { DadosConciliacao, montarMovimentosLote } from '../conciliacaoPayload';

Modal.setAppElement('#root');

type TransferenciaSubtipo = 'transferencia' | 'aplicacao' | 'estorno';

/** Same plan as "Transferência entre contas" / movimentações sem efeito financeiro (Parâmetros). */
function resolvePlanoMovSemEfeitoFinanceiro(p: Parametro): number {
	return p.idPlanoTransferenciaEntreContas;
}

function parseDateOnlyAsLocal(value: string): Date {
	if (!value) return new Date(NaN);
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return new Date(value);
	const year = Number(m[1]);
	const month = Number(m[2]) - 1;
	const day = Number(m[3]);
	return new Date(year, month, day, 12, 0, 0, 0);
}

function formatDateOnlyPtBr(value: string | null | undefined): string {
	if (!value) return '-';
	const d = parseDateOnlyAsLocal(value);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleDateString('pt-BR');
}

function todayLocalIsoDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = `${now.getMonth() + 1}`.padStart(2, '0');
	const day = `${now.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

const cache: {
	parametros: Parametro[] | null;
	bancos: Banco[] | null;
	pessoas: Pessoa[] | null;
	planosConta: PlanoConta[] | null;
	centroCustos: CentroCustos[] | null;
} = {
	parametros: null,
	bancos: null,
	pessoas: null,
	planosConta: null,
	centroCustos: null,
};

interface ConciliaPlanoContasModalProps {
	isOpen: boolean;
	onClose: () => void;
	movimento: MovimentoBancario;
	planos: PlanoConta[];
	/** Deve lançar erro em caso de falha (o modal fica aberto e mostra o erro). */
	handleConcilia: (data: DadosConciliacao) => Promise<void> | void;
	/** Movimentos do lote; > 1 = conciliação em lote. Ao abrir pela linha, passar só o movimento clicado. */
	movimentosSelecionados?: MovimentoBancario[];
	/** When opening from a table "Múltiplos" cell, open the matching rateio editor */
	abrirRateioInicial?: 'centros' | 'planos' | null;
}

interface FormData {
	idPlanoContas: number | null;
	pessoaSelecionada: string;
	bancoSelecionado: string;
	idPessoa: number | null;
	idBanco: number | null;
	idCentroCustos: number | null;
	idFinanciamento: number | null;
}

const ConciliaPlanoContasModal: React.FC<
	ConciliaPlanoContasModalProps & {
		/** Recebe um movimento já montado por item do lote; deve lançar erro em caso de falha. */
		onConciliaMultiplos?: (movimentos: MovimentoBancarioEdicao[]) => Promise<void> | void;
	}
> = ({
	isOpen,
	onClose,
	movimento,
	planos = [],
	handleConcilia,
	movimentosSelecionados = [],
	onConciliaMultiplos,
	abrirRateioInicial = null,
}) => {
	const [modalidadeMovimento, setModalidadeMovimento] = useState('padrao');
	const [idCentroCustos, setIdCentroCustos] = useState<number | null>(null);
	const [centroCustos, setCentroCustos] = useState<CentroCustos[]>([]);
	const [searchCentroCustos, setSearchCentroCustos] = useState('');
	const centroCustosRef = useRef(null);
	const [idPlanoContas, setIdPlanoContas] = useState<number | null>(null);
	const [parametros, setParametros] = useState<Parametro[]>([]);
	const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
	const [pessoas, setPessoas] = useState<{ id: number; nome: string }[]>([]);
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const planoRef = useRef(null);
	const [searchPlano, setSearchPlano] = useState('');
	const [showPlanoDropdown, setShowPlanoDropdown] = useState(false);
	const [planosSearchValue, setPlanosSearchValue] = useState('');
	const [rateioCentrosModalAberto, setRateioCentrosModalAberto] = useState(false);
	const [rateioPlanosModalAberto, setRateioPlanosModalAberto] = useState(false);
	const [showCentroCustosDropdown, setShowCentroCustosDropdown] = useState(false);
	const [centroCustosSearchValue, setCentroCustosSearchValue] = useState('');
	const [rateiosCentros, setRateiosCentros] = useState<{ idCentro: number; descricao: string; valor: number }[]>([]);
	const [rateiosCentrosPorcentagem, setRateiosCentrosPorcentagem] = useState<{ idCentro: number; porcentagem: number }[]>([]);
	const [rateiosPlanos, setRateiosPlanos] = useState<{ idPlano: number; descricao: string; valor: number }[]>([]);
	const [rateiosPlanosPorcentagem, setRateiosPlanosPorcentagem] = useState<{ idPlano: number; porcentagem: number }[]>([]);
	const [tipoCentroSelecionado, setTipoCentroSelecionado] = useState<'CUSTEIO' | 'INVESTIMENTO' | null>(null);
	const [tipoPlanoSelecionado, setTipoPlanoSelecionado] = useState<'CUSTEIO' | 'INVESTIMENTO' | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [modalFinanciamentoOpen, setModalFinanciamentoOpen] = useState(false);
	const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
	const [buscaFinanciamento, setBuscaFinanciamento] = useState('');
	const [financiamentoSelecionado, setFinanciamentoSelecionado] = useState<Financiamento | null>(null);
	const [novoFinanciamentoData, setNovoFinanciamentoData] = useState<any>(null);
	const [transferenciaPlanoMode, setTransferenciaPlanoMode] = useState<TransferenciaSubtipo>('transferencia');
	const [modalParcelasOpen, setModalParcelasOpen] = useState(false);
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationDate, setLiquidationDate] = useState('');
	const [liquidationValor, setLiquidationValor] = useState<string>('');
	const [mostrarMaisOpcoes, setMostrarMaisOpcoes] = useState(false);

	const [formData, setFormData] = useState<FormData>({
		idPlanoContas: null,
		pessoaSelecionada: '',
		bancoSelecionado: '',
		idPessoa: null,
		idBanco: null,
		idFinanciamento: null,
		idCentroCustos: null,
	});

	// useRef para controlar se o modal já foi inicializado
	const modalInicializado = useRef(false);

	useEffect(() => {
		console.log('[DEBUG FIN] Effect run', {
			isOpen,
			movimentoId: movimento?.id,
			movimentoIdFinanciamento: movimento?.idFinanciamento,
			modalidade: movimento?.modalidadeMovimento,
			modalInicializado: modalInicializado.current,
			movimentosSelecionadosLength: movimentosSelecionados.length,
		});
		if (isOpen && !modalInicializado.current) {
			console.log('[DEBUG FIN] Entrando no bloco de inicialização (modalInicializado era false)');
			modalInicializado.current = true;

			if (movimentosSelecionados.length > 1) {
				// Limpa todos os campos para conciliação em lote
				setModalidadeMovimento('padrao');
				setIdPlanoContas(null);
				setIdCentroCustos(null);
				setSearchCentroCustos('');
				setSearchPlano('');
				setFinanciamentoSelecionado(null);
				setBuscaFinanciamento('');
				setTipoCentroSelecionado(movimento.tipoMovimento === 'D' ? 'CUSTEIO' : null);
				setTipoPlanoSelecionado(movimento.tipoMovimento === 'D' ? 'CUSTEIO' : null);
				setRateiosPlanos([]);
				setRateiosPlanosPorcentagem([]);
				setRateiosCentros([]);
				setRateiosCentrosPorcentagem([]);
				setTransferenciaPlanoMode('transferencia');
				setFormData({
					idPlanoContas: null,
					pessoaSelecionada: '',
					bancoSelecionado: '',
					idPessoa: null,
					idBanco: null,
					idCentroCustos: null,
					idFinanciamento: null,
				});
			} else {
				// Mantém o comportamento existente para um único movimento
				setModalidadeMovimento(movimento.modalidadeMovimento || 'padrao');
				setTipoCentroSelecionado(movimento.tipoMovimento === 'D' ? 'CUSTEIO' : null);
				setTipoPlanoSelecionado(movimento.tipoMovimento === 'D' ? 'CUSTEIO' : null);
				// Um único resultado = tratar como plano único (dados legados ou antes da normalização)
				const idPlanoInicial =
					movimento.resultadoList?.length === 1 ? movimento.resultadoList[0].idPlanoContas : (movimento.idPlanoContas ?? null);
				const idCentroInicial =
					!movimento.idCentroCustos && movimento.centroCustosList?.length === 1
						? movimento.centroCustosList[0].idCentroCustos
						: (movimento.idCentroCustos ?? null);

				setIdPlanoContas(idPlanoInicial);
				setIdCentroCustos(idCentroInicial);
				setSearchCentroCustos(idCentroInicial ? centroCustos.find((c) => c.id === idCentroInicial)?.descricao || '' : '');
				if (movimento.idPlanoContas || movimento.resultadoList?.length === 1) {
					const planoSelecionado = planos.find((p) => p.id === idPlanoInicial);
					setSearchPlano(planoSelecionado ? planoSelecionado.descricao : '');
				} else {
					setSearchPlano('');
				}
				// Hydrate rateio drafts only from persisted movement data (never from a previous unsaved session)
				if (movimento.resultadoList && movimento.resultadoList.length > 1) {
					const convertidos = movimento.resultadoList.map((r) => {
						const plano = planos.find((p) => p.id === r.idPlanoContas);
						return {
							idPlano: r.idPlanoContas,
							descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
							valor: r.valor,
						};
					});
					setRateiosPlanos(convertidos);
				} else {
					setRateiosPlanos([]);
				}
				setRateiosPlanosPorcentagem([]);

				if (movimento.centroCustosList && movimento.centroCustosList.length > 1) {
					const convertidosCentros = movimento.centroCustosList.map((c) => {
						const centro = centroCustos.find((ct) => ct.id === c.idCentroCustos);
						return {
							idCentro: c.idCentroCustos,
							descricao: centro?.descricao || `Centro ${c.idCentroCustos}`,
							valor: c.valor,
						};
					});
					setRateiosCentros(convertidosCentros);
				} else {
					setRateiosCentros([]);
				}
				setRateiosCentrosPorcentagem([]);

				// Só limpar financiamento quando o movimento não está conciliado como financiamento (evita flash vazio ao reabrir)
				if (!movimento.idFinanciamento) {
					setFinanciamentoSelecionado(null);
					setBuscaFinanciamento('');
				}

				setFormData({
					idPlanoContas: idPlanoInicial,
					pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
					bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
					idPessoa: movimento.idPessoa || null,
					idBanco: movimento.idBanco || null,
					idCentroCustos: idCentroInicial,
					idFinanciamento: movimento.idFinanciamento || null,
				});
			}

			const inicializarModal = async () => {
				try {
					const financiamentosList = await listarFinanciamentos();
					setFinanciamentos(financiamentosList);
					console.log(
						'[DEBUG FIN] inicializarModal: list length=',
						financiamentosList.length,
						'movimento.idFinanciamento=',
						movimento.idFinanciamento,
						'ids na lista=',
						financiamentosList.slice(0, 5).map((f: Financiamento) => ({ id: f.id, tipo: typeof f.id })),
					);
					// Carregar financiamento sempre que o movimento tiver idFinanciamento (não depender de movimentosSelecionados.length === 1; ao abrir pelo clique na célula pode ser 0)
					if (movimento.idFinanciamento) {
						const financiamento = financiamentosList.find((f) => f.id == movimento.idFinanciamento);
						console.log(
							'[DEBUG FIN] inicializarModal: find result=',
							financiamento ? { id: financiamento.id, responsavel: financiamento.responsavel } : 'undefined',
						);
						if (financiamento) {
							setFinanciamentoSelecionado(financiamento);
							setBuscaFinanciamento(`${financiamento.numeroContrato || ''} - ${financiamento.responsavel || ''}`);
						}
					}
				} catch (error) {
					console.error('Erro ao inicializar modal:', error);
					toast.error('Erro ao carregar dados do modal');
				}
			};

			inicializarModal();

			setMostrarMaisOpcoes(Boolean(movimento?.idPessoa));
			setErrors({});
			if (abrirRateioInicial === 'centros') {
				setTimeout(() => setRateioCentrosModalAberto(true), 50);
			} else if (abrirRateioInicial === 'planos') {
				setTimeout(() => setRateioPlanosModalAberto(true), 50);
			}
		}

		// Sempre que o modal está aberto e o movimento tem idFinanciamento, garantir que o financiamento seja carregado no input
		if (isOpen && movimento?.idFinanciamento) {
			console.log('[DEBUG FIN] Entrando no bloco carregarFinanciamentoSelecionado, movimento.idFinanciamento=', movimento.idFinanciamento);
			const carregarFinanciamentoSelecionado = async () => {
				try {
					const list = await listarFinanciamentos();
					setFinanciamentos(list);
					console.log(
						'[DEBUG FIN] carregarFinanciamentoSelecionado: list length=',
						list.length,
						'buscando id=',
						movimento.idFinanciamento,
						'tipo=',
						typeof movimento.idFinanciamento,
					);
					console.log(
						'[DEBUG FIN] primeiros ids da lista:',
						list.slice(0, 10).map((f: Financiamento) => ({ id: f.id, tipo: typeof f.id })),
					);
					const fin = list.find((f: Financiamento) => f.id == movimento.idFinanciamento);
					console.log(
						'[DEBUG FIN] carregarFinanciamentoSelecionado: fin encontrado=',
						fin ? { id: fin.id, responsavel: fin.responsavel } : 'NÃO ENCONTRADO',
					);
					if (fin) {
						setFinanciamentoSelecionado(fin);
						setBuscaFinanciamento(`${fin.numeroContrato || ''} - ${fin.responsavel || ''}`);
					}
				} catch (e) {
					console.error('Erro ao carregar financiamento:', e);
				}
			};
			carregarFinanciamentoSelecionado();
		}

		// Discard unsaved association drafts when the modal closes without Associar
		if (!isOpen) {
			modalInicializado.current = false;
			setTipoCentroSelecionado(null);
			setTipoPlanoSelecionado(null);
			setRateiosCentros([]);
			setRateiosCentrosPorcentagem([]);
			setRateiosPlanos([]);
			setRateiosPlanosPorcentagem([]);
			setRateioCentrosModalAberto(false);
			setRateioPlanosModalAberto(false);
			setIdPlanoContas(null);
			setIdCentroCustos(null);
			setSearchPlano('');
			setSearchCentroCustos('');
			setErrors({});
			setMostrarMaisOpcoes(false);
		}
	}, [isOpen, movimento?.id, movimento?.idFinanciamento, abrirRateioInicial]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				if (!cache.parametros) cache.parametros = await listarParametros();
				if (!cache.planosConta) cache.planosConta = await listarPlanoContas();
				if (!cache.bancos) cache.bancos = await listarBancos();
				if (!cache.pessoas) cache.pessoas = await listarPessoas();
				if (!cache.centroCustos) cache.centroCustos = await listarCentroCustos();

				setParametros(cache.parametros);
				setBancos(cache.bancos);
				setPessoas(cache.pessoas);
				setCentroCustos(cache.centroCustos);
			} catch (error) {
				console.error('Erro ao buscar dados:', error);
			}
		};

		if (isOpen && modalInicializado.current) {
			fetchData();
		}
	}, [isOpen, modalInicializado.current]);

	useEffect(() => {
		if (centroCustos.length > 0 && movimento?.idCentroCustos && isOpen) {
			const centro = centroCustos.find((c) => c.id === movimento.idCentroCustos);
			if (centro) {
				setSearchCentroCustos((prev) => {
					if (!prev || prev !== centro.descricao) {
						return centro.descricao;
					}
					return prev;
				});
			}
		}
	}, [centroCustos, movimento?.idCentroCustos, isOpen]);

	// Hidratação do rateio a partir do movimento: só no modo individual (no lote o movimento é o
	// 1º selecionado e seus valores em R$ não valem para os demais).
	useEffect(() => {
		if (
			planos.length > 0 &&
			movimentosSelecionados.length <= 1 &&
			movimento?.resultadoList &&
			movimento.resultadoList.length > 1 &&
			isOpen &&
			modalInicializado.current
		) {
			const convertidos = movimento.resultadoList.map((r) => {
				const plano = planos.find((p) => p.id === r.idPlanoContas);
				return {
					idPlano: r.idPlanoContas,
					descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
					valor: r.valor,
				};
			});
			setRateiosPlanos(convertidos);
		}
	}, [planos, movimento?.resultadoList, isOpen, modalInicializado.current, movimentosSelecionados.length]);

	useEffect(() => {
		if (
			centroCustos.length > 0 &&
			movimentosSelecionados.length <= 1 &&
			movimento?.centroCustosList &&
			movimento.centroCustosList.length > 1 &&
			isOpen &&
			modalInicializado.current
		) {
			const convertidos = movimento.centroCustosList.map((c) => {
				const centro = centroCustos.find((ct) => ct.id === c.idCentroCustos);
				return {
					idCentro: c.idCentroCustos,
					descricao: centro?.descricao || `Centro ${c.idCentroCustos}`,
					valor: c.valor,
				};
			});
			setRateiosCentros(convertidos);
		}
	}, [centroCustos, movimento?.centroCustosList, isOpen, modalInicializado.current, movimentosSelecionados.length]);

	// Sync transferencia subtype when reopening a movement already reconciled (sem efeito tab)
	useEffect(() => {
		if (!isOpen || movimentosSelecionados.length > 1 || !parametros[0]) return;
		if (movimento?.modalidadeMovimento !== 'transferencia' || movimento.idPlanoContas == null) return;
		const id = movimento.idPlanoContas;
		const p = parametros[0];
		if (p.idPlanoEstornos != null && id === p.idPlanoEstornos) {
			setTransferenciaPlanoMode('estorno');
		} else if ((p.idPlanoAplicacaoResgateInvestimentos != null && id === p.idPlanoAplicacaoResgateInvestimentos) || id === 233) {
			// 233 = legacy hardcoded aplic./resgate before parameter existed
			setTransferenciaPlanoMode('aplicacao');
		} else if (id === p.idPlanoTransferenciaEntreContas) {
			setTransferenciaPlanoMode('transferencia');
		} else {
			setTransferenciaPlanoMode('transferencia');
		}
	}, [isOpen, movimentosSelecionados.length, movimento?.id, movimento?.modalidadeMovimento, movimento?.idPlanoContas, parametros]);

	const aplicarRateioCentrosComoCentroCustosList = (centros: MovimentoCentroCustos[] | { idCentro: number; porcentagem: number }[]) => {
		// Draft only until Associar — never mutate the movimento prop (that object may be shared with the table)
		if (movimentosSelecionados.length > 1 && centros.length > 0 && 'porcentagem' in centros[0]) {
			const rateiosPorcentagem = centros as { idCentro: number; porcentagem: number }[];
			setRateiosCentrosPorcentagem(rateiosPorcentagem);
			// Keep mirror in rateiosCentros (valor = %) so reopening the rateio modal restores the draft
			setRateiosCentros(
				rateiosPorcentagem.map((rc) => ({
					idCentro: rc.idCentro,
					descricao: centroCustos.find((ct) => ct.id === rc.idCentro)?.descricao || `Centro ${rc.idCentro}`,
					valor: rc.porcentagem,
				}))
			);
			setIdCentroCustos(null);
			setSearchCentroCustos('');
			setFormData((prev: FormData) => ({ ...prev, idCentroCustos: null }));
			setErrors((prev) => {
				const next = { ...prev };
				delete next.idCentroCustos;
				return next;
			});
			setRateioCentrosModalAberto(false);
			return;
		}

		const centrosNormais = centros as MovimentoCentroCustos[];
		const convertidos = centrosNormais.map((c) => {
			const centro = centroCustos.find((ct) => ct.id === c.idCentroCustos);
			return {
				idCentro: c.idCentroCustos,
				descricao: centro?.descricao || `Centro ${c.idCentroCustos}`,
				valor: c.valor,
			};
		});
		setRateiosCentros(convertidos);
		setRateiosCentrosPorcentagem([]);
		setIdCentroCustos(null);
		setSearchCentroCustos('');
		setFormData((prev: FormData) => ({ ...prev, idCentroCustos: null }));
		setErrors((prev) => {
			const next = { ...prev };
			delete next.idCentroCustos;
			return next;
		});
		setRateioCentrosModalAberto(false);
	};

	const limparRateioCentros = () => {
		setRateiosCentros([]);
		setRateiosCentrosPorcentagem([]);
		setRateioCentrosModalAberto(false);
	};

	const aplicarRateioPlanosComoResultadoList = (resultados: Resultado[] | { idPlano: number; porcentagem: number }[]) => {
		// Draft only until Associar — never mutate the movimento prop
		if (movimentosSelecionados.length > 1 && resultados.length > 0 && 'porcentagem' in resultados[0]) {
			const rateiosPorcentagem = resultados as { idPlano: number; porcentagem: number }[];
			setRateiosPlanosPorcentagem(rateiosPorcentagem);
			setRateiosPlanos(
				rateiosPorcentagem.map((rp) => ({
					idPlano: rp.idPlano,
					descricao: planos.find((p) => p.id === rp.idPlano)?.descricao || `Plano ${rp.idPlano}`,
					valor: rp.porcentagem,
				}))
			);
			setIdPlanoContas(null);
			setSearchPlano('');
			setFormData((prev: FormData) => ({ ...prev, idPlanoContas: null }));
			setErrors((prev) => {
				const next = { ...prev };
				delete next.idPlanoContas;
				return next;
			});
			setRateioPlanosModalAberto(false);
			return;
		}

		const resultadosNormais = resultados as Resultado[];
		const convertidos = resultadosNormais.map((r) => {
			const plano = planos.find((p) => p.id === r.idPlanoContas);
			return {
				idPlano: r.idPlanoContas,
				descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
				valor: r.valor,
			};
		});
		setRateiosPlanos(convertidos);
		setRateiosPlanosPorcentagem([]);
		setIdPlanoContas(null);
		setSearchPlano('');
		setFormData((prev: FormData) => ({ ...prev, idPlanoContas: null }));
		setErrors((prev) => {
			const next = { ...prev };
			delete next.idPlanoContas;
			return next;
		});
		setRateioPlanosModalAberto(false);
	};

	const limparRateioPlanos = () => {
		setRateiosPlanos([]);
		setRateiosPlanosPorcentagem([]);
		setRateioPlanosModalAberto(false);
	};

	// Fechar dropdowns ao clicar fora
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (planoRef.current && !(planoRef.current as any).contains(event.target)) {
				setShowPlanoDropdown(false);
			}
			if (centroCustosRef.current && !(centroCustosRef.current as any).contains(event.target)) {
				setShowCentroCustosDropdown(false);
			}
		};

		if (showPlanoDropdown || showCentroCustosDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showPlanoDropdown, showCentroCustosDropdown]);

	// Filtrar planos com busca interna
	const isDespesa = movimento.tipoMovimento === 'D';
	const planosFiltered = planos
		.filter((plano) => {
			const matchSearch = plano.descricao.toLowerCase().includes(planosSearchValue.toLowerCase());
			const matchHierarquia = movimento.tipoMovimento === 'D' ? plano.hierarquia.startsWith('002') : plano.hierarquia.startsWith('001');
			const matchNivel = plano.nivel === 3;
			// Para despesas, filtrar também por tipo (custeio/investimento) se um tipo foi selecionado
			const matchTipo = !isDespesa || !tipoPlanoSelecionado || plano.tipo?.toLowerCase() === tipoPlanoSelecionado.toLowerCase();
			// Plano inativo não é oferecido para nova seleção (o nome do já associado continua exibido via `planos`)
			const matchAtivo = !plano.inativo;
			return matchSearch && matchHierarquia && matchNivel && matchTipo && matchAtivo;
		})
		.slice(0, 50);

	// Filtrar centro de custos com busca interna e por tipo de movimento
	const centroCustosFiltered = centroCustos.filter((centro) => {
		const matchSearch = centro.descricao.toLowerCase().includes(centroCustosSearchValue.toLowerCase());

		// Filtrar por tipo de movimento: C (Crédito/Entrada) = Receita, D (Débito/Saída) = Despesa
		const matchTipoMovimento =
			movimento.tipoMovimento === 'C' ? centro.tipoReceitaDespesa === 'RECEITA' : centro.tipoReceitaDespesa === 'DESPESA';

		// Para despesas, filtrar também por tipo (CUSTEIO/INVESTIMENTO) se um tipo foi selecionado
		const matchTipo = !isDespesa || !tipoCentroSelecionado || centro.tipo === tipoCentroSelecionado;

		return matchSearch && matchTipoMovimento && matchTipo;
	});

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const target = e.target as HTMLInputElement;
		setFormData((prev: FormData) => ({
			...prev,
			[target.name]: target.value,
		}));
	};

	const validarFormulario = () => {
		const newErrors: { [key: string]: string } = {};
		if (modalidadeMovimento === 'padrao') {
			// Para receitas, não validar plano de contas
			const isReceita = movimento.tipoMovimento === 'C';

			if (!isReceita) {
				// Validação: verificar se há plano único ou múltiplos planos (rateio)
				const temPlanoUnico = formData.idPlanoContas !== null && formData.idPlanoContas !== undefined;
				const temMultiplosPlanosExistentes = movimento.resultadoList && movimento.resultadoList.length > 1;
				const temUmPlanoEmResultadoList = (movimento.resultadoList?.length ?? 0) === 1;
				const temRateiosPlanos = rateiosPlanos.length > 0;
				const temRateiosPlanosPorcentagem = (rateiosPlanosPorcentagem ?? []).length > 0;
				const movimentoJaConciliado = movimento.idPlanoContas !== null && movimento.idPlanoContas !== undefined;

				// Permitir null apenas se o movimento já estava conciliado (para permitir limpar)
				if (
					!temPlanoUnico &&
					!temMultiplosPlanosExistentes &&
					!temUmPlanoEmResultadoList &&
					!temRateiosPlanos &&
					!temRateiosPlanosPorcentagem &&
					!movimentoJaConciliado
				) {
					newErrors.idPlanoContas = 'Selecione um plano de contas ou defina múltiplos!';
				}
			}

			// Validar centro de custos obrigatório
			// Permitir null apenas se o movimento já tinha centro de custos (para permitir limpar)
			const temCentroUnico = formData.idCentroCustos !== null && formData.idCentroCustos !== undefined;
			const temCentroCustosListMultiplo = (movimento.centroCustosList ?? []).length > 1;
			const temUmCentroEmLista = (movimento.centroCustosList?.length ?? 0) === 1;
			const temRateiosCentros = rateiosCentros.length > 0;
			const temRateiosCentrosPorcentagem = (rateiosCentrosPorcentagem ?? []).length > 0;
			const movimentoJaTinhaCentro = movimento.idCentroCustos !== null && movimento.idCentroCustos !== undefined;

			if (
				!temCentroUnico &&
				!temCentroCustosListMultiplo &&
				!temUmCentroEmLista &&
				!temRateiosCentros &&
				!temRateiosCentrosPorcentagem &&
				!movimentoJaTinhaCentro
			) {
				newErrors.idCentroCustos = 'Selecione um centro de custos ou defina múltiplos!';
			}
		}
		if (modalidadeMovimento === 'financiamento') {
			if (!financiamentoSelecionado) {
				newErrors.financiamento = 'Selecione um financiamento ou crie um novo!';
			}
			// Para financiamentos bancários, não exigir plano de contas nem centro de custos
			// A informação vai apenas para o item financiamento
		}
		if (modalidadeMovimento === 'transferencia') {
			const p0 = parametros[0];
			if (transferenciaPlanoMode === 'estorno') {
				if (!p0?.idPlanoEstornos) {
					newErrors.estornoPlano = 'Configure o Plano de Contas Estornos/duplicidades em Parâmetros.';
				}
			} else if (transferenciaPlanoMode === 'aplicacao') {
				if (!p0?.idPlanoAplicacaoResgateInvestimentos) {
					newErrors.transferenciaPlano = 'Configure o Plano de Contas — Aplicação/resgate de investimentos em Parâmetros.';
				}
			} else if (transferenciaPlanoMode === 'transferencia' && !resolvePlanoMovSemEfeitoFinanceiro(p0)) {
				newErrors.transferenciaPlano = 'Configure o Plano de Contas para Movimentações sem efeito / Movimentação interna em Parâmetros.';
			}
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Validation runs only on Associar (and field clears remove individual errors)

	// useEffect para configurar planos de financiamento automaticamente
	useEffect(() => {
		if (modalidadeMovimento === 'financiamento' && parametros.length > 0 && modalInicializado.current) {
			if (movimento.tipoMovimento === 'C') {
				const idPlano = parametros[0]?.idPlanoEntradaFinanciamentos;
				if (idPlano && idPlano !== formData.idPlanoContas) {
					setFormData((prev) => ({ ...prev, idPlanoContas: idPlano }));
					setIdPlanoContas(idPlano);
					const plano = planos.find((p) => p.id === idPlano);
					setSearchPlano(plano ? plano.descricao : '');
				}
			} else {
				const idPlano = parametros[0]?.idPlanoPagamentoFinanciamentos;
				if (idPlano && idPlano !== formData.idPlanoContas) {
					setFormData((prev) => ({ ...prev, idPlanoContas: idPlano }));
					setIdPlanoContas(idPlano);
					const plano = planos.find((p) => p.id === idPlano);
					setSearchPlano(plano ? plano.descricao : '');
				}
			}
		}
	}, [modalidadeMovimento, parametros.length, movimento.tipoMovimento, planos.length, formData.idPlanoContas, modalInicializado.current]);

	const selectPlanoNew = (plano: PlanoConta | null) => {
		setRateiosPlanos([]);
		setRateiosPlanosPorcentagem([]);
		if (plano === null) {
			setSearchPlano('');
			setFormData((prev: FormData) => ({ ...prev, idPlanoContas: null }));
			setIdPlanoContas(null);
			setShowPlanoDropdown(false);
			setPlanosSearchValue('');
		} else {
			setSearchPlano(plano.descricao);
			setFormData((prev: FormData) => ({ ...prev, idPlanoContas: plano.id }));
			setIdPlanoContas(plano.id);
			setShowPlanoDropdown(false);
			setPlanosSearchValue('');
			setErrors((prev) => {
				const next = { ...prev };
				delete next.idPlanoContas;
				return next;
			});
		}
	};

	const selectCentroCustosNew = (centro: CentroCustos | null) => {
		setRateiosCentros([]);
		setRateiosCentrosPorcentagem([]);
		if (centro === null) {
			setIdCentroCustos(null);
			setSearchCentroCustos('');
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
			setFormData((prev: FormData) => ({ ...prev, idCentroCustos: null }));
		} else {
			setIdCentroCustos(centro.id);
			setSearchCentroCustos(centro.descricao);
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
			setFormData((prev: FormData) => ({ ...prev, idCentroCustos: centro.id }));
			setErrors((prev) => {
				const next = { ...prev };
				delete next.idCentroCustos;
				return next;
			});
		}
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

	// Data do movimento (OFX grava 'YYYY-MM-DDT00:00:00Z'): lê dd/mm/aaaa do próprio texto,
	// sem conversão de fuso (senão 13/04 00:00Z vira "12/04 21:00" no Brasil) — igual à tabela
	const formatarData = (data: string) => {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ''));
		if (m) return `${m[3]}/${m[2]}/${m[1]}`;
		const d = new Date(data);
		return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
	};

	const formatarMoeda = (valor: number) => {
		return valor.toLocaleString('pt-BR', {
			style: 'currency',
			currency: 'BRL',
		});
	};

	const carregarFinanciamentos = async () => {
		try {
			const financiamentosList = await listarFinanciamentos();
			setFinanciamentos(financiamentosList);
		} catch (error) {
			console.error('Erro ao carregar financiamentos:', error);
		}
	};

	const financiamentosFiltrados = financiamentos.filter((f) => {
		const matchesSearch =
			buscaFinanciamento === '' ||
			f.responsavel.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
			f.numeroContrato.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
			(bancos.find((b) => b.id === f.idBanco)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
			(pessoas.find((p) => p.id === f.idPessoa)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase());
		return matchesSearch;
	});

	const handleSalvar = async () => {
		if (isSaving) return;
		if (!validarFormulario()) return;

		setIsSaving(true);
		try {
			let dados: any = {};

			if (modalidadeMovimento === 'padrao') {
				// Permitir plano de contas tanto para receitas quanto para despesas
				dados = {
					idPlanoContas: formData.idPlanoContas ? parseInt(formData.idPlanoContas.toString()) : null,
					idPessoa: formData.pessoaSelecionada ? parseInt(formData.pessoaSelecionada) : null,
					idBanco: formData.bancoSelecionado ? parseInt(formData.bancoSelecionado) : null,
					idCentroCustos: formData.idCentroCustos,
					modalidadeMovimento,
				};

				// Se há rateio de planos, usar resultadoList do rateio
				if (rateiosPlanos.length > 0) {
					dados.resultadoList = rateiosPlanos.map((rp) => ({
						idPlanoContas: rp.idPlano,
						valor: rp.valor,
						tipo: movimento.tipoMovimento ?? 'C',
						idContaCorrente: movimento.idContaCorrente,
						dtMovimento: movimento.dtMovimento,
					}));
					dados.idPlanoContas = null; // Limpar idPlanoContas quando há rateio
				} else if ((movimento.resultadoList ?? []).length > 0 && !formData.idPlanoContas && rateiosPlanos.length === 0) {
					// Se não há rateios novos mas há planos existentes, manter os existentes
					dados.resultadoList = movimento.resultadoList;
				} else if ((movimento.resultadoList ?? []).length > 0 && !formData.idPlanoContas) {
					// Manter resultadoList existente quando não há rateio novo nem plano único selecionado
					dados.resultadoList = movimento.resultadoList;
				} else {
					// Plano único ou nenhum: resultadoList vazio (backend usa idPlanoContas)
					dados.resultadoList = [];
				}

				// Se idCentroCustos é null e não há rateios, limpar centroCustosList
				if (dados.idCentroCustos === null && rateiosCentros.length === 0) {
					dados.centroCustosList = undefined;
				} else if (rateiosCentros.length > 0) {
					// Adicionar centroCustosList se houver múltiplos centros
					// Converter rateiosCentros para formato MovimentoCentroCustos[]
					dados.centroCustosList = rateiosCentros.map((rc) => ({
						idCentroCustos: rc.idCentro,
						valor: rc.valor,
					}));
				} else if ((movimento.centroCustosList ?? []).length > 0) {
					// Se não há rateios novos mas há centros existentes, manter os existentes
					dados.centroCustosList = movimento.centroCustosList;
				}

				// Um único item no rateio equivale a plano/centro únicos (evita resultadoList com 1 linha)
				if (Array.isArray(dados.resultadoList) && dados.resultadoList.length === 1) {
					dados.idPlanoContas = dados.resultadoList[0].idPlanoContas;
					dados.resultadoList = [];
				}
				if (Array.isArray(dados.centroCustosList) && dados.centroCustosList.length === 1) {
					dados.idCentroCustos = dados.centroCustosList[0].idCentroCustos;
					dados.centroCustosList = undefined;
				}
			} else if (modalidadeMovimento === 'financiamento') {
				dados = {
					idPlanoContas: null, // Não exigir plano de contas para financiamentos
					idFinanciamento: financiamentoSelecionado?.id,
					idCentroCustos: null, // Não exigir centro de custos para financiamentos
					modalidadeMovimento,
				};
				// Limpar centroCustosList e resultadoList para financiamentos
				dados.centroCustosList = undefined;
				dados.resultadoList = [];
			} else if (modalidadeMovimento === 'transferencia') {
				const p0 = parametros[0];
				let idPlano: number | undefined;
				if (transferenciaPlanoMode === 'transferencia') {
					idPlano = resolvePlanoMovSemEfeitoFinanceiro(p0);
				} else if (transferenciaPlanoMode === 'aplicacao') {
					idPlano = p0?.idPlanoAplicacaoResgateInvestimentos ?? undefined;
				} else {
					idPlano = p0?.idPlanoEstornos ?? undefined;
				}

				dados = {
					idPlanoContas: idPlano,
					modalidadeMovimento,
				};
			}

			if (movimentosSelecionados.length > 1 && onConciliaMultiplos) {
				// Lote: um payload por movimento. Rateios por % viram R$ de cada movimento,
				// arredondados a centavos com o resíduo na última linha (soma = valor do movimento).
				const movimentosLote = montarMovimentosLote(
					movimentosSelecionados,
					dados as DadosConciliacao,
					rateiosPlanosPorcentagem,
					rateiosCentrosPorcentagem
				);
				await onConciliaMultiplos(movimentosLote);
			} else {
				await handleConcilia(dados as DadosConciliacao);
			}
			// Fecha só depois que o salvamento terminou com sucesso
			onClose();
		} catch (error) {
			console.error('Erro ao salvar movimento:', error);
			// Modal continua aberto para o usuário tentar de novo
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao salvar a conciliação.');
		} finally {
			setIsSaving(false);
		}
	};

	const handleLiquidarParcela = async () => {
		if (!selectedParcela || !liquidationDate) return;

		try {
			// Converter valor de string formatada para número
			const valorLiquidacao = liquidationValor ? parseFloat(liquidationValor.replace(/\./g, '').replace(',', '.')) : selectedParcela.valor;

			const parcelaAtualizada: ParcelaFinanciamento = {
				...selectedParcela,
				status: 'Liquidado' as 'Liquidado',
				dt_liquidacao: liquidationDate,
				valor: valorLiquidacao, // Atualizar valor se diferente
				idMovimentoBancario: movimento.id, // Vincular ao movimento bancário
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);

			// Atualizar o movimento bancário na mesma rotina da tela de conciliação
			// (evita exigir uma segunda etapa de "Associar" depois da liquidação da parcela).
			if (financiamentoSelecionado?.id != null) {
				try {
					await handleConcilia({
						modalidadeMovimento: 'financiamento',
						idFinanciamento: financiamentoSelecionado.id,
						idPlanoContas: null,
						idCentroCustos: null,
						centroCustosList: undefined,
						resultadoList: [],
					});
				} catch (error) {
					// A parcela já foi liquidada; avisar que o movimento não foi atualizado
					console.error('Erro ao atualizar o movimento após liquidar a parcela:', error);
					toast.error(
						`Parcela liquidada, mas o movimento não foi atualizado: ${
							error instanceof Error ? error.message : 'erro desconhecido'
						}. Use "Associar" para tentar de novo.`
					);
				}
			}

			// Atualiza a lista de parcelas do financiamento selecionado
			if (financiamentoSelecionado) {
				const parcelasAtualizadas: ParcelaFinanciamento[] =
					financiamentoSelecionado.parcelasList?.map((p) => (p.id === selectedParcela.id ? parcelaAtualizada : p)) || [];

				const financiamentoAtualizado: Financiamento = {
					...financiamentoSelecionado,
					parcelasList: parcelasAtualizadas,
				};

				setFinanciamentoSelecionado(financiamentoAtualizado);

				// Atualiza a lista de financiamentos
				const financiamentosAtualizados = financiamentos.map((f) => (f.id === financiamentoAtualizado.id ? financiamentoAtualizado : f));
				setFinanciamentos(financiamentosAtualizados);
			}

			setLiquidationModalOpen(false);
			setSelectedParcela(null);
			setLiquidationDate('');
			setLiquidationValor('');
			toast.success('Parcela liquidada com sucesso!');

			// Após liquidar a parcela, fechar o modal de conciliação também se for débito
			if (movimento.tipoMovimento === 'D') {
				setTimeout(() => {
					onClose();
				}, 500);
			}
		} catch (error) {
			console.error('Erro ao liquidar parcela:', error);
			toast.error('Erro ao liquidar parcela');
		}
	};

	const renderCampos = () => {
		if (modalidadeMovimento === 'padrao') {
			const isReceita = movimento.tipoMovimento === 'C';
			const rl = movimento.resultadoList ?? [];
			const ccl = movimento.centroCustosList ?? [];
			const bloqueioMultiplosPlanos =
				rateiosPlanos.length > 1 ||
				rateiosPlanosPorcentagem.length > 1 ||
				(rateiosPlanos.length === 0 && rateiosPlanosPorcentagem.length === 0 && rl.length > 1);
			const qtdPlanosMulti =
				rateiosPlanos.length > 1
					? rateiosPlanos.length
					: rateiosPlanosPorcentagem.length > 1
						? rateiosPlanosPorcentagem.length
						: rl.length;
			const pctPlanosMulti =
				rateiosPlanosPorcentagem.length > 1
					? rateiosPlanosPorcentagem.reduce((acc, r) => acc + r.porcentagem, 0)
					: 100;
			const textoPlanoCampo = bloqueioMultiplosPlanos
				? 'Múltiplos Planos'
				: rateiosPlanos.length === 1
					? rateiosPlanos[0].descricao
					: rl.length === 1
						? planos.find((p) => p.id === rl[0].idPlanoContas)?.descricao || searchPlano
						: searchPlano;
			const bloqueioMultiplosCentros =
				rateiosCentros.length > 1 ||
				rateiosCentrosPorcentagem.length > 1 ||
				(rateiosCentros.length === 0 && rateiosCentrosPorcentagem.length === 0 && ccl.length > 1);
			const qtdCentrosMulti =
				rateiosCentros.length > 1
					? rateiosCentros.length
					: rateiosCentrosPorcentagem.length > 1
						? rateiosCentrosPorcentagem.length
						: ccl.length;
			const pctCentrosMulti =
				rateiosCentrosPorcentagem.length > 1
					? rateiosCentrosPorcentagem.reduce((acc, r) => acc + r.porcentagem, 0)
					: 100;
			const textoCentroCampo = bloqueioMultiplosCentros
				? 'Múltiplos Centros'
				: rateiosCentros.length === 1
					? rateiosCentros[0].descricao
					: ccl.length === 1
						? centroCustos.find((c) => c.id === ccl[0].idCentroCustos)?.descricao || searchCentroCustos
						: searchCentroCustos;
			return (
				<>
					{/* Plano de Contas and Centro de Custos side by side (or only Centro if receita) */}
					<div className={`grid ${isReceita ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4 mb-4`}>
						{!isReceita && (
							<div ref={planoRef} className="relative min-w-0">
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Plano de Contas <span className="text-red-500">*</span>
								</label>
								<div className="flex w-full items-stretch h-10">
									{bloqueioMultiplosPlanos ? (
										<>
											<button
												type="button"
												className="min-w-0 flex-1 h-10 px-3 border border-blue-200 bg-blue-50 rounded-l-md text-left hover:bg-blue-100 transition-colors flex items-center gap-2 overflow-hidden"
												onClick={() => setRateioPlanosModalAberto(true)}
												title="Abrir rateio de planos"
											>
												<span className="text-sm font-semibold text-blue-700 truncate">Múltiplos Planos</span>
												<span className="text-xs text-blue-600/80 flex-shrink-0 whitespace-nowrap">
													{qtdPlanosMulti} · {pctPlanosMulti.toFixed(0)}%
												</span>
											</button>
											<button
												type="button"
												className="h-10 w-10 flex-shrink-0 border-y border-blue-200 bg-white text-red-500 hover:bg-red-50 flex items-center justify-center"
												onClick={limparRateioPlanos}
												title="Remover múltiplos planos"
											>
												<FontAwesomeIcon icon={faTimes} />
											</button>
										</>
									) : (
										<div className="relative min-w-0 flex-1">
											<input
												type="text"
												className={`w-full h-10 pl-3 pr-9 border rounded-l-md cursor-pointer truncate text-sm bg-white ${
													errors.idPlanoContas ? 'border-red-400' : 'border-gray-300'
												}`}
												placeholder="Selecionar plano..."
												title={textoPlanoCampo || undefined}
												onClick={() => {
													const next = !showPlanoDropdown;
													setShowPlanoDropdown(next);
													if (next) {
														setShowCentroCustosDropdown(false);
														if (isDespesa && tipoPlanoSelecionado === null) {
															setTipoPlanoSelecionado('CUSTEIO');
														}
													}
												}}
												value={textoPlanoCampo}
												readOnly
											/>
											<FontAwesomeIcon
												icon={faChevronDown}
												className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"
											/>
										</div>
									)}
									<button
										type="button"
										className="h-10 w-10 flex-shrink-0 rounded-r-md bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
										onClick={() => setRateioPlanosModalAberto(true)}
										title={bloqueioMultiplosPlanos ? 'Editar rateio de planos' : 'Rateio em múltiplos planos'}
									>
										<FontAwesomeIcon icon={bloqueioMultiplosPlanos ? faPen : faPlus} />
									</button>
								</div>
								{errors.idPlanoContas && <p className="text-red-500 text-xs mt-1">{errors.idPlanoContas}</p>}

								{showPlanoDropdown && !bloqueioMultiplosPlanos && (
									<div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md overflow-hidden flex flex-col max-h-72">
										{isDespesa && (
											<div className="p-2 border-b bg-gray-50 flex-shrink-0">
												<label className="block text-xs font-medium text-gray-700 mb-1.5">Tipo de Despesa</label>
												<div className="inline-flex w-full rounded-md border border-gray-200 overflow-hidden text-xs font-semibold">
													<button
														type="button"
														onClick={() => {
															setTipoPlanoSelecionado('CUSTEIO');
															setIdPlanoContas(null);
															setSearchPlano('');
															setPlanosSearchValue('');
														}}
														className={`flex-1 px-2.5 py-1.5 ${
															tipoPlanoSelecionado === 'CUSTEIO' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
														}`}
													>
														Custeio
													</button>
													<button
														type="button"
														onClick={() => {
															setTipoPlanoSelecionado('INVESTIMENTO');
															setIdPlanoContas(null);
															setSearchPlano('');
															setPlanosSearchValue('');
														}}
														className={`flex-1 px-2.5 py-1.5 border-l border-gray-200 ${
															tipoPlanoSelecionado === 'INVESTIMENTO' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
														}`}
													>
														Investimento
													</button>
												</div>
											</div>
										)}
										<div className="p-2 border-b bg-gray-50 flex-shrink-0">
											<input
												type="text"
												className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
												placeholder="Buscar plano de contas..."
												value={planosSearchValue}
												onChange={(e) => setPlanosSearchValue(e.target.value)}
												autoFocus
											/>
										</div>
										<ul className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
											<li
												className="px-3 py-2 hover:bg-gray-50 text-sm cursor-pointer border-b border-gray-100 text-gray-500 italic"
												onClick={() => selectPlanoNew(null)}
											>
												Limpar seleção
											</li>
											{planosFiltered.length > 0 ? (
												planosFiltered.map((plano) => (
													<li
														key={plano.id}
														className="px-3 py-2 hover:bg-blue-50 text-sm cursor-pointer border-b border-gray-50 last:border-b-0 flex items-start gap-2"
														onClick={() => selectPlanoNew(plano)}
													>
														<span className="min-w-0 flex-1">
															<span className="block text-gray-800 break-words">{plano.descricao}</span>
															<span className="block font-mono text-xs text-gray-500 mt-0.5">{plano.hierarquia}</span>
														</span>
														{plano.tipo && (
															<span
																className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
																	plano.tipo.toLowerCase() === 'investimento'
																		? 'bg-blue-100 text-blue-800'
																		: 'bg-yellow-100 text-yellow-800'
																}`}
															>
																{plano.tipo.toLowerCase() === 'investimento' ? 'Inv' : 'Cust'}
															</span>
														)}
													</li>
												))
											) : (
												<li className="px-3 py-4 text-sm text-gray-500 text-center">Nenhum resultado encontrado</li>
											)}
										</ul>
									</div>
								)}
							</div>
						)}

						<div ref={centroCustosRef} className="relative min-w-0">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Centro de Custos <span className="text-red-500">*</span>
							</label>
							<div className="flex w-full items-stretch h-10">
								{bloqueioMultiplosCentros ? (
									<>
										<button
											type="button"
											className="min-w-0 flex-1 h-10 px-3 border border-green-200 bg-green-50 rounded-l-md text-left hover:bg-green-100 transition-colors flex items-center gap-2 overflow-hidden"
											onClick={() => setRateioCentrosModalAberto(true)}
											title="Abrir rateio de centros"
										>
											<span className="text-sm font-semibold text-green-800 truncate">Múltiplos Centros</span>
											<span className="text-xs text-green-700/80 flex-shrink-0 whitespace-nowrap">
												{qtdCentrosMulti} · {pctCentrosMulti.toFixed(0)}%
											</span>
										</button>
										<button
											type="button"
											className="h-10 w-10 flex-shrink-0 border-y border-green-200 bg-white text-red-500 hover:bg-red-50 flex items-center justify-center"
											onClick={limparRateioCentros}
											title="Remover múltiplos centros"
										>
											<FontAwesomeIcon icon={faTimes} />
										</button>
									</>
								) : (
									<div className="relative min-w-0 flex-1">
										<input
											type="text"
											className={`w-full h-10 pl-3 pr-9 border rounded-l-md cursor-pointer truncate text-sm bg-white ${
												errors.idCentroCustos ? 'border-red-400' : 'border-gray-300'
											}`}
											placeholder="Selecionar centro..."
											title={textoCentroCampo || undefined}
											onClick={() => {
												const next = !showCentroCustosDropdown;
												setShowCentroCustosDropdown(next);
												if (next) {
													setShowPlanoDropdown(false);
													if (isDespesa && tipoCentroSelecionado === null) {
														setTipoCentroSelecionado('CUSTEIO');
													}
												}
											}}
											value={textoCentroCampo}
											readOnly
										/>
										<FontAwesomeIcon
											icon={faChevronDown}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"
										/>
									</div>
								)}
								<button
									type="button"
									className="h-10 w-10 flex-shrink-0 rounded-r-md bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
									onClick={() => setRateioCentrosModalAberto(true)}
									title={bloqueioMultiplosCentros ? 'Editar rateio de centros' : 'Rateio em múltiplos centros'}
								>
									<FontAwesomeIcon icon={bloqueioMultiplosCentros ? faPen : faPlus} />
								</button>
							</div>
							{errors.idCentroCustos && <p className="text-red-500 text-xs mt-1">{errors.idCentroCustos}</p>}

							{showCentroCustosDropdown && !bloqueioMultiplosCentros && (
								<div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md overflow-hidden flex flex-col max-h-72">
									{isDespesa && (
										<div className="p-2 border-b bg-gray-50 flex-shrink-0">
											<label className="block text-xs font-medium text-gray-700 mb-1.5">Tipo de Despesa</label>
											<div className="inline-flex w-full rounded-md border border-gray-200 overflow-hidden text-xs font-semibold">
												<button
													type="button"
													onClick={() => {
														setTipoCentroSelecionado('CUSTEIO');
														setIdCentroCustos(null);
														setSearchCentroCustos('');
														setFormData((prev: FormData) => ({ ...prev, idCentroCustos: null }));
														setCentroCustosSearchValue('');
													}}
													className={`flex-1 px-2.5 py-1.5 ${
														tipoCentroSelecionado === 'CUSTEIO' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
													}`}
												>
													Custeio
												</button>
												<button
													type="button"
													onClick={() => {
														setTipoCentroSelecionado('INVESTIMENTO');
														setIdCentroCustos(null);
														setSearchCentroCustos('');
														setFormData((prev: FormData) => ({ ...prev, idCentroCustos: null }));
														setCentroCustosSearchValue('');
													}}
													className={`flex-1 px-2.5 py-1.5 border-l border-gray-200 ${
														tipoCentroSelecionado === 'INVESTIMENTO' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
													}`}
												>
													Investimento
												</button>
											</div>
										</div>
									)}
									<div className="p-2 border-b bg-gray-50 flex-shrink-0">
										<input
											type="text"
											className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
											placeholder="Buscar centro de custos..."
											value={centroCustosSearchValue}
											onChange={(e) => setCentroCustosSearchValue(e.target.value)}
											autoFocus
										/>
									</div>
									<ul className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
										<li
											className="px-3 py-2 hover:bg-gray-50 text-sm cursor-pointer border-b border-gray-100 text-gray-500 italic"
											onClick={() => selectCentroCustosNew(null)}
										>
											Limpar seleção
										</li>
										{centroCustosFiltered.length > 0 ? (
											centroCustosFiltered.map((centro) => (
												<li
													key={centro.id}
													className="px-3 py-2 hover:bg-green-50 text-sm cursor-pointer border-b border-gray-50 last:border-b-0 flex items-center justify-between gap-2"
													onClick={() => selectCentroCustosNew(centro)}
												>
													<span className="min-w-0 truncate" title={centro.descricao}>
														{centro.descricao}
													</span>
													{centro.tipo && centro.tipoReceitaDespesa === 'DESPESA' && (
														<span
															className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
																centro.tipo === 'INVESTIMENTO' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
															}`}
														>
															{centro.tipo === 'INVESTIMENTO' ? 'Inv' : 'Cust'}
														</span>
													)}
												</li>
											))
										) : (
											<li className="px-3 py-4 text-sm text-gray-500 text-center">Nenhum resultado encontrado</li>
										)}
									</ul>
								</div>
							)}
						</div>
					</div>

					<hr className="border-gray-200 my-3" />
					<div className="mb-2">
						<button
							type="button"
							className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800"
							onClick={() => setMostrarMaisOpcoes((v) => !v)}
						>
							<FontAwesomeIcon icon={mostrarMaisOpcoes ? faChevronDown : faChevronRight} className="text-xs" />
							Mais opções
							{formData.pessoaSelecionada && !mostrarMaisOpcoes && (
								<span className="text-xs font-normal text-gray-400">(pessoa selecionada)</span>
							)}
						</button>
						{mostrarMaisOpcoes && (
							<div className="mt-3">
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Pessoa <span className="text-gray-500">(opcional)</span>
								</label>
								<select
									name="pessoaSelecionada"
									className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
									value={formData.pessoaSelecionada}
									onChange={handleInputChange}
								>
									<option value="">Selecione uma pessoa</option>
									{pessoas.map((pessoa) => (
										<option key={pessoa.id} value={pessoa.id}>
											{pessoa.nome}
										</option>
									))}
								</select>
							</div>
						)}
					</div>
				</>
			);
		}

		if (modalidadeMovimento === 'financiamento') {
			return (
				<div className="grid grid-cols-2 gap-4 mb-4">
					<div className="col-span-2" style={{ position: 'relative' }}>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Associar Financiamento <span className="text-red-500">*</span>
							</label>
							<div className="flex w-full">
								<input
									type="text"
									className="w-full p-2 border rounded-l"
									placeholder="Buscar por responsável, credor ou contrato"
									value={
										financiamentoSelecionado
											? `${financiamentoSelecionado.numeroContrato} - ${financiamentoSelecionado.responsavel} (${(financiamentoSelecionado.modalidade || '').toUpperCase() === 'PARTICULAR' ? 'Particular' : bancos.find((b) => b.id === financiamentoSelecionado.idBanco)?.nome || pessoas.find((p) => p.id === financiamentoSelecionado.idPessoa)?.nome || 'Não identificado'})`
											: buscaFinanciamento
									}
									onChange={(e) => setBuscaFinanciamento(e.target.value)}
									disabled={!!financiamentoSelecionado}
								/>
								{movimento.tipoMovimento === 'C' && (
									<button
										type="button"
										style={{ height: 'auto' }}
										className={`text-white text-lg px-4 ${financiamentoSelecionado ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'} rounded-r `}
										onClick={() => {
											if (financiamentoSelecionado) {
												setFinanciamentoSelecionado(null);
												setBuscaFinanciamento('');
											} else {
												setNovoFinanciamentoData({
													valor: movimento.valor?.toString().replace('.', ',') || '0,00',
													dataContrato: movimento.dtMovimento?.slice(0, 10) || '',
													observacao: 'Conciliação Bancária: ' + movimento.historico + ' - No valor de: R$ ' + movimento.valor || '',
												});
												setModalFinanciamentoOpen(true);
											}
										}}
										title={financiamentoSelecionado ? 'Desvincular Financiamento' : 'Novo Financiamento'}
									>
										<FontAwesomeIcon icon={financiamentoSelecionado ? faTimes : faPlus} />
									</button>
								)}
							</div>
							{errors.financiamento && <p className="text-red-500 text-xs">{errors.financiamento}</p>}

							{buscaFinanciamento && !financiamentoSelecionado && financiamentosFiltrados.length > 0 && (
								<ul className="absolute z-10 border rounded mt-1 bg-white max-h-40 overflow-y-auto w-full shadow-lg">
									{financiamentosFiltrados.map((f: Financiamento) => (
										<li key={f.id} className="p-2 cursor-pointer hover:bg-orange-100" onClick={() => setFinanciamentoSelecionado(f)}>
											<strong>{f.numeroContrato}</strong> - {f.responsavel} -{' '}
											{(f.modalidade || '').toUpperCase() === 'PARTICULAR'
												? 'Particular'
												: bancos.find((b) => b.id === f.idBanco)?.nome ||
													pessoas.find((p) => p.id === f.idPessoa)?.nome ||
													'Não identificado'}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					{financiamentoSelecionado && (
						<div className="mt-6 col-span-2">
							<div className="flex justify-between items-center mb-4">
								<h3 className="text-lg font-semibold">Parcelas do Financiamento</h3>
								<button
									onClick={() => setModalParcelasOpen(true)}
									className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
								>
									<FontAwesomeIcon icon={faEdit} />
									Editar Parcelas
								</button>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full">
									<thead className="bg-gray-50">
										<tr>
											<th className="p-2 text-left">Parcela</th>
											<th className="p-2 text-left">Vencimento</th>
											<th className="p-2 text-left">Valor</th>
											<th className="p-2 text-left">Status</th>
											<th className="p-2 text-left">Data Liquidação</th>
											<th className="p-2 text-right">Ações</th>
										</tr>
									</thead>
									<tbody>
										{financiamentoSelecionado.parcelasList?.map((parcela) => (
											<tr key={parcela.id} className="border-t">
												<td className="p-2">{parcela.numParcela}</td>
												<td className="p-2">{formatDateOnlyPtBr(parcela.dt_vencimento)}</td>
												<td className="p-2">{formatarMoeda(parcela.valor)}</td>
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
														<span className="text-sm text-gray-600">{formatDateOnlyPtBr(parcela.dt_liquidacao)}</span>
													) : (
														<span className="text-sm text-gray-400">-</span>
													)}
												</td>
												<td className="p-2 text-right">
													<div className="flex justify-end">
														{parcela.status !== 'Liquidado' && movimento.tipoMovimento === 'D' && (
															<button
																onClick={() => {
																	setSelectedParcela(parcela);
																	setLiquidationDate(todayLocalIsoDate());
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
			);
		}

		if (modalidadeMovimento === 'transferencia') {
			const textoExplicativoTransferencia =
				transferenciaPlanoMode === 'transferencia'
					? 'Transferências entre contas próprias da Fazenda, sem impacto econômico para o período.'
					: transferenciaPlanoMode === 'aplicacao'
						? 'Aplicação ou resgate em investimentos, sem registrar entrada ou saída operacional efetiva.'
						: 'Estornos (ex.: TEDs devolvidas) e demais operações neutras.';
			const msgFluxo = `${textoExplicativoTransferencia} Esta classificação não entra no Fluxo de Caixa.`;
			return (
				<div className="flex flex-col items-center text-center text-yellow-600 mt-10 mb-10">
					<p className="text-lg font-semibold text-gray-800 mb-2">Tipo do Movimento</p>
					<div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pb-5 border-b border-gray-200 mb-6 max-w-2xl mx-auto">
						<label className="flex items-center gap-2 cursor-pointer text-gray-600 transition-all">
							<input
								type="radio"
								name="filterMode"
								value="transferencia"
								checked={transferenciaPlanoMode === 'transferencia'}
								onChange={() => setTransferenciaPlanoMode('transferencia')}
								className="hidden"
							/>
							<div
								className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
									transferenciaPlanoMode === 'transferencia' ? 'bg-red-500 border-red-500' : 'border-gray-400'
								}`}
								style={{ padding: '0.60rem' }}
							>
								{transferenciaPlanoMode === 'transferencia' && (
									<span className="text-white text-md">
										<FontAwesomeIcon icon={faCheck} />
									</span>
								)}
							</div>
							<span className="text-left max-w-[11rem] sm:max-w-none">Movimentação interna</span>
						</label>

						<label className="flex items-center gap-2 cursor-pointer text-gray-600 transition-all">
							<input
								type="radio"
								name="filterMode"
								value="aplicacao"
								checked={transferenciaPlanoMode === 'aplicacao'}
								onChange={() => setTransferenciaPlanoMode('aplicacao')}
								className="hidden"
							/>
							<div
								className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
									transferenciaPlanoMode === 'aplicacao' ? 'bg-red-500 border-red-500' : 'border-gray-400'
								}`}
								style={{ padding: '0.60rem' }}
							>
								{transferenciaPlanoMode === 'aplicacao' && (
									<span className="text-white text-md">
										<FontAwesomeIcon icon={faCheck} />
									</span>
								)}
							</div>
							<span className="text-left max-w-[11rem] sm:max-w-none">Aplicação/resgate de investimentos</span>
						</label>

						<label className="flex items-center gap-2 cursor-pointer text-gray-600 transition-all">
							<input
								type="radio"
								name="filterMode"
								value="estorno"
								checked={transferenciaPlanoMode === 'estorno'}
								onChange={() => setTransferenciaPlanoMode('estorno')}
								className="hidden"
							/>
							<div
								className={`w-3 h-3 flex items-center justify-center rounded-full border-2 ${
									transferenciaPlanoMode === 'estorno' ? 'bg-red-500 border-red-500' : 'border-gray-400'
								}`}
								style={{ padding: '0.60rem' }}
							>
								{transferenciaPlanoMode === 'estorno' && (
									<span className="text-white text-md">
										<FontAwesomeIcon icon={faCheck} />
									</span>
								)}
							</div>
							<span>Estornos/duplicidades</span>
						</label>
					</div>
					<FontAwesomeIcon icon={faMoneyBillTransfer} size="3x" />
					<p className="mt-2 font-medium max-w-xl mx-auto px-2">{msgFluxo}</p>
					{(errors.estornoPlano || errors.transferenciaPlano) && (
						<p className="mt-3 text-sm text-red-600 max-w-xl mx-auto px-2">{errors.estornoPlano || errors.transferenciaPlano}</p>
					)}
				</div>
			);
		}
	};

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={onClose}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto z-100"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
			>
				<div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
					<h2 className="text-xl font-semibold text-gray-800">
						{movimentosSelecionados.length > 1 ? 'Associação de Plano de Contas em Lote' : 'Associação de Plano de Contas'}
					</h2>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
						<FontAwesomeIcon icon={faTimes} size="xl" />
					</button>
				</div>

				<div className="p-4">
					{movimentosSelecionados.length > 1 ? (
						<div className="mb-4">
							<div className="flex items-center justify-between border-gray-200 border text-gray-800 p-3 rounded-lg mb-4 shadow-sm text-sm">
								<span className="font-semibold">{movimentosSelecionados.length} movimentos selecionados</span>
								<strong className={`${movimentosSelecionados[0].tipoMovimento === 'C' ? 'text-green-600' : 'text-red-600'}`}>
									{movimentosSelecionados[0].tipoMovimento === 'C' ? 'Créditos' : 'Débitos'}
								</strong>
							</div>
							<div className="max-h-40 overflow-y-auto border rounded-lg">
								{movimentosSelecionados.map((mov, index) => (
									<div key={index} className="flex items-center justify-between p-2 border-b last:border-b-0">
										<span className="flex items-center gap-2 overflow-hidden">
											<span>{formatarData(mov.dtMovimento)}</span>
											<span>|</span>
											<span className="truncate max-w-[430px]" title={mov.historico}>
												{mov.historico}
											</span>
										</span>
										<strong className={`${mov.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(mov.valor)}</strong>
									</div>
								))}
							</div>
						</div>
					) : (
						movimento &&
						movimento.valor && (
							<div className="flex items-center justify-between border-gray-200 border text-gray-800 p-3 rounded-lg mb-4 shadow-sm text-sm">
								<span className="flex items-center gap-2 overflow-hidden">
									<span>{formatarData(movimento.dtMovimento)}</span>
									<span>|</span>
									<span className="truncate max-w-[430px]" title={movimento.historico}>
										{movimento.historico}
									</span>
								</span>
								<strong className={`${movimento.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(movimento.valor)}</strong>
							</div>
						)
					)}

					<div className="mb-4 flex w-full rounded-lg border border-gray-200 overflow-hidden divide-x divide-gray-200">
						{['padrao', 'financiamento', 'transferencia'].map((tipo) => (
							<button
								key={tipo}
								type="button"
								onClick={() => setModalidadeMovimento(tipo)}
								title={tipo === 'transferencia' ? 'Movimentações sem efeito' : undefined}
								className={`flex-1 min-h-[2.75rem] px-2 py-2 flex items-center justify-center text-center text-sm sm:text-base font-semibold leading-tight whitespace-nowrap ${
									modalidadeMovimento === tipo ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
								}`}
							>
								{tipo === 'padrao' && 'Padrão'}
								{tipo === 'financiamento' && 'Financiamento'}
								{tipo === 'transferencia' && 'Movimentações sem efeito'}
							</button>
						))}
					</div>

					{renderCampos()}

					<div className="flex justify-end mt-8 border-t pt-4">
						<button
							className={`font-semibold px-5 py-2 rounded flex items-center gap-2 transition ${
								isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'
							}`}
							onClick={handleSalvar}
							disabled={isSaving}
						>
							<FontAwesomeIcon icon={faSave} />
							{isSaving ? 'Salvando...' : 'Associar'}
						</button>
					</div>
				</div>
			</Modal>
			<ModalRateioCentroCustos
				isOpen={rateioCentrosModalAberto}
				onClose={() => setRateioCentrosModalAberto(false)}
				onConfirmar={aplicarRateioCentrosComoCentroCustosList}
				onLimpar={limparRateioCentros}
				centrosDisponiveis={centroCustos}
				movimento={movimento}
				valorTotal={movimento.valor}
				rateios={rateiosCentros}
				setRateios={setRateiosCentros}
				movimentosMultiplos={movimentosSelecionados.length > 1 ? movimentosSelecionados : undefined}
			/>
			<ModalRateioPlano
				isOpen={rateioPlanosModalAberto}
				onClose={() => setRateioPlanosModalAberto(false)}
				onConfirmar={aplicarRateioPlanosComoResultadoList}
				onLimpar={limparRateioPlanos}
				planosDisponiveis={planos}
				movimento={movimento}
				valorTotal={movimento.valor}
				rateios={rateiosPlanos}
				setRateios={setRateiosPlanos}
				movimentosMultiplos={movimentosSelecionados.length > 1 ? movimentosSelecionados : undefined}
			/>
			<ModalFinanciamento
				isOpen={modalFinanciamentoOpen}
				onClose={() => setModalFinanciamentoOpen(false)}
				onSave={async (financiamento: Financiamento) => {
					setModalFinanciamentoOpen(false);
					await carregarFinanciamentos();
					setFinanciamentoSelecionado(financiamento);
					// Conciliar o movimento imediatamente com o novo financiamento (evita ficar pendente e ter que clicar Associar)
					if (financiamento?.id != null) {
						const dadosFinanciamento = {
							modalidadeMovimento: 'financiamento' as const,
							idFinanciamento: financiamento.id,
							idPlanoContas: null,
							idCentroCustos: null,
							centroCustosList: undefined,
							resultadoList: [],
						};
						handleConcilia(dadosFinanciamento);
					}
				}}
				bancos={bancos as any}
				pessoas={pessoas as any}
				financiamentoData={novoFinanciamentoData}
			/>
			{financiamentoSelecionado && (
				<ModalParcelas
					isOpen={modalParcelasOpen}
					onClose={() => {
						setModalParcelasOpen(false);
					}}
					financiamento={financiamentoSelecionado}
					onSave={handleSaveFinanciamento}
					bancos={bancos as any}
					pessoas={pessoas as any}
				/>
			)}
			{/* Modal customizado para liquidação de parcela com valor editável */}
			<Modal
				isOpen={liquidationModalOpen}
				onRequestClose={() => {
					setLiquidationModalOpen(false);
					setSelectedParcela(null);
					setLiquidationDate('');
					setLiquidationValor('');
				}}
				className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto z-100"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
			>
				<div className="p-5">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-semibold text-gray-800">Liquidar Parcela</h2>
						<button
							onClick={() => {
								setLiquidationModalOpen(false);
								setSelectedParcela(null);
								setLiquidationDate('');
								setLiquidationValor('');
							}}
							className="text-gray-500 hover:text-gray-700"
						>
							<FontAwesomeIcon icon={faTimes} />
						</button>
					</div>

					{selectedParcela && (
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Parcela #{selectedParcela.numParcela} - Valor Previsto
								</label>
								<input
									type="text"
									value={selectedParcela.valor.toFixed(2).replace('.', ',')}
									disabled
									className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-600"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Valor da Liquidação <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={liquidationValor}
									onChange={(e) => {
										// Permitir apenas números, vírgula e ponto
										const value = e.target.value.replace(/[^\d,.-]/g, '');
										setLiquidationValor(value);
									}}
									placeholder="Digite o valor (ex: 1500,00)"
									className="w-full p-2 border border-gray-300 rounded"
								/>
								<p className="text-xs text-gray-500 mt-1">
									Valor do movimento: R${' '}
									{Math.abs(movimento.valor || 0)
										.toFixed(2)
										.replace('.', ',')}
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Data de Liquidação <span className="text-red-500">*</span>
								</label>
								<input
									type="date"
									value={liquidationDate}
									onChange={(e) => setLiquidationDate(e.target.value)}
									className="w-full p-2 border border-gray-300 rounded"
									required
								/>
							</div>

							<div className="flex justify-end gap-3 mt-6">
								<button
									onClick={() => {
										setLiquidationModalOpen(false);
										setSelectedParcela(null);
										setLiquidationDate('');
										setLiquidationValor('');
									}}
									className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
								>
									Cancelar
								</button>
								<button
									onClick={handleLiquidarParcela}
									disabled={!liquidationDate || !liquidationValor}
									className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
								>
									Liquidar
								</button>
							</div>
						</div>
					)}
				</div>
			</Modal>
		</>
	);
};

export default ConciliaPlanoContasModal;
