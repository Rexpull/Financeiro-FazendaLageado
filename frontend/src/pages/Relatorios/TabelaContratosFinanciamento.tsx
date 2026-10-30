import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faSort, faSortDown, faSortUp, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { brl } from '../../Utils/formatos';
import { formatarDataISO } from '../../Utils/dataSemFuso';
import {
	ordenarLinhas,
	rotuloModalidade,
	separarSemParcelas,
	situacaoLiquidado,
	somaValores,
	textoParcelas,
	type ColunaOrdem,
	type LinhaContrato,
	type Ordem,
} from './financiamentosRelatorio';

const BADGE_PARCELA: Record<string, string> = {
	Liquidado: 'bg-green-100 text-green-800',
	Vencido: 'bg-red-100 text-red-800',
};

// Cells: tighter padding on phones so Contrato / Tomador / A vencer fit in 375px without scrolling
const th = 'px-2 sm:px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50 shadow-[inset_0_-1px_0_#e5e7eb]';
const td = 'px-2 sm:px-3 py-2.5 text-[13px] sm:text-sm text-gray-700 align-top';
const num = 'text-right tabular-nums whitespace-nowrap';
const quebra = '[overflow-wrap:anywhere]';

const ParcelasContrato: React.FC<{ linha: LinhaContrato }> = ({ linha }) => {
	const { contrato: c } = linha;
	return (
		<div>
			<p className="text-xs text-gray-600 mb-2">
				{rotuloModalidade(c)} · contrato de {formatarDataISO(c.dataContrato)} · valor {brl(c.valorContrato)}
				{c.numeroGarantia ? ` · garantia ${c.numeroGarantia}` : ''}
				{c.taxaJurosAnual != null ? ` · juros ${String(c.taxaJurosAnual).replace('.', ',')}% a.a.` : ''}
			</p>
			{!c.parcelas.length ? (
				<p className="text-sm text-gray-500">Contrato sem parcelas cadastradas.</p>
			) : (
				<table className="w-full sm:w-auto text-[13px] sm:text-sm">
					<thead>
						<tr className="text-left text-xs font-semibold text-gray-600">
							<th className="px-2 py-1.5">Nº</th>
							<th className="px-2 py-1.5">Vencimento</th>
							<th className="px-2 py-1.5 hidden sm:table-cell">Pagamento</th>
							<th className="px-2 py-1.5">Situação</th>
							<th className="px-2 py-1.5 text-right">Valor</th>
						</tr>
					</thead>
					<tbody>
						{c.parcelas.map((p) => (
							<tr key={p.idParcela} className="border-t border-gray-200">
								<td className="px-2 py-1.5">{p.numParcela}</td>
								<td className="px-2 py-1.5 whitespace-nowrap">{formatarDataISO(p.dt_vencimento)}</td>
								<td className="px-2 py-1.5 whitespace-nowrap hidden sm:table-cell">{formatarDataISO(p.dt_liquidacao, '—')}</td>
								<td className="px-2 py-1.5">
									<span className={`px-2 py-0.5 rounded text-xs font-semibold ${BADGE_PARCELA[p.status] ?? 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span>
								</td>
								<td className={`px-2 py-1.5 font-medium ${num}`}>{brl(p.valor)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
};

/** Header cell that sorts the table (click again to invert). */
const Cabecalho: React.FC<{
	coluna: ColunaOrdem;
	ordem: Ordem;
	onOrdenar: (c: ColunaOrdem) => void;
	direita?: boolean;
	className?: string;
	title?: string;
	children: React.ReactNode;
}> = ({ coluna, ordem, onOrdenar, direita, className = '', title, children }) => {
	const ativo = ordem.coluna === coluna;
	return (
		<th scope="col" aria-sort={ativo ? (ordem.desc ? 'descending' : 'ascending') : 'none'} className={`${th} ${direita ? 'text-right' : 'text-left'} ${className}`}>
			<button
				type="button"
				onClick={() => onOrdenar(coluna)}
				title={title ?? 'Ordenar'}
				className={`inline-flex items-center gap-1.5 uppercase rounded hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
					ativo ? 'text-gray-900' : ''
				} ${direita ? 'flex-row-reverse' : ''}`}
			>
				{children}
				<FontAwesomeIcon
					icon={ativo ? (ordem.desc ? faSortDown : faSortUp) : faSort}
					className={`text-[10px] ${ativo ? 'text-blue-600' : 'text-gray-300'}`}
					aria-hidden
				/>
			</button>
		</th>
	);
};

/** Contracts without parcelas registered: collapsed note under the table. */
const SemParcelas: React.FC<{ linhas: LinhaContrato[] }> = ({ linhas }) => {
	const [aberto, setAberto] = useState(false);
	if (!linhas.length) return null;
	return (
		<div className="border-t border-gray-200 px-3 sm:px-4 py-2.5 text-sm">
			<button
				type="button"
				aria-expanded={aberto}
				onClick={() => setAberto((v) => !v)}
				className="inline-flex items-center gap-2 text-amber-800 hover:text-amber-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
			>
				<FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" aria-hidden />
				<span>
					{linhas.length} {linhas.length === 1 ? 'contrato sem parcelas cadastradas' : 'contratos sem parcelas cadastradas'} — conferir no cadastro
				</span>
				<FontAwesomeIcon icon={aberto ? faChevronDown : faChevronRight} className="text-[10px]" aria-hidden />
			</button>
			{aberto && (
				<ul className="mt-2 space-y-1 text-gray-600">
					{linhas.map(({ contrato: c }) => (
						<li key={c.idFinanciamento} className="flex flex-wrap gap-x-2">
							<span className="font-semibold text-gray-800">{c.numeroContrato || 'sem número'}</span>
							<span>{c.credor}</span>
							<span>· {c.tomador || 'sem tomador'}</span>
							<span>· {formatarDataISO(c.dataContrato)}</span>
							<span className="tabular-nums">· valor do contrato {brl(c.valorContrato)}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

/**
 * Contracts of a view (or of a chart bar / KPI). The value that prevails is the sum of the parcelas not
 * liquidated ("A vencer"); the contract value comes after it. `colunaValor` adds a highlighted column
 * with the value of each line in that context (e.g. "Pago no período", "Vence em 2027"), placed first.
 * Contracts without parcelas go to a note under the table (they still count in the totals).
 */
const TabelaContratosFinanciamento: React.FC<{
	linhas: LinhaContrato[];
	colunaValor?: string;
	mostrarSituacao?: boolean;
	vazio: React.ReactNode;
	/** Sticky header offset in px (height of whatever is stuck above it) */
	topoCabecalho?: number;
}> = ({ linhas, colunaValor, mostrarSituacao = false, vazio, topoCabecalho = 0 }) => {
	const [abertos, setAbertos] = useState<Set<number>>(new Set());
	const [ordem, setOrdem] = useState<Ordem>({ coluna: colunaValor ? 'valor' : 'vencer', desc: true });

	const { principais, semParcelas } = useMemo(() => separarSemParcelas(linhas), [linhas]);
	const ordenadas = useMemo(() => ordenarLinhas(principais, ordem), [principais, ordem]);

	const alternar = (id: number) =>
		setAbertos((atual) => {
			const novo = new Set(atual);
			if (novo.has(id)) novo.delete(id);
			else novo.add(id);
			return novo;
		});
	// Money and dates start descending (biggest/newest first); text starts A→Z
	const ordenar = (coluna: ColunaOrdem) =>
		setOrdem((o) => (o.coluna === coluna ? { coluna, desc: !o.desc } : { coluna, desc: coluna !== 'contrato' && coluna !== 'tomador' }));

	if (!principais.length) {
		return (
			<>
				<div className="px-4 py-10 text-center text-sm text-gray-500">{vazio}</div>
				<SemParcelas linhas={semParcelas} />
			</>
		);
	}

	const totalContratos = somaValores(linhas.map((l) => ({ valor: l.contrato.valorContrato })));
	const totalVincendo = somaValores(linhas.map((l) => ({ valor: l.contrato.valorVincendo })));
	const vincendoDestaque = !colunaValor;
	// A vencer is secondary when there is a context value: on phones it gives way to that column
	const ocultaVencer = colunaValor ? 'hidden sm:table-cell' : '';
	const colunas = colunaValor ? 6 : 5;

	return (
		<>
			<table className="w-full">
				<thead className="sticky z-10" style={{ top: topoCabecalho }}>
					<tr>
						<Cabecalho coluna="contrato" ordem={ordem} onOrdenar={ordenar}>
							Contrato
						</Cabecalho>
						<Cabecalho coluna="tomador" ordem={ordem} onOrdenar={ordenar}>
							Tomador
						</Cabecalho>
						{colunaValor && (
							<Cabecalho coluna="valor" ordem={ordem} onOrdenar={ordenar} direita>
								{colunaValor}
							</Cabecalho>
						)}
						<Cabecalho
							coluna="vencer"
							ordem={ordem}
							onOrdenar={ordenar}
							direita
							className={ocultaVencer}
							title="Soma das parcelas ainda não pagas (já com juros). Clique para ordenar."
						>
							A vencer
						</Cabecalho>
						<Cabecalho coluna="valorContrato" ordem={ordem} onOrdenar={ordenar} direita className="hidden md:table-cell">
							Valor do contrato
						</Cabecalho>
						<Cabecalho coluna="data" ordem={ordem} onOrdenar={ordenar} className="hidden lg:table-cell">
							Data
						</Cabecalho>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-200">
					{ordenadas.map((l) => {
						const c = l.contrato;
						const aberto = abertos.has(c.idFinanciamento);
						return (
							<React.Fragment key={c.idFinanciamento}>
								<tr className={`cursor-pointer ${aberto ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`} onClick={() => alternar(c.idFinanciamento)}>
									<td className={td}>
										<button
											type="button"
											aria-expanded={aberto}
											aria-label={`${aberto ? 'Esconder' : 'Ver'} parcelas do contrato ${c.numeroContrato}`}
											onClick={(e) => {
												e.stopPropagation();
												alternar(c.idFinanciamento);
											}}
											className={`flex items-start gap-1.5 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${quebra}`}
										>
											<FontAwesomeIcon icon={aberto ? faChevronDown : faChevronRight} className="text-[10px] text-blue-600 mt-1 shrink-0" aria-hidden />
											<span>
												<span className="font-semibold text-gray-900">{c.numeroContrato || 'sem número'}</span>
												<span className="block text-xs text-gray-500">{c.credor}</span>
											</span>
										</button>
									</td>
									<td className={`${td} ${quebra}`}>{c.tomador || '—'}</td>
									{colunaValor && (
										<td className={`${td} ${num} font-bold text-gray-900`}>
											{brl(l.valor)}
											{mostrarSituacao && (
												<span className={`block text-xs font-medium ${l.renegociado ? 'text-purple-700' : l.quitado ? 'text-green-700' : 'text-gray-500'}`}>{situacaoLiquidado(l)}</span>
											)}
										</td>
									)}
									<td className={`${td} ${num} ${ocultaVencer} ${vincendoDestaque ? 'font-bold text-gray-900' : ''}`}>
										{brl(c.valorVincendo)}
										<span className="block text-xs font-normal text-gray-500 whitespace-normal">{textoParcelas(c)}</span>
									</td>
									<td className={`${td} ${num} hidden md:table-cell text-gray-600`}>{brl(c.valorContrato)}</td>
									<td className={`${td} hidden lg:table-cell whitespace-nowrap text-gray-600`}>{formatarDataISO(c.dataContrato)}</td>
								</tr>
								{aberto && (
									<tr>
										<td colSpan={colunas} className="px-3 sm:px-8 py-3 bg-gray-50">
											<ParcelasContrato linha={l} />
										</td>
									</tr>
								)}
							</React.Fragment>
						);
					})}
				</tbody>
				<tfoot className="bg-gray-50 border-t-2 border-gray-200">
					<tr>
						<td className={`${td} font-semibold text-gray-900`}>Total</td>
						<td className={`${td} text-gray-500`}>
							{linhas.length} {linhas.length === 1 ? 'contrato' : 'contratos'}
						</td>
						{colunaValor && <td className={`${td} ${num} font-bold text-gray-900`}>{brl(somaValores(linhas))}</td>}
						<td className={`${td} ${num} ${ocultaVencer} ${vincendoDestaque ? 'font-bold text-gray-900' : 'font-semibold'}`}>{brl(totalVincendo)}</td>
						<td className={`${td} ${num} hidden md:table-cell font-semibold`}>{brl(totalContratos)}</td>
						<td className="hidden lg:table-cell" />
					</tr>
				</tfoot>
			</table>
			<SemParcelas linhas={semParcelas} />
		</>
	);
};

export default TabelaContratosFinanciamento;
