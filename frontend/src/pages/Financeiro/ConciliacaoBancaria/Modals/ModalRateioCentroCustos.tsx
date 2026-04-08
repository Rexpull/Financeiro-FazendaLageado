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

/** Ex.: "40, 30, 30" ou "40% 30% 30%" → lista de percentuais */
function parsePercentuaisLinha(raw: string): number[] {
	const s = raw.trim();
	if (!s) return [];
	const parts = s
		.split(/[,;]+/)
		.map((p) => p.trim().replace(/%/g, '').replace(/\s+/g, ''))
		.filter(Boolean);
	return parts.map((p) => {
		const n = parseFloat(p.replace(',', '.'));
		return Number.isFinite(n) ? n : NaN;
	});
}

/** Partes iguais em base 100,00%; o resto (centésimos) fica no último centro. */
function splitPercentEquallyWithRemainderOnLast(n: number): number[] {
	if (n <= 0) return [];
	const bp = 10000;
	const each = Math.floor(bp / n);
	const rem = bp - each * n;
	const out: number[] = [];
	for (let i = 0; i < n - 1; i++) out.push(each / 100);
	out.push((each + rem) / 100);
	return out;
}

/** Rateio em R$: primeiros n-1 arredondados; último absorve diferença para fechar o total. */
function aplicarPercentuaisEmValoresMonetarios(
	rateios: RateioCentro[],
	percentuais: number[],
	totalAbsoluto: number
): RateioCentro[] {
	const n = rateios.length;
	const out = rateios.map((r) => ({ ...r }));
	for (let i = 0; i < n - 1; i++) {
		const v = (percentuais[i] / 100) * totalAbsoluto;
		out[i].valor = Math.round(v * 100) / 100;
	}
	const sumPrev = out.slice(0, n - 1).reduce((a, r) => a + r.valor, 0);
	out[n - 1].valor = Math.round((totalAbsoluto - sumPrev) * 100) / 100;
	return out;
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
	const isModoMultiplos = movimentosMultiplos && movimentosMultiplos.length > 1;
	const isModoPorcentagemPura = isModoMultiplos;
	const [linhaPercentuais, setLinhaPercentuais] = useState('');
	const [tipoCentroSelecionado, setTipoCentroSelecionado] = useState<'CUSTEIO' | 'INVESTIMENTO' | null>(null);
	const [editandoPorcentagem, setEditandoPorcentagem] = useState<number | null>(null);
	const [valorPorcentagemEditando, setValorPorcentagemEditando] = useState<string>('');
	const isDespesa = movimento.tipoMovimento === 'D';

	const valorTotalAbsoluto = Math.abs(valorTotal);

	let totalRateado = 0;
	let porcentagemTotalRateada = 0;

	if (isModoPorcentagemPura) {
		porcentagemTotalRateada = rateios.reduce((acc, r) => acc + r.valor, 0);
		totalRateado = 0;
	} else {
		totalRateado = rateios.reduce((acc, r) => acc + r.valor, 0);
		porcentagemTotalRateada =
			valorTotalAbsoluto > 0
				? rateios.reduce((acc, r) => acc + (r.valor / valorTotalAbsoluto) * 100, 0)
				: 0;
	}

	const valorRestante = valorTotalAbsoluto - totalRateado;
	const porcentagemRestante = 100 - porcentagemTotalRateada;

	const podeAdicionarCentro =
		rateios.length === 0 || porcentagemTotalRateada < 100 - 0.001 || totalRateado < valorTotalAbsoluto - 0.005;

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
			setLinhaPercentuais('');
			setTipoCentroSelecionado(null);
			setEditandoPorcentagem(null);
			setValorPorcentagemEditando('');
		}
	}, [isOpen]);

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

	const aplicarLinhaPercentuais = () => {
		const nums = parsePercentuaisLinha(linhaPercentuais);
		if (rateios.length === 0) {
			toast.warning('Adicione os centros de custo antes de aplicar os percentuais.');
			return;
		}
		if (nums.length !== rateios.length) {
			toast.error(
				`Informe ${rateios.length} percentuais (ex.: 40, 30, 30), separados por vírgula — você digitou ${nums.length}.`
			);
			return;
		}
		if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
			toast.error('Use apenas números válidos para percentuais.');
			return;
		}
		const soma = nums.reduce((a, b) => a + b, 0);
		if (Math.abs(soma - 100) > 0.02) {
			toast.error(`A soma dos percentuais deve ser 100% (atual: ${soma.toFixed(2)}%).`);
			return;
		}

		if (isModoPorcentagemPura) {
			setRateios(rateios.map((r, i) => ({ ...r, valor: nums[i] })));
		} else {
			setRateios(aplicarPercentuaisEmValoresMonetarios(rateios, nums, valorTotalAbsoluto));
		}
		toast.success('Percentuais aplicados.');
	};

	const dividirIgualmente = () => {
		if (rateios.length === 0) {
			toast.warning('Adicione os centros de custo antes de dividir.');
			return;
		}
		const pcts = splitPercentEquallyWithRemainderOnLast(rateios.length);
		if (isModoPorcentagemPura) {
			setRateios(rateios.map((r, i) => ({ ...r, valor: pcts[i] })));
		} else {
			setRateios(aplicarPercentuaisEmValoresMonetarios(rateios, pcts, valorTotalAbsoluto));
		}
		toast.success('Percentuais divididos igualmente; diferença de arredondamento no último centro.');
	};

	const adicionarRateio = () => {
		if (!centroSelecionado) return;
		if (rateios.some((r) => r.idCentro === centroSelecionado.id)) {
			toast.warning('Este centro de custos já está na lista.');
			return;
		}

		if (isModoPorcentagemPura) {
			if (porcentagemTotalRateada >= 100 - 0.001) {
				toast.warning('Já totaliza 100%. Remova um centro ou ajuste os percentuais antes de adicionar outro.');
				return;
			}
			setRateios([
				...rateios,
				{
					idCentro: centroSelecionado.id,
					descricao: centroSelecionado.descricao,
					valor: 0,
				},
			]);
		} else {
			if (totalRateado >= valorTotalAbsoluto - 0.005 && rateios.length > 0) {
				toast.warning('Valor total já distribuído. Remova ou ajuste um centro para adicionar outro.');
				return;
			}
			setRateios([
				...rateios,
				{
					idCentro: centroSelecionado.id,
					descricao: centroSelecionado.descricao,
					valor: 0,
				},
			]);
		}

		setCentroSelecionado(null);
		setSearchCentro('');
		setShowCentroCustosDropdown(false);
		setCentroCustosSearchValue('');
	};

	const removerRateio = (index: number) => {
		const novosRateios = [...rateios];
		novosRateios.splice(index, 1);
		setRateios(novosRateios);
	};

	const iniciarEdicaoPorcentagem = (index: number) => {
		const porcentagemAtual = isModoPorcentagemPura
			? rateios[index].valor
			: valorTotalAbsoluto > 0
				? (rateios[index].valor / valorTotalAbsoluto) * 100
				: 0;
		setEditandoPorcentagem(index);
		setValorPorcentagemEditando(porcentagemAtual.toFixed(2));
	};

	const salvarEdicaoPorcentagem = (index: number) => {
		const novaPorcentagem = parseFloat(valorPorcentagemEditando.replace(',', '.')) || 0;

		const porcentagemOutros = rateios.reduce((acc, r, i) => {
			if (i === index) return acc;
			const porcentagemOutro = isModoPorcentagemPura
				? r.valor
				: valorTotalAbsoluto > 0
					? (r.valor / valorTotalAbsoluto) * 100
					: 0;
			return acc + porcentagemOutro;
		}, 0);

		if (novaPorcentagem < 0 || porcentagemOutros + novaPorcentagem > 100 + 0.01) {
			setEditandoPorcentagem(null);
			setValorPorcentagemEditando('');
			toast.error('Percentual inválido ou soma acima de 100%.');
			return;
		}

		const novosRateios = [...rateios];
		if (isModoPorcentagemPura) {
			novosRateios[index] = { ...novosRateios[index], valor: novaPorcentagem };
		} else {
			const novoValor = Math.round(((novaPorcentagem / 100) * valorTotalAbsoluto) * 100) / 100;
			novosRateios[index] = { ...novosRateios[index], valor: novoValor };
			const ult = novosRateios.length - 1;
			if (ult >= 0) {
				const sumExcUlt = novosRateios.slice(0, ult).reduce((a, r) => a + r.valor, 0);
				novosRateios[ult] = {
					...novosRateios[ult],
					valor: Math.round((valorTotalAbsoluto - sumExcUlt) * 100) / 100,
				};
			}
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
		const cleanValue = value.replace(/[^0-9.,]/g, '');
		const numValue = parseFloat(cleanValue.replace(',', '.')) || 0;
		if (numValue <= 100) {
			setValorPorcentagemEditando(cleanValue);
		}
	};

	const podeConfirmar = isModoPorcentagemPura
		? rateios.length > 0 && Math.abs(porcentagemTotalRateada - 100) < 0.02
		: rateios.length > 0 &&
			Math.abs(totalRateado - valorTotalAbsoluto) < 0.02 &&
			Math.abs(porcentagemTotalRateada - 100) < 0.05;

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

			<div className="flex items-start gap-2 pt-3 p-5">
				<div className="w-3/4 relative" ref={centroCustosRef}>
					<label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custos</label>
					<div className="relative w-full">
						<input
							type="text"
							className={`w-full p-2 border rounded cursor-pointer ${!podeAdicionarCentro ? 'bg-gray-100' : ''}`}
							placeholder="Clique para selecionar centro de custos..."
							onClick={() => (podeAdicionarCentro ? setShowCentroCustosDropdown(!showCentroCustosDropdown) : undefined)}
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

				<div className="w-1/4 flex flex-col justify-end">
					<label className="block text-sm font-medium text-gray-700 mb-1 invisible">Adicionar</label>
					<button
						type="button"
						onClick={adicionarRateio}
						className="bg-green-500 text-white font-semibold px-4 py-2 rounded w-full hover:bg-green-600 flex items-center justify-center gap-2"
						disabled={!centroSelecionado || !podeAdicionarCentro}
						title="Adiciona o centro à lista (percentuais pela linha ou dividir igualmente)"
					>
						<FontAwesomeIcon icon={faPlus} />
						Adicionar
					</button>
					{!isModoPorcentagemPura && valorRestante > 0 && rateios.length > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {formatarMoeda(valorRestante)} - {porcentagemRestante.toFixed(2)}%
						</div>
					)}
				</div>
			</div>

			<div className="px-5 pb-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
				<div className="flex-1">
					<label className="block text-sm font-medium text-gray-700 mb-1">Percentuais em uma linha (ordem da tabela abaixo)</label>
					<input
						type="text"
						className="w-full p-2 border rounded"
						placeholder="Ex.: 40, 30, 30"
						value={linhaPercentuais}
						onChange={(e) => setLinhaPercentuais(e.target.value)}
					/>
				</div>
				<button
					type="button"
					onClick={aplicarLinhaPercentuais}
					className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
				>
					Aplicar linha
				</button>
				<button
					type="button"
					onClick={dividirIgualmente}
					className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium text-sm whitespace-nowrap"
				>
					Dividir igualmente
				</button>
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
								const porcentagemRateio = isModoPorcentagemPura
									? r.valor
									: valorTotalAbsoluto > 0
										? (r.valor / valorTotalAbsoluto) * 100
										: 0;
								const valorExibido = isModoPorcentagemPura ? null : r.valor;
								return (
									<tr key={idx} className="border-t">
										<td className="p-2">{r.descricao}</td>
										<td className="p-2 text-center">
											{isModoPorcentagemPura ? (
												<span className="text-gray-400 italic">N/A (múltiplos movimentos)</span>
											) : (
												formatarMoeda(valorExibido ? valorExibido : 0)
											)}
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
