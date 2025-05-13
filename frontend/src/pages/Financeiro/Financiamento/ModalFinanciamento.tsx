import React, { useState, useEffect } from 'react';
import CurrencyInput from 'react-currency-input-field';
import { Financiamento, ParcelaFinanciamento } from '../../../../../backend/src/models';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faGripLinesVertical, faTimes } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
interface Props {
	onClose: () => void;
	onSave: (data: Financiamento) => void;
	isOpen: boolean;
}

const ModalFinanciamento: React.FC<Props> = ({ onClose, onSave, isOpen }) => {
	const [tipoParcelamento, setTipoParcelamento] = useState<'mensal' | 'anual'>('mensal');
	const [dataVencimentoInicial, setDataVencimentoInicial] = useState('');
	const [form, setForm] = useState<Partial<Financiamento>>({
		parcelasList: [],
	});
	const [numParcelas, setNumParcelas] = useState(1);

	useEffect(() => {
		if (isOpen) {
			const hoje = new Date();
			setDataVencimentoInicial(hoje.toISOString().split('T')[0]);
		}
	}, [isOpen]);

	const handleInputChange = (field: string, value: any) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleParcelaChange = (index: number, field: keyof ParcelaFinanciamento, value: any) => {
		const updatedParcelas = [...(form.parcelasList || [])];
		if (field === 'valor') {
			updatedParcelas[index][field] = parseFloat(value);
		} else {
			updatedParcelas[index][field] = value;
		}
		handleInputChange('parcelasList', updatedParcelas);
	};

	const gerarParcelas = () => {
		if (!dataVencimentoInicial) {
			toast.error('Informe a data da primeira parcela.');
			return;
		}
		if (!form.valor || form.valor <= 0) {
			toast.error('Valor total do financiamento inválido.');
			return;
		}
		if (numParcelas < 1) {
			toast.error('Número de parcelas deve ser no mínimo 1.');
			return;
		}

		const parcelas: ParcelaFinanciamento[] = [];
		const valorParcela = (form.valor || 0) / numParcelas;
		const dataInicial = new Date(dataVencimentoInicial);

		for (let i = 0; i < numParcelas; i++) {
			const vencimento = new Date(dataInicial);

			if (tipoParcelamento === 'mensal') {
				vencimento.setMonth(vencimento.getMonth() + i);
			} else {
				vencimento.setFullYear(vencimento.getFullYear() + i);
			}

			parcelas.push({
				id: 0,
				idFinanciamento: 0,
				status: 'Aberto',
				numParcela: i + 1,
				valor: parseFloat(valorParcela.toFixed(2)),
				dt_vencimento: vencimento.toISOString().split('T')[0],
				dt_lancamento: new Date().toISOString().split('T')[0],
				dt_liquidacao: null,
			});
		}

		handleInputChange('parcelasList', parcelas);
		handleInputChange('dataVencimentoPrimeiraParcela', parcelas[0].dt_vencimento);
		handleInputChange('dataVencimentoUltimaParcela', parcelas[parcelas.length - 1].dt_vencimento);
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[1300px] mx-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		>
			<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-xl font-semibold text-gray-800">Novo Financiamento</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>
			<div className="p-6 flex justify-between items-start gap-2 ">
				<div className="grid grid-cols-2 gap-4 border-r mr-4 pr-6 w-full">
					<div>
						<label>
							Responsável <span className="text-red-500">*</span>
						</label>
						<input
							className="w-full border rounded p-2"
							value={form.responsavel || ''}
							onChange={(e) => handleInputChange('responsavel', e.target.value)}
						/>
					</div>

					<div>
						<label>
							Data do Contrato <span className="text-red-500">*</span>
						</label>
						<input
							type="date"
							className="w-full border rounded p-2"
							value={form.dataContrato || ''}
							onChange={(e) => handleInputChange('dataContrato', e.target.value)}
						/>
					</div>

					<div>
						<label>
							Valor <span className="text-red-500">*</span>
						</label>
						<CurrencyInput
							className="w-full border rounded p-2"
							value={form.valor || 0}
							decimalsLimit={2}
							prefix="R$ "
							onValueChange={(value) => handleInputChange('valor', parseFloat(value || '0'))}
						/>
					</div>

					<div>
						<label>
							Número do Contrato <span className="text-red-500">*</span>
						</label>
						<input
							className="w-full border rounded p-2"
							value={form.numeroContrato || ''}
							onChange={(e) => handleInputChange('numeroContrato', e.target.value)}
						/>
					</div>

					<div>
						<label>Taxa de Juros (Anual)</label>
						<CurrencyInput
							className="w-full border rounded p-2"
							value={form.taxaJurosAnual || 0}
							decimalsLimit={2}
							prefix="R$ "
							decimalSeparator=","
							groupSeparator="."
							fixedDecimalLength={2}
							onValueChange={(value) => handleInputChange('taxaJurosAnual', parseFloat(value || '0'))}
						/>
					</div>

					<div>
						<label>Número da Garantia</label>
						<input
							className="w-full border rounded p-2"
							value={form.numeroGarantia || ''}
							onChange={(e) => handleInputChange('numeroGarantia', e.target.value)}
						/>
					</div>

					<div className="col-span-2">
						<label>Observação</label>
						<textarea
							className="w-full border rounded p-2"
							value={form.observacao || ''}
							onChange={(e) => handleInputChange('observacao', e.target.value)}
						/>
					</div>
					<div className="col-span-2 flex justify-end mt-6 gap-3">
						<button onClick={onClose} className="text-gray-600">
							Cancelar
						</button>
						<button onClick={() => onSave(form as Financiamento)} className="bg-primary text-white px-4 py-2 rounded">
							Salvar
						</button>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4 w-full">
					<div className="col-span-2">
						<label className="font-semibold ">Gerar Parcelas</label>
						<div className="border-t w-full pt-4 mt-2 flex gap-3 items-end">

							<input
								type="number"
								min={1}
								value={numParcelas}
								onChange={(e) => setNumParcelas(parseInt(e.target.value))}
								placeholder="Qtde parcelas"
								className="border p-2 rounded flex-1"
							/>
							<input
								type="date"
								value={dataVencimentoInicial}
								onChange={(e) => setDataVencimentoInicial(e.target.value)}
								className="border p-2 rounded  flex-1"
							/>
							<select
								value={tipoParcelamento}
								onChange={(e) => setTipoParcelamento(e.target.value as 'mensal' | 'anual')}
								className="border p-2 rounded flex-1"
							>
								<option value="mensal">Mensal</option>
								<option value="anual">Anual</option>
							</select>
							<button
								onClick={gerarParcelas}
								className="bg-primary text-white px-4 py-2 rounded hover:bg-orange-500 transition w-fit"
								title="Gerar Parcelas"
							>
								<FontAwesomeIcon icon={faGear} />
							</button>
						</div>
					</div>

					<div className="col-span-2 max-h-64 overflow-y-auto mt-4">
						<div className="col-span-2 max-h-64 overflow-y-auto mt-4">
							<table className="w-full  border">
								<thead className="bg-gray-100">
									<tr>
										<th className="p-2">Parcela</th>
										<th>Vencimento</th>
										<th>Valor</th>
									</tr>
								</thead>
								<tbody>
									{form.parcelasList.length === 0 ? (
										<tr>
											<td colSpan={3} className="text-center py-3 text-gray-500 italic">
												Nenhuma parcela encontrada
											</td>
										</tr>
									) : (
										form.parcelasList.map((parcela, index) => (
											<tr key={index} className="text-center border-t">
												<td className="p-1">{parcela.numParcela}</td>
												<td className="p-1">
													<input
														type="date"
														value={parcela.dt_vencimento}
														onChange={(e) => handleParcelaChange(index, 'dt_vencimento', e.target.value)}
														className="border p-1 rounded "
													/>
												</td>
												<td className="p-1">
													<CurrencyInput
														className="w-full p-1 border border-gray-300 rounded"
														value={parcela.valor}
														decimalsLimit={2}
														prefix="R$ "
														decimalSeparator=","
														groupSeparator="."
														fixedDecimalLength={2}
														onValueChange={(value) => handleParcelaChange(index, 'valor', value || '0.00')}
													/>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	);
};

export default ModalFinanciamento;
