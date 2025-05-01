import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { formatarData } from '../../../Utils/formatarData';

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
	const contas = Array.from(new Set(movimentos.map((m) => m.conta || 'Desconhecida')));
	const [tabAtiva, setTabAtiva] = useState(contas[0]);
	const [filtro, setFiltro] = useState('');

	useEffect(() => {
		if (isOpen && contas.length > 0) {
			setTabAtiva(contas[0]);
		}
	}, [isOpen, contas]);

	const movimentosFiltrados = useMemo(() => {
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
					<div className="flex items-end gap-3 relative w-auto whitespace-nowrap overflow-x-auto overflow-y-hidden no-scrollbar" onWheel={(e) => {
    e.currentTarget.scrollLeft += e.deltaY;
  }}>
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
					onChange={(e) => setFiltro(e.target.value)}
					className="w-full border px-3 py-2 rounded text-sm"
				/>

				{/* Tabela */}
				{/* Tabela com scroll apenas no corpo */}
				<div className="border rounded">
					<table className="w-full min-w-[600px]">
						<thead className="bg-gray-100 text-gray-700">
							<tr>
								<th className="text-left px-3 py-2">Data</th>
								<th className="text-left px-3 py-2">Descrição</th>
								<th className="text-right px-3 py-2">Valor</th>
							</tr>
						</thead>
					</table>
					<div style={{ maxHeight: '300px', overflowY: 'auto' }}>
						<table className="w-full min-w-[600px]">
							<tbody>
								{movimentosFiltrados.map((mov) => (
									<tr key={mov.id} className="border-b">
										<td className="px-3 py-2 whitespace-nowrap">{formatarData(mov.data)}</td>
										<td className="px-3 py-2 text-left">{mov.descricao}</td>
										<td className="px-3 py-2 text-right font-semibold" style={{ color: mov.valor < 0 ? 'red' : 'green' }}>
											R$ {mov.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{/* Total da Conta visível fora do scroll */}
					<div className="bg-gray-100 border-t px-3 py-2 text-right font-bold text-sm">
						Total da Conta: R$ {totalConta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
					</div>
				</div>
			</div>

			<div className="flex justify-end px-5 py-4 border-t gap-3 mt-3">
				<div className="text-right text-sm font-bold mt-2">
					Total Geral: R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
				</div>
				<button onClick={onClose} className="bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded hover:bg-gray-400">
					Fechar
				</button>
			</div>
		</Modal>
	);
};

export default ModalDetalhamento;
