import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { Tree, TreeNode } from 'react-organizational-chart';

import DialogModal from '../../../components/DialogModal';
import CrudModal from './CrudModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faSearch,
	faPlus,
	faChevronLeft,
	faChevronRight,
	faTrash,
	faPencil,
	faSortUp,
	faSortDown,
} from '@fortawesome/free-solid-svg-icons';

import { faMinus, faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';

import { listarPlanoContas, salvarPlanoConta, excluirPlanoConta, atualizarStatusConta } from '../../../services/planoContasService';
import { PlanoConta } from '../../../../../backend/src/models/PlanoConta';

const PlanoContasTable: React.FC = () => {
	const [planos, setPlanos] = useState<PlanoConta[]>([]);
	const [filteredPlanos, setFilteredPlanos] = useState<PlanoConta[]>([]);
	const [modalIsOpen, setModalIsOpen] = useState(false);
	const [planoData, setPlanoData] = useState<PlanoConta>({
		id: 0,
		nivel: 1,
		hierarquia: '',
		descricao: '',
		inativo: false,
		tipo: 'custeio',
		idReferente: null,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [deletePlanoId, setDeletePlanoId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [ocultarInativos, setOcultarInativos] = useState(false);
	const [mostrarHierarquia, setMostrarHierarquia] = useState(false);

	// 🔹 Estado para ordenação
	const [sortColumn, setSortColumn] = useState<string | null>(null);
	const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

	// 🔹 Paginação
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(15);
	const [activeTab, setActiveTab] = useState<'tabela' | 'arvore'>('tabela');
	const [expandedNodes, setExpandedNodes] = useState<number[]>([]);
	const [tipoSelecionado, setTipoSelecionado] = useState<'despesa' | 'receita' | 'movimentacao'>('despesa');

	useEffect(() => {
		fetchPlanos();
		handleSort('nivel');
	}, []);

	const fetchPlanos = async () => {
		setIsLoading(true);
		try {
			const data = await listarPlanoContas();
			setPlanos(data);
			setFilteredPlanos(data);
			setExpandedNodes(data.map((p) => p.id));
		} catch (error) {
			console.error('Erro ao buscar planos de contas:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const planosFiltrados = planos.filter((p) => {
		if (tipoSelecionado === 'despesa') return p.hierarquia.startsWith('002');
		if (tipoSelecionado === 'receita') return p.hierarquia.startsWith('001');
		if (tipoSelecionado === 'movimentacao') return p.hierarquia.startsWith('003');
		return true;
	});

	const rootPlano = planosFiltrados.find((p) => p.idReferente === null);

	useEffect(() => {
		const allIds = planos.map((p) => p.id);
		setExpandedNodes(allIds);
	}, [planos]);

	const renderTree = (parentId: number | null): JSX.Element[] => {
		const children = planosFiltrados.filter((p) => p.idReferente === parentId);

		if (!children.length) return [];

		return children.map((plano) => {
			const hasChildren = planosFiltrados.some((p) => p.idReferente === plano.id);
			const isExpanded = expandedNodes.includes(plano.id);

			return (
				<TreeNode
					key={plano.id}
					label={
						<div className="border border-gray-400 bg-white px-4 py-2 rounded shadow text-center hover:bg-orange-50 min-w-[140px]">
							<div className="font-bold">{plano.descricao}</div>
							<div className="text-xs text-gray-500">{plano.hierarquia}</div>
							<div className="text-xs text-gray-400 capitalize">{plano.tipo.toLowerCase()}</div>
						</div>
					}
					style={{ borderLeft: hasChildren && isExpanded ? '2px solid #bbb' : 'none' }} // Adjusted styling
				>
					{hasChildren && isExpanded && renderTree(plano.id)}
				</TreeNode>
			);
		});
	};

	useEffect(() => {
		let filtered = [...planos];

		// 🔹 Filtro de busca
		if (searchTerm) {
			filtered = filtered.filter(
				(plano) => plano.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || plano.hierarquia.includes(searchTerm)
			);
		}

		// 🔹 Filtro de "Ocultar Inativos"
		if (ocultarInativos) {
			filtered = filtered.filter((plano) => !plano.inativo);
		}

		// 🔹 Aplica ordenação
		if (sortColumn) {
			filtered.sort((a, b) => {
				let valA = a[sortColumn as keyof PlanoConta];
				let valB = b[sortColumn as keyof PlanoConta];

				if (typeof valA === 'string') valA = valA.toLowerCase();
				if (typeof valB === 'string') valB = valB.toLowerCase();

				if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
				if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
				return 0;
			});
		}

		setFilteredPlanos(filtered);
		setCurrentPage(1); // Reinicia a página ao alterar os filtros
	}, [searchTerm, ocultarInativos, planos, sortColumn, sortDirection]);

	const openModal = (plano?: PlanoConta) => {
		setPlanoData(plano || { id: 0, nivel: 1, hierarquia: '', descricao: '', inativo: false, tipo: 'custeio', idReferente: null });
		setModalIsOpen(true);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			if (planoData.id) {
				await salvarPlanoConta(planoData);
				setPlanos((prev) => prev.map((plano) => (plano.id === planoData.id ? planoData : plano)));
			} else {
				const planoSalvo = await salvarPlanoConta(planoData);
				setPlanos((prev) => [...prev, planoSalvo]);
			}
			setModalIsOpen(false);
			fetchPlanos();
		} catch (error) {
			console.error('Erro ao salvar plano de contas:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteConfirm = async () => {
		if (deletePlanoId === null) return;
		try {
			await excluirPlanoConta(deletePlanoId);
			setPlanos((prev) => prev.filter((plano) => plano.id !== deletePlanoId));
			setConfirmModalOpen(false);
		} catch (error) {
			console.error('Erro ao excluir plano de contas:', error);
		}
	};

	const handleDelete = (id: number) => {
		setDeletePlanoId(id);
		setConfirmModalOpen(true);
	};

	const handleStatusChange = async (id: number, novoStatus: boolean) => {
		try {
			await atualizarStatusConta(id, novoStatus);
			setPlanos((prev) => prev.map((plano) => (plano.id === id ? { ...plano, inativo: novoStatus } : plano)));
		} catch (error) {
			console.error('Erro ao atualizar status do plano de contas:', error);
		}
	};

	const handleSort = (column: string) => {
		setSortColumn(column);
		setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
	};

	// 🔹 Paginação: calcular registros exibidos
	const indexOfLastItem = currentPage * itemsPerPage;
	const indexOfFirstItem = indexOfLastItem - itemsPerPage;
	const currentItems = filteredPlanos.slice(indexOfFirstItem, indexOfLastItem);
	const totalPages = Math.ceil(filteredPlanos.length / itemsPerPage);

	return (
		<div>
			<div className="flex justify-between items-center gap-5 mb-4">
				<div className="flex border-b border-gray-300 ">
					<button
						className={`px-4 py-2 font-bold text-sm text-nowrap ${
							activeTab === 'tabela' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
						}`}
						onClick={() => setActiveTab('tabela')}
					>
						TABELA DOS DADOS
					</button>
					<button
						className={`px-4 py-2 font-bold text-sm text-nowrap ${
							activeTab === 'arvore' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
						}`}
						onClick={() => setActiveTab('arvore')}
					>
						VISÃO EM ÁRVORE
					</button>
				</div>

				<div className="flex justify-end items-center gap-5 w-full">
					{activeTab === 'tabela' ? (
						<>
							<div className="relative flex items-center gap-2 w-auto whitespace-nowrap">
								<label className="flex items-center text-gray-600 font-medium mr-2 cursor-pointer">
									Ocultar Inativos:
									<input
										type="checkbox"
										className="ml-2 cursor-pointer"
										style={{ marginTop: '0.1rem' }}
										checked={ocultarInativos}
										onChange={() => setOcultarInativos(!ocultarInativos)}
									/>
								</label>
								|
								<label className="flex items-center text-gray-600 font-medium mr-2 cursor-pointer">
									Mostrar Hierarquia:
									<input
										type="checkbox"
										className="ml-2 cursor-pointer"
										style={{ marginTop: '0.1rem' }}
										checked={mostrarHierarquia}
										onChange={() => setMostrarHierarquia(!mostrarHierarquia)}
									/>
								</label>
							</div>
							<div className="relative">
								<span className="absolute inset-y-0 left-0 flex items-center " style={{ paddingLeft: '0.75rem', color: '#666666' }}>
									<FontAwesomeIcon icon={faSearch} />
								</span>
								<input
									type="text"
									className="border border-gray-400 p-2 pl-10 pr-4 rounded w-full hover:border-gray-500 focus:outline-none focus:border-blue-500"
									style={{ width: '300px' }}
									placeholder="Filtrar por hierarquia ou descrição"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>
						</>
					) : (
						<></>
					)}
					<button
						className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-400"
						onClick={() => openModal()}
					>
						Adicionar Plano de Contas <FontAwesomeIcon icon={faPlus} className="ml-3 font-bold" />
					</button>
				</div>
			</div>
			<div className="bg-gray-50 shadow-md rounded-lg overflow-hidden border border-gray-200 " style={{ maxWidth: 'calc(100vw - 315px)' }}>
				{isLoading ? (
					<div className="flex justify-center items-center h-64">
						<div className="loader"></div>
					</div>
				) : (
					<>
						{activeTab === 'tabela' ? (
							<>
								<table className="w-full border-collapse">
									<thead>
										<tr className="bg-gray-200">
											{['nivel', ...(mostrarHierarquia ? ['hierarquia'] : []), 'descricao', 'tipo'].map((column) => (
												<th key={column} className="p-2 cursor-pointer" onClick={() => handleSort(column)}>
													{column.charAt(0).toUpperCase() + column.slice(1)}
													{sortColumn === column && (
														<FontAwesomeIcon icon={sortDirection === 'asc' ? faSortUp : faSortDown} className="ml-1" />
													)}
												</th>
											))}

											<th className="p-2 text-right">Status</th>
											<th className="p-2 pr-11 text-right">Ações</th>
										</tr>
									</thead>
									<tbody>
										{currentItems.length === 0 ? (
											<tr>
												<td colSpan={6} className="text-center py-5 text-gray-600 text-lg font-medium border-b">
													Nenhum movimento encontrado!
												</td>
											</tr>
										) : (
											currentItems.map((planoC) => (
												<tr key={planoC.id} className="border-b">
													<td className="p-2 text-center">{planoC.nivel}</td>
													{mostrarHierarquia && <td className="p-2 text-left">{planoC.hierarquia}</td>}
													<td className="p-2 text-left">{planoC.descricao}</td>
													<td className="p-2 text-center capitalize">{planoC.tipo.toLowerCase()}</td>
													<td className="p-2 text-right">
														<label className="relative inline-flex items-center cursor-pointer">
															<input
																type="checkbox"
																className="sr-only peer"
																checked={!planoC.inativo}
																onChange={() => handleStatusChange(planoC.id, !planoC.inativo)}
															/>
															<div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[1px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
														</label>
													</td>

													<td className="p-2 text-right pr-5">
														<button
															className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-700"
															onClick={() => openModal(planoC)}
														>
															<FontAwesomeIcon icon={faPencil} />
														</button>
														<button
															className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700"
															onClick={() => handleDelete(planoC.id)}
														>
															<FontAwesomeIcon icon={faTrash} />
														</button>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
								{/* 🔹 Paginação */}
								<div className="flex justify-center items-center my-2 mx-2">
									<span className="text-gray-800 text-base w-auto whitespace-nowrap ml-2">
										{planos.length} <span className="text-sm">Registros</span>
									</span>

									<div className="flex items-center gap-2 w-full justify-end">
										<button
											className="px-3 py-1 border rounded mx-1"
											disabled={currentPage === 1}
											onClick={() => setCurrentPage(currentPage - 1)}
										>
											<FontAwesomeIcon icon={faChevronLeft} />
										</button>

										<span className="px-3 py-1">
											{currentPage} / {totalPages}
										</span>

										<button
											className="px-3 py-1 border rounded mx-1"
											disabled={currentPage === totalPages}
											onClick={() => setCurrentPage(currentPage + 1)}
										>
											<FontAwesomeIcon icon={faChevronRight} />
										</button>

										<select
											className="border border-gray-400 p-1 rounded"
											value={itemsPerPage}
											onChange={(e) => setItemsPerPage(Number(e.target.value))}
										>
											{[5, 10, 15, 30, 50, 100].map((size) => (
												<option key={size} value={size}>
													{size}
												</option>
											))}
										</select>
									</div>
								</div>
							</>
						) : (
							<div className="p-4">
								<div className="flex justify-between items-center mb-4">
									{/* Select de tipo */}
									<div className="flex items-center gap-2">
										<span className="font-semibold text-gray-700">Tipo:</span>
										<select
											value={tipoSelecionado}
											onChange={(e) => setTipoSelecionado(e.target.value as 'despesa' | 'receita' | 'movimentacao')}
											className="border rounded px-3 py-1 text-gray-700"
										>
											<option value="despesa">Despesa</option>
											<option value="receita">Receita</option>
											<option value="movimentacao">Movimentacao</option>
										</select>
									</div>
								</div>

								{/* Container da arvore */}
								<div className="arvorePlanos overflow-auto border bg-gray-100 rounded p-6 shadow" style={{ width: '100%', height: '600px' }}>
									<Tree
										lineWidth={'2px'}
										lineColor={'#bbb'}
										lineBorderRadius={'10px'}
										label={
											<div className="border border-gray-400 bg-white px-4 py-2 rounded shadow text-center hover:bg-orange-50 min-w-[140px]">
												<div className="font-bold">{rootPlano?.descricao ?? 'Plano de Contas'}</div>
												<div className="text-xs text-gray-500">{rootPlano?.hierarquia}</div>
												<div className="text-xs text-gray-400 capitalize">{rootPlano?.tipo?.toLowerCase()}</div>
											</div>
										}
									>
										{renderTree(rootPlano?.id || null)}
									</Tree>
								</div>
							</div>
						)}
					</>
				)}
			</div>
			<CrudModal
				isOpen={modalIsOpen}
				onClose={() => setModalIsOpen(false)}
				planoData={planoData}
				handleInputChange={(e) => setPlanoData({ ...planoData, [e.target.name]: e.target.value })}
				handleSave={handleSave}
				isSaving={isSaving}
				planos={planos}
			/>

			<DialogModal
				isOpen={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={handleDeleteConfirm}
				title="Atenção"
				type="warn"
				message="Tem certeza que deseja excluir este Plano de Conta?"
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>
		</div>
	);
};

export default PlanoContasTable;
