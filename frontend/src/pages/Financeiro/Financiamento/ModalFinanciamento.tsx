import React, { useState } from 'react';
import CurrencyInput from 'react-currency-input-field';
import { Financiamento, ParcelaFinanciamento } from '../../../../../backend/src/models';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';

interface Props {
	onClose: () => void;
	onSave: (data: Financiamento) => void;
	isOpen: boolean;
}

const ModalFinanciamento: React.FC<Props> = ({ onClose, onSave, isOpen }) => {
	const [form, setForm] = useState<Partial<Financiamento>>({
		parcelasList: [],
	});
	const [numParcelas, setNumParcelas] = useState(1);

	const handleInputChange = (field: string, value: any) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const gerarParcelas = () => {
		const parcelas: ParcelaFinanciamento[] = [];
		const valorParcela = (form.valor || 0) / numParcelas;
		const hoje = new Date();

		for (let i = 0; i < numParcelas; i++) {
			const vencimento = new Date(hoje);
			vencimento.setMonth(vencimento.getMonth() + i);

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
			className="bg-white rounded-lg shadow-lg w-full max-w-[1100px] mx-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		>
			<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-lg font-semibold text-gray-800">Novo Financiamento</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>
			<div className="p-6 flex justify-between items-start gap-2 ">
				<div className="grid grid-cols-2 gap-4 border-r pr-2">
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
						<input
							type="number"
							className="w-full border rounded p-2"
							value={form.taxaJurosAnual || 0}
							onChange={(e) => handleInputChange('taxaJurosAnual', parseFloat(e.target.value))}
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
				<div className="grid grid-cols-2 gap-4">
					<div className="col-span-2">
						<label>Parcelamento</label>
						<div className="flex items-center gap-4">
							<input
								type="number"
								min={1}
								value={numParcelas}
								onChange={(e) => setNumParcelas(parseInt(e.target.value))}
								className="border p-2 w-32 rounded"
							/>
							<button onClick={gerarParcelas} className="bg-primary text-white px-4 py-2 rounded">
								Gerar Parcelas
							</button>
						</div>
					</div>

					<div className="col-span-2 max-h-64 overflow-y-auto mt-4">
						{form.parcelasList?.length > 0 && (
							<table className="w-full text-sm border">
								<thead className="bg-gray-100">
									<tr>
										<th className="p-2">Parcela</th>
										<th>Vencimento</th>
										<th>Valor</th>
									</tr>
								</thead>
								<tbody>
									{form.parcelasList.map((parcela, i) => (
										<tr key={i} className="text-center border-t">
											<td className="p-1">{parcela.numParcela}</td>
											<td>{parcela.dt_vencimento}</td>
											<td>R$ {parcela.valor.toFixed(2)}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>

			
		</Modal>
	);
};

export default ModalFinanciamento;
