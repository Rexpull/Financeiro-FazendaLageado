import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import type { MemoriaConciliacao } from '../../../../../../backend/src/models/MemoriaConciliacao';
import type { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import type { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import DialogModal from '../../../../components/DialogModal';
import { excluirMemoria, listarMemoriasConta } from '../../../../services/memoriaConciliacaoService';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	conta: { id?: number; bancoNome?: string; numConta?: string; responsavel?: string } | null;
	planos: PlanoConta[];
	centros: CentroCustos[];
	/** A memory was deleted: the lines it classified lose the "memória" tag */
	onExcluida?: () => void;
}

const pctTexto = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** "Pessoal - Salários" or "Múltiplos (3)" with every name and % in the title. */
function descreverFatias(fatias: Array<{ id: number; pct: number }>, nome: (id: number) => string, multiplo: string) {
	if (!fatias.length) return { texto: '-', titulo: undefined as string | undefined };
	const linhas = fatias.map((f) => `${nome(f.id)} — ${pctTexto(f.pct)}`).join('\n');
	return fatias.length === 1 ? { texto: nome(fatias[0].id), titulo: undefined } : { texto: `${multiplo} (${fatias.length})`, titulo: linhas };
}

/**
 * Table cell of a memory's planos or centros: the name alone when there is one, or one line per entry
 * with its percentage (the rateio must be readable without hovering).
 */
const CelulaFatias: React.FC<{ fatias: Array<{ id: number; pct: number }>; nome: (id: number) => string; rotulo: string }> = ({ fatias, nome, rotulo }) => {
	if (fatias.length === 0) return <span>-</span>;
	if (fatias.length === 1) {
		return (
			<span className="block truncate" title={nome(fatias[0].id)}>
				{nome(fatias[0].id)}
			</span>
		);
	}
	return (
		<ul className="space-y-0.5" aria-label={`${rotulo}: rateio entre ${fatias.length}`}>
			{fatias.map((f) => (
				<li key={f.id} className="flex items-baseline gap-2">
					<span className="min-w-0 flex-1 truncate" title={nome(f.id)}>
						{nome(f.id)}
					</span>
					<span className="shrink-0 tabular-nums text-gray-600">{pctTexto(f.pct)}</span>
				</li>
			))}
		</ul>
	);
};

/** 'AAAA-MM-DD HH:MM:SS' (UTC, from SQLite) → dd/mm/aaaa, read from the text. */
const dataTexto = (s: string | null) => {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
	return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
};

/**
 * "Memórias da conta": what the conta remembers (text, entrada/saída, plano and centros with %), how many
 * times it was used, and a trash button. To change a memory, reclassify a line with "Lembrar" ticked.
 */
const MemoriasConta: React.FC<Props> = ({ isOpen, onClose, conta, planos, centros, onExcluida }) => {
	const [memorias, setMemorias] = useState<MemoriaConciliacao[]>([]);
	const [carregando, setCarregando] = useState(false);
	const [excluindo, setExcluindo] = useState<MemoriaConciliacao | null>(null);
	const [busca, setBusca] = useState('');

	const carregar = useCallback(async () => {
		if (!conta?.id) return;
		setCarregando(true);
		try {
			setMemorias(await listarMemoriasConta(conta.id));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Não foi possível carregar as memórias da conta.');
		} finally {
			setCarregando(false);
		}
	}, [conta?.id]);

	useEffect(() => {
		if (isOpen) {
			setBusca('');
			carregar();
		}
	}, [isOpen, carregar]);

	const nomePlano = (id: number) => planos.find((p) => p.id === id)?.descricao ?? `Plano ${id}`;
	const nomeCentro = (id: number) => {
		const c = centros.find((x) => x.id === id);
		if (!c) return `Centro ${id}`;
		return c.tipoReceitaDespesa === 'DESPESA' && c.tipo ? `${c.descricao} (${c.tipo === 'INVESTIMENTO' ? 'Investimento' : 'Custeio'})` : c.descricao;
	};

	const confirmarExclusao = async () => {
		if (!excluindo) return;
		try {
			await excluirMemoria(excluindo.id);
			toast.success('Memória excluída. Os lançamentos já classificados continuam como estão.');
			setMemorias((lista) => lista.filter((m) => m.id !== excluindo.id));
			setExcluindo(null);
			onExcluida?.();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Não foi possível excluir a memória.');
		}
	};

	const nomeConta = [conta?.numConta, conta?.bancoNome, conta?.responsavel].filter(Boolean).join(' - ');

	// Search by text, plano or centro (accents and case ignored)
	const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	const visiveis = useMemo(() => {
		const q = semAcento(busca.trim());
		if (!q) return memorias;
		return memorias.filter((m) =>
			semAcento(
				[m.historicoExemplo ?? '', m.chave, ...m.planos.map((f) => nomePlano(f.id)), ...m.centros.map((f) => nomeCentro(f.id))].join(' '),
			).includes(q),
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [busca, memorias, planos, centros]);

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={onClose}
				className="bg-white rounded-lg shadow-lg w-full max-w-5xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			>
				<div className="flex justify-between items-start border-b px-5 py-4">
					<div className="min-w-0">
						<h2 className="text-xl font-semibold text-gray-800">Memórias da conta</h2>
						<p className="text-sm text-gray-500 truncate">{nomeConta}</p>
					</div>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-700 ml-3" aria-label="Fechar" title="Fechar">
						<FontAwesomeIcon icon={faTimes} />
					</button>
				</div>

				<div className="px-5 py-4 overflow-y-auto">
					{carregando ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent" />
						</div>
					) : memorias.length === 0 ? (
						<div className="text-center py-10 px-4">
							<p className="text-gray-700 font-medium">Esta conta ainda não lembra nenhuma classificação.</p>
							<p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
								Ao classificar um lançamento, marque <span className="font-medium">"Lembrar esta classificação nos próximos extratos"</span>. Nas
								próximas importações, o mesmo lançamento já entra classificado.
							</p>
						</div>
					) : (
						<>
							<div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
								<p className="text-sm text-gray-500 flex-1">
									Quando há rateio, cada plano e cada centro aparece com o seu percentual. Para mudar uma memória, reclassifique um lançamento
									com "Lembrar" marcado: a memória é substituída.
								</p>
								{memorias.length > 5 && (
									<input
										type="search"
										value={busca}
										onChange={(e) => setBusca(e.target.value)}
										placeholder="Buscar por texto, plano ou centro"
										aria-label="Buscar memória"
										className="w-full sm:w-64 h-9 px-3 border border-gray-300 rounded text-sm"
									/>
								)}
							</div>
							<div className="hidden sm:block overflow-x-auto">
								<table className="w-full border-collapse text-sm">
									<thead>
										<tr className="bg-gray-100 text-gray-700">
											<th className="p-2 text-left">Lançamento</th>
											<th className="p-2 text-center">Tipo</th>
											<th className="p-2 text-left">Plano de Contas</th>
											<th className="p-2 text-left">Centro de Custos</th>
											<th className="p-2 text-center">Usos</th>
											<th className="p-2 text-center whitespace-nowrap">Último uso</th>
											<th className="p-2" />
										</tr>
									</thead>
									<tbody>
										{visiveis.map((m) => {
											return (
												<tr key={m.id} className="border-b align-top">
													<td className="p-2 max-w-[18rem]">
														<span className="block truncate" title={m.historicoExemplo || m.chave}>
															{m.historicoExemplo || m.chave}
														</span>
														{/\d/.test(m.historicoExemplo ?? '') && (
															<span className="block truncate text-xs text-gray-500" title="Datas e números do histórico são ignorados">
																Reconhece: {m.chave}
															</span>
														)}
														{m.modalidadeMovimento === 'transferencia' && (
															<span className="text-xs text-gray-500">Movimentação sem efeito</span>
														)}
													</td>
													<td className={`p-2 text-center whitespace-nowrap ${m.tipoMovimento === 'C' ? 'text-green-700' : 'text-red-600'}`}>
														{m.tipoMovimento === 'C' ? 'Entrada' : 'Saída'}
													</td>
													<td className="p-2 max-w-[16rem]">
														<CelulaFatias fatias={m.planos} nome={nomePlano} rotulo="Planos de contas" />
													</td>
													<td className="p-2 max-w-[18rem]">
														<CelulaFatias fatias={m.centros} nome={nomeCentro} rotulo="Centros de custos" />
													</td>
													<td className="p-2 text-center tabular-nums">{m.usos}</td>
													<td className="p-2 text-center tabular-nums">{m.usos > 0 ? dataTexto(m.ultimoUsoEm) : '-'}</td>
													<td className="p-2 text-right">
														<button
															className="text-red-500 hover:bg-red-50 rounded px-2 py-1"
															onClick={() => setExcluindo(m)}
															aria-label={`Excluir memória de ${m.historicoExemplo || m.chave}`}
															title="Excluir memória"
														>
															<FontAwesomeIcon icon={faTrash} />
														</button>
													</td>
												</tr>
											);
										})}
										{visiveis.length === 0 && (
											<tr>
												<td colSpan={7} className="p-6 text-center text-gray-500">
													Nenhuma memória com "{busca}".
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
							{/* Phone: one card per memory (the table would hide plano and centro behind a sideways scroll) */}
							<ul className="sm:hidden space-y-2">
								{visiveis.map((m) => {
									const plano = descreverFatias(m.planos, nomePlano, 'Múltiplos planos');
									const centro = descreverFatias(m.centros, nomeCentro, 'Múltiplos centros');
									return (
										<li key={m.id} className="border rounded-md p-3 text-sm">
											<div className="flex items-start gap-2">
												<div className="min-w-0 flex-1">
													<p className="font-medium text-gray-800 break-words">{m.historicoExemplo || m.chave}</p>
													<p className={`text-xs ${m.tipoMovimento === 'C' ? 'text-green-700' : 'text-red-600'}`}>
														{m.tipoMovimento === 'C' ? 'Entrada' : 'Saída'}
														{m.modalidadeMovimento === 'transferencia' && <span className="text-gray-500"> · Movimentação sem efeito</span>}
													</p>
												</div>
												<button
													className="text-red-500 hover:bg-red-50 rounded px-2 py-1 -mr-1"
													onClick={() => setExcluindo(m)}
													aria-label={`Excluir memória de ${m.historicoExemplo || m.chave}`}
													title="Excluir memória"
												>
													<FontAwesomeIcon icon={faTrash} />
												</button>
											</div>
											<dl className="mt-2 space-y-0.5 text-gray-700">
												<div className="flex gap-1">
													<dt className="text-gray-500 shrink-0">Plano:</dt>
													<dd className="min-w-0 break-words">{plano.titulo ? plano.titulo.split('\n').map((l) => <span key={l} className="block">{l}</span>) : plano.texto}</dd>
												</div>
												{m.centros.length > 0 && (
													<div className="flex gap-1">
														<dt className="text-gray-500 shrink-0">Centro:</dt>
														<dd className="min-w-0 break-words">{centro.titulo ? centro.titulo.split('\n').map((l) => <span key={l} className="block">{l}</span>) : centro.texto}</dd>
													</div>
												)}
											</dl>
											<p className="mt-1 text-xs text-gray-500">
												{m.usos > 0 ? `Usada ${m.usos} ${m.usos === 1 ? 'vez' : 'vezes'} · último uso ${dataTexto(m.ultimoUsoEm)}` : 'Ainda não usada'}
											</p>
										</li>
									);
								})}
								{visiveis.length === 0 && <li className="p-6 text-center text-gray-500">Nenhuma memória com "{busca}".</li>}
							</ul>
						</>
					)}
				</div>

				<div className="border-t px-5 py-3 flex justify-end">
					<button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded hover:bg-gray-200 font-semibold">
						Fechar
					</button>
				</div>
			</Modal>

			<DialogModal
				isOpen={!!excluindo}
				onClose={() => setExcluindo(null)}
				onConfirm={confirmarExclusao}
				title="Excluir memória"
				type="warn"
				message={`Esquecer a classificação de "${excluindo?.historicoExemplo || excluindo?.chave || ''}"? Os lançamentos já classificados continuam como estão; só as próximas importações deixam de vir classificadas.`}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>
		</>
	);
};

export default MemoriasConta;
