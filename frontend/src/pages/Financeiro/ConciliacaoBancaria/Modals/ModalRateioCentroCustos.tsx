import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faArrowLeft, faWarning, faSearch, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import CurrencyInput from 'react-currency-input-field';
import { MovimentoCentroCustos } from '../../../../../../backend/src/models/MovimentoCentroCustos';

interface RateioCentro {
	idCentro: number;
	descricao: string;
	valor: number; // Quando isModoMultiplos e tipoRateio é 'porcentagem', este campo armazena a porcentagem diretamente
}

interface ModalRateioCentroCustosProps {
	isOpen: boolean;
	onClose: () => void;
	valorTotal: number;
	movimento: MovimentoBancario;
	centrosDisponiveis: CentroCustos[];
	rateios: RateioCentro[];
	setRateios: (rateios: RateioCentro[]) => void;
	onConfirmar: (centros: MovimentoCentroCustos[] | { idCentro: number; porcentagem: number }[]) => void;
	movimentosMultiplos?: MovimentoBancario[];
}

const ModalRateioCentroCustos: React.FC<ModalRateioCentroCustosProps> = ({
	isOpen,
	onClose,
	valorTotal,
	centrosDisponiveis,
	movimento,
	rateios,
	setRateios,
	onConfirmar,
	movimentosMultiplos,
}) => {
	const [centroSelecionado, setCentroSelecionado] = useState<CentroCustos | null>(null);
	const [valorParcial, setValorParcial] = useState<string>('0,00');
	const [searchCentro, setSearchCentro] = useState('');
	const centroCustosRef = useRef(null);
	const [centroCustosSearchValue, setCentroCustosSearchValue] = useState('');
	const [showCentroCustosDropdown, setShowCentroCustosDropdown] = useState(false);
	const isModoMultiplos = movimentosMultiplos && movimentosMultiplos.length > 1;
	const [tipoRateio, setTipoRateio] = useState<'valor' | 'porcentagem'>(isModoMultiplos ? 'porcentagem' : 'valor');
	const [porcentagemParcial, setPorcentagemParcial] = useState<string>('0');
	const [tipoCentroSelecionado, setTipoCentroSelecionado] = useState<'CUSTEIO' | 'INVESTIMENTO' | null>(null);
	const [editandoPorcentagem, setEditandoPorcentagem] = useState<number | null>(null);
	const [valorPorcentagemEditando, setValorPorcentagemEditando] = useState<string>('');
	const isDespesa = movimento.tipoMovimento === 'D';

	const valorNumericoParcial = Number(valorParcial.replace(/\./g, '').replace(',', '.')) || 0;
	const porcentagemNumericaParcial = Number(porcentagemParcial) || 0;

	const valorTotalAbsoluto = Math.abs(valorTotal);
	
	// Debug: logar valores iniciais
	if (tipoRateio === 'porcentagem' && porcentagemParcial !== '0' && porcentagemParcial !== '') {
		console.log('🔍 DEBUG - Valores iniciais:');
		console.log('  - valorTotal:', valorTotal);
		console.log('  - valorTotalAbsoluto:', valorTotalAbsoluto);
		console.log('  - porcentagemParcial (string):', porcentagemParcial);
		console.log('  - porcentagemNumericaParcial:', porcentagemNumericaParcial);
		console.log('  - tipoRateio:', tipoRateio);
		console.log('  - isModoMultiplos:', isModoMultiplos);
	}
	
	// Quando há múltiplos movimentos e tipoRateio é 'porcentagem', trabalhar apenas com porcentagens puras
	const isModoPorcentagemPura = isModoMultiplos && tipoRateio === 'porcentagem';
	
	// Calcular total rateado e porcentagem total
	let totalRateado = 0;
	let porcentagemTotalRateada = 0;
	
	if (isModoPorcentagemPura) {
		// Em modo porcentagem pura, o campo 'valor' armazena a porcentagem diretamente
		porcentagemTotalRateada = rateios.reduce((acc, r) => acc + r.valor, 0);
		totalRateado = 0; // Não calculamos valores quando há múltiplos movimentos
	} else {
		// Modo normal: calcular valores e porcentagens baseados no valorTotalAbsoluto
		totalRateado = rateios.reduce((acc, r) => acc + r.valor, 0);
		porcentagemTotalRateada = rateios.reduce((acc, r) => {
			const porcentagemRateio = (r.valor / valorTotalAbsoluto) * 100;
			return acc + porcentagemRateio;
		}, 0);
	}
	
	const valorRestante = valorTotalAbsoluto - totalRateado;

	// Calcular valor baseado na porcentagem (apenas quando não está em modo porcentagem pura)
	const valorCalculadoPorcentagem = isModoPorcentagemPura 
		? 0 // Não calcular valor quando em modo porcentagem pura
		: (porcentagemNumericaParcial / 100) * valorTotalAbsoluto;
	const valorFinalParcial = tipoRateio === 'valor' ? valorNumericoParcial : valorCalculadoPorcentagem;

	// Calcular porcentagem restante
	const porcentagemRestante = 100 - porcentagemTotalRateada;

	// Filtrar centros baseado na busca e tipo (para despesas)
	const filteredCentros = centrosDisponiveis
		.filter((centro) => {
			const buscaCorreta = centro.descricao.toLowerCase().includes(centroCustosSearchValue.toLowerCase());
			// Filtrar por tipo de movimento: C (Crédito/Entrada) = Receita, D (Débito/Saída) = Despesa
			const matchTipoMovimento = movimento.tipoMovimento === 'C' 
				? centro.tipoReceitaDespesa === 'RECEITA'
				: centro.tipoReceitaDespesa === 'DESPESA';
			// Para despesas, filtrar também por tipo (CUSTEIO/INVESTIMENTO) se um tipo foi selecionado
			const matchTipo = !isDespesa || !tipoCentroSelecionado || centro.tipo === tipoCentroSelecionado;
			return buscaCorreta && matchTipoMovimento && matchTipo;
		})
		.slice(0, 50);

	// Funções de seleção
	const selectCentro = (centro: CentroCustos | null) => {
		if (centro === null) {
			setCentroSelecionado(null);
			setSearchCentro('');
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
		} else {
			setCentroSelecionado(centro);
			setSearchCentro(centro.descricao);
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
		}
	};

	// Fechar dropdowns ao clicar fora
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (centroCustosRef.current && !(centroCustosRef.current as any).contains(event.target)) {
				setShowCentroCustosDropdown(false);
			}
		};

		if (showCentroCustosDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showCentroCustosDropdown]);

	useEffect(() => {
		if (isOpen) {
			if (isModoMultiplos) {
				// Em modo múltiplos, não carregar do movimento
				setRateios([]);
			} else if (movimento && (movimento.centroCustosList ?? []).length > 0 && centrosDisponiveis.length > 0) {
				const convertidos: RateioCentro[] = (movimento.centroCustosList ?? []).map((c) => {
					const centro = centrosDisponiveis.find((ct) => ct.id === c.idCentroCustos);
					if (!centro) {
						console.warn(`⚠️ Centro de custos não encontrado: ID ${c.idCentroCustos}`);
					}
					return {
						idCentro: c.idCentroCustos,
						descricao: centro?.descricao && centro.descricao.trim() !== '' 
							? centro.descricao 
							: `Centro ${c.idCentroCustos}`,
						valor: c.valor,
					};
				});
				setRateios(convertidos);
			}
		}
	}, [isOpen, isModoMultiplos, movimento, centrosDisponiveis]);

	// Limpar busca quando modal fechar
	useEffect(() => {
		if (!isOpen) {
			setSearchCentro('');
			setCentroSelecionado(null);
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
			setValorParcial('0,00');
			setPorcentagemParcial('0');
			setTipoRateio(isModoMultiplos ? 'porcentagem' : 'valor');
			setTipoCentroSelecionado(null);
			setEditandoPorcentagem(null);
			setValorPorcentagemEditando('');
		}
	}, [isOpen, isModoMultiplos]);

	const handleCancelar = () => {
		setRateios([]);
		onClose();
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		if (isModoMultiplos) {
			// Retornar apenas porcentagens para múltiplos movimentos
			// Quando isModoPorcentagemPura, o campo 'valor' já contém a porcentagem diretamente
			const rateiosPorcentagem: { idCentro: number; porcentagem: number }[] = rateios.map((r) => {
				return {
					idCentro: r.idCentro,
					porcentagem: r.valor, // Já é a porcentagem quando isModoPorcentagemPura
				};
			});
			console.log('🔍 DEBUG - handleConfirmar (múltiplos):');
			console.log('  - rateios:', rateios);
			console.log('  - rateiosPorcentagem:', rateiosPorcentagem);
			onConfirmar(rateiosPorcentagem);
		} else {
			// Comportamento normal para movimento único
			const novosCentros: MovimentoCentroCustos[] = rateios.map((r) => ({
				idMovimentoBancario: movimento.id,
				idCentroCustos: r.idCentro,
				valor: r.valor,
			}));
			onConfirmar(novosCentros);
		}
	};

	const adicionarRateio = () => {
		if (!centroSelecionado) return;
		
		// Quando há múltiplos movimentos e tipoRateio é 'porcentagem', trabalhar apenas com porcentagens puras
		if (isModoPorcentagemPura) {
			// Validar porcentagem
			if (porcentagemNumericaParcial <= 0 || porcentagemTotalRateada + porcentagemNumericaParcial > 100) {
				return; // Não adicionar se exceder 100%
			}
			
			// Auto-correção: se estiver muito próximo de 100%, ajustar para o valor restante exato
			let porcentagemParaAdicionar = porcentagemNumericaParcial;
			const porcentagemComNovoRateio = porcentagemTotalRateada + porcentagemNumericaParcial;
			if (porcentagemComNovoRateio >= 99.9) {
				porcentagemParaAdicionar = porcentagemRestante; // Usar a porcentagem restante exata
			}
			
			// Armazenar a porcentagem diretamente no campo 'valor'
			setRateios([
				...rateios,
				{
					idCentro: centroSelecionado.id,
					descricao: centroSelecionado.descricao,
					valor: porcentagemParaAdicionar, // Armazenar porcentagem diretamente
				},
			]);
		} else {
			// Modo normal: trabalhar com valores
			let valorParaAdicionar: number;
			
			if (tipoRateio === 'porcentagem') {
				// Quando é porcentagem, calcular o valor baseado na porcentagem informada
				console.log('🔍 DEBUG - Adicionando rateio por porcentagem:');
				console.log('  - porcentagemNumericaParcial:', porcentagemNumericaParcial);
				console.log('  - valorTotalAbsoluto:', valorTotalAbsoluto);
				console.log('  - porcentagemParcial (string):', porcentagemParcial);
				
				valorParaAdicionar = (porcentagemNumericaParcial / 100) * valorTotalAbsoluto;
				
				console.log('  - valorParaAdicionar calculado:', valorParaAdicionar);
				
				// Auto-correção: se estiver muito próximo de 100%, ajustar para o valor restante exato
				const porcentagemComNovoRateio = porcentagemTotalRateada + porcentagemNumericaParcial;
				if (porcentagemComNovoRateio >= 99.9) { // Próximo de 100%
					valorParaAdicionar = valorRestante; // Usar o valor restante exato
					console.log('  - Ajustado para valorRestante:', valorParaAdicionar);
				}
				
				// Validação: não pode exceder 100%
				if (porcentagemTotalRateada + porcentagemNumericaParcial > 100) {
					console.log('  - ❌ ERRO: Porcentagem excede 100%');
					return; // Não adicionar se exceder 100%
				}
			} else {
				// Quando é valor, usar o valor informado diretamente
				valorParaAdicionar = valorFinalParcial;
				
				// Validação: não pode exceder o restante
				if (valorParaAdicionar > valorRestante) {
					return; // Não adicionar se exceder
				}
			}
			
			if (valorParaAdicionar <= 0) {
				console.log('  - ❌ ERRO: valorParaAdicionar <= 0:', valorParaAdicionar);
				return;
			}

			console.log('  - ✅ Adicionando rateio com valor:', valorParaAdicionar);

			setRateios([
				...rateios,
				{
					idCentro: centroSelecionado.id,
					descricao: centroSelecionado.descricao,
					valor: valorParaAdicionar,
				},
			]);
		}
		
			setCentroSelecionado(null);
			setValorParcial('0,00');
			setPorcentagemParcial('0');
			setSearchCentro(''); // Limpar campo de busca
			setShowCentroCustosDropdown(false); // Esconder dropdown
			setCentroCustosSearchValue(''); // Limpar busca do dropdown
	};

	const removerRateio = (index: number) => {
		const novosRateios = [...rateios];
		novosRateios.splice(index, 1);
		setRateios(novosRateios);
	};

	const iniciarEdicaoPorcentagem = (index: number) => {
		const porcentagemAtual = isModoPorcentagemPura 
			? rateios[index].valor 
			: (rateios[index].valor / valorTotalAbsoluto) * 100;
		setEditandoPorcentagem(index);
		setValorPorcentagemEditando(porcentagemAtual.toFixed(2));
	};

	const salvarEdicaoPorcentagem = (index: number) => {
		const novaPorcentagem = parseFloat(valorPorcentagemEditando) || 0;
		
		// Validar que não excede 100%
		const porcentagemOutros = rateios.reduce((acc, r, i) => {
			if (i === index) return acc;
			const porcentagemOutro = isModoPorcentagemPura 
				? r.valor 
				: (r.valor / valorTotalAbsoluto) * 100;
			return acc + porcentagemOutro;
		}, 0);
		
		if (novaPorcentagem <= 0 || porcentagemOutros + novaPorcentagem > 100) {
			// Cancelar edição se inválida
			setEditandoPorcentagem(null);
			setValorPorcentagemEditando('');
			return;
		}
		
		const novosRateios = [...rateios];
		if (isModoPorcentagemPura) {
			// Em modo porcentagem pura, armazenar a porcentagem diretamente
			novosRateios[index] = {
				...novosRateios[index],
				valor: novaPorcentagem,
			};
		} else {
			// Calcular o valor baseado na nova porcentagem
			const novoValor = (novaPorcentagem / 100) * valorTotalAbsoluto;
			novosRateios[index] = {
				...novosRateios[index],
				valor: novoValor,
			};
		}
		
		setRateios(novosRateios);
		setEditandoPorcentagem(null);
		setValorPorcentagemEditando('');
	};

	const cancelarEdicaoPorcentagem = () => {
		setEditandoPorcentagem(null);
		setValorPorcentagemEditando('');
	};

	const handlePorcentagemEditChange = (value: string) => {
		// Permitir apenas números e ponto decimal
		const cleanValue = value.replace(/[^0-9.]/g, '');
		const numValue = parseFloat(cleanValue) || 0;
		if (numValue <= 100) {
			setValorPorcentagemEditando(cleanValue);
		}
	};

	const podeConfirmar = isModoPorcentagemPura
		? Math.abs(porcentagemTotalRateada - 100) < 0.01 // Tolerância de 0.01% para problemas de centavos
		: tipoRateio === 'valor' 
			? totalRateado === valorTotalAbsoluto 
			: Math.abs(porcentagemTotalRateada - 100) < 0.01; // Tolerância de 0.01% para problemas de centavos

	const handlePorcentagemChange = (value: string) => {
		// Permitir apenas números e ponto decimal
		const cleanValue = value.replace(/[^0-9.]/g, '');
		
		// Validar se não excede 100%
		const numValue = parseFloat(cleanValue) || 0;
		if (numValue <= 100) {
			setPorcentagemParcial(cleanValue);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={handleCancelar}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto "
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
		>
			<div className="flex justify-between items-center bg-green-50 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-xl font-semibold text-gray-800">
					Rateio de centros de custos - {movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'}
					{isModoMultiplos && ` (${movimentosMultiplos?.length} movimentos)`}
				</h2>
				<button onClick={handleCancelar} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="xl" />
				</button>
			</div>

			{/* Switch para tipo de rateio - oculto em modo múltiplos */}
			{!isModoMultiplos && (
				<div className="px-5 py-3 bg-gray-50 border-b">
					<div className="flex items-center justify-center gap-4">
						<span className={`text-sm font-medium ${tipoRateio === 'valor' ? 'text-green-600' : 'text-gray-500'}`}>
							Rateio por Valor
						</span>
						<button
							type="button"
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
								tipoRateio === 'porcentagem' ? 'bg-green-600' : 'bg-gray-200'
							}`}
							onClick={() => setTipoRateio(tipoRateio === 'valor' ? 'porcentagem' : 'valor')}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									tipoRateio === 'porcentagem' ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</button>
						<span className={`text-sm font-medium ${tipoRateio === 'porcentagem' ? 'text-green-600' : 'text-gray-500'}`}>
							Rateio por Porcentagem
						</span>
					</div>
				</div>
			)}

			<div className="flex items-start gap-2 pt-3 p-5">
				<div className="w-3/4 relative" ref={centroCustosRef}>
					<label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custos</label>
					<div className="relative w-full">
						<input
							type="text"
							className={`w-full p-2 border rounded cursor-pointer ${!valorRestante || valorRestante <= 0 ? 'bg-gray-100' : ''}`}
							placeholder="Clique para selecionar centro de custos..."
							onClick={() => (!valorRestante || valorRestante <= 0 ? false : setShowCentroCustosDropdown(!showCentroCustosDropdown))}
							value={searchCentro}
							readOnly
							disabled={!valorRestante || valorRestante <= 0}
						/>
						<FontAwesomeIcon icon={faChevronDown} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
					</div>
					{showCentroCustosDropdown && (
						<div className="absolute z-50 bg-white w-full border-2 border-gray-300 shadow-lg rounded mt-1">
							{isDespesa && (
								<div className="p-2 border-b bg-gray-50">
									<label className="block text-xs font-medium text-gray-700 mb-2">Tipo de Despesa</label>
									<div className="flex ">
										<button
											type="button"
											onClick={() => {
												setTipoCentroSelecionado('CUSTEIO');
												// Limpar seleção de centro quando mudar o tipo
												setCentroSelecionado(null);
												setSearchCentro('');
												setCentroCustosSearchValue('');
											}}
											className={`flex-1 px-4 py-2 rounded-l-lg font-medium text-sm transition-all ${
												tipoCentroSelecionado === 'CUSTEIO'
													? 'bg-yellow-500 text-white shadow-md'
													: 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300	'
											}`}
										>
											Custeio
										</button>
										<button
											type="button"
											onClick={() => {
												setTipoCentroSelecionado('INVESTIMENTO');
												// Limpar seleção de centro quando mudar o tipo
												setCentroSelecionado(null);
												setSearchCentro('');
												setCentroCustosSearchValue('');
											}}
											className={`flex-1 px-4 py-2 rounded-r-lg font-medium text-sm transition-all ${
												tipoCentroSelecionado === 'INVESTIMENTO'
													? 'bg-blue-500 text-white shadow-md'
													: 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300	'
											}`}
										>
											Investimento
										</button>
									</div>
								</div>
							)}
							{(!isDespesa || tipoCentroSelecionado !== null) && (
								<>
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
										<li 
											className="p-2 hover:bg-gray-100 text-sm cursor-pointer border-b text-gray-500 italic"
											onClick={() => selectCentro(null)}
										>
											Selecione um centro
										</li>
										{filteredCentros.length > 0 ? (
											filteredCentros.map((centro) => (
												<li 
													key={centro.id} 
													className="p-2 hover:bg-orange-100 text-sm cursor-pointer border-b last:border-b-0 flex items-center justify-between"
													onClick={() => selectCentro(centro)}
												>
													<span>{centro.descricao}</span>
													{centro.tipo && centro.tipoReceitaDespesa === 'DESPESA' && (
														<span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
															centro.tipo === 'INVESTIMENTO' 
																? 'bg-blue-100 text-blue-800' 
																: 'bg-yellow-100 text-yellow-800'
														}`}>
															{centro.tipo === 'INVESTIMENTO' ? 'Inv' : 'Cust'}
														</span>
													)}
												</li>
											))
										) : (
											<li className="p-2 text-sm text-gray-500 text-center">
												Nenhum resultado encontrado
											</li>
										)}
									</ul>
								</>
							)}
							{isDespesa && !tipoCentroSelecionado && (
								<div className="p-4 text-center text-gray-500 text-sm">
									Selecione primeiro o tipo de despesa
								</div>
							)}
						</div>
					)}
				</div>

				<div className="w-1/4">
					<label className="block text-sm font-medium text-gray-700 mb-1">
						{tipoRateio === 'valor' 
							? `Valor R$`
							: 'Porcentagem %'
						}
					</label>
					<div className="flex items-center">
						{tipoRateio === 'valor' ? (
						<CurrencyInput
							name="valorParcial"
							className="w-full p-2 border rounded-l"
							placeholder="R$ 0,00"
							decimalsLimit={2}
							prefix="R$ "
							decimalSeparator=","
							groupSeparator="."
							value={valorParcial}
							onValueChange={(value) => setValorParcial(value || '0,00')}
							disabled={!centroSelecionado || (!isModoPorcentagemPura && valorRestante <= 0)}
						/>
						) : (
							<input
								type="text"
								className="w-full p-2 border rounded-l"
								placeholder="0"
								value={porcentagemParcial}
								onChange={(e) => handlePorcentagemChange(e.target.value)}
								disabled={!centroSelecionado || porcentagemRestante <= 0}
							/>
						)}

						<button
							onClick={adicionarRateio}
							className="bg-green-500 text-white font-semibold px-4 py-2 rounded-r hover:bg-green-600"
							disabled={
								!centroSelecionado || 
								(isModoPorcentagemPura && (porcentagemNumericaParcial <= 0 || porcentagemTotalRateada + porcentagemNumericaParcial > 100)) ||
								(!isModoPorcentagemPura && tipoRateio === 'valor' && (valorFinalParcial <= 0 || valorFinalParcial > valorRestante)) ||
								(!isModoPorcentagemPura && tipoRateio === 'porcentagem' && (porcentagemNumericaParcial <= 0 || porcentagemTotalRateada + porcentagemNumericaParcial > 100))
							}
						>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					{tipoRateio === 'valor' && valorRestante > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {formatarMoeda(valorRestante)}
						</div>
					)}
					{tipoRateio === 'porcentagem' && porcentagemRestante > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {porcentagemRestante.toFixed(2)}%
						</div>
					)}
				</div>
			</div>

			<div className="pt-3 p-5">
				<div className="border rounded">
					<table className="w-full text-sm">
						<thead className="bg-gray-100">
							<tr>
								<th className="p-2 text-left">Centro de Custos</th>
								<th className="p-2 text-center">Valor</th>
								<th className="p-2 text-center">Porcentagem</th>
								<th className="p-2 text-right pr-2" style={{ width: '50px' }}>
									Ação
								</th>
							</tr>
						</thead>
						<tbody>
							{rateios.map((r, idx) => {
								// Quando isModoPorcentagemPura, o campo 'valor' já contém a porcentagem diretamente
								const porcentagemRateio = isModoPorcentagemPura 
									? r.valor 
									: (r.valor / valorTotalAbsoluto) * 100;
								const valorExibido = isModoPorcentagemPura 
									? null // Não exibir valor quando em modo porcentagem pura
									: r.valor;
								return (
								<tr key={idx} className="border-t">
									<td className="p-2">{r.descricao}</td>
									<td className="p-2 text-center">
										{isModoPorcentagemPura 
											? <span className="text-gray-400 italic">N/A (múltiplos movimentos)</span>
											: formatarMoeda(valorExibido ? valorExibido : 0)
										}
									</td>
									<td className="p-2 text-center">
										{editandoPorcentagem === idx ? (
											<div className="flex items-center justify-center gap-1">
												<input
													type="text"
													className="w-20 p-1 border rounded text-center text-sm"
													value={valorPorcentagemEditando}
													onChange={(e) => handlePorcentagemEditChange(e.target.value)}
													onBlur={() => salvarEdicaoPorcentagem(idx)}
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															salvarEdicaoPorcentagem(idx);
														} else if (e.key === 'Escape') {
															cancelarEdicaoPorcentagem();
														}
													}}
													autoFocus
												/>
												<span>%</span>
											</div>
										) : (
											<span 
												className="cursor-pointer hover:text-blue-600 hover:underline"
												onClick={() => iniciarEdicaoPorcentagem(idx)}
												title="Clique para editar"
											>
												{porcentagemRateio.toFixed(2)}%
											</span>
										)}
									</td>
									<td className="p-2 text-right pr-4" style={{ width: '50px' }}>
										<button onClick={() => removerRateio(idx)} className="text-red-500 hover:text-red-700">
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
								);
							})}
							{rateios.length === 0 && (
								<tr>
									<td colSpan={4} className="text-center text-gray-500 p-4">
										Nenhum centro adicionado.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex justify-between items-center gap-4 mt-4 p-5 border-t">
				<div className="flex justify-start gap-4 text-sm font-medium">
					{!isModoPorcentagemPura && (
						<div className="flex flex-col gap-1">
							<span>Total Rateado:</span>
							<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
								R$ {formatarMoeda(totalRateado ? totalRateado : 0)} / R$ {formatarMoeda(valorTotalAbsoluto ? valorTotalAbsoluto : 0)}
							</span>
						</div>
					)}
					<div className="flex flex-col gap-1">
						<span>Porcentagem Total:</span>
						<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
							{porcentagemTotalRateada.toFixed(2)}% / 100%
						</span>
					</div>
				</div>

				<div className="flex justify-end gap-3">
					<button
						onClick={handleCancelar}
						className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded hover:bg-gray-200 font-semibold"
					>
						<FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
						Cancelar
					</button>
					<button
						onClick={handleConfirmar}
						className="px-4 py-2 bg-green-500 text-white font-semibold rounded hover:bg-green-600"
						disabled={!podeConfirmar}
					>
						<FontAwesomeIcon icon={faCheck} className="mr-2" />
						Confirmar Rateio
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default ModalRateioCentroCustos;

