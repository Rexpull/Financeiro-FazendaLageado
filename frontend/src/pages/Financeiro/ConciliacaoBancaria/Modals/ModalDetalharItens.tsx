import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import type { CentroCustos } from '../../../../../../backend/src/models/CentroCustos';
import type { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import { parseValorMonetario } from '../../../../Utils/valorMonetario';
import { agruparItens, itensIniciais, somaItensCentavos, type ItemDetalhe, type TiposDetalhe, type TotalPorId } from './detalharItens';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	movimento: MovimentoBancario;
	planos: PlanoConta[];
	centros: CentroCustos[];
	/** What the line has now (draft or saved): used to start the items */
	planosAtuais: TotalPorId[];
	centrosAtuais: TotalPorId[];
	onConfirmar: (planos: TotalPorId[], centros: TotalPorId[]) => void;
}

const formatarCampo = (raw: string) => {
	const n = parseValorMonetario(raw);
	return Number.isFinite(n) && n > 0 ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : raw;
};

const ehInvestimento = (tipo: string | null | undefined) => String(tipo ?? '').toUpperCase() === 'INVESTIMENTO';

/**
 * "Detalhar por itens": splits one bank line (e.g. a card bill) into items with their own value, plano and
 * centro. Saved as the total per plano and per centro, which is what every report reads.
 */
const ModalDetalharItens: React.FC<Props> = ({ isOpen, onClose, movimento, planos, centros, planosAtuais, centrosAtuais, onConfirmar }) => {
	const exigePlano = movimento.tipoMovimento !== 'C';
	const totalCentavos = Math.round(Math.abs(movimento.valor) * 100);
	const [itens, setItens] = useState<ItemDetalhe[]>([]);

	useEffect(() => {
		if (isOpen) setItens(itensIniciais(planosAtuais, centrosAtuais, movimento.valor));
		// Only when it opens: later changes of the draft must not wipe what is being typed
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const usados = useMemo(() => new Set(itens.map((i) => i.idPlano)), [itens]);
	const planosOpcoes = useMemo(
		() =>
			planos
				.filter(
					(p) =>
						p.nivel === 3 &&
						p.hierarquia.startsWith(exigePlano ? '002' : '001') &&
						(!p.inativo || usados.has(p.id)),
				)
				.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
		[planos, exigePlano, usados],
	);
	const centrosOpcoes = useMemo(
		() =>
			centros
				.filter((c) => c.tipoReceitaDespesa === (exigePlano ? 'DESPESA' : 'RECEITA'))
				.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
		[centros, exigePlano],
	);

	const somaCentavos = somaItensCentavos(itens);
	const difCentavos = totalCentavos - somaCentavos;
	// Each item: plano and centro of the same type (investimento → investimento, custeio → custeio)
	const tipos: TiposDetalhe = useMemo(
		() => ({
			plano: (id) => planos.find((p) => p.id === id)?.tipo,
			centro: (id) => centros.find((c) => c.id === id)?.tipo,
		}),
		[planos, centros],
	);
	const resultado = agruparItens(itens, movimento.valor, exigePlano, tipos);
	/** Type of the item's plano ('investimento' | 'custeio'), or null while no plano is chosen. */
	const tipoDoItem = (it: ItemDetalhe): 'investimento' | 'custeio' | null =>
		exigePlano && it.idPlano ? (ehInvestimento(tipos.plano(it.idPlano)) ? 'investimento' : 'custeio') : null;
	/** Choosing a plano of another type drops the item's centro, which no longer fits. */
	const escolherPlano = (i: number, idPlano: number | null) =>
		setItens((prev) =>
			prev.map((it, k) => {
				if (k !== i) return it;
				const centroServe = !idPlano || !it.idCentro || ehInvestimento(tipos.plano(idPlano)) === ehInvestimento(tipos.centro(it.idCentro));
				return { ...it, idPlano, idCentro: centroServe ? it.idCentro : null };
			}),
		);

	const alterar = (i: number, campo: Partial<ItemDetalhe>) => setItens((prev) => prev.map((it, k) => (k === i ? { ...it, ...campo } : it)));
	const adicionar = () =>
		setItens((prev) => {
			const resto = totalCentavos - somaItensCentavos(prev);
			const valor = resto > 0 ? (resto / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
			return [...prev, { valor, idPlano: null, idCentro: null }];
		});
	const remover = (i: number) => setItens((prev) => prev.filter((_, k) => k !== i));

	const confirmar = () => {
		if (!resultado.ok) return;
		onConfirmar(resultado.planos, resultado.centros);
	};

	const opcoesPlano = (tipo: 'custeio' | 'investimento') =>
		planosOpcoes
			.filter((p) => (tipo === 'investimento' ? ehInvestimento(p.tipo) : !ehInvestimento(p.tipo)))
			.map((p) => (
				<option key={p.id} value={p.id}>
					{p.descricao}
					{p.inativo ? ' (inativo)' : ''}
				</option>
			));
	const opcoesCentro = (tipo: 'custeio' | 'investimento') =>
		centrosOpcoes
			.filter((c) => (tipo === 'investimento' ? ehInvestimento(c.tipo) : !ehInvestimento(c.tipo)))
			.map((c) => (
				<option key={c.id} value={c.id}>
					{c.descricao}
					{exigePlano ? (ehInvestimento(c.tipo) ? ' · Investimento' : ' · Custeio') : ''}
				</option>
			));

	const colunas = exigePlano ? 'sm:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem]' : 'sm:grid-cols-[8.5rem_minmax(0,1fr)_2.5rem]';
	const campo = 'w-full h-10 px-2 border border-gray-300 rounded-md text-sm bg-white';

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-4xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
		>
			<div className="flex justify-between items-start bg-blue-50 px-4 py-3 rounded-t-lg border-b">
				<div className="min-w-0">
					<h2 className="text-xl font-semibold text-gray-800">Detalhar por itens</h2>
					<p className="text-sm text-gray-600 truncate" title={movimento.historico}>
						{movimento.historico} · {formatarMoeda(Math.abs(movimento.valor))}
					</p>
				</div>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700 ml-3" aria-label="Fechar" title="Fechar">
					<FontAwesomeIcon icon={faTimes} />
				</button>
			</div>

			<div className="px-4 pt-3 pb-2 overflow-y-auto">
				<p className="text-sm text-gray-600 mb-3">
					Cada item com o seu valor, {exigePlano ? 'plano de contas e centro de custos' : 'e centro de custos'}. A soma dos itens tem que fechar com o valor da linha.
					{exigePlano && ' Em cada item, o centro é do mesmo tipo do plano (custeio ou investimento).'}
				</p>

				<div className={`hidden sm:grid ${colunas} gap-2 px-1 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide`}>
					<span>Valor (R$)</span>
					{exigePlano && <span>Plano de contas</span>}
					<span>Centro de custos</span>
					<span />
				</div>

				<ul className="space-y-2">
					{itens.map((it, i) => (
						<li key={i} className={`grid grid-cols-1 ${colunas} gap-2 p-2 sm:p-1 border sm:border-0 rounded-md bg-gray-50 sm:bg-transparent`}>
							<input
								type="text"
								inputMode="decimal"
								aria-label={`Valor do item ${i + 1}`}
								className={`${campo} text-right tabular-nums`}
								placeholder="0,00"
								value={it.valor}
								onChange={(e) => alterar(i, { valor: e.target.value })}
								onBlur={(e) => alterar(i, { valor: formatarCampo(e.target.value) })}
							/>
							{exigePlano && (
								<select
									aria-label={`Plano de contas do item ${i + 1}`}
									className={campo}
									value={it.idPlano ?? ''}
									onChange={(e) => escolherPlano(i, e.target.value ? Number(e.target.value) : null)}
								>
									<option value="">Escolha o plano...</option>
									<optgroup label="Custeio">{opcoesPlano('custeio')}</optgroup>
									<optgroup label="Investimento">{opcoesPlano('investimento')}</optgroup>
								</select>
							)}
							<select
								aria-label={`Centro de custos do item ${i + 1}`}
								className={campo}
								value={it.idCentro ?? ''}
								onChange={(e) => alterar(i, { idCentro: e.target.value ? Number(e.target.value) : null })}
							>
								<option value="">Escolha o centro...</option>
								{exigePlano ? (
									<>
										{tipoDoItem(it) !== 'investimento' && <optgroup label="Custeio">{opcoesCentro('custeio')}</optgroup>}
										{tipoDoItem(it) !== 'custeio' && <optgroup label="Investimento">{opcoesCentro('investimento')}</optgroup>}
									</>
								) : (
									opcoesCentro('custeio')
								)}
							</select>
							<button
								type="button"
								onClick={() => remover(i)}
								disabled={itens.length === 1}
								className="h-10 w-full sm:w-10 flex items-center justify-center rounded-md text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent"
								aria-label={`Remover item ${i + 1}`}
								title="Remover item"
							>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</li>
					))}
				</ul>

				<button type="button" onClick={adicionar} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-2">
					<FontAwesomeIcon icon={faPlus} /> Adicionar item
				</button>
			</div>

			<div className="border-t px-4 py-3 bg-gray-50 rounded-b-lg">
				<dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-2">
					<div>
						<dt className="inline text-gray-500">Valor da linha: </dt>
						<dd className="inline font-semibold tabular-nums">{formatarMoeda(totalCentavos / 100)}</dd>
					</div>
					<div>
						<dt className="inline text-gray-500">Soma dos itens: </dt>
						<dd className="inline font-semibold tabular-nums">{formatarMoeda(somaCentavos / 100)}</dd>
					</div>
					<div>
						<dt className="inline text-gray-500">{difCentavos >= 0 ? 'Falta: ' : 'Passou: '}</dt>
						<dd className={`inline font-semibold tabular-nums ${difCentavos === 0 ? 'text-green-700' : 'text-orange-600'}`}>
							{formatarMoeda(Math.abs(difCentavos) / 100)}
						</dd>
					</div>
				</dl>
				{!resultado.ok && (
					<p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2" role="status">
						{resultado.erro}
					</p>
				)}
				<div className="flex justify-end gap-2">
					<button type="button" onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm">
						Cancelar
					</button>
					<button
						type="button"
						onClick={confirmar}
						disabled={!resultado.ok}
						className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2"
					>
						<FontAwesomeIcon icon={faCheck} /> Aplicar itens
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default ModalDetalharItens;
