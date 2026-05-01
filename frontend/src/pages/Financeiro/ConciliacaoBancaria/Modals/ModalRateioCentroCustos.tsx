import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faArrowLeft, faWarning, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import { MovimentoCentroCustos } from '../../../../../../backend/src/models/MovimentoCentroCustos';
import { toast } from 'react-toastify';

interface RateioCentro {
	idCentro: number;
	descricao: string;
	valor: number;
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
	const [searchCentro, setSearchCentro] = useState('');
	const centroCustosRef = useRef(null);
	const [centroCustosSearchValue, setCentroCustosSearchValue] = useState('');
	const [showCentroCustosDropdown, setShowCentroCustosDropdown] = useState(false);
	const [porcentagemParcial, setPorcentagemParcial] = useState<string>('0');
	const [tipoCentroSelecionado, setTipoCentroSelecionado] = useState<'CUSTEIO' | 'INVESTIMENTO' | null>(null);
	const isDespesa = movimento.tipoMovimento === 'D';
	const isModoMultiplos = movimentosMultiplos && movimentosMultiplos.length > 1;

	const valorTotalAbsoluto = Math.abs(valorTotal);

	const totalRateado = isModoMultiplos ? 0 : rateios.reduce((acc, r) => acc + r.valor, 0);

	const porcentagemTotalRateada = isModoMultiplos
		? rateios.reduce((acc, r) => acc + r.valor, 0)
		: valorTotalAbsoluto > 0
			? rateios.reduce((acc, r) => acc + (r.valor / valorTotalAbsoluto) * 100, 0)
			: 0;

	const valorRestante = valorTotalAbsoluto - totalRateado;
	const porcentagemRestante = 100 - porcentagemTotalRateada;

	const porcentagemNumericaParcial = Number(porcentagemParcial.replace(',', '.')) || 0;

	const podeAdicionarCentro =
		isModoMultiplos ||
		rateios.length === 0 ||
		porcentagemTotalRateada < 100 - 0.001 ||
		totalRateado < valorTotalAbsoluto - 0.005;

	const idsCentrosJaNoRateio = new Set(rateios.map((r) => r.idCentro));

	const filteredCentros = centrosDisponiveis
		.filter((centro) => {
			if (idsCentrosJaNoRateio.has(centro.id)) return false;
			const buscaCorreta = centro.descricao.toLowerCase().includes(centroCustosSearchValue.toLowerCase());
			const matchTipoMovimento =
				movimento.tipoMovimento === 'C'
					? centro.tipoReceitaDespesa === 'RECEITA'
					: centro.tipoReceitaDespesa === 'DESPESA';
			const matchTipo = !isDespesa || !tipoCentroSelecionado || centro.tipo === tipoCentroSelecionado;
			return buscaCorreta && matchTipoMovimento && matchTipo;
		})
		.slice(0, 50);

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
				setRateios([]);
			} else if (movimento && (movimento.centroCustosList ?? []).length > 0 && centrosDisponiveis.length > 0) {
				const convertidos: RateioCentro[] = (movimento.centroCustosList ?? []).map((c) => {
					const centro = centrosDisponiveis.find((ct) => ct.id === c.idCentroCustos);
					if (!centro) {
						console.warn(`⚠️ Centro de custos não encontrado: ID ${c.idCentroCustos}`);
					}
					return {
						idCentro: c.idCentroCustos,
						descricao:
							centro?.descricao && centro.descricao.trim() !== ''
								? centro.descricao
								: `Centro ${c.idCentroCustos}`,
						valor: c.valor,
					};
				});
				setRateios(convertidos);
			}
		}
	}, [isOpen, isModoMultiplos, movimento, centrosDisponiveis]);

	useEffect(() => {
		if (!isOpen) {
			setSearchCentro('');
			setCentroSelecionado(null);
			setShowCentroCustosDropdown(false);
			setCentroCustosSearchValue('');
			setPorcentagemParcial('0');
			setTipoCentroSelecionado(null);
		} else if (isDespesa) {
			setTipoCentroSelecionado('CUSTEIO');
		}
	}, [isOpen, isDespesa]);

	const handleCancelar = () => {
		setRateios([]);
		onClose();
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		if (isModoMultiplos) {
			const rateiosPorcentagem: { idCentro: number; porcentagem: number }[] = rateios.map((r) => ({
				idCentro: r.idCentro,
				porcentagem: r.valor,
			}));
			onConfirmar(rateiosPorcentagem);
		} else {
			const novosCentros: MovimentoCentroCustos[] = rateios.map((r) => ({
				idMovimentoBancario: movimento.id,
				idCentroCustos: r.idCentro,
				valor: r.valor,
			}));
			onConfirmar(novosCentros);
		}
	};

	const handlePorcentagemChange = (value: string) => {
		const cleanValue = value.replace(/[^0-9.,]/g, '');
		const numValue = parseFloat(cleanValue.replace(',', '.')) || 0;
		if (numValue <= 100) {
			setPorcentagemParcial(cleanValue);
		}
	};

	const adicionarRateio = () => {
		if (!centroSelecionado) return;
		if (rateios.some((r) => r.idCentro === centroSelecionado.id)) {
			toast.warning('Este centro de custos já está na lista.');
			return;
		}
		if (!podeAdicionarCentro) {
			toast.warning('Distribuição já completa. Remova um item para adicionar outro.');
			return;
		}

		const pct = porcentagemNumericaParcial;
		if (pct <= 0) {
			toast.warning('Informe um percentual maior que zero.');
			return;
		}
		if (porcentagemTotalRateada + pct > 100 + 0.01) {
			toast.error('A soma dos percentuais não pode passar de 100%.');
			return;
		}

		if (isModoMultiplos) {
			setRateios([
				...rateios,
				{
					idCentro: centroSelecionado.id,
					descricao: centroSelecionado.descricao,
					valor: pct,
				},
			]);
		} else {
			let valorParaAdicionar = (pct / 100) * valorTotalAbsoluto;
			if (porcentagemTotalRateada + pct >= 99.9) {
				valorParaAdicionar = valorRestante;
			}
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
		setSearchCentro('');
		setShowCentroCustosDropdown(false);
		setCentroCustosSearchValue('');
		setPorcentagemParcial('0');
	};

	const removerRateio = (index: number) => {
		const novosRateios = [...rateios];
		novosRateios.splice(index, 1);
		setRateios(novosRateios);
	};

	const podeConfirmar = isModoMultiplos
		? rateios.length > 0 && Math.abs(porcentagemTotalRateada - 100) < 0.02
		: rateios.length > 0 &&
			Math.abs(totalRateado - valorTotalAbsoluto) < 0.02 &&
			Math.abs(porcentagemTotalRateada - 100) < 0.05;

	const addDisabled =
		!centroSelecionado ||
		!podeAdicionarCentro ||
		porcentagemNumericaParcial <= 0 ||
		porcentagemTotalRateada + porcentagemNumericaParcial > 100 + 0.01;

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

			<div className="flex flex-col sm:flex-row items-start gap-2 pt-3 p-5">
				<div className="flex-1 w-full relative" ref={centroCustosRef}>
					<label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custos</label>
					<div className="relative w-full">
						<input
							type="text"
							className={`w-full p-2 border rounded cursor-pointer ${!podeAdicionarCentro ? 'bg-gray-100' : ''}`}
							placeholder="Clique para selecionar centro de custos..."
							onClick={() => {
								if (!podeAdicionarCentro) return;
								const next = !showCentroCustosDropdown;
								setShowCentroCustosDropdown(next);
								if (next && isDespesa && tipoCentroSelecionado === null) {
									setTipoCentroSelecionado('CUSTEIO');
								}
							}}
							value={searchCentro}
							readOnly
							disabled={!podeAdicionarCentro}
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
														<span
															className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
																centro.tipo === 'INVESTIMENTO' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
															}`}
														>
															{centro.tipo === 'INVESTIMENTO' ? 'Inv' : 'Cust'}
														</span>
													)}
												</li>
											))
										) : (
											<li className="p-2 text-sm text-gray-500 text-center">Nenhum resultado encontrado</li>
										)}
									</ul>
								</>
							)}
							{isDespesa && !tipoCentroSelecionado && (
								<div className="p-4 text-center text-gray-500 text-sm">Selecione primeiro o tipo de despesa</div>
							)}
						</div>
					)}
				</div>

				<div className="w-full sm:w-28 flex-shrink-0">
					<label className="block text-sm font-medium text-gray-700 mb-1">Porcentagem %</label>
					<input
						type="text"
						className="w-full p-2 border rounded"
						placeholder="0"
						value={porcentagemParcial}
						onChange={(e) => handlePorcentagemChange(e.target.value)}
						disabled={!centroSelecionado || !podeAdicionarCentro || porcentagemRestante <= 0}
					/>
					{porcentagemRestante > 0 && rateios.length > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {porcentagemRestante.toFixed(2)}%
						</div>
					)}
				</div>

				<div className="w-full sm:w-auto flex flex-col justify-end">
					<label className="block text-sm font-medium text-gray-700 mb-1 invisible">Adicionar</label>
					<button
						type="button"
						onClick={adicionarRateio}
						className="bg-green-500 text-white font-semibold px-4 py-2 rounded w-full sm:w-auto hover:bg-green-600 flex items-center justify-center gap-2"
						disabled={addDisabled}
					>
						<FontAwesomeIcon icon={faPlus} />
						Adicionar
					</button>
				</div>
			</div>

			<div className="pt-1 p-5">
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
								const porcentagemRateio = isModoMultiplos
									? r.valor
									: valorTotalAbsoluto > 0
										? (r.valor / valorTotalAbsoluto) * 100
										: 0;
								return (
									<tr key={`${r.idCentro}-${idx}`} className="border-t">
										<td className="p-2">{r.descricao}</td>
										<td className="p-2 text-center">
											{isModoMultiplos ? (
												<span className="text-gray-400 italic">N/A (múltiplos movimentos)</span>
											) : (
												formatarMoeda(r.valor || 0)
											)}
										</td>
										<td className="p-2 text-center">{porcentagemRateio.toFixed(2)}%</td>
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
					{!isModoMultiplos && (
						<div className="flex flex-col gap-1">
							<span>Total Rateado:</span>
							<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
								R$ {formatarMoeda(totalRateado || 0)} / R$ {formatarMoeda(valorTotalAbsoluto || 0)}
							</span>
						</div>
					)}
					<div className="flex flex-col gap-1">
						<span>Porcentagem Total:</span>
						<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>{porcentagemTotalRateada.toFixed(2)}% / 100%</span>
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
