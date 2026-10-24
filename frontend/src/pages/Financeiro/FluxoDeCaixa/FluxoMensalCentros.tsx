import React, { useMemo } from 'react';
import { Tooltip } from '@mui/material';
import { formatarMoeda } from '../../../Utils/formataMoeda';
import { pct } from '../../../Utils/formatos';
import { montarFluxoMensal, FluxoMesCentrosInput, LinhaFluxo } from './fluxoMensalRegras';

/** Light group colours (the old dark bands were hard to read): header background / text. */
const GRUPO = {
	receitas: { bg: '#e8f1fb', cell: '#f5f9fe', text: '#1d3f66' },
	operacionais: { bg: '#fdeedd', cell: '#fffaf4', text: '#7a3e0c' },
	investimentos: { bg: '#fcf3cf', cell: '#fffdf1', text: '#6b5208' },
	saldo: { bg: '#e3f3ee', cell: '#f5fbf9', text: '#0f5132' },
	financiamentos: { bg: '#eee8fb', cell: '#faf8fe', text: '#4c2a85' },
} as const;

export type GrupoCentros = 'receitas' | 'operacionais' | 'investimentos';

interface Props {
	dadosFluxo: FluxoMesCentrosInput[];
	meses: string[];
	ano: string;
	expandidos: Record<GrupoCentros, boolean>;
	onToggleGrupo: (grupo: GrupoCentros) => void;
	descricaoCentro: (id: string) => string;
	onDetalharCentro: (idCentro: string, mesIdx: number, tipo: 'receitas' | 'despesas', descricao: string) => void;
	onDetalharFinanciamento: (mesIdx: number, subtipo: 'pagos' | 'contratados', descricao: string) => void;
}

/** Quitados / Créditos novos come from the contracts, not from bank movements. */
const AVISO_FINANCIAMENTOS = 'Financiamentos não dependem das contas selecionadas';

const valorTxt = (v: number) => (v ? formatarMoeda(v) : '—');
const corValor = (v: number) => (v < 0 ? '#b91c1c' : undefined);

const th = 'px-3 py-2 text-xs font-bold whitespace-nowrap border-b border-r border-gray-200';
const td = 'px-3 py-1.5 text-right whitespace-nowrap border-b border-r border-gray-100 tabular-nums';

const FluxoMensalCentros: React.FC<Props> = ({
	dadosFluxo,
	meses,
	ano,
	expandidos,
	onToggleGrupo,
	descricaoCentro,
	onDetalharCentro,
	onDetalharFinanciamento,
}) => {
	const { linhas, total, colunas } = useMemo(() => montarFluxoMensal(dadosFluxo), [dadosFluxo]);

	const grupos: { key: GrupoCentros; titulo: string; ids: string[]; totalKey: 'totalReceitas' | 'totalOperacionais' | 'totalInvestimentos'; tipo: 'receitas' | 'despesas' }[] = [
		{ key: 'receitas', titulo: 'Receitas', ids: colunas.receitas, totalKey: 'totalReceitas', tipo: 'receitas' },
		{ key: 'operacionais', titulo: 'Despesas operacionais', ids: colunas.operacionais, totalKey: 'totalOperacionais', tipo: 'despesas' },
		{ key: 'investimentos', titulo: 'Despesas de investimento', ids: colunas.investimentos, totalKey: 'totalInvestimentos', tipo: 'despesas' },
	];
	const colsGrupo = (g: (typeof grupos)[number]) => (expandidos[g.key] ? g.ids.length : 0) + 1;

	const celulaValor = (
		v: number,
		cor: string,
		onClick?: () => void,
		opts?: { bold?: boolean; title?: string },
	) => (
		<td className={td} style={{ backgroundColor: cor, color: corValor(v), fontWeight: opts?.bold ? 700 : undefined }} title={opts?.title}>
			{v && onClick ? (
				<button type="button" className="hover:underline hover:text-blue-700 tabular-nums" onClick={onClick}>
					{valorTxt(v)}
				</button>
			) : (
				valorTxt(v)
			)}
		</td>
	);

	const renderLinha = (l: LinhaFluxo, idx: number | null) => {
		const ehTotal = idx === null;
		const rotulo = ehTotal ? `Total ${ano}` : meses[idx];
		return (
			<tr key={rotulo} className={ehTotal ? 'font-bold' : 'hover:bg-gray-50'} style={ehTotal ? { position: 'sticky', bottom: 0, zIndex: 2 } : undefined}>
				<th
					scope="row"
					className={`${th} text-left sticky left-0 z-[3] ${ehTotal ? 'bg-gray-100 border-t-2 border-t-gray-300' : 'bg-white font-semibold'}`}
				>
					{rotulo}
				</th>
				{grupos.map((g) => (
					<React.Fragment key={g.key}>
						{expandidos[g.key] &&
							g.ids.map((id) =>
								<React.Fragment key={id}>
									{celulaValor(
										l[g.key][id] ?? 0,
										ehTotal ? GRUPO[g.key].bg : GRUPO[g.key].cell,
										ehTotal ? undefined : () => onDetalharCentro(id, idx!, g.tipo, `${descricaoCentro(id)} — ${rotulo}`),
									)}
								</React.Fragment>,
							)}
						{celulaValor(
							l[g.totalKey],
							GRUPO[g.key].bg,
							!expandidos[g.key] && g.ids.length ? () => onToggleGrupo(g.key) : undefined,
							{ bold: true, title: !expandidos[g.key] && g.ids.length ? 'Clique para ver por centro de custos' : undefined },
						)}
					</React.Fragment>
				))}
				{celulaValor(l.saldoAposInvestimentos, GRUPO.saldo.bg, undefined, { bold: true })}
				{celulaValor(
					l.quitados,
					ehTotal ? GRUPO.financiamentos.bg : GRUPO.financiamentos.cell,
					ehTotal ? undefined : () => onDetalharFinanciamento(idx!, 'pagos', `Quitados — ${rotulo}`),
				)}
				{celulaValor(
					l.creditosNovos,
					ehTotal ? GRUPO.financiamentos.bg : GRUPO.financiamentos.cell,
					ehTotal ? undefined : () => onDetalharFinanciamento(idx!, 'contratados', `Créditos novos — ${rotulo}`),
				)}
			</tr>
		);
	};

	const thGrupo = (key: keyof typeof GRUPO) => ({ backgroundColor: GRUPO[key].bg, color: GRUPO[key].text });

	return (
		<div className="flex flex-col gap-6">
			<div className="bg-white rounded-lg border border-gray-200 overflow-auto" style={{ maxHeight: 'calc(100vh - 230px)' }}>
				<table className="border-separate border-spacing-0 w-full text-sm">
					{/* Whole thead is sticky: two header rows with no gap between them */}
					<thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
						<tr>
							<th rowSpan={2} className={`${th} text-left sticky left-0 z-[5] bg-gray-100`} style={{ minWidth: 110 }}>
								Mês
							</th>
							{grupos.map((g) => (
								<th key={g.key} colSpan={colsGrupo(g)} className={`${th} text-center`} style={thGrupo(g.key)}>
									<span className="inline-flex items-center gap-2">
										{g.titulo}
										{g.ids.length > 0 && (
											<button
												type="button"
												onClick={() => onToggleGrupo(g.key)}
												className="inline-flex items-center justify-center min-w-[28px] h-7 rounded border border-current px-2 text-sm font-bold hover:bg-white/60"
												aria-expanded={expandidos[g.key]}
												aria-label={expandidos[g.key] ? `Recolher centros de custos de ${g.titulo}` : `Ver ${g.titulo} por centro de custos`}
												title={expandidos[g.key] ? 'Recolher centros de custos' : 'Ver por centro de custos'}
											>
												{expandidos[g.key] ? '−' : '+'}
											</button>
										)}
									</span>
								</th>
							))}
							<th
								rowSpan={2}
								className={`${th} text-center`}
								style={thGrupo('saldo')}
								title="Receitas menos todas as despesas, operacionais e de investimento (R − D)"
							>
								(C) Saldo após
								<br />
								investimentos
							</th>
							<th colSpan={2} className={`${th} text-center`} style={thGrupo('financiamentos')}>
								<span className="inline-flex items-center gap-1">
									Financiamentos
									{/* Hover, keyboard focus and tap (the native title only worked with a mouse) */}
									<Tooltip title={AVISO_FINANCIAMENTOS} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
										<button
											type="button"
											className="inline-flex items-center justify-center w-7 h-7 rounded-full font-normal hover:bg-white/60"
											aria-label={AVISO_FINANCIAMENTOS}
										>
											ⓘ
										</button>
									</Tooltip>
								</span>
							</th>
						</tr>
						<tr>
							{grupos.map((g) => (
								<React.Fragment key={g.key}>
									{expandidos[g.key] &&
										g.ids.map((id) => (
											<th key={id} className={`${th} text-right font-semibold`} style={{ ...thGrupo(g.key), maxWidth: 170 }} title={descricaoCentro(id)}>
												<span className="block truncate">{descricaoCentro(id)}</span>
											</th>
										))}
									<th className={`${th} text-right`} style={thGrupo(g.key)}>
										Total
									</th>
								</React.Fragment>
							))}
							<th className={`${th} text-right`} style={thGrupo('financiamentos')} title="Parcelas amortizadas e liquidadas no mês">
								Quitados
							</th>
							<th className={`${th} text-right`} style={thGrupo('financiamentos')} title="Parcelas dos contratos novos do mês">
								Créditos novos
							</th>
						</tr>
					</thead>
					<tbody>
						{linhas.map((l, idx) => renderLinha(l, idx))}
						{renderLinha(total, null)}
					</tbody>
				</table>
			</div>

			{/* Totalização mensal (A, B, C) — financiamentos ficam de fora, tratados à parte */}
			<section className="bg-white rounded-lg border border-gray-200 overflow-auto">
				<div className="px-4 pt-4 pb-2">
					<h3 className="text-base font-bold text-gray-800">Totalização mensal</h3>
					<p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-4xl">
						<strong>(A) Saldo operacional</strong>: receitas menos despesas operacionais de custeio, mostra a capacidade da atividade de gerar
						recursos para sustentar suas operações. <strong>(B) Investimentos realizados</strong>: despesas de investimento e aplicações
						financeiras. <strong>(C) Saldo após investimentos</strong>: A − B, quanto sobra considerando todas as saídas, exceto financiamentos.
					</p>
				</div>
				<table className="border-separate border-spacing-0 w-full text-sm">
					<thead>
						<tr>
							<th className={`${th} text-left bg-gray-100`} style={{ minWidth: 110 }}>
								Mês
							</th>
							<th className={`${th} text-right`} style={thGrupo('saldo')}>
								(A) Saldo operacional
							</th>
							<th className={`${th} text-right`} style={thGrupo('investimentos')}>
								(B) Investimentos realizados
							</th>
							<th className={`${th} text-right`} style={thGrupo('saldo')}>
								(C) Saldo após investimentos
							</th>
							<th className={`${th} text-right bg-gray-100`} title="Saldo após investimentos ÷ receitas">
								Lucratividade
							</th>
						</tr>
					</thead>
					<tbody>
						{[...linhas.map((l, idx) => ({ l, rotulo: meses[idx], total: false })), { l: total, rotulo: `Total ${ano}`, total: true }].map(({ l, rotulo, total: ehTotal }) => (
							<tr key={rotulo} className={ehTotal ? 'font-bold bg-gray-50' : 'hover:bg-gray-50'}>
								<th scope="row" className={`${th} text-left ${ehTotal ? 'bg-gray-100' : 'bg-white font-semibold'}`}>
									{rotulo}
								</th>
								<td className={td} style={{ color: corValor(l.saldoOperacional) }}>{valorTxt(l.saldoOperacional)}</td>
								<td className={td}>{valorTxt(l.investimentosRealizados)}</td>
								<td className={td} style={{ color: corValor(l.saldoAposInvestimentos), fontWeight: 700 }}>{valorTxt(l.saldoAposInvestimentos)}</td>
								<td className={td} style={{ color: corValor(l.lucratividade ?? 0) }}>
									{pct(l.lucratividade)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</div>
	);
};

export default FluxoMensalCentros;
