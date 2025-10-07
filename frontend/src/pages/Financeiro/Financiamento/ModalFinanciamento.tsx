import React, { useState, useEffect } from 'react';
import CurrencyInput from 'react-currency-input-field';
import { Financiamento, ParcelaFinanciamento } from '../../../../../backend/src/models';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faGripLinesVertical, faSave, faTimes } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { salvarFinanciamento } from '../../../services/financiamentoService';
import { salvarParcelaFinanciamento } from '../../../services/financiamentoParcelasService';

import { Banco } from '../../../../../backend/src/models/Banco';
import { Pessoa } from '../../../../../backend/src/models/Pessoa';

interface Props {
	onClose: () => void;
	onSave: (data: Financiamento) => void;
	isOpen: boolean;
	bancos: Banco[];
	pessoas: Pessoa[];
	financiamentoData?: Financiamento | null;
}

const ModalFinanciamento: React.FC<Props> = ({ onClose, onSave, isOpen, bancos, pessoas, financiamentoData }) => {
	const [tipoParcelamento, setTipoParcelamento] = useState<'mensal' | 'anual'>('mensal');
	const [dataVencimentoInicial, setDataVencimentoInicial] = useState('');
	const [form, setForm] = useState<Partial<Financiamento & { valor?: string; taxaJurosAnual?: string }>>({
		parcelasList: [],
	});

	const [numParcelas, setNumParcelas] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<{ [key: string]: string }>({});

	useEffect(() => {
		if (isOpen) {
			if (financiamentoData) {
				setForm({
					...financiamentoData,
					valor: financiamentoData.valor?.toString().replace('.', ',') || '0,00',
					taxaJurosAnual: financiamentoData.taxaJurosAnual?.toString().replace('.', ',') || '0,00',
				});
				if (financiamentoData.parcelasList && financiamentoData.parcelasList.length > 0) {
					setNumParcelas(financiamentoData.parcelasList.length);
					setDataVencimentoInicial(financiamentoData.parcelasList[0].dt_vencimento);
				}
			} else {
				const hoje = new Date();
				setDataVencimentoInicial(hoje.toISOString().split('T')[0]);
				setForm({
					parcelasList: [],
				});
				setNumParcelas(1);
			}
		}
	}, [isOpen, financiamentoData]);


	const handleInputChange = (field: string, value: any) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleParcelaChange = (index: number, field: keyof ParcelaFinanciamento, value: any) => {
		const updatedParcelas = [...(form.parcelasList || [])];
		if (field === 'valor') {
			// Se o valor for uma string com vírgula, converter para número
			if (typeof value === 'string') {
				const valorNumerico = parseFloat(value.replace(/\./g, '').replace(',', '.'));
				updatedParcelas[index][field] = isNaN(valorNumerico) ? 0 : valorNumerico;
			} else {
				updatedParcelas[index][field] = Number(value) || 0;
			}
		} else {
			updatedParcelas[index][field] = value;
		}
		handleInputChange('parcelasList', updatedParcelas);
	};

	const validarFormulario = () => {
		const newErrors: { [key: string]: string } = {};

		if (!form.responsavel) newErrors.responsavel = 'Responsável é obrigatório';
		if (!form.dataContrato) newErrors.dataContrato = 'Data do contrato é obrigatória';
		if (!form.valor) newErrors.valor = 'Valor é obrigatório';
		if (!form.numeroContrato) newErrors.numeroContrato = 'Número do contrato é obrigatório';
		if (!form.parcelasList || form.parcelasList.length === 0) {
			newErrors.parcelas = 'Gere as parcelas antes de salvar';
		}

		// Validação de banco/pessoa
		if (!form.idBanco && !form.idPessoa) {
			newErrors.bancoPessoa = 'Escolha um banco ou uma pessoa';
		}
		if (form.idBanco && form.idPessoa) {
			newErrors.bancoPessoa = 'Escolha apenas um: Banco ou Pessoa';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
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
		const valorTotal = parseFloat((form.valor || '0,00').replace(/\./g, '').replace(',', '.'));
		if (valorTotal <= 0) {
			toast.error('Valor total do financiamento inválido.');
			return;
		}

		// Calcula o valor base da parcela e o resto da divisão
		const valorBaseParcela = Math.floor((valorTotal * 100) / numParcelas) / 100;
		const resto = valorTotal - (valorBaseParcela * (numParcelas - 1));

		const dataInicial = new Date(dataVencimentoInicial);

		for (let i = 0; i < numParcelas; i++) {
			const vencimento = new Date(dataInicial);

			if (tipoParcelamento === 'mensal') {
				vencimento.setMonth(vencimento.getMonth() + i);
			} else {
				vencimento.setFullYear(vencimento.getFullYear() + i);
			}

			// Se for a última parcela, usa o valor com o resto
			const valorParcela = i === numParcelas - 1 ? resto : valorBaseParcela;

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

	const handleSave = async () => {
		if (!validarFormulario()) {
			return;
		}

		try {
			setIsLoading(true);

			const financiamentoData: Financiamento = {
				...form,
				valor: parseFloat((form.valor || '0,00').replace(/\./g, '').replace(',', '.')),
				taxaJurosAnual: form.taxaJurosAnual ? parseFloat((form.taxaJurosAnual || '0,00').replace(/\./g, '').replace(',', '.')) : null,
			} as Financiamento;

			// Se estiver editando, mantém o ID original
			if (financiamentoData.id) {
				await salvarFinanciamento(financiamentoData);
				
				// Atualiza as parcelas existentes
				if (form.parcelasList) {
					for (const parcela of form.parcelasList) {
						await salvarParcelaFinanciamento({
							...parcela,
							idFinanciamento: financiamentoData.id
						});
					}
				}
				
				toast.success('Financiamento atualizado com sucesso!');
			} else {
				// Criação de novo financiamento
				const { id } = await salvarFinanciamento(financiamentoData);
				
				// Cria as novas parcelas
				const parcelasSalvas: ParcelaFinanciamento[] = [];
				console.log(`🔄 Processando ${form.parcelasList?.length || 0} parcelas para financiamento ID ${id}`);
				
				for (const parcela of form.parcelasList) {
					try {
						console.log(`💾 Salvando parcela ${parcela.numParcela}:`, {
							valorOriginal: parcela.valor,
							tipoValor: typeof parcela.valor,
							parcelaCompleta: parcela
						});
						
						const parcelaComId = await salvarParcelaFinanciamento({
							...parcela,
							idFinanciamento: id
						});
						parcelasSalvas.push(parcelaComId);
						console.log(`✅ Parcela ${parcela.numParcela} salva com sucesso`);
					} catch (error) {
						console.error(`❌ Erro ao salvar parcela ${parcela.numParcela}:`, error);
						toast.error(`Erro ao salvar parcela ${parcela.numParcela}. Tente novamente.`);
						return;
					}
				}
				
				toast.success('Financiamento criado com sucesso!');
				financiamentoData.id = id;
				financiamentoData.parcelasList = parcelasSalvas;
			}

			onSave(financiamentoData);
			onClose();
		} catch (error) {
			console.error('Erro ao salvar financiamento:', error);
			toast.error('Erro ao salvar financiamento. Tente novamente.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[1300px] mx-auto z-150 max-h-[90vh] overflow-y-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-150 p-4"
			contentLabel="Modal Financiamento"
		>
			<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-xl font-semibold text-gray-800">
					{financiamentoData?.id ? 'Editar Financiamento' : 'Novo Financiamento'}
				</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>
			<div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-2">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:border-r lg:mr-4 lg:pr-6 w-full">
					<div>
						<label className="text-sm sm:text-base">
							Responsável <span className="text-red-500">*</span>
						</label>
						<input
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							placeholder="Digite o nome do responsável"
							value={form.responsavel || ''}
							onChange={(e) => handleInputChange('responsavel', e.target.value)}
						/>
						{errors.responsavel && <p className="text-red-500 text-xs">{errors.responsavel}</p>}
					</div>

					<div>
						<label className="text-sm sm:text-base">
							Data do Contrato <span className="text-red-500">*</span>
						</label>
						<input
							type="date"
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.dataContrato || ''}
							onChange={(e) => handleInputChange('dataContrato', e.target.value)}
						/>
						{errors.dataContrato && <p className="text-red-500 text-xs">{errors.dataContrato}</p>}
					</div>

					<div>
						<label className="text-sm sm:text-base">
							Valor <span className="text-red-500">*</span>
						</label>
						<CurrencyInput
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.valor || '0,00'}
							decimalsLimit={2}
							prefix="R$ "
							decimalSeparator=","
							groupSeparator="."
							fixedDecimalLength={2}
							onValueChange={(value) => handleInputChange('valor', value || '0,00')}
						/>
						{errors.valor && <p className="text-red-500 text-xs">{errors.valor}</p>}
					</div>

					<div>
						<label className="text-sm sm:text-base">
							Número do Contrato <span className="text-red-500">*</span>
						</label>
						<input
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							placeholder="Digite o número do contrato"
							value={form.numeroContrato || ''}
							onChange={(e) => handleInputChange('numeroContrato', e.target.value)}
						/>
						{errors.numeroContrato && <p className="text-red-500 text-xs">{errors.numeroContrato}</p>}
					</div>

					<div>
						<label className="text-sm sm:text-base">Banco <span className="text-gray-500">(opcional)</span></label>
						<select
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.idBanco?.toString() || ''}
							onChange={(e) => {
								handleInputChange('idBanco', e.target.value ? parseInt(e.target.value) : null);
								handleInputChange('idPessoa', null);
							}}
							disabled={!!form.idPessoa}
						>
							<option value="">Selecione um banco</option>
							{bancos.map((banco) => (
								<option key={banco.id} value={banco.id}>
									{banco.nome}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="text-sm sm:text-base">Pessoa <span className="text-gray-500">(opcional)</span></label>
						<select
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.idPessoa?.toString() || ''}
							onChange={(e) => {
								handleInputChange('idPessoa', e.target.value ? parseInt(e.target.value) : null);
								handleInputChange('idBanco', null);
							}}
							disabled={!!form.idBanco}
						>
							<option value="">Selecione uma pessoa</option>
							{pessoas.map((pessoa) => (
								<option key={pessoa.id} value={pessoa.id}>
									{pessoa.nome}
								</option>
							))}
						</select>
					</div>

					{errors.bancoPessoa && <p className="text-red-500 text-xs col-span-2">{errors.bancoPessoa}</p>}

					<div>
						<label className="text-sm sm:text-base">Total de Juros do Contrato</label>
						<CurrencyInput
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.taxaJurosAnual || '0,00'}
							decimalsLimit={2}
							prefix="R$ "
							decimalSeparator=","
							groupSeparator="."
							fixedDecimalLength={2}
							onValueChange={(value) => handleInputChange('taxaJurosAnual', value || '0,00')}
						/>
					</div>

					<div>
						<label className="text-sm sm:text-base">Número da Garantia</label>
						<input
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							value={form.numeroGarantia || ''}
							placeholder="Digite o número da garantia"
							onChange={(e) => handleInputChange('numeroGarantia', e.target.value)}
						/>
					</div>

					<div className="col-span-1 sm:col-span-2">
						<label className="text-sm sm:text-base">Observação</label>
						<textarea
							className="w-full p-2 bg-white border border-gray-300 rounded text-sm"
							placeholder="Digite a observação"
							value={form.observacao || ''}
							onChange={(e) => handleInputChange('observacao', e.target.value)}
						/>
					</div>

					{errors.parcelas && <p className="text-red-500 text-xs col-span-2">{errors.parcelas}</p>}

					<div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row justify-end mt-6 gap-3">
						<button 
							onClick={onClose} 
							className="text-gray-600 font-semibold hover:bg-gray-200 px-4 py-2 rounded text-sm sm:text-base"
							disabled={isLoading}
						>
							Cancelar
						</button>
						<button 
							onClick={handleSave} 
							className="bg-primary hover:bg-orange-600 font-semibold text-white px-4 py-2 rounded flex items-center justify-center text-sm sm:text-base"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<span className="animate-spin mr-2">⏳</span>
									Salvando...
								</>
							) : (
								<>
									<span className="hidden sm:inline">{financiamentoData?.id ? 'Confirmar Edição' : 'Salvar e Criar'}</span>
									<span className="sm:hidden">{financiamentoData?.id ? 'Confirmar' : 'Salvar'}</span>
									<FontAwesomeIcon icon={faSave} className='ml-2' />
								</>
							)}
						</button>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
					<div className="col-span-1 sm:col-span-2">
						<label className="font-semibold text-sm sm:text-base">Gerar Parcelas</label>
						<div className="border-t w-full pt-4 mt-2 flex flex-col sm:flex-row gap-3 items-end">
							<input
								type="number"
								min={1}
								value={numParcelas}
								onChange={(e) => setNumParcelas(parseInt(e.target.value))}
								placeholder="Qtde parcelas"
								className="border p-2 rounded flex-1 text-sm"
							/>
							<input
								type="date"
								value={dataVencimentoInicial}
								onChange={(e) => setDataVencimentoInicial(e.target.value)}
								className="border p-2 rounded flex-1 text-sm"
							/>
							<select
								value={tipoParcelamento}
								onChange={(e) => setTipoParcelamento(e.target.value as 'mensal' | 'anual')}
								className="border p-2 rounded flex-1 text-sm"
							>
								<option value="mensal">Mensal</option>
								<option value="anual">Anual</option>
							</select>
							<button
								onClick={gerarParcelas}
								className="bg-primary text-white px-4 py-2 rounded hover:bg-orange-500 transition w-full sm:w-fit text-sm"
								title="Gerar Parcelas"
							>
								<span className="hidden sm:inline">Gerar Parcelas</span>
								<span className="sm:hidden">Gerar</span>
								<FontAwesomeIcon icon={faGear} className="ml-2" />
							</button>
						</div>
					</div>

					<div className="col-span-1 sm:col-span-2 max-h-64 overflow-y-auto mt-4">
						<div className="overflow-x-auto">
							<table className="w-full border min-w-[400px]">
								<thead className="bg-gray-100">
									<tr>
										<th className="p-2 text-xs sm:text-sm">Parcela</th>
										<th className="p-2 text-xs sm:text-sm">Vencimento</th>
										<th className="p-2 text-xs sm:text-sm">Valor</th>
									</tr>
								</thead>
								<tbody>
									{form.parcelasList?.length === 0 ? (
										<tr>
											<td colSpan={3} className="text-center py-3 text-gray-500 italic text-xs sm:text-sm">
												Nenhuma parcela encontrada
											</td>
										</tr>
									) : (
										form.parcelasList?.map((parcela, index) => (
											<tr key={index} className="text-center border-t">
												<td className="p-1 text-xs sm:text-sm">{parcela.numParcela}</td>
												<td className="p-1">
													<input
														type="date"
														value={parcela.dt_vencimento}
														onChange={(e) => handleParcelaChange(index, 'dt_vencimento', e.target.value)}
														className="border p-1 rounded text-xs sm:text-sm w-full"
													/>
												</td>
												<td className="p-1">
													<CurrencyInput
														className="w-full p-1 border border-gray-300 rounded text-xs sm:text-sm"
														value={parcela.valor?.toString().replace('.', ',') || '0,00'}
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
