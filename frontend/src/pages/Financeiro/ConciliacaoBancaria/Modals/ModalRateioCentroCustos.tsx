import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faArrowLeft, faEquals } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import { MovimentoCentroCustos } from '../../../../../../backend/src/models/MovimentoCentroCustos';
import { toast } from 'react-toastify';
import {
	dividirIgualmenteEntrePreenchidos,
	isPercentualPreenchido,
	rateiosCentrosFromDraft,
	somarPercentuaisPreenchidos,
} from './rateioPercentuais';

interface RateioCentro {
	idCentro: number;
	descricao: string;
	valor: number;
}

type FiltroTipoCentro = 'TODOS' | 'CUSTEIO' | 'INVESTIMENTO';

interface ModalRateioCentroCustosProps {
	isOpen: boolean;
	onClose: () => void;
	valorTotal: number;
	movimento: MovimentoBancario;
	centrosDisponiveis: CentroCustos[];
	rateios: RateioCentro[];
	setRateios: (rateios: RateioCentro[]) => void;
	onConfirmar: (centros: MovimentoCentroCustos[] | { idCentro: number; porcentagem: number }[]) => void;
	onLimpar?: () => void;
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
	onLimpar,
	movimentosMultiplos,
}) => {
	const [draftPct, setDraftPct] = useState<Record<string, string>>({});
	const [filtroTipo, setFiltroTipo] = useState<FiltroTipoCentro>('TODOS');
	const [filtroDescricao, setFiltroDescricao] = useState('');
	const isDespesa = movimento.tipoMovimento === 'D';
	const isModoMultiplos = Boolean(movimentosMultiplos && movimentosMultiplos.length > 1);

	const valorTotalAbsoluto = Math.abs(valorTotal);

	const centrosFiltrados = useMemo(() => {
		const busca = filtroDescricao.trim().toLowerCase();
		return centrosDisponiveis
			.filter((centro) => {
				const matchTipoMovimento =
					movimento.tipoMovimento === 'C' ? centro.tipoReceitaDespesa === 'RECEITA' : centro.tipoReceitaDespesa === 'DESPESA';
				const matchTipo = !isDespesa || filtroTipo === 'TODOS' || centro.tipo === filtroTipo;
				const matchBusca = !busca || centro.descricao.toLowerCase().includes(busca);
				return matchTipoMovimento && matchTipo && matchBusca;
			})
			.sort((a, b) => {
				if (isDespesa && a.tipo !== b.tipo) {
					if (a.tipo === 'CUSTEIO') return -1;
					if (b.tipo === 'CUSTEIO') return 1;
				}
				return a.descricao.localeCompare(b.descricao, 'pt-BR');
			});
	}, [centrosDisponiveis, movimento.tipoMovimento, isDespesa, filtroTipo, filtroDescricao]);

	const centrosById = useMemo(() => {
		const map = new Map<number, CentroCustos>();
		for (const c of centrosDisponiveis) map.set(c.id, c);
		return map;
	}, [centrosDisponiveis]);

	const porcentagemTotalRateada = somarPercentuaisPreenchidos(draftPct);
	const filledCount = Object.values(draftPct).filter(isPercentualPreenchido).length;
	const podeConfirmar = filledCount > 0 && Math.abs(porcentagemTotalRateada - 100) < 0.02;

	const totalRateadoMonetario = useMemo(() => {
		if (isModoMultiplos || valorTotalAbsoluto <= 0) return 0;
		const rows = rateiosCentrosFromDraft(draftPct, centrosById, {
			multi: false,
			totalAbsoluto: valorTotalAbsoluto,
		});
		return rows.reduce((a, r) => a + r.valor, 0);
	}, [draftPct, centrosById, isModoMultiplos, valorTotalAbsoluto]);

	useEffect(() => {
		if (!isOpen) {
			setDraftPct({});
			setFiltroTipo('TODOS');
			setFiltroDescricao('');
			return;
		}

		const next: Record<string, string> = {};
		if (rateios.length > 0) {
			// Prefer parent draft (includes lote % stored in valor, and single-movement monetary drafts)
			for (const r of rateios) {
				if (!(r.valor > 0)) continue;
				if (isModoMultiplos) {
					next[String(r.idCentro)] = String(r.valor);
				} else if (valorTotalAbsoluto > 0) {
					const pct = (r.valor / valorTotalAbsoluto) * 100;
					next[String(r.idCentro)] = (Math.round(pct * 100) / 100).toString();
				}
			}
		} else if (!isModoMultiplos && (movimento.centroCustosList ?? []).length > 0 && valorTotalAbsoluto > 0) {
			for (const c of movimento.centroCustosList ?? []) {
				const pct = (c.valor / valorTotalAbsoluto) * 100;
				if (pct > 0) next[String(c.idCentroCustos)] = (Math.round(pct * 100) / 100).toString();
			}
		}
		setDraftPct(next);
		// Hydrate only when the modal opens (isOpen flips to true)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const handleCancelar = () => {
		onClose();
	};

	const handleLimparESair = () => {
		setDraftPct({});
		setRateios([]);
		if (onLimpar) {
			onLimpar();
		} else {
			onClose();
		}
	};

	const handlePctChange = (idCentro: number, value: string) => {
		const cleanValue = value.replace(/[^0-9.,]/g, '');
		const numValue = parseFloat(cleanValue.replace(',', '.'));
		if (cleanValue !== '' && Number.isFinite(numValue) && numValue > 100) {
			return;
		}
		setDraftPct((prev) => ({ ...prev, [String(idCentro)]: cleanValue }));
	};

	const handleDividirIgualmente = () => {
		if (filledCount === 0) {
			toast.warning('Preencha o % de pelo menos um centro para dividir igualmente.');
			return;
		}
		setDraftPct((prev) => dividirIgualmenteEntrePreenchidos(prev));
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		const built = rateiosCentrosFromDraft(draftPct, centrosById, {
			multi: Boolean(isModoMultiplos),
			totalAbsoluto: valorTotalAbsoluto,
		});
		if (built.length === 0) return;

		setRateios(built);

		if (isModoMultiplos) {
			onConfirmar(
				built.map((r) => ({
					idCentro: r.idCentro,
					porcentagem: r.valor,
				}))
			);
		} else {
			const novosCentros: MovimentoCentroCustos[] = built.map((r) => ({
				idMovimentoBancario: movimento.id,
				idCentroCustos: r.idCentro,
				valor: r.valor,
			}));
			onConfirmar(novosCentros);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={handleCancelar}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto max-h-[90vh] flex flex-col"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
		>
			<div className="flex justify-between items-center bg-green-50 px-4 py-3 rounded-t-lg border-b flex-shrink-0">
				<h2 className="text-xl font-semibold text-gray-800">
					Rateio de centros de custos - {movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'}
					{isModoMultiplos && ` (${movimentosMultiplos?.length} movimentos)`}
				</h2>
				<button onClick={handleCancelar} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="xl" />
				</button>
			</div>

			<div className="p-5 flex flex-col gap-3 flex-1 min-h-0">
				<div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
					{isDespesa && (
						<div className="sm:w-40 flex-shrink-0">
							<label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
							<select
								className="w-full h-10 px-2 border border-gray-300 rounded-md text-sm bg-white"
								value={filtroTipo}
								onChange={(e) => setFiltroTipo(e.target.value as FiltroTipoCentro)}
							>
								<option value="TODOS">Todos</option>
								<option value="CUSTEIO">Custeio</option>
								<option value="INVESTIMENTO">Investimento</option>
							</select>
						</div>
					)}
					<div className="flex-1 min-w-0">
						<label className="block text-sm font-medium text-gray-700 mb-1">Buscar centro</label>
						<input
							type="text"
							className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm"
							placeholder="Filtrar por nome..."
							value={filtroDescricao}
							onChange={(e) => setFiltroDescricao(e.target.value)}
						/>
					</div>
					<button
						type="button"
						onClick={handleDividirIgualmente}
						disabled={filledCount === 0}
						className="h-10 px-4 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0"
						title="Divide 100% igualmente entre os centros que já têm %"
					>
						<FontAwesomeIcon icon={faEquals} />
						Dividir igualmente
					</button>
				</div>

				<p className="text-xs text-gray-500">
					Deixe em branco (ou 0%) para excluir o centro do rateio. &quot;Dividir igualmente&quot; só redistribui entre linhas já
					preenchidas.
				</p>

				<div className="border border-gray-200 rounded-md overflow-auto flex-1 min-h-[280px] max-h-[58vh]">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 sticky top-0 z-10">
							<tr>
								<th className="px-3 py-2.5 text-left font-medium text-gray-700">Centro de Custos</th>
								<th className="px-3 py-2.5 text-right font-medium text-gray-700 w-[120px]">Percentual</th>
							</tr>
						</thead>
						<tbody>
							{centrosFiltrados.map((centro) => {
								const key = String(centro.id);
								const raw = draftPct[key] ?? '';
								const filled = isPercentualPreenchido(raw);
								return (
									<tr key={centro.id} className={`border-t border-gray-100 ${filled ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
										<td className="px-3 py-2.5">
											<div className="flex items-start gap-2 min-w-0">
												<span className="min-w-0 flex-1 text-gray-800 break-words">{centro.descricao}</span>
												{centro.tipo && centro.tipoReceitaDespesa === 'DESPESA' && (
													<span
														className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
															centro.tipo === 'INVESTIMENTO' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
														}`}
													>
														{centro.tipo === 'INVESTIMENTO' ? 'Inv' : 'Cust'}
													</span>
												)}
											</div>
										</td>
										<td className="px-3 py-2.5 text-right whitespace-nowrap">
											<input
												type="text"
												inputMode="decimal"
												className="w-20 h-9 px-2 border border-gray-300 rounded-md text-right text-sm"
												placeholder="—"
												value={raw}
												onChange={(e) => handlePctChange(centro.id, e.target.value)}
												aria-label={`Percentual ${centro.descricao}`}
											/>
											<span className="ml-1 text-gray-500">%</span>
										</td>
									</tr>
								);
							})}
							{centrosFiltrados.length === 0 && (
								<tr>
									<td colSpan={2} className="text-center text-gray-500 p-8">
										Nenhum centro disponível para este filtro.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="flex justify-between items-center gap-4 p-5 border-t flex-shrink-0">
				<div className="flex justify-start gap-4 text-sm font-medium">
					{!isModoMultiplos && (
						<div className="flex flex-col gap-1">
							<span>Total Rateado:</span>
							<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
								R$ {formatarMoeda(totalRateadoMonetario || 0)} / R$ {formatarMoeda(valorTotalAbsoluto || 0)}
							</span>
						</div>
					)}
					<div className="flex flex-col gap-1">
						<span>Porcentagem preenchida:</span>
						<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
							{porcentagemTotalRateada.toFixed(2)}% / 100%
							{filledCount > 0 && (
								<span className="text-gray-500 font-normal ml-1">
									({filledCount} centro{filledCount !== 1 ? 's' : ''})
								</span>
							)}
						</span>
					</div>
				</div>

				<div className="flex justify-end gap-3 flex-wrap">
					<button
						type="button"
						onClick={handleLimparESair}
						className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded hover:bg-red-50 font-semibold"
					>
						Limpar e sair
					</button>
					<button
						onClick={handleCancelar}
						className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded hover:bg-gray-200 font-semibold"
					>
						<FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
						Cancelar
					</button>
					<button
						onClick={handleConfirmar}
						className="px-4 py-2 bg-green-500 text-white font-semibold rounded hover:bg-green-600 disabled:opacity-50"
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
