import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faArrowLeft, faWarning } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import CurrencyInput from 'react-currency-input-field';
import { Resultado } from '../../../../../../backend/src/models/Resultado';
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
	onConfirmar: (resultados: Resultado[]) => void;
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
}) => {
	const [planoSelecionado, setPlanoSelecionado] = useState<PlanoConta | null>(null);
	const [valorParcial, setValorParcial] = useState<string>('0,00');

	const valorNumericoParcial = Number(valorParcial.replace(/\./g, '').replace(',', '.')) || 0;

	const valorTotalAbsoluto = Math.abs(valorTotal);
	const totalRateado = rateios.reduce((acc, r) => acc + r.valor, 0);
	const valorRestante = valorTotalAbsoluto - totalRateado;

	const rateiosOriginais = useRef<Rateio[]>([]);

	useEffect(() => {
		if (isOpen && movimento && (movimento.resultadoList ?? []).length > 0) {
			const convertidos: Rateio[] = (movimento.resultadoList ?? []).map((r) => {
				const plano = planosDisponiveis.find((p) => p.id === r.idPlanoContas);
				return {
					idPlano: r.idPlanoContas,
					descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
					valor: r.valor,
				};
			});
			rateiosOriginais.current = convertidos; // backup dos originais
			setRateios(convertidos); // atualiza visual
		}
	}, [isOpen]); // somente ao abrir

	const handleCancelar = () => {
		setRateios(rateiosOriginais.current); // restaura valores
		onClose();
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		const novosResultados: Resultado[] = rateios.map((r) => ({
			idPlanoContas: r.idPlano,
			valor: r.valor,
			tipo: movimento.tipoMovimento ?? 'C',
			idContaCorrente: movimento.idContaCorrente,
			dtMovimento: movimento.dtMovimento,
		}));

		onConfirmar(novosResultados);
	};

	const adicionarRateio = () => {
		if (planoSelecionado && valorNumericoParcial > 0 && valorNumericoParcial <= valorRestante) {
			setRateios([
				...rateios,
				{
					idPlano: planoSelecionado.id,
					descricao: planoSelecionado.descricao,
					valor: valorNumericoParcial,
				},
			]);
			setPlanoSelecionado(null);
			setValorParcial('0,00');
		}
	};

	const removerRateio = (index: number) => {
		const novosRateios = [...rateios];
		novosRateios.splice(index, 1);
		setRateios(novosRateios);
	};

	const podeConfirmar = totalRateado === valorTotalAbsoluto;

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
				</h2>
				<button onClick={handleCancelar} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="xl" />
				</button>
			</div>

			<div className="flex items-start gap-2 pt-3 p-5">
				<div className="w-3/4">
					<label className="block text-sm font-medium text-gray-700 mb-1">Plano de Contas</label>
					<select
						className="w-full p-2 border rounded"
						value={planoSelecionado?.id || ''}
						onChange={(e) => {
							const plano = planosDisponiveis.find((p) => p.id === parseInt(e.target.value));
							setPlanoSelecionado(plano || null);
						}}
						disabled={!valorRestante || valorRestante <= 0}
					>
						<option value="">Selecione um plano</option>
						{planosDisponiveis
							.filter((plano) => {
								const ehReceita = movimento.tipoMovimento === 'C';
								const hierarquiaCorreta = ehReceita ? plano.hierarquia.startsWith('001') : plano.hierarquia.startsWith('002');
								return plano.nivel === 3 && hierarquiaCorreta;
							})
							.map((plano) => (
								<option key={plano.id} value={plano.id}>
									{plano.hierarquia} - {plano.descricao}
								</option>
							))}
					</select>
				</div>

				<div className="w-1/4">
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Valor {movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'} R$
					</label>
					<div className="flex items-center ">
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
							disabled={!planoSelecionado || valorRestante <= 0}
						/>

						<button
							onClick={adicionarRateio}
							className="bg-green-500 text-white font-semibold px-4 py-2 rounded-r hover:bg-green-600"
							disabled={!planoSelecionado || valorNumericoParcial <= 0 || valorNumericoParcial > valorRestante}
						>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					{valorRestante > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {formatarMoeda(valorRestante)}
						</div>
					)}
				</div>
			</div>

			<div className="pt-3 p-5">
				<div className="border rounded">
					<table className="w-full text-sm">
						<thead className="bg-gray-100">
							<tr>
								<th className="p-2 text-left">Plano de Conta</th>
								<th className="p-2 text-center">Valor</th>
								<th className="p-2 text-right pr-2" style={{ width: '50px' }}>
									Ação
								</th>
							</tr>
						</thead>
						<tbody>
							{rateios.map((r, idx) => (
								<tr key={idx} className="border-t">
									<td className="p-2">{r.descricao}</td>
									<td className="p-2 text-center">{formatarMoeda(r.valor ? r.valor : 0)}</td>
									<td className="p-2 text-right pr-4" style={{ width: '50px' }}>
										<button onClick={() => removerRateio(idx)} className="text-red-500 hover:text-red-700">
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
							))}
							{rateios.length === 0 && (
								<tr>
									<td colSpan={3} className="text-center text-gray-500 p-4">
										Nenhum plano adicionado.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex justify-between items-center gap-4 mt-4 p-5 border-t">
				<div className="flex justify-start gap-4 text-sm font-medium ">
					<span>Total Rateado:</span>
					<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
						R$ {formatarMoeda(totalRateado ? totalRateado : 0)} / R$ {formatarMoeda(valorTotalAbsoluto ? valorTotalAbsoluto : 0)}
					</span>
				</div>

				<div className="flex justify-end gap-3 ">
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
