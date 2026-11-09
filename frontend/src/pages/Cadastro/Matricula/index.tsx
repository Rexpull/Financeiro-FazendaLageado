import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faPlus, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import BreadCrumb from '../../../components/BreadCrumb';
import DialogModal from '../../../components/DialogModal';
import type { Matricula } from '../../../../../backend/src/models/Matricula';
import { formatarMatricula, normalizarMatricula } from '../../../../../backend/src/utils/matriculas';
import { excluirMatricula, listarMatriculas, salvarMatricula } from '../../../services/matriculaService';

const campo = 'h-9 px-3 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';
const btnIcone = 'w-8 h-8 inline-flex items-center justify-center rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

/**
 * Matrículas of the rural properties given as guarantee in financing contracts. The financing form picks
 * from this list, and the Relatório de Financiamentos filters by it.
 */
const Matriculas: React.FC = () => {
	const [lista, setLista] = useState<Matricula[]>([]);
	const [carregando, setCarregando] = useState(true);
	const [falhou, setFalhou] = useState(false);
	const [numero, setNumero] = useState('');
	const [descricao, setDescricao] = useState('');
	const [salvando, setSalvando] = useState(false);
	const [editando, setEditando] = useState<{ id: number; numero: string; descricao: string } | null>(null);
	const [excluindo, setExcluindo] = useState<Matricula | null>(null);
	const [busca, setBusca] = useState('');

	const carregar = useCallback(async () => {
		setCarregando(true);
		setFalhou(false);
		try {
			setLista(await listarMatriculas());
		} catch {
			setFalhou(true);
		} finally {
			setCarregando(false);
		}
	}, []);

	useEffect(() => {
		carregar();
	}, [carregar]);

	const visiveis = useMemo(() => {
		const q = busca.trim().toLowerCase();
		if (!q) return lista;
		const n = normalizarMatricula(q);
		return lista.filter((m) => (n && m.numero.includes(n)) || String(m.descricao ?? '').toLowerCase().includes(q));
	}, [busca, lista]);

	const adicionar = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!normalizarMatricula(numero)) return;
		setSalvando(true);
		try {
			const m = await salvarMatricula({ numero, descricao });
			toast.success(`Matrícula ${formatarMatricula(m.numero)} cadastrada.`);
			setNumero('');
			setDescricao('');
			await carregar();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a matrícula.');
		} finally {
			setSalvando(false);
		}
	};

	const salvarEdicao = async () => {
		if (!editando) return;
		const original = lista.find((m) => m.id === editando.id);
		setSalvando(true);
		try {
			const m = await salvarMatricula(editando);
			const trocouNumero = original && original.numero !== m.numero && (original.contratos ?? 0) > 0;
			toast.success(
				trocouNumero
					? `Matrícula alterada para ${formatarMatricula(m.numero)}, também nos ${original!.contratos} contratos que a usam.`
					: 'Matrícula atualizada.',
			);
			setEditando(null);
			await carregar();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a matrícula.');
		} finally {
			setSalvando(false);
		}
	};

	const confirmarExclusao = async () => {
		if (!excluindo) return;
		try {
			await excluirMatricula(excluindo.id);
			toast.success(`Matrícula ${formatarMatricula(excluindo.numero)} excluída.`);
			setExcluindo(null);
			await carregar();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a matrícula.');
			setExcluindo(null);
		}
	};

	const usadas = lista.filter((m) => (m.contratos ?? 0) > 0).length;

	return (
		<div>
			<BreadCrumb grupo="Cadastro" pagina="Matrículas" />
			<div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 max-w-4xl">
				<h2 className="text-lg font-semibold text-gray-900">Matrículas (garantias)</h2>
				<p className="text-sm text-gray-500 mb-4">
					Imóveis oferecidos aos bancos como garantia. No cadastro do financiamento você escolhe uma ou mais destas matrículas, e o relatório de
					financiamentos filtra por elas.
				</p>

				<form onSubmit={adicionar} className="flex flex-col sm:flex-row gap-2 mb-4" aria-label="Nova matrícula">
					<input
						className={`${campo} sm:w-40`}
						placeholder="Nº (ex.: 3.041)"
						aria-label="Número da matrícula"
						inputMode="numeric"
						value={numero}
						onChange={(e) => setNumero(e.target.value)}
						disabled={salvando}
					/>
					<input
						className={`${campo} flex-1`}
						placeholder="Imóvel / observação (opcional)"
						aria-label="Descrição"
						value={descricao}
						onChange={(e) => setDescricao(e.target.value)}
						disabled={salvando}
					/>
					<button
						type="submit"
						disabled={salvando || !normalizarMatricula(numero)}
						className="h-9 px-4 rounded bg-red-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-red-600 disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faPlus} /> Adicionar
					</button>
				</form>

				<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
					<p className="text-sm text-gray-600" role="status">
						{carregando ? 'Carregando...' : `${lista.length} matrículas · ${usadas} em uso em financiamentos`}
					</p>
					{lista.length > 8 && (
						<input
							type="search"
							className={`${campo} w-full sm:w-64`}
							placeholder="Buscar matrícula ou imóvel"
							aria-label="Buscar matrícula"
							value={busca}
							onChange={(e) => setBusca(e.target.value)}
						/>
					)}
				</div>

				{falhou ? (
					<div className="p-6 text-center text-red-700">
						Não foi possível carregar as matrículas.{' '}
						<button type="button" onClick={carregar} className="underline">
							Tentar novamente
						</button>
					</div>
				) : (
					<div className="border rounded-lg overflow-hidden">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 text-xs uppercase text-gray-600">
								<tr>
									<th className="p-2 text-left w-32">Matrícula</th>
									<th className="p-2 text-left">Imóvel / observação</th>
									<th className="p-2 text-right w-24">Contratos</th>
									<th className="p-2 w-24" aria-label="Ações" />
								</tr>
							</thead>
							<tbody className="divide-y">
								{visiveis.map((m) =>
									editando?.id === m.id ? (
										<tr key={m.id} className="bg-blue-50/40">
											<td className="p-2">
												<input
													className={`${campo} w-full`}
													aria-label="Número da matrícula"
													value={editando.numero}
													autoFocus
													onChange={(e) => setEditando({ ...editando, numero: e.target.value })}
													onKeyDown={(e) => e.key === 'Enter' && salvarEdicao()}
												/>
											</td>
											<td className="p-2">
												<input
													className={`${campo} w-full`}
													aria-label="Descrição"
													value={editando.descricao}
													onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
													onKeyDown={(e) => e.key === 'Enter' && salvarEdicao()}
												/>
											</td>
											<td className="p-2 text-right tabular-nums">{m.contratos ?? 0}</td>
											<td className="p-2 text-right whitespace-nowrap">
												<button type="button" className={`${btnIcone} text-green-700`} onClick={salvarEdicao} disabled={salvando} aria-label="Salvar" title="Salvar">
													<FontAwesomeIcon icon={faCheck} />
												</button>
												<button type="button" className={`${btnIcone} text-gray-500`} onClick={() => setEditando(null)} aria-label="Cancelar" title="Cancelar">
													<FontAwesomeIcon icon={faTimes} />
												</button>
											</td>
										</tr>
									) : (
										<tr key={m.id} className="hover:bg-gray-50">
											<td className="p-2 font-medium text-gray-900 tabular-nums">{formatarMatricula(m.numero)}</td>
											<td className="p-2 text-gray-700">{m.descricao || <span className="text-gray-400">—</span>}</td>
											<td className="p-2 text-right tabular-nums">{m.contratos || <span className="text-gray-400">0</span>}</td>
											<td className="p-2 text-right whitespace-nowrap">
												<button
													type="button"
													className={`${btnIcone} text-blue-700`}
													onClick={() => setEditando({ id: m.id, numero: m.numero, descricao: m.descricao ?? '' })}
													aria-label={`Editar matrícula ${formatarMatricula(m.numero)}`}
													title="Editar"
												>
													<FontAwesomeIcon icon={faPen} />
												</button>
												<button
													type="button"
													className={`${btnIcone} text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent`}
													onClick={() => setExcluindo(m)}
													disabled={(m.contratos ?? 0) > 0}
													aria-label={`Excluir matrícula ${formatarMatricula(m.numero)}`}
													title={(m.contratos ?? 0) > 0 ? 'Em uso em financiamentos: tire dos contratos antes de excluir' : 'Excluir'}
												>
													<FontAwesomeIcon icon={faTrash} />
												</button>
											</td>
										</tr>
									),
								)}
								{!carregando && visiveis.length === 0 && (
									<tr>
										<td colSpan={4} className="p-6 text-center text-gray-500">
											{lista.length ? `Nenhuma matrícula com "${busca}".` : 'Nenhuma matrícula cadastrada.'}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<DialogModal
				isOpen={!!excluindo}
				onClose={() => setExcluindo(null)}
				onConfirm={confirmarExclusao}
				type="warn"
				title="Excluir matrícula"
				message={excluindo ? `Excluir a matrícula ${formatarMatricula(excluindo.numero)}?` : ''}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>
		</div>
	);
};

export default Matriculas;
