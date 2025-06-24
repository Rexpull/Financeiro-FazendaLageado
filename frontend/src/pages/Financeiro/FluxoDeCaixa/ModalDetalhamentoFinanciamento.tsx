import React, { useState } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FinanciamentoDetalhadoDTO } from '../../../../../backend/src/models/FinanciamentoDetalhadoDTO';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import { formatarData } from '../../../Utils/formatarData';

Modal.setAppElement('#root');

interface Props {
	isOpen: boolean;
	onClose: () => void;
	financiamentos: FinanciamentoDetalhadoDTO[];
	titulo: string;
}

const ModalDetalhamentoFinanciamento: React.FC<Props> = ({ isOpen, onClose, financiamentos, titulo }) => {
	const [expandido, setExpandido] = useState<{ [key: number]: boolean }>({});

	const toggleExpandir = (id: number) => {
		setExpandido((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const formatarDataBR = (data?: string | null) => {
		if (!data) return '—';
		try {
			return new Date(data).toLocaleDateString('pt-BR');
		} catch {
			return data;
		}
	};

	const getStatusClass = (status: string) => {
		if (status === 'Liquidado') return 'bg-green-100 text-green-800';
		if (status === 'Vencido') return 'bg-red-100 text-red-800';
		return 'bg-yellow-100 text-yellow-800';
	};

	const totalGeral = financiamentos.reduce((acc, fin) => acc + fin.parcelas.reduce((pAcc, p) => pAcc + p.valor, 0), 0);

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[1000px] mx-auto border border-gray-300"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		>
			<div className="flex justify-between items-center bg-gray-100 px-6 py-4 rounded-t-lg border-b">
				<h2 className="text-xl font-bold text-primary tracking-wide">{titulo}</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-red-600 p-2 rounded-full border border-gray-300 bg-white transition">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>
			<div className="p-6" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
				<table className="w-full min-w-[800px]">
					<thead className="bg-gray-100 text-gray-700">
						<tr>
							<th className="text-left px-3 py-2 w-12"></th>
							<th className="text-left px-3 py-2">Contrato</th>
							<th className="text-left px-3 py-2">Credor</th>
							<th className="text-right px-3 py-2">Valor Total do Contrato</th>
						</tr>
					</thead>
					<tbody>
						{financiamentos.map((fin) => (
							<React.Fragment key={fin.id}>
								<tr className="border-b cursor-pointer hover:bg-gray-50" onClick={() => toggleExpandir(fin.id)}>
									<td className="px-3 py-2 text-center">
										<FontAwesomeIcon icon={expandido[fin.id] ? faChevronDown : faChevronRight} />
									</td>
									<td className="px-3 py-2 font-semibold text-primary">{fin.numeroContrato}</td>
									<td className="px-3 py-2">{fin.credor}</td>
									<td className="px-3 py-2 text-right font-bold text-primary">{formatarMoeda(fin.valorTotal)}</td>
								</tr>
								{expandido[fin.id] && (
									<tr className="bg-gray-50">
										<td colSpan={4} className="p-3">
											<div className="border rounded-lg overflow-hidden">
												<table className="w-full">
													<thead className="bg-gray-200 text-gray-600 text-sm">
														<tr>
															<th className="text-left px-3 py-1">Parcela</th>
															<th className="text-left px-3 py-1">Vencimento</th>
															<th className="text-left px-3 py-1">Liquidação</th>
															<th className="text-left px-3 py-1">Status</th>
															<th className="text-right px-3 py-1">Valor</th>
														</tr>
													</thead>
													<tbody>
														{fin.parcelas.map((p) => (
															<tr key={p.id} className="border-b bg-white">
																<td className="px-3 py-2">{p.numParcela}</td>
																<td className="px-3 py-2">{formatarDataBR(p.dt_vencimento)}</td>
																<td className="px-3 py-2">{formatarDataBR(p.dt_liquidacao)}</td>
																<td className={`px-3 py-2`}>
																	<span className={`px-2 py-1 rounded font-semibold text-sm ${getStatusClass(p.status)}`}>{p.status}</span>
																</td>
																<td className="px-3 py-2 text-right font-semibold">{formatarMoeda(p.valor)}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</td>
									</tr>
								)}
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex justify-end items-center px-6 py-4 border-t gap-3 mt-auto bg-gray-50 rounded-b-lg">
				<div className="text-right text-lg font-bold text-primary">Total do Mês: {formatarMoeda(totalGeral)}</div>
				<button onClick={onClose} className="bg-gray-300 text-gray-700 font-bold px-5 py-2 rounded hover:bg-red-400 hover:text-white transition">
					Fechar
				</button>
			</div>
		</Modal>
	);
};

export default ModalDetalhamentoFinanciamento; 