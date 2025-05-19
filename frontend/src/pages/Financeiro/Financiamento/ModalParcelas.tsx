import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faTimes,
	faPlus,
	faTrash,
	faMoneyBillWave,
	faUndo,
	faSave,
	faCalculator,
} from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import { Financiamento, ParcelaFinanciamento } from '../../../../../backend/src/models';
import DialogModal from '../../../components/DialogModal';
import { NumericFormat } from 'react-number-format';
import { salvarParcelaFinanciamento, excluirParcelaFinanciamento } from '../../../services/parcelaFinanciamentoService';
import defaultIcon from '../../../assets/img/icon-Bancos/default.png';

// Importando logos dos bancos
import bancoBrasil from '../../../assets/img/icon-Bancos/banco-brasil.svg';
import santander from '../../../assets/img/icon-Bancos/santander.svg';
import caixa from '../../../assets/img/icon-Bancos/caixa.svg';
import bradesco from '../../../assets/img/icon-Bancos/bradesco.svg';
import itau from '../../../assets/img/icon-Bancos/itau.svg';
import inter from '../../../assets/img/icon-Bancos/inter.svg';
import sicredi from '../../../assets/img/icon-Bancos/sicredi.svg';
import sicoob from '../../../assets/img/icon-Bancos/sicoob.svg';
import safra from '../../../assets/img/icon-Bancos/safra.svg';
import nubank from '../../../assets/img/icon-Bancos/nubank.svg';
import original from '../../../assets/img/icon-Bancos/original.svg';
import bancoBrasilia from '../../../assets/img/icon-Bancos/banco-brasilia.svg';
import banrisul from '../../../assets/img/icon-Bancos/banrisul.svg';
import citiBank from '../../../assets/img/icon-Bancos/citi-bank.svg';
import hsbc from '../../../assets/img/icon-Bancos/hsbc.svg';
import banestes from '../../../assets/img/icon-Bancos/banestes.svg';
import bancoAmazonia from '../../../assets/img/icon-Bancos/banco-amazonia.svg';
import bancoNordeste from '../../../assets/img/icon-Bancos/banco-nordeste.svg';
import bankBoston from '../../../assets/img/icon-Bancos/bank-boston.svg';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	financiamento: Financiamento;
	onSave: (financiamento: Financiamento) => void;
	bancos: any[];
	pessoas: any[];
}

const API_URL = import.meta.env.VITE_API_URL;

const ModalParcelas: React.FC<Props> = ({ isOpen, onClose, financiamento, onSave, bancos, pessoas }) => {
	const [parcelas, setParcelas] = useState<ParcelaFinanciamento[]>([]);
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [liquidationDate, setLiquidationDate] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [parcelasToDelete, setParcelasToDelete] = useState<number[]>([]);
	const [showValueMismatchModal, setShowValueMismatchModal] = useState(false);

	useEffect(() => {
		if (isOpen && financiamento.parcelasList) {
			setParcelas([...financiamento.parcelasList]);
			setParcelasToDelete([]);
		}
	}, [isOpen, financiamento]);

	const getBancoLogo = (codigo: string) => {
		const BancoLogos: { [key: string]: string } = {
			'001': bancoBrasil,
			'033': santander,
			'104': caixa,
			'237': bradesco,
			'341': itau,
			'077': inter,
			'748': sicredi,
			'756': sicoob,
			'422': safra,
			'260': nubank,
			'212': original,
			'070': bancoBrasilia,
			'389': banrisul,
			'745': citiBank,
			'399': hsbc,
			'021': banestes,
			'085': bancoAmazonia,
			'003': bancoNordeste,
			'318': bankBoston,
		};
		return BancoLogos[codigo] || defaultIcon;
	};

	const getBancoNome = (idBanco: number | null) => {
		const banco = bancos.find((b) => b.id === idBanco);
		return banco?.nome || 'Banco não encontrado';
	};

	const getPessoaNome = (idPessoa: number | null) => {
		const pessoa = pessoas.find((p) => p.id === idPessoa);
		return pessoa?.nome || 'Pessoa não encontrada';
	};

	const handleAddParcela = () => {
		const novaParcela: ParcelaFinanciamento = {
			id: 0, // ID 0 indica que é uma nova parcela
			idFinanciamento: financiamento.id,
			status: 'Aberto',
			numParcela: parcelas.length + 1,
			valor: 0,
			dt_vencimento: new Date().toISOString().split('T')[0],
			dt_lancamento: new Date().toISOString().split('T')[0],
			dt_liquidacao: null,
			idMovimentoBancario: null // Adicionando campo obrigatório
		};
		setParcelas([...parcelas, novaParcela]);
	};

	const handleDeleteParcela = (parcela: ParcelaFinanciamento) => {
		setSelectedParcela(parcela);
		setShowDeleteConfirmModal(true);
	};

	const handleDeleteConfirm = () => {
		if (selectedParcela) {
			if (selectedParcela.id && selectedParcela.id > 0) { // Verifica se é uma parcela existente (não temporária)
				setParcelasToDelete([...parcelasToDelete, selectedParcela.id]);
			}
			const novasParcelas = parcelas.filter((p) => p.id !== selectedParcela.id);
			setParcelas(novasParcelas);
			setShowDeleteConfirmModal(false);
			setSelectedParcela(null);
		}
	};

	const handleRecalcularParcelas = () => {
		if (parcelas.length === 0) {
			toast.warning('Não há parcelas para recalcular');
			return;
		}

		const parcelasEmAberto = parcelas.filter(p => p.status === 'Aberto' || p.status === 'Vencido');
		if (parcelasEmAberto.length === 0) {
			toast.warning('Não há parcelas em aberto para recalcular');
			return;
		}

		// Calcula o valor total já pago
		const valorTotalPago = parcelas
			.filter(p => p.status === 'Liquidado')
			.reduce((total, p) => total + p.valor, 0);

		// Calcula o valor restante a ser pago
		const valorRestante = financiamento.valor - valorTotalPago;

		// Calcula o valor base da parcela e o resto da divisão
		const valorBaseParcela = Math.floor((valorRestante * 100) / parcelasEmAberto.length) / 100;
		const resto = valorRestante - (valorBaseParcela * (parcelasEmAberto.length - 1));

		const novasParcelas = parcelas.map((parcela, index) => {
			if (parcela.status === 'Liquidado') {
				return parcela;
			}

			// Encontra o índice da parcela atual na lista de parcelas em aberto
			const indexEmAberto = parcelasEmAberto.findIndex(p => p.id === parcela.id);
			// Se for a última parcela em aberto, usa o valor com o resto
			const valorParcela = indexEmAberto === parcelasEmAberto.length - 1 ? resto : valorBaseParcela;

			return {
				...parcela,
				valor: parseFloat(valorParcela.toFixed(2)),
			};
		});

		setParcelas(novasParcelas);
		toast.success('Parcelas recalculadas com sucesso!');
	};

	const validarParcelas = () => {
		const parcelasInvalidas = parcelas.some(p => {
			if (p.status === 'Liquidado') return false;
			return !p.valor || p.valor < 0.01 || !p.dt_vencimento;
		});

		if (parcelasInvalidas) {
			toast.error('Todas as parcelas em aberto devem ter valor (mínimo R$ 0,01) e data de vencimento');
			return false;
		}

		const valorTotalParcelas = parcelas.reduce((total, p) => total + p.valor, 0);
		if (Math.abs(valorTotalParcelas - financiamento.valor) > 0.01) {
			setShowValueMismatchModal(true);
			return false;
		}

		return true;
	};

	const handleSave = async () => {
		try {
			setIsLoading(true);
			const parcelasToSave = parcelas.map(p => ({
				...p,
				valor: Number(p.valor),
				dt_vencimento: p.dt_vencimento,
				dt_lancamento: p.dt_lancamento,
				dt_liquidacao: p.dt_liquidacao || null,
				idMovimentoBancario: p.idMovimentoBancario || null,
				idFinanciamento: financiamento.id // Garantindo que o idFinanciamento está presente
			}));

			// Validar parcelas antes de salvar
			const parcelasInvalidas = parcelasToSave.filter(p => 
				!p.valor || p.valor <= 0 || !p.dt_vencimento
			);

			if (parcelasInvalidas.length > 0) {
				toast.error('Existem parcelas com valores inválidos ou datas de vencimento não preenchidas');
				return;
			}

			// Salvar cada parcela individualmente
			for (const parcela of parcelasToSave) {
				await salvarParcelaFinanciamento(parcela);
			}

			// Excluir parcelas marcadas para exclusão
			for (const id of parcelasToDelete) {
				await excluirParcelaFinanciamento(id);
			}

			toast.success('Parcelas salvas com sucesso!');
			onClose();
			onSave(financiamento); // Passando o financiamento atualizado
		} catch (error) {
			console.error('Erro ao salvar parcelas:', error);
			toast.error(error instanceof Error ? error.message : 'Erro ao salvar parcelas');
		} finally {
			setIsLoading(false);
		}
	};

	const handleLiquidarParcela = async () => {
		if (!selectedParcela || !liquidationDate) return;

		try {
			const parcelaAtualizada = {
				...selectedParcela,
				status: 'Liquidado',
				dt_liquidacao: liquidationDate,
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);
			const novasParcelas = parcelas.map((p) =>
				p.id === selectedParcela.id ? parcelaAtualizada : p
			);

			setParcelas(novasParcelas);
			setLiquidationModalOpen(false);
			setSelectedParcela(null);
			setLiquidationDate('');
			toast.success('Parcela liquidada com sucesso!');
		} catch (error) {
			console.error('Erro ao liquidar parcela:', error);
			toast.error('Erro ao liquidar parcela');
		}
	};

	const handleEstornarParcela = async (parcela: ParcelaFinanciamento) => {
		try {
			const parcelaAtualizada = {
				...parcela,
				status: 'Aberto',
				dt_liquidacao: null,
			};

			await salvarParcelaFinanciamento(parcelaAtualizada);
			const novasParcelas = parcelas.map((p) =>
				p.id === parcela.id ? parcelaAtualizada : p
			);

			setParcelas(novasParcelas);
			toast.success('Parcela estornada com sucesso!');
		} catch (error) {
			console.error('Erro ao estornar parcela:', error);
			toast.error('Erro ao estornar parcela');
		}
	};

	const handleConfirmValueMismatch = async () => {
		const valorTotalParcelas = parcelas.reduce((total, p) => total + p.valor, 0);
		const financiamentoAtualizado = {
			...financiamento,
			valor: valorTotalParcelas,
			parcelasList: parcelas,
		};

		try {
			setIsLoading(true);
			await onSave(financiamentoAtualizado);
			setShowValueMismatchModal(false);
			onClose();
		} catch (error) {
			console.error('Erro ao salvar financiamento:', error);
			toast.error('Erro ao salvar financiamento');
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setParcelasToDelete([]);
		setParcelas([]);
		setSelectedParcela(null);
		setLiquidationDate('');
		setShowDeleteConfirmModal(false);
		setLiquidationModalOpen(false);
		setShowValueMismatchModal(false);
		onClose();
	};

	const handleDelete = async (id: number) => {
		try {
			setIsLoading(true);
			const response = await fetch(`/api/financiamentos/parcelas/${id}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Erro ao excluir parcela');
			}

			setParcelas(parcelas.filter(p => p.id !== id));
			toast.success('Parcela excluída com sucesso!');
		} catch (error) {
			console.error('Erro ao excluir parcela:', error);
			toast.error(error instanceof Error ? error.message : 'Erro ao excluir parcela');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={handleClose}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-[1000px] mx-auto"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			>
				<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
					<div className="flex items-center gap-3">
						{financiamento.idBanco ? (
							<img
								src={getBancoLogo(bancos.find((b) => b.id === financiamento.idBanco)?.codigo || '')}
								alt="Banco"
								className="w-12 h-12 object-contain"
							/>
						) : financiamento.idPessoa ? (
							<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
								{getPessoaNome(financiamento.idPessoa)[0].toUpperCase()}
							</div>
						) : (
							<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
						)}
						<div>
							<h2 className="text-xl font-semibold text-gray-800">
								Gerenciar Parcelas - {financiamento.numeroContrato}
							</h2>
							<p className="text-sm text-gray-600">
								{financiamento.idBanco ? getBancoNome(financiamento.idBanco) : getPessoaNome(financiamento.idPessoa)}
							</p>
						</div>
					</div>
					<button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</button>
				</div>

				<div className="p-6">
					{/* Resumo do Contrato */}
					<div className="bg-gray-50 p-4 rounded-lg mb-6">
						<div className="grid grid-cols-4 gap-4">
							<div>
								<p className="text-sm text-gray-600">Valor Total</p>
								<p className="font-semibold text-lg text-primary">
									{formatarMoeda(financiamento.valor)}
								</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Responsável</p>
								<p className="font-semibold">{financiamento.responsavel}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Data do Contrato</p>
								<p className="font-semibold">
									{new Date(financiamento.dataContrato).toLocaleDateString()}
								</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Parcelas</p>
								<p className="font-semibold">
									{parcelas.length}x {parcelas.length > 0 ? (new Date(parcelas[parcelas.length - 1].dt_vencimento).getFullYear() - new Date(parcelas[0].dt_vencimento).getFullYear() > 0 ? 'Anual' : 'Mensal') : ''}
								</p>
							</div>
						</div>
					</div>

					{/* Lista de Parcelas */}
					<div className="mb-4 flex justify-between items-center border-t border-gray-200 pt-4">
						<h3 className="text-lg font-semibold">Parcelas</h3>
						<div className="flex gap-2">
							<button
								onClick={handleRecalcularParcelas}
								className=" hover:bg-gray-100 font-semibold text-gray-800 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors"
							>
								<FontAwesomeIcon icon={faCalculator} />
								<span>Recalcular Parcelas</span>
							</button>
							<button
								onClick={handleAddParcela}
								className="bg-blue-400 hover:bg-blue-500 font-semibold text-white px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors"
							>
								<FontAwesomeIcon icon={faPlus} />
								<span>Nova Parcela</span>
							</button>
						</div>
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
								{parcelas.map((parcela) => (
									<tr key={parcela.id} className="border-t">
										<td className="p-2">{parcela.numParcela}</td>
										<td className="p-2">
											<input
												type="date"
												value={parcela.dt_vencimento}
												onChange={(e) => {
													const novasParcelas = parcelas.map((p) =>
														p.id === parcela.id
															? { ...p, dt_vencimento: e.target.value }
															: p
													);
													setParcelas(novasParcelas);
												}}
												className={`border p-1 rounded ${parcela.status === 'Liquidado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
												disabled={parcela.status === 'Liquidado'}
											/>
										</td>
										<td className="p-2">
											<NumericFormat
												className={`w-full p-1 border border-gray-300 rounded ${parcela.status === 'Liquidado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
												value={parcela.valor}
												prefix="R$ "
												decimalSeparator=","
												thousandSeparator="."
												fixedDecimalScale
												decimalScale={2}
												onValueChange={(values) => {
													const { floatValue } = values;
													const novasParcelas = parcelas.map((p) =>
														p.id === parcela.id
															? { ...p, valor: floatValue || 0 }
															: p
													);
													setParcelas(novasParcelas);
												}}
												disabled={parcela.status === 'Liquidado'}
											/>
										</td>
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
											<div className="flex justify-end gap-4">
												{parcela.status === 'Liquidado' ? (
													<button
														onClick={() => handleEstornarParcela(parcela)}
														className="bg-orange-400 hover:bg-yellow-500 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
														title="Estornar parcela"
													>
														<FontAwesomeIcon icon={faUndo} />
													</button>
												) : (
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
												<button
													onClick={() => handleDeleteParcela(parcela)}
													className={`text-red-600 hover:text-red-800 ${parcela.status === 'Liquidado' ? 'opacity-50 cursor-not-allowed' : ''}`}
													title="Excluir parcela"
													disabled={parcela.status === 'Liquidado'}
												>
													<FontAwesomeIcon icon={faTrash} />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex justify-end gap-3 border-t  border-gray-300 pt-4 mt-6">
						<button
							onClick={handleClose}
							className="text-gray-600 font-semibold hover:bg-gray-200 px-4 py-2 rounded"
							disabled={isLoading}
						>
							Cancelar
						</button>
						<button
							onClick={handleSave}
							className="bg-primary hover:bg-orange-600 font-semibold text-white px-4 py-2 rounded flex items-center"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<span className="animate-spin mr-2">⏳</span>
									Salvando...
								</>
							) : (
								<>
									Salvar <FontAwesomeIcon icon={faSave} className="ml-2" />
								</>
							)}
						</button>
					</div>
				</div>
			</Modal>

			{/* Modal de Confirmação de Exclusão */}
			<DialogModal
				isOpen={showDeleteConfirmModal}
				onClose={() => setShowDeleteConfirmModal(false)}
				onConfirm={handleDeleteConfirm}
				title="Atenção"
				type="warn"
				message="Deseja excluir esta parcela? Após a exclusão, você pode recalcular o valor das parcelas restantes."
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			{/* Modal de Liquidação */}
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

			{/* Modal de Confirmação de Diferença de Valores */}
			<DialogModal
				isOpen={showValueMismatchModal}
				onClose={() => setShowValueMismatchModal(false)}
				onConfirm={handleConfirmValueMismatch}
				title="Atenção"
				type="warn"
				message={`O valor total das parcelas (${formatarMoeda(parcelas.reduce((total, p) => total + p.valor, 0))}) é diferente do valor do contrato (${formatarMoeda(financiamento.valor)}). Deseja atualizar o valor do contrato para o valor total das parcelas?`}
				confirmLabel="Atualizar Valor"
				cancelLabel="Cancelar"
			/>
		</>
	);
};

export default ModalParcelas; 