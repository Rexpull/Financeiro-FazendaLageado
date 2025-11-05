import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCheck, faInfoCircle, faUsers, faMoneyBillTransfer, faSearch, faPlus, faEdit, faMoneyBillWave, faChevronDown } from '@fortawesome/free-solid-svg-icons';
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
import ModalRateioPlano from './ModalRateioPlano';
import ModalRateioCentroCustos from './ModalRateioCentroCustos';
import ModalFinanciamento from '../../Financiamento/ModalFinanciamento';
import { listarFinanciamentos, salvarFinanciamento } from '../../../../services/financiamentoService';
import { Financiamento } from '../../../../../../backend/src/models/Financiamento';
import ModalParcelas from '../../Financiamento/ModalParcelas';
import DialogModal from '../../../../components/DialogModal';
import { toast } from 'react-toastify';
import { ParcelaFinanciamento } from '../../../../../../backend/src/models/ParcelaFinanciamento';
import { salvarParcelaFinanciamento } from '../../../../services/parcelaFinanciamentoService';
import ListFinanciamentos from '../../Financiamento/ListFinanciamentos';
import { MovimentoCentroCustos } from '../../../../../../backend/src/models/MovimentoCentroCustos';
  
Modal.setAppElement('#root');

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
	handleConcilia: (data: any) => void;
	movimentosSelecionados?: MovimentoBancario[];
}

interface FormData {
	idPlanoContas: number | null;
	pessoaSelecionada: string;
	bancoSelecionado: string;
	idPessoa: number | null;
	idBanco: number | null;
	idCentroCustos: number | null;
	parcelado: boolean;
	numeroDocumento: string;
	idFinanciamento: number | null;
}

const ConciliaPlanoContasModal: React.FC<ConciliaPlanoContasModalProps & { onConciliaMultiplos?: (data: any) => void }> = ({ isOpen, onClose, movimento, planos = [], handleConcilia, movimentosSelecionados = [], onConciliaMultiplos }) => {
	const [modalidadeMovimento, setModalidadeMovimento] = useState('padrao');
	const [idCentroCustos, setIdCentroCustos] = useState<number | null>(null);
	const [centroCustos, setCentroCustos] = useState<{ id: number; descricao: string }[]>([]);
	const [searchCentroCustos, setSearchCentroCustos] = useState('');
	const [showCentroCustosSuggestions, setShowCentroCustosSuggestions] = useState(false);
	const centroCustosRef = useRef(null);
	const [idPlanoContas, setIdPlanoContas] = useState<number | null>(null);
	const [idPessoa, setIdPessoa] = useState<number | null>(null);
	const [idBanco, setIdBanco] = useState<number | null>(null);
	const [numeroDocumento, setNumeroDocumento] = useState('');
	const [parcelado, setParcelado] = useState(false);
	const [parcelas, setParcelas] = useState<any[]>([]);
	const [planosFetch, setPlanosFetch] = useState<PlanoConta[]>([]);
	const [parametros, setParametros] = useState<Parametro[]>([]);
	const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
	const [pessoas, setPessoas] = useState<{ id: number; nome: string }[]>([]);
	const [numParcelas, setNumParcelas] = useState(1);
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	const [showSuggestions, setShowSuggestions] = useState(false);
	const planoRef = useRef(null);
	const [searchPlano, setSearchPlano] = useState('');
	const [showPlanoDropdown, setShowPlanoDropdown] = useState(false);
	const [planosSearchValue, setPlanosSearchValue] = useState('');
	const [rateioModalAberto, setRateioModalAberto] = useState(false);
	const [rateioCentrosModalAberto, setRateioCentrosModalAberto] = useState(false);
	const [showCentroCustosDropdown, setShowCentroCustosDropdown] = useState(false);
	const [centroCustosSearchValue, setCentroCustosSearchValue] = useState('');
	const [rateios, setRateios] = useState<{ idPlano: number; descricao: string; valor: number }[]>([]);
	const [rateiosCentros, setRateiosCentros] = useState<{ idCentro: number; descricao: string; valor: number }[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [modalFinanciamentoOpen, setModalFinanciamentoOpen] = useState(false);
	const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([]);
	const [buscaFinanciamento, setBuscaFinanciamento] = useState('');
	const [financiamentoSelecionado, setFinanciamentoSelecionado] = useState<Financiamento | null>(null);
	const [novoFinanciamentoData, setNovoFinanciamentoData] = useState<any>(null);
	const [transferenciaPlanoMode, setTransferenciaPlanoMode] = useState('transferencia');
	const [modalParcelasOpen, setModalParcelasOpen] = useState(false);
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationDate, setLiquidationDate] = useState('');

	const [formData, setFormData] = useState<FormData>({
		idPlanoContas: null,
		pessoaSelecionada: '',
		bancoSelecionado: '',
		idPessoa: null,
		idBanco: null,
		parcelado: false,
		numeroDocumento: '',
		idFinanciamento: null,
		idCentroCustos: null
	});

	// useRef para controlar se o modal já foi inicializado
	const modalInicializado = useRef(false);

	useEffect(() => {
		if (isOpen && !modalInicializado.current) {
			modalInicializado.current = true;
			
			if (movimentosSelecionados.length > 1) {
				// Limpa todos os campos para conciliação em lote
				setModalidadeMovimento('padrao');
				setIdPlanoContas(null);
				setIdPessoa(null);
				setIdBanco(null);
				setIdCentroCustos(null);
				setSearchCentroCustos('');
				setNumeroDocumento('');
				setParcelado(false);
				setParcelas([]);
				setSearchPlano('');
				setFinanciamentoSelecionado(null);
				setBuscaFinanciamento('');
				setRateios([]);
				setFormData({
					idPlanoContas: null,
					pessoaSelecionada: '',
					bancoSelecionado: '',
					idPessoa: null,
					idBanco: null,
					idCentroCustos: null,
					parcelado: false,
					numeroDocumento: '',
					idFinanciamento: null,
				});
			} else {
				// Mantém o comportamento existente para um único movimento
				setModalidadeMovimento(movimento.modalidadeMovimento || 'padrao');
				setIdPlanoContas(movimento.idPlanoContas || null);
				setIdPessoa(movimento.idPessoa || null);
				setIdBanco(movimento.idBanco || null);
				setIdCentroCustos(movimento.idCentroCustos || null);
				setSearchCentroCustos(movimento.idCentroCustos ? centroCustos.find(c => c.id === movimento.idCentroCustos)?.descricao || '' : '');
				setNumeroDocumento(movimento.numeroDocumento || '');
				setParcelado(movimento.parcelado || false);
				setParcelas([]);
				// Define o plano de contas selecionado
				if (movimento.idPlanoContas) {
					const planoSelecionado = planos.find(p => p.id === movimento.idPlanoContas);
					setSearchPlano(planoSelecionado ? planoSelecionado.descricao : '');
				} else {
					setSearchPlano('');
				}
				setFinanciamentoSelecionado(null);
				setBuscaFinanciamento('');
				
				setFormData({
					idPlanoContas: movimento.idPlanoContas || null,
					pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
					bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
					idPessoa: movimento.idPessoa || null,
					idBanco: movimento.idBanco || null,
					idCentroCustos: movimento.idCentroCustos || null,
					parcelado: movimento.parcelado || false,
					numeroDocumento: movimento.numeroDocumento || '',
					idFinanciamento: movimento.idFinanciamento || null,
				});
			}
			
			const inicializarModal = async () => {
				try {
					console.log('Inicializando modal...');
					const financiamentosList = await listarFinanciamentos();
					setFinanciamentos(financiamentosList);
					
					if (movimentosSelecionados.length === 1 && movimento.idFinanciamento) {
						const financiamento = financiamentosList.find(f => f.id === movimento.idFinanciamento);
						if (financiamento) {
							setFinanciamentoSelecionado(financiamento);
						}
					}
					
					// Removido validarFormulario() daqui para evitar loop
				} catch (error) {
					console.error('Erro ao inicializar modal:', error);
					toast.error('Erro ao carregar dados do modal');
				}
			};
			
			inicializarModal();
		}

		// Reset do flag quando o modal fecha
		if (!isOpen) {
			modalInicializado.current = false;
		}
	}, [isOpen]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				if (!cache.parametros) cache.parametros = await listarParametros();
				if (!cache.planosConta) cache.planosConta = await listarPlanoContas();
				if (!cache.bancos) cache.bancos = await listarBancos();
				if (!cache.pessoas) cache.pessoas = await listarPessoas();
				if (!cache.centroCustos) cache.centroCustos = await listarCentroCustos();

				setParametros(cache.parametros);
				setPlanosFetch(cache.planosConta.filter((p) => p.nivel === 3));
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

	const preencherCamposExistentes = () => {
		setModalidadeMovimento(movimento.modalidadeMovimento || 'padrao');

		if (movimento.modalidadeMovimento === 'padrao') {
			setFormData({
				idPlanoContas: movimento.idPlanoContas || null,
				pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
				bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
				idPessoa: movimento.idPessoa || null,
				idBanco: movimento.idBanco || null,
				parcelado: movimento.parcelado || false,
				numeroDocumento: movimento.numeroDocumento || '',
				idFinanciamento: movimento.idFinanciamento || null,
				idCentroCustos: movimento.idCentroCustos || null
			});
			setIdPlanoContas(movimento.idPlanoContas || null);
			const plano = planos.find((p) => p.id === movimento.idPlanoContas);
			setSearchPlano(plano ? plano.descricao : '');
		} else if (movimento.modalidadeMovimento === 'financiamento') {
			setIdPlanoContas(movimento.idPlanoContas || null);
			setFormData({
				idPlanoContas: movimento.idPlanoContas || null,
				pessoaSelecionada: movimento.idPessoa ? movimento.idPessoa.toString() : '',
				bancoSelecionado: movimento.idBanco ? movimento.idBanco.toString() : '',
				idPessoa: movimento.idPessoa || null,
				idBanco: movimento.idBanco || null,
				parcelado: movimento.parcelado || false,
				numeroDocumento: movimento.numeroDocumento || '',
				idFinanciamento: movimento.idFinanciamento || null,
				idCentroCustos: movimento.idCentroCustos || null
			});

			setNumeroDocumento(movimento.numeroDocumento || '');
			setParcelado(movimento.parcelado || false);
		}
	};

	const aplicarRateioComoResultadoList = (resultados: Resultado[]) => {
		movimento.resultadoList = resultados;
		const convertidos = resultados.map((r) => {
			const plano = planos.find((p) => p.id === r.idPlanoContas);
			return {
				idPlano: r.idPlanoContas,
				descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
				valor: r.valor,
			};
		});
		setRateios(convertidos);
		setRateioModalAberto(false);
	};

	const aplicarRateioCentrosComoCentroCustosList = (centros: MovimentoCentroCustos[]) => {
		movimento.centroCustosList = centros;
		const convertidos = centros.map((c) => {
			const centro = centroCustos.find((ct) => ct.id === c.idCentroCustos);
			return {
				idCentro: c.idCentroCustos,
				descricao: centro?.descricao || `Centro ${c.idCentroCustos}`,
				valor: c.valor,
			};
		});
		setRateiosCentros(convertidos);
		setRateioCentrosModalAberto(false);
	};

	const handleSearchCentroCustos = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchCentroCustos(value);
		setShowCentroCustosSuggestions(value.length > 0);
	};

	const selectCentroCustos = (centroCustos: CentroCustos) => {
		setIdCentroCustos(centroCustos.id);
		setSearchCentroCustos(centroCustos.descricao);
		setShowCentroCustosSuggestions(false);
		setFormData((prev: FormData) => ({ ...prev, idCentroCustos: centroCustos.id }));
	};

	const filteredCentroCustos = centroCustos.filter(centro =>
		centro.descricao.toLowerCase().includes(searchCentroCustos.toLowerCase())
	);

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
	const planosFiltered = planos
		.filter(
			(plano) =>
				plano.descricao.toLowerCase().includes(planosSearchValue.toLowerCase()) &&
				(movimento.tipoMovimento === 'D' ? plano.hierarquia.startsWith('002') : plano.hierarquia.startsWith('001')) &&
				plano.nivel === 3
		)
		.slice(0, 50);

	// Filtrar centro de custos com busca interna
	const centroCustosFiltered = centroCustos.filter(centro =>
		centro.descricao.toLowerCase().includes(centroCustosSearchValue.toLowerCase())
	);

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
			const multiplosPlanos = rateios.length > 0 || (movimento.resultadoList && movimento.resultadoList.length > 1);
			
			// Permite um plano único para múltiplos movimentos ou múltiplos planos para um único movimento
			if (!formData.idPlanoContas && !multiplosPlanos) {
				newErrors.idPlanoContas = 'Selecione um plano de contas ou defina múltiplos!';
			}
		}
		if (modalidadeMovimento === 'financiamento') {
			if (!financiamentoSelecionado) {
				newErrors.financiamento = 'Selecione um financiamento ou crie um novo!';
			}
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// useEffect para validação que só executa quando necessário
	useEffect(() => {
		if (isOpen && modalInicializado.current) {
			// Pequeno delay para garantir que todos os estados foram atualizados
			const timeoutId = setTimeout(() => {
				validarFormulario();
			}, 200);

			return () => clearTimeout(timeoutId);
		}
	}, [isOpen, modalInicializado.current, formData.idPlanoContas, modalidadeMovimento, financiamentoSelecionado?.id, rateios.length]);

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

	useEffect(() => {
		if (parcelado && movimento.valor > 0) {
			const valorParcela = (movimento.valor / numParcelas).toFixed(2);
			const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
				numParcela: i + 1,
				dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
				valor: valorParcela,
			}));
			setParcelas(novasParcelas);
		}
	}, [parcelado, numParcelas, movimento.valor]);

	const filteredPlanos = planos
		.filter(
			(plano) =>
				plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()) &&
				(movimento.tipoMovimento === 'D' ? plano.hierarquia.startsWith('002') : plano.hierarquia.startsWith('001')) &&
				plano.nivel === 3
		)
		.slice(0, 10);

	const handleSearchPlano = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchPlano(e.target.value);
		setShowSuggestions(true);
	};

	const selectPlano = (plano: { id: number; descricao: string; hierarquia: string }) => {
		setSearchPlano(plano.descricao);
		setFormData((prev: FormData) => ({ ...prev, idPlanoContas: plano.id }));
		setIdPlanoContas(plano.id);
		setShowSuggestions(false);
		setShowPlanoDropdown(false);
		setPlanosSearchValue('');
	};

	const selectPlanoNew = (plano: PlanoConta) => {
		setSearchPlano(plano.descricao);
		setFormData((prev: FormData) => ({ ...prev, idPlanoContas: plano.id }));
		setIdPlanoContas(plano.id);
		setShowPlanoDropdown(false);
		setPlanosSearchValue('');
	};

	const selectCentroCustosNew = (centro: CentroCustos) => {
		setIdCentroCustos(centro.id);
		setSearchCentroCustos(centro.descricao);
		setShowCentroCustosDropdown(false);
		setCentroCustosSearchValue('');
		setFormData((prev: FormData) => ({ ...prev, idCentroCustos: centro.id }));
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

	useEffect(() => {
		gerarParcelas();
	}, [parcelado, numParcelas, movimento.valor]);

	const gerarParcelas = () => {
		if (!parcelado || movimento.valor <= 0) {
			setParcelas([]);
			return;
		}
		const valorParcela = (movimento.valor / numParcelas).toFixed(2);
		const novasParcelas = Array.from({ length: numParcelas }, (_, i) => ({
			numParcela: i + 1,
			dt_vencimento: new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10),
			valor: valorParcela,
		}));
		setParcelas(novasParcelas);
	};

	const formatarData = (data: string) => {
		return new Date(data).toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
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
			console.log('financiamentosList ', financiamentosList);
		} catch (error) {
			console.error('Erro ao carregar financiamentos:', error);
		}
	};

	const financiamentosFiltrados = financiamentos.filter(f => 
		f.responsavel.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
		f.numeroContrato.toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
		(bancos.find(b => b.id === f.idBanco)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase()) ||
		(pessoas.find(p => p.id === f.idPessoa)?.nome || '').toLowerCase().includes(buscaFinanciamento.toLowerCase())
	);

	const handleSalvar = () => {
		if (!validarFormulario()) return;

		setIsSaving(true);
		try {
			let dados: any = {};

		console.log('formData ', formData);
		console.log('idPlanoContas ', idPlanoContas);
		if (modalidadeMovimento === 'padrao') {
				dados = {
					idPlanoContas: formData.idPlanoContas ? parseInt(formData.idPlanoContas.toString()) : null,
					idPessoa: formData.pessoaSelecionada ? parseInt(formData.pessoaSelecionada) : null,
					idBanco: formData.bancoSelecionado ? parseInt(formData.bancoSelecionado) : null,
					idCentroCustos: formData.idCentroCustos,
					modalidadeMovimento,
				};
				
				// Adicionar centroCustosList se houver múltiplos centros
				if (rateiosCentros.length > 0 || (movimento.centroCustosList ?? []).length > 0) {
					dados.centroCustosList = movimento.centroCustosList;
				}
			} else if (modalidadeMovimento === 'financiamento') {
				dados = {
					idPlanoContas: idPlanoContas,
					idFinanciamento: financiamentoSelecionado?.id,
					idCentroCustos: formData.idCentroCustos,
					modalidadeMovimento,
				};
				console.log('financiamento sendo enviado:', dados);
				
				// Adicionar centroCustosList se houver múltiplos centros
				if (rateiosCentros.length > 0 || (movimento.centroCustosList ?? []).length > 0) {
					dados.centroCustosList = movimento.centroCustosList;
				}
			} else if (modalidadeMovimento === 'transferencia') {
				const idPlano = transferenciaPlanoMode === 'transferencia' ? parametros[0]?.idPlanoTransferenciaEntreContas : 233; //Id plano de contas de aplicação de fundos (Tô com preguiça de parametrizar)
				
				dados = {
					idPlanoContas: idPlano,
					modalidadeMovimento,
				};
			}

			if (movimentosSelecionados.length > 1 && onConciliaMultiplos) {
				onConciliaMultiplos(dados);
			} else {
				handleConcilia(dados);
			}
			onClose();
		} catch (error) {
			console.error('Erro ao salvar movimento:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleLiquidarParcela = async () => {
		if (!selectedParcela || !liquidationDate) return;

		try {
			const parcelaAtualizada: ParcelaFinanciamento = {
				...selectedParcela,
				status: 'Liquidado' as 'Liquidado',
				dt_liquidacao: liquidationDate,
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);
			
			// Atualiza a lista de parcelas do financiamento selecionado
			if (financiamentoSelecionado) {
				const parcelasAtualizadas: ParcelaFinanciamento[] = financiamentoSelecionado.parcelasList?.map(p => 
					p.id === selectedParcela.id ? parcelaAtualizada : p
				) || [];
				
				const financiamentoAtualizado: Financiamento = {
					...financiamentoSelecionado,
					parcelasList: parcelasAtualizadas
				};
				
				setFinanciamentoSelecionado(financiamentoAtualizado);
				
				// Atualiza a lista de financiamentos
				const financiamentosAtualizados = financiamentos.map(f => 
					f.id === financiamentoAtualizado.id ? financiamentoAtualizado : f
				);
				setFinanciamentos(financiamentosAtualizados);
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

	const renderCampos = () => {
		if (modalidadeMovimento === 'padrao') {
			return (
				<>
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div ref={planoRef} className="relative mb-4">
							<label>
								Plano de Contas <span className="text-red-500">*</span>
							</label>
							<div className="flex w-full">
								<div className="relative w-full">
									<input
										type="text"
										className={`w-full p-2 border rounded-l cursor-pointer ${rateios.length > 1 || (movimento.resultadoList ?? []).length > 1 ? 'bg-gray-100' : ''}`}
										placeholder="Clique para selecionar plano de contas..."
										onClick={() => !(rateios.length > 1 || (movimento.resultadoList ?? []).length > 1) && setShowPlanoDropdown(!showPlanoDropdown)}
										value={rateios.length > 1 || (movimento.resultadoList ?? []).length > 1 ? 'Multiplos Planos' : searchPlano}
										readOnly
									/>
									<FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
								</div>
								<button
									type="button"
									className={`px-3 rounded-r ${
										movimentosSelecionados.length > 1
											? 'bg-gray-300 cursor-not-allowed'
											: 'bg-orange-500 hover:bg-orange-600 text-white'
									}`}
									onClick={() => movimentosSelecionados.length <= 1 && setRateioModalAberto(true)}
									disabled={movimentosSelecionados.length > 1}
									title={movimentosSelecionados.length > 1 ? 'Não é possível usar múltiplos planos em conciliação em lote' : 'Adicionar múltiplos planos'}
								>
									<FontAwesomeIcon icon={faPlus} className="font-bolder" />
								</button>
							</div>
							{errors.idPlanoContas && <p className="text-red-500 text-xs col-span-2">{errors.idPlanoContas}</p>}
							{(rateios.length > 1 || (movimento.resultadoList ?? []).length > 1) && (
								<p className="text-gray-500 text-xs col-span-2">
									Múltiplos planos configurados para rateio
								</p>
							)}

							{(movimento.resultadoList ?? []).length === 1 && movimento.idPlanoContas && (
								<p className="text-gray-500 text-xs col-span-2">
									Plano de contas já associado
								</p>
							)}
							{movimentosSelecionados.length > 1 && (
								<p className="text-gray-500 text-xs col-span-2">
									Selecione um plano único para aplicar a todos os movimentos selecionados
								</p>
							)}

							{showPlanoDropdown && (
								<div className="absolute z-50 bg-white w-full border-2 border-gray-300 shadow-lg rounded mt-1">
									<div className="p-2 border-b">
										<input
											type="text"
											className="w-full p-2 border rounded"
											placeholder="Buscar plano de contas..."
											value={planosSearchValue}
											onChange={(e) => setPlanosSearchValue(e.target.value)}
											autoFocus
										/>
									</div>
									<ul className="max-h-60 overflow-y-auto">
										{planosFiltered.length > 0 ? (
											planosFiltered.map((plano) => (
												<li 
													key={plano.id} 
													className="p-2 hover:bg-orange-100 text-sm cursor-pointer border-b last:border-b-0"
													onClick={() => selectPlanoNew(plano)}
												>
													<span className="font-semibold text-gray-600">{plano.hierarquia}</span> | {plano.descricao}
												</li>
											))
										) : (
											<li className="p-2 text-sm text-gray-500 text-center">
												Nenhum resultado encontrado
											</li>
										)}
									</ul>
								</div>
							)}
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Pessoa <span className="text-gray-500">(opcional)</span>
							</label>
							<select
								name="pessoaSelecionada"
								className="w-full p-2 border border-gray-300 rounded"
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
					</div>
					
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div ref={centroCustosRef} className="relative">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Centro de Custos <span className="text-gray-500">(opcional)</span>
							</label>
							<div className="flex w-full">
								<div className="relative w-full">
									<input
										type="text"
										className={`w-full p-2 border rounded-l cursor-pointer ${rateiosCentros.length > 1 || (movimento.centroCustosList ?? []).length > 1 ? 'bg-gray-100' : ''}`}
										placeholder="Clique para selecionar centro de custos..."
										onClick={() => !(rateiosCentros.length > 1 || (movimento.centroCustosList ?? []).length > 1) && setShowCentroCustosDropdown(!showCentroCustosDropdown)}
										value={rateiosCentros.length > 1 || (movimento.centroCustosList ?? []).length > 1 ? 'Múltiplos Centros' : searchCentroCustos}
										readOnly
									/>
									<FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
								</div>
								<button
									type="button"
									className={`px-3 rounded-r ${
										movimentosSelecionados.length > 1
											? 'bg-gray-300 cursor-not-allowed'
											: 'bg-green-500 hover:bg-green-600 text-white'
									}`}
									onClick={() => movimentosSelecionados.length <= 1 && setRateioCentrosModalAberto(true)}
									disabled={movimentosSelecionados.length > 1}
									title={movimentosSelecionados.length > 1 ? 'Não é possível usar múltiplos centros em conciliação em lote' : 'Adicionar múltiplos centros'}
								>
									<FontAwesomeIcon icon={faPlus} className="font-bolder" />
								</button>
							</div>
							{(rateiosCentros.length > 1 || (movimento.centroCustosList ?? []).length > 1) && (
								<p className="text-gray-500 text-xs col-span-2">
									Múltiplos centros configurados para rateio
								</p>
							)}

							{(movimento.centroCustosList ?? []).length === 1 && movimento.idCentroCustos && (
								<p className="text-gray-500 text-xs col-span-2">
									Centro de custos já associado
								</p>
							)}
							{movimentosSelecionados.length > 1 && (
								<p className="text-gray-500 text-xs col-span-2">
									Selecione um centro único para aplicar a todos os movimentos selecionados
								</p>
							)}

							{showCentroCustosDropdown && (
								<div className="absolute z-50 bg-white w-full border-2 border-gray-300 shadow-lg rounded mt-1">
									<div className="p-2 border-b">
										<input
											type="text"
											className="w-full p-2 border rounded"
											placeholder="Buscar centro de custos..."
											value={centroCustosSearchValue}
											onChange={(e) => setCentroCustosSearchValue(e.target.value)}
											autoFocus
										/>
									</div>
									<ul className="max-h-60 overflow-y-auto">
										{centroCustosFiltered.length > 0 ? (
											centroCustosFiltered.map((centro) => (
												<li 
													key={centro.id} 
													className="p-2 hover:bg-orange-100 text-sm cursor-pointer border-b last:border-b-0"
													onClick={() => selectCentroCustosNew(centro)}
												>
													{centro.descricao}
												</li>
											))
										) : (
											<li className="p-2 text-sm text-gray-500 text-center">
												Nenhum resultado encontrado
											</li>
										)}
									</ul>
								</div>
							)}
						</div>
						<div></div>
					</div>
				</>
			);
		}

		if (modalidadeMovimento === 'financiamento') {
			return (
				<>
					<div className="grid grid-cols-2 gap-4 mb-4" style={{position: 'relative'}}>
						<div className="col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Associar Financiamento <span className="text-red-500">*</span>
							</label>
							<div className="flex w-full">
								<input
									type="text"
									className="w-full p-2 border rounded-l"
									placeholder="Buscar por responsável, credor ou contrato"
									value={financiamentoSelecionado ? `${financiamentoSelecionado.numeroContrato} - ${financiamentoSelecionado.responsavel} (${bancos.find(b=>b.id===financiamentoSelecionado.idBanco)?.nome || pessoas.find(p=>p.id===financiamentoSelecionado.idPessoa)?.nome})` : buscaFinanciamento}
									onChange={e => setBuscaFinanciamento(e.target.value)}
									disabled={!!financiamentoSelecionado}
								/>
								{movimento.tipoMovimento === 'C' && (
									<button
										type="button"
										style={{height: 'auto'}}
										className={`text-white text-lg px-4 ${financiamentoSelecionado ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'} rounded-r `} 
										onClick={() => {
											if (financiamentoSelecionado) {
												setFinanciamentoSelecionado(null);
												setBuscaFinanciamento('');
											} else {
												setNovoFinanciamentoData({
													valor: movimento.valor?.toString().replace('.', ',') || '0,00',
													dataContrato: movimento.dtMovimento?.slice(0, 10) || '',
													observacao: "Conciliação Bancária: " + movimento.historico + " - No valor de: R$ " + movimento.valor || '',
												});
												setModalFinanciamentoOpen(true);
											}
										}}
										title={financiamentoSelecionado ? "Desvincular Financiamento" : "Novo Financiamento"}
									>
										<FontAwesomeIcon icon={financiamentoSelecionado ? faTimes : faPlus} />
									</button>
								)}
							</div>
							{errors.financiamento && <p className="text-red-500 text-xs">{errors.financiamento}</p>}
							
							{buscaFinanciamento && !financiamentoSelecionado && financiamentosFiltrados.length > 0 && (
								<ul className="absolute z-10 border rounded mt-1 bg-white max-h-40 overflow-y-auto w-full shadow-lg">
									{financiamentosFiltrados.map((f: Financiamento) => (
										<li
											key={f.id}
											className="p-2 cursor-pointer hover:bg-orange-100"
											onClick={() => setFinanciamentoSelecionado(f)}
										>
											<strong>{f.numeroContrato}</strong> - {f.responsavel} - {bancos.find(b=>b.id===f.idBanco)?.nome || pessoas.find(p=>p.id===f.idPessoa)?.nome}
										</li>
									))}
								</ul>
							)}
							
						</div>
					</div>

					{financiamentoSelecionado && (
						<div className="mt-6">
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
												<td className="p-2">{new Date(parcela.dt_vencimento).toLocaleDateString()}</td>
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
														<span className="text-sm text-gray-600">
															{new Date(parcela.dt_liquidacao!).toLocaleDateString()}
														</span>
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
				</>
			);
		}

		if (modalidadeMovimento === 'transferencia') {
			return (
				<div className="flex flex-col items-center text-center text-yellow-600 mt-10 mb-10">
					
					<p className="text-lg font-semibold text-gray-800 mb-2">Tipo do Movimento</p>
					<div className="flex items-center gap-5 pb-5 border-b border-gray-200 mb-6">
					<label className={`flex items-center gap-2 cursor-pointer text-gray-600 transition-all`}>
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
							<span>Mera Transferência</span>
						</label>

						<label className={`flex items-center gap-2 cursor-pointer transition-all text-gray-500`}>
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
							<span>Aplicação/Resgate em fundos</span>
						</label>
					</div>
					<FontAwesomeIcon icon={faMoneyBillTransfer} size="3x" />
					<p className="mt-2 font-medium">
						{transferenciaPlanoMode === 'transferencia' ? 'Mera transferência entre contas próprias da Fazenda' : 'Aplicação/Resgate em fundos'} <br />
						na qual será ignorada no Fluxo de Caixa!
					</p>
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
								<span className="font-semibold">
									{movimentosSelecionados.length} movimentos selecionados
								</span>
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
										<strong className={`${mov.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
											{formatarMoeda(mov.valor)}
										</strong>
									</div>
								))}
							</div>
						</div>
					) : (
						movimento && movimento.valor && (
							<div className="flex items-center justify-between border-gray-200 border text-gray-800 p-3 rounded-lg mb-4 shadow-sm text-sm">
								<span className="flex items-center gap-2 overflow-hidden">
									<span>{formatarData(movimento.dtMovimento)}</span>
									<span>|</span>
									<span className="truncate max-w-[430px]" title={movimento.historico}>
										{movimento.historico}
									</span>
								</span>
								<strong className={`${movimento.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
									{formatarMoeda(movimento.valor)}
								</strong>
							</div>
						)
					)}

					<div className="flex items-center justify-center mb-6 flex w-full justify-center rounded-lg border overflow-hidden">
						{['padrao', 'financiamento', 'transferencia'].map((tipo) => (
							<button
								key={tipo}
								onClick={() => setModalidadeMovimento(tipo)}
								// disabled={tipo === 'financiamento' && movimento.tipoMovimento === 'D'}
								className={`px-4 flex-1 text-center text-lg py-1 font-semibold ${
									modalidadeMovimento === tipo ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
								}`}
							>
								{tipo === 'padrao' && 'Padrão'}
								{tipo === 'financiamento' && 'Financiamento'}
								{tipo === 'transferencia' && 'Transferência'}
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
			<ModalRateioPlano
				isOpen={rateioModalAberto}
				onClose={() => setRateioModalAberto(false)}
				onConfirmar={aplicarRateioComoResultadoList}
				planosDisponiveis={planos}
				movimento={movimento}
				valorTotal={movimento.valor}
				rateios={rateios}
				setRateios={setRateios}
			/>
			<ModalRateioCentroCustos
				isOpen={rateioCentrosModalAberto}
				onClose={() => setRateioCentrosModalAberto(false)}
				onConfirmar={aplicarRateioCentrosComoCentroCustosList}
				centrosDisponiveis={centroCustos}
				movimento={movimento}
				valorTotal={movimento.valor}
				rateios={rateiosCentros}
				setRateios={setRateiosCentros}
			/>
			<ModalFinanciamento
				isOpen={modalFinanciamentoOpen}
				onClose={() => setModalFinanciamentoOpen(false)}
				onSave={async (financiamento: Financiamento) => {
					await salvarFinanciamento(financiamento);
					setModalFinanciamentoOpen(false);
					await carregarFinanciamentos();
					setFinanciamentoSelecionado(financiamento);
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
				message="Selecione a data de liquidação da parcela:"
				confirmLabel="Liquidar"
				cancelLabel="Cancelar"
			/>
		</>
	);
};

export default ConciliaPlanoContasModal;
