import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faArrowLeft, faSearch } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import { Resultado } from '../../../../../../backend/src/models/Resultado';
import { toast } from 'react-toastify';
import {
	parsePercentuaisLinha,
	splitPercentEquallyWithRemainderOnLast,
	aplicarPercentuaisEmValoresMonetarios,
} from './rateioPercentuais';

interface Rateio {
	idPlano: number;
	descricao: string;
	valor: number;
}

interface ModalRateioPlanoProps {
	isOpen: boolean;
	onClose: () => void;
	valorTotal: number;
	movimento: MovimentoBancario;
	planosDisponiveis: PlanoConta[];
	rateios: Rateio[];
	setRateios: (rateios: Rateio[]) => void;
	onConfirmar: (resultados: Resultado[] | { idPlano: number; porcentagem: number }[]) => void;
	movimentosMultiplos?: MovimentoBancario[];
}

const ModalRateioPlano: React.FC<ModalRateioPlanoProps> = ({
	isOpen,
	onClose,
	valorTotal,
	planosDisponiveis,
	movimento,
	rateios,
	setRateios,
	onConfirmar,
	movimentosMultiplos,
}) => {
	const [planoSelecionado, setPlanoSelecionado] = useState<PlanoConta | null>(null);
	const [searchPlano, setSearchPlano] = useState('');
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [linhaPercentuais, setLinhaPercentuais] = useState('');
	const isModoMultiplos = movimentosMultiplos && movimentosMultiplos.length > 1;

	const valorTotalAbsoluto = Math.abs(valorTotal);

	const totalRateado = isModoMultiplos ? 0 : rateios.reduce((acc, r) => acc + r.valor, 0);

	const porcentagemTotalRateada = isModoMultiplos
		? rateios.reduce((acc, r) => acc + r.valor, 0)
		: valorTotalAbsoluto > 0
			? rateios.reduce((acc, r) => acc + (r.valor / valorTotalAbsoluto) * 100, 0)
			: 0;

	const rateiosOriginais = useRef<Rateio[]>([]);

	const idsPlanosNoRateio = new Set(rateios.map((r) => r.idPlano));

	const filteredPlanos = planosDisponiveis
		.filter((plano) => {
			const ehReceita = movimento.tipoMovimento === 'C';
			const hierarquiaCorreta = ehReceita ? plano.hierarquia.startsWith('001') : plano.hierarquia.startsWith('002');
			const buscaCorreta =
				plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()) ||
				plano.hierarquia.toLowerCase().includes(searchPlano.toLowerCase());
			return plano.nivel === 3 && hierarquiaCorreta && buscaCorreta;
		})
		.slice(0, 10);

	const podeAdicionarPlano =
		isModoMultiplos ||
		rateios.length === 0 ||
		porcentagemTotalRateada < 100 - 0.001 ||
		totalRateado < valorTotalAbsoluto - 0.005;

	const handleSearchPlano = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchPlano(e.target.value);
		setShowSuggestions(true);
		setPlanoSelecionado(null);
	};

	const selectPlano = (plano: PlanoConta) => {
		setSearchPlano(plano.descricao);
		setPlanoSelecionado(plano);
		setShowSuggestions(false);
	};

	useEffect(() => {
		if (isOpen) {
			if (isModoMultiplos) {
				setRateios([]);
				rateiosOriginais.current = [];
			} else if (movimento && (movimento.resultadoList ?? []).length > 0) {
				const convertidos: Rateio[] = (movimento.resultadoList ?? []).map((r) => {
					const plano = planosDisponiveis.find((p) => p.id === r.idPlanoContas);
					return {
						idPlano: r.idPlanoContas,
						descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
						valor: r.valor,
					};
				});
				rateiosOriginais.current = convertidos;
				setRateios(convertidos);
			}
		}
	}, [isOpen, isModoMultiplos]); // intentionally not including movimento.details to mirror prior behavior on open-only

	useEffect(() => {
		if (!isOpen) {
			setSearchPlano('');
			setPlanoSelecionado(null);
			setShowSuggestions(false);
			setLinhaPercentuais('');
		}
	}, [isOpen]);

	const handleCancelar = () => {
		setRateios(rateiosOriginais.current);
		onClose();
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		if (isModoMultiplos) {
			const rateiosPorcentagem: { idPlano: number; porcentagem: number }[] = rateios.map((r) => ({
				idPlano: r.idPlano,
				porcentagem: r.valor,
			}));
			onConfirmar(rateiosPorcentagem);
		} else {
			const novosResultados: Resultado[] = rateios.map((r) => ({
				idPlanoContas: r.idPlano,
				valor: r.valor,
				tipo: movimento.tipoMovimento ?? 'C',
				idContaCorrente: movimento.idContaCorrente,
				dtMovimento: movimento.dtMovimento,
			}));
			onConfirmar(novosResultados);
		}
	};

	const adicionarRateio = () => {
		if (!planoSelecionado) return;
		if (idsPlanosNoRateio.has(planoSelecionado.id)) {
			toast.warning('Este plano de contas já está na lista.');
			return;
		}
		if (!podeAdicionarPlano) {
			toast.warning('Distribuição já completa. Remova um item para adicionar outro.');
			return;
		}

		setRateios([
			...rateios,
			{
				idPlano: planoSelecionado.id,
				descricao: planoSelecionado.descricao,
				valor: 0,
			},
		]);
		setPlanoSelecionado(null);
		setSearchPlano('');
		setShowSuggestions(false);
	};

	const aplicarLinhaPercentuais = () => {
		const nums = parsePercentuaisLinha(linhaPercentuais);
		if (rateios.length === 0) {
			toast.warning('Adicione os planos de contas antes de aplicar os percentuais.');
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

		if (isModoMultiplos) {
			setRateios(rateios.map((r, i) => ({ ...r, valor: nums[i] })));
		} else {
			setRateios(aplicarPercentuaisEmValoresMonetarios(rateios, nums, valorTotalAbsoluto));
		}
		toast.success('Percentuais aplicados.');
	};

	const dividirIgualmente = () => {
		if (rateios.length === 0) {
			toast.warning('Adicione os planos de contas antes de dividir.');
			return;
		}
		const pcts = splitPercentEquallyWithRemainderOnLast(rateios.length);
		if (isModoMultiplos) {
			setRateios(rateios.map((r, i) => ({ ...r, valor: pcts[i] })));
		} else {
			setRateios(aplicarPercentuaisEmValoresMonetarios(rateios, pcts, valorTotalAbsoluto));
		}
		toast.success('Percentuais divididos igualmente; diferença de arredondamento no último plano.');
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

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={handleCancelar}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto "
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
		>
			<div className="flex justify-between items-center bg-blue-50 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-xl font-semibold text-gray-800">
					Rateio de planos de contas - {movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'}
					{isModoMultiplos && ` (${movimentosMultiplos?.length} movimentos)`}
				</h2>
				<button onClick={handleCancelar} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="xl" />
				</button>
			</div>

			<div className="flex items-start gap-2 pt-3 p-5">
				<div className="flex-1 relative">
					<label className="block text-sm font-medium text-gray-700 mb-1">Plano de Contas</label>
					<div className="relative">
						<input
							type="text"
							className="w-full p-2 border rounded pr-10"
							placeholder="Pesquisar plano de contas..."
							value={searchPlano}
							onChange={handleSearchPlano}
							disabled={!podeAdicionarPlano}
						/>
						<FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
					</div>
					{showSuggestions && searchPlano && (
						<ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10 max-h-60 overflow-y-auto">
							{filteredPlanos.map((plano) => (
								<li
									key={plano.id}
									className="p-2 hover:bg-gray-200 text-sm cursor-pointer border-b last:border-b-0"
									onClick={() => selectPlano(plano)}
								>
									<div className="font-medium">{plano.hierarquia}</div>
									<div className="text-gray-600">{plano.descricao}</div>
								</li>
							))}
							{filteredPlanos.length === 0 && (
								<li className="p-2 text-sm text-gray-500 text-center">Nenhum plano encontrado</li>
							)}
						</ul>
					)}
				</div>

				<div className="flex flex-col justify-end">
					<label className="block text-sm font-medium text-gray-700 mb-1 invisible">Adicionar</label>
					<button
						type="button"
						onClick={adicionarRateio}
						className="bg-green-500 text-white font-semibold px-4 py-2 rounded hover:bg-green-600 whitespace-nowrap flex items-center gap-2"
						disabled={!planoSelecionado || !podeAdicionarPlano || idsPlanosNoRateio.has(planoSelecionado?.id ?? 0)}
					>
						<FontAwesomeIcon icon={faPlus} />
						Adicionar
					</button>
				</div>
			</div>

			<div className="px-5 pb-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
				<div className="flex-1">
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Percentuais em uma linha (ordem da tabela abaixo)
					</label>
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
								<th className="p-2 text-left">Plano de Conta</th>
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
									<tr key={`${r.idPlano}-${idx}`} className="border-t">
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
										Nenhum plano adicionado.
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
						className="px-4 py-2 bg-orange-500 text-white font-semibold rounded hover:bg-orange-600"
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

export default ModalRateioPlano;
