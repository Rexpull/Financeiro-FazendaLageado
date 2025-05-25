import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCheck, faInfoCircle, faUsers, faMoneyBillTransfer, faSearch, faPlus, faEdit, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { listarPlanoContas } from '../../../../services/planoContasService';
import { listarBancos } from '../../../../services/bancoService';
import { listarPessoas } from '../../../../services/pessoaService';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { listarParametros } from '../../../../services/parametroService';
import { Parametro } from '../../../../../../backend/src/models/Parametro';
import { Banco } from '../../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../../backend/src/models/Pessoa';
import ModalRateioPlano from './ModalRateioPlano';
import { Resultado } from '../../../../../../backend/src/models/Resultado';
import ModalFinanciamento from '../../Financiamento/ModalFinanciamento';
import { listarFinanciamentos, salvarFinanciamento } from '../../../../services/financiamentoService';
import { Financiamento } from '../../../../../../backend/src/models/Financiamento';
import ModalParcelas from '../../Financiamento/ModalParcelas';
import DialogModal from '../../../../components/DialogModal';
import { toast } from 'react-toastify';
import { ParcelaFinanciamento } from '../../../../../../backend/src/models/ParcelaFinanciamento';
import { salvarParcelaFinanciamento } from '../../../../services/parcelaFinanciamentoService';
import ListFinanciamentos from '../../Financiamento/ListFinanciamentos';
  
Modal.setAppElement('#root');

const cache: {
	parametros: Parametro[] | null;
	bancos: Banco[] | null;
	pessoas: Pessoa[] | null;
	planosConta: PlanoConta[] | null;
} = {
	parametros: null,
	bancos: null,
	pessoas: null,
	planosConta: null,
};

interface ConciliaPlanoContasModalProps {
	isOpen: boolean;
	onClose: () => void;
	movimento: MovimentoBancario;
	planos: { id: number; descricao: string; tipo: string; hierarquia: string; nivel: number }[];
	handleConcilia: (data: any) => void;
}

interface FormData {
	idPlanoContas: number | null;
	pessoaSelecionada: string;
	bancoSelecionado: string;
	idPessoa: number | null;
	idBanco: number | null;
	parcelado: boolean;
	numeroDocumento: string;
	idFinanciamento: number | null;
}

const ConciliaPlanoContasModal: React.FC<ConciliaPlanoContasModalProps> = ({ isOpen, onClose, movimento, planos, handleConcilia }) => {
	const [modalidadeMovimento, setModalidadeMovimento] = useState('padrao');
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
	const [rateioModalAberto, setRateioModalAberto] = useState(false);
	const [rateios, setRateios] = useState<{ idPlano: number; descricao: string; valor: number }[]>([]);
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
		idFinanciamento: null
	});

	useEffect(() => {
		if (isOpen) {
			setModalidadeMovimento('padrao');
			setIdPlanoContas(null);
			setIdPessoa(null);
			setIdBanco(null);
			setNumeroDocumento('');
			setParcelado(false);
			setParcelas([]);
			setSearchPlano('');
			setFinanciamentoSelecionado(null);
			setBuscaFinanciamento('');
			
			const inicializarModal = async () => {
				try {
					const financiamentosList = await listarFinanciamentos();
					setFinanciamentos(financiamentosList);
					console.log('financiamentosList ', financiamentosList);
					
					setFormData({
						idPlanoContas: movimento.idPlanoContas || null,
						pessoaSelecionada: '',
						bancoSelecionado: '',
						idPessoa: movimento.idPessoa || null,
						idBanco: movimento.idBanco || null,
						parcelado: movimento.parcelado || false,
						numeroDocumento: movimento.numeroDocumento || '',
						idFinanciamento: movimento.idFinanciamento || null
					});
					
					console.log('movimento ', movimento);
					if (movimento.idFinanciamento) {
						const financiamento = financiamentosList.find(f => f.id === movimento.idFinanciamento);
						console.log('financiamento encontrado ', financiamento);
						
						if (financiamento) {
							setFinanciamentoSelecionado(financiamento);
						}
					}
					
					preencherCamposExistentes();
					validarFormulario();
				} catch (error) {
					console.error('Erro ao inicializar modal:', error);
					toast.error('Erro ao carregar dados do modal');
				}
			};
			
			inicializarModal();
		}
	}, [isOpen]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				if (!cache.parametros) cache.parametros = await listarParametros();
				if (!cache.planosConta) cache.planosConta = await listarPlanoContas();
				if (!cache.bancos) cache.bancos = await listarBancos();
				if (!cache.pessoas) cache.pessoas = await listarPessoas();

				setParametros(cache.parametros);

				setPlanosFetch(cache.planosConta.filter((p) => p.nivel === 3));
				setBancos(cache.bancos);
				setPessoas(cache.pessoas);
			} catch (error) {
				console.error('Erro ao buscar dados:', error);
			}
		};

		if (isOpen) {
			fetchData();
		}
	}, [isOpen]);

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
				idFinanciamento: movimento.idFinanciamento || null
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
				idFinanciamento: movimento.idFinanciamento || null
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

	useEffect(() => {
		if (modalidadeMovimento === 'financiamento' && parametros.length > 0) {
			if (movimento.tipoMovimento === 'C') {
				const idPlano = parametros[0]?.idPlanoEntradaFinanciamentos;
				if (idPlano) {
					setFormData((prev) => ({ ...prev, idPlanoContas: idPlano.toString() }));
					setIdPlanoContas(idPlano);
					const plano = planos.find((p) => p.id === idPlano);
					setSearchPlano(plano ? plano.descricao : '');
				}
			} else {
				const idPlano = parametros[0]?.idPlanoPagamentoFinanciamentos;
				if (idPlano) {
					setFormData((prev) => ({ ...prev, idPlanoContas: idPlano.toString() }));
					setIdPlanoContas(idPlano);
					const plano = planos.find((p) => p.id === idPlano);
					setSearchPlano(plano ? plano.descricao : '');
				}
			}
		}
	}, [modalidadeMovimento, parametros, movimento.tipoMovimento, planos]);

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
			let dados = {};

			console.log('formData ', formData);
			console.log('idPlanoContas ', idPlanoContas);
			if (modalidadeMovimento === 'padrao') {
				dados = {
					idPlanoContas: parseInt(formData.idPlanoContas),
					idPessoa: formData.pessoaSelecionada ? parseInt(formData.pessoaSelecionada) : null,
					idBanco: formData.bancoSelecionado ? parseInt(formData.bancoSelecionado) : null,
					modalidadeMovimento,
				};
			} else if (modalidadeMovimento === 'financiamento') {
				dados = {
					idPlanoContas: idPlanoContas,
					idFinanciamento: financiamentoSelecionado?.id,
					modalidadeMovimento,
				};
				console.log('financiamento sendo enviado:', dados)
			} else if (modalidadeMovimento === 'transferencia') {
				const idPlano = transferenciaPlanoMode === 'transferencia' ? parametros[0]?.idPlanoTransferenciaEntreContas : 172; //Id plano de contas de aplicação de fundos (Tô com preguiça de parametrizar)
				
				dados = {
					idPlanoContas: idPlano,
					modalidadeMovimento,
				};
			}

			handleConcilia(dados);
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
										className="w-full p-2 border rounded-l"
										placeholder="Pesquisar plano de contas..."
										onChange={handleSearchPlano}
										value={rateios.length > 0 || (movimento.resultadoList ?? []).length > 0 ? 'Multiplos Planos' : searchPlano}
										disabled={rateios.length > 0 || (movimento.resultadoList ?? []).length > 0}
									/>
									<FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
								</div>
								<button
									type="button"
									className="bg-orange-500 text-white px-3 rounded-r hover:bg-orange-600"
									onClick={() => setRateioModalAberto(true)}
								>
									<FontAwesomeIcon icon={faPlus} className="font-bolder" />
								</button>
							</div>
							{errors.idPlanoContas && <p className="text-red-500 text-xs col-span-2">{errors.idPlanoContas}</p>}

							{showSuggestions && (
								<ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10">
									{filteredPlanos.map((plano) => (
										<li key={plano.id} className="p-2 hover:bg-gray-200 text-sm cursor-pointer" onClick={() => selectPlano(plano)}>
											{plano.hierarquia} | {plano.descricao}
										</li>
									))}
								</ul>
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
							
							{buscaFinanciamento && !financiamentoSelecionado && (
								<ul className="absolute z-10 border rounded mt-1 bg-white max-h-40 overflow-y-auto w-full shadow-lg">
									{financiamentosFiltrados.map(f => (
										<li
											key={f.id}
											className={`p-2 cursor-pointer hover:bg-orange-100 ${financiamentoSelecionado?.id === f.id ? 'bg-orange-200' : ''}`}
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
							<span>Aplicação de Fundos</span>
						</label>
					</div>
					<FontAwesomeIcon icon={faMoneyBillTransfer} size="3x" />
					<p className="mt-2 font-medium">
						{transferenciaPlanoMode === 'transferencia' ? 'Mera transferência entre contas próprias da Fazenda' : 'Aplicação de fundos'} <br />
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
					<h2 className="text-xl font-semibold text-gray-800">Associação de Plano de Contas</h2>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
						<FontAwesomeIcon icon={faTimes} size="xl" />
					</button>
				</div>

				<div className="p-4">
					{movimento && movimento.valor && (
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
			<ModalFinanciamento
				isOpen={modalFinanciamentoOpen}
				onClose={() => setModalFinanciamentoOpen(false)}
				onSave={async (financiamento: Financiamento) => {
					await salvarFinanciamento(financiamento);
					setModalFinanciamentoOpen(false);
					await carregarFinanciamentos();
					setFinanciamentoSelecionado(financiamento);
				}}
				bancos={bancos}
				pessoas={pessoas}
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
					bancos={bancos}
					pessoas={pessoas}
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
		</>
	);
};

export default ConciliaPlanoContasModal;
