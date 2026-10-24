import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { formatarDataISO } from '../../../Utils/formatarData';
import { brl } from '../../../Utils/formatos';

Modal.setAppElement('#root');

interface MovimentoDetalhado {
	id: number;
	data: string;
	descricao: string;
	valor: number;
	conta?: string;
}

interface Props {
	isOpen: boolean;
	onClose: () => void;
	movimentos: MovimentoDetalhado[];
	titulo: string;
}

const ModalDetalhamento: React.FC<Props> = ({ isOpen, onClose, movimentos, titulo }) => {
	// console.log('detalhando movmientos:', movimentos);
	const contas = useMemo(() => Array.from(new Set(movimentos.map((m) => m.conta || 'Desconhecida'))), [movimentos]);
	const [tabAtiva, setTabAtiva] = useState(contas.length > 0 ? contas[0] : '');
	const [filtro, setFiltro] = useState('');

	useEffect(() => {
		if (contas.length > 0) {
			setTabAtiva(contas[0]);
		}
	}, [contas]);

	const movimentosFiltrados = useMemo(() => {
		if (!tabAtiva) return [];
		const lower = filtro.toLowerCase();
		return movimentos.filter(
			(m) =>
				m.conta === tabAtiva &&
				(m.data.toLowerCase().includes(lower) ||
					m.descricao.toLowerCase().includes(lower) ||
					m.valor.toFixed(2).replace('.', ',').includes(lower))
		);
	}, [movimentos, tabAtiva, filtro]);

	const totalConta = movimentosFiltrados.reduce((acc, m) => acc + m.valor, 0);
	const totalGeral = movimentos.reduce((acc, m) => acc + m.valor, 0);
	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[900px] mx-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		>
			<div className="flex justify-between items-center bg-gray-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>

			<div className="px-5 pt-4 space-y-3">
				{/* Tabs */}
				<div className="flex gap-2 flex-wrap">
					<div
						className="flex items-end gap-3 relative w-auto whitespace-nowrap overflow-x-auto overflow-y-hidden no-scrollbar"
						onWheel={(e) => {
							const target = e.currentTarget as HTMLDivElement;
							target.scrollLeft += e.deltaY;
						}}
					>
						<div className="flex border-b border-gray-300">
							{contas.map((conta) => (
								<button
									key={conta}
									onClick={() => setTabAtiva(conta)}
									className={`px-4 py-2 font-bold text-sm ${
										tabAtiva === conta ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
									}`}
								>
									{conta}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Filtro */}
				<input
					type="text"
					placeholder="Filtrar por data, descrição ou valor..."
					value={filtro}
					onChange={(e) => {
						const target = e.target as HTMLInputElement;
						setFiltro(target.value);
					}}
					className="w-full border px-3 py-2 rounded text-sm"
				/>

				{/* One table (header and body used to be two tables, so the columns didn't line up); the header sticks while scrolling */}
				<div className="border rounded">
					<div className="overflow-auto" style={{ maxHeight: '340px' }}>
						<table className="w-full min-w-[600px]">
							<thead className="bg-gray-100 text-gray-700 sticky top-0 z-[1]">
								<tr>
									<th className="text-left px-3 py-2 w-28">Data</th>
									<th className="text-left px-3 py-2">Descrição</th>
									<th className="text-right px-3 py-2 w-40">Valor</th>
								</tr>
							</thead>
							<tbody>
								{movimentosFiltrados.map((mov, idx) => (
									<tr key={`${mov.id}-${idx}`} className="border-b">
										<td className="px-3 py-2 whitespace-nowrap">{formatarDataISO(mov.data)}</td>
										<td className="px-3 py-2 text-left">{mov.descricao}</td>
										<td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums" style={{ color: mov.valor < 0 ? 'red' : 'green' }}>
											{brl(mov.valor)}
										</td>
									</tr>
								))}
								{movimentosFiltrados.length === 0 && (
									<tr>
										<td colSpan={3} className="px-3 py-6 text-center text-gray-500">
											Nenhum movimento encontrado.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					{/* Total da Conta visível fora do scroll */}
					<div className="bg-gray-100 border-t px-3 py-2 text-right font-bold text-sm tabular-nums">Total da conta: {brl(totalConta)}</div>
				</div>
			</div>

			<div className="flex flex-wrap justify-end items-center px-5 py-4 border-t gap-3 mt-3">
				<div className="text-right text-sm font-bold tabular-nums">Total geral: {brl(totalGeral)}</div>
				<button onClick={onClose} className="bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded hover:bg-gray-400">
					Fechar
				</button>
			</div>
		</Modal>
	);
};

export default ModalDetalhamento;
