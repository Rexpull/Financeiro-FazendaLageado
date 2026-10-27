import React, { useEffect, useRef, useState } from 'react';
import { Popover } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faSliders, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { SEM_TOMADOR_FINANCIAMENTO, type ModalidadeFinanciamento } from '../../services/relatorioService';
import type { Banco } from '../../../../backend/src/models/Banco';
import {
	contarFiltrosExtras,
	OPCOES_PERIODO_RELATORIO,
	VISOES,
	type PeriodoRelatorio,
	type RefinosFinanciamentos,
	type VisaoFinanciamentos,
} from './financiamentosRelatorio';

export const MODALIDADES: Array<{ value: ModalidadeFinanciamento; label: string }> = [
	{ value: 'INVESTIMENTO', label: 'Investimento' },
	{ value: 'CUSTEIO', label: 'Custeio' },
	{ value: 'PARTICULAR', label: 'Particular' },
	{ value: 'RENEGOCIACAO', label: 'Renegociação' },
];

export const FAIXAS_JUROS = [
	{ value: '<=8', label: 'Até 8%' },
	{ value: '>8<=10', label: 'Mais de 8% até 10%' },
	{ value: '>10<=12', label: 'Mais de 10% até 12%' },
	{ value: '>12<=15', label: 'Mais de 12% até 15%' },
	{ value: '>15', label: 'Mais de 15%' },
];

const foco = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
const select = `h-9 px-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-800 hover:border-gray-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${foco}`;
const labelPopover = 'block text-xs font-medium text-gray-600 mb-1';

/** View tabs: one view at a time; arrow keys / Home / End move between them (WAI-ARIA tabs). */
const AbasVisao: React.FC<{ visao: VisaoFinanciamentos; onVisao: (v: VisaoFinanciamentos) => void }> = ({ visao, onVisao }) => {
	const refs = useRef<Array<HTMLButtonElement | null>>([]);
	const teclas = (e: React.KeyboardEvent, i: number) => {
		const n = VISOES.length;
		const alvo = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
		if (alvo === undefined) return;
		e.preventDefault();
		onVisao(VISOES[alvo].id);
		refs.current[alvo]?.focus();
	};
	return (
		<div role="tablist" aria-label="O que ver" className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto gap-1 rounded-lg bg-gray-100 p-1">
			{VISOES.map((v, i) => {
				const ativa = v.id === visao;
				return (
					<button
						key={v.id}
						ref={(el) => {
							refs.current[i] = el;
						}}
						id={`aba-fin-${v.id}`}
						type="button"
						role="tab"
						aria-selected={ativa}
						aria-controls="painel-fin"
						tabIndex={ativa ? 0 : -1}
						title={v.rotulo}
						onClick={() => onVisao(v.id)}
						onKeyDown={(e) => teclas(e, i)}
						className={`h-8 px-3 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${foco} ${
							ativa ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
						}`}
					>
						{v.curto}
						{v.usaPeriodo && <span className="hidden 2xl:inline"> no período</span>}
					</button>
				);
			})}
		</div>
	);
};

/** "Mais filtros": banco, modalidade, garantia and juros in a popover, with a count of the ones in use. */
const MaisFiltros: React.FC<{
	refinos: RefinosFinanciamentos;
	onRefinos: (r: Partial<RefinosFinanciamentos>) => void;
	bancos: Banco[];
}> = ({ refinos, onRefinos, bancos }) => {
	const [ancora, setAncora] = useState<HTMLElement | null>(null);
	const [garantia, setGarantia] = useState(refinos.numeroGarantia ?? '');
	useEffect(() => setGarantia(refinos.numeroGarantia ?? ''), [refinos.numeroGarantia]);
	const aplicarGarantia = () => {
		const v = garantia.trim() || undefined;
		if (v !== refinos.numeroGarantia) onRefinos({ numeroGarantia: v });
	};
	const ativos = contarFiltrosExtras(refinos);
	return (
		<>
			<button
				type="button"
				onClick={(e) => setAncora(e.currentTarget)}
				aria-haspopup="dialog"
				aria-expanded={!!ancora}
				aria-label={`Mais filtros${ativos ? ` (${ativos} em uso)` : ''}`}
				className={`h-9 px-3 inline-flex items-center gap-2 rounded-lg border text-sm font-medium ${foco} ${
					ativos ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
				}`}
			>
				<FontAwesomeIcon icon={faSliders} className="text-xs" aria-hidden />
				Mais filtros
				{ativos > 0 && (
					<span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs leading-5 text-center tabular-nums" aria-hidden>
						{ativos}
					</span>
				)}
			</button>
			<Popover
				open={!!ancora}
				anchorEl={ancora}
				onClose={() => {
					aplicarGarantia();
					setAncora(null);
				}}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				slotProps={{ paper: { sx: { mt: 1, borderRadius: 2 } } }}
			>
				<div role="dialog" aria-label="Mais filtros" className="p-4 w-[min(92vw,30rem)]">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label className={labelPopover} htmlFor="fin-banco">
								Banco
							</label>
							<select
								id="fin-banco"
								value={refinos.idBanco || ''}
								onChange={(e) => onRefinos({ idBanco: e.target.value ? parseInt(e.target.value) : undefined })}
								className={`${select} w-full`}
							>
								<option value="">Todos</option>
								{bancos.map((b) => (
									<option key={b.id} value={b.id}>
										{b.nome}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelPopover} htmlFor="fin-modalidade">
								Modalidade
							</label>
							<select
								id="fin-modalidade"
								value={refinos.modalidade || ''}
								onChange={(e) => onRefinos({ modalidade: (e.target.value || undefined) as ModalidadeFinanciamento | undefined })}
								className={`${select} w-full`}
							>
								<option value="">Todas</option>
								{MODALIDADES.map((m) => (
									<option key={m.value} value={m.value}>
										{m.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelPopover} htmlFor="fin-garantia">
								Garantia (nº da matrícula)
							</label>
							<input
								id="fin-garantia"
								type="text"
								value={garantia}
								onChange={(e) => setGarantia(e.target.value)}
								onBlur={aplicarGarantia}
								onKeyDown={(e) => e.key === 'Enter' && aplicarGarantia()}
								placeholder="Digite e tecle Enter"
								className={`${select} w-full`}
							/>
						</div>
						<div>
							<label className={labelPopover} htmlFor="fin-juros">
								Juros ao ano
							</label>
							<select
								id="fin-juros"
								value={refinos.faixaJuros || ''}
								onChange={(e) => onRefinos({ faixaJuros: e.target.value || undefined })}
								className={`${select} w-full`}
							>
								<option value="">Todas as faixas</option>
								{FAIXAS_JUROS.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
						</div>
					</div>
					<div className="flex justify-between items-center mt-4">
						<button
							type="button"
							disabled={!ativos && !garantia}
							onClick={() => {
								setGarantia('');
								onRefinos({ idBanco: undefined, modalidade: undefined, numeroGarantia: undefined, faixaJuros: undefined });
							}}
							className={`text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 rounded px-1 ${foco}`}
						>
							Limpar estes filtros
						</button>
						<button
							type="button"
							onClick={() => {
								aplicarGarantia();
								setAncora(null);
							}}
							className={`h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 ${foco}`}
						>
							Pronto
						</button>
					</div>
				</div>
			</Popover>
		</>
	);
};

/**
 * Toolbar of the report (one row on a laptop, wraps on phones): view tabs, período, tomador,
 * "Mais filtros" and Excel. The período only applies to Contratados / Liquidados.
 */
const BarraFiltrosFinanciamentos: React.FC<{
	visao: VisaoFinanciamentos;
	onVisao: (v: VisaoFinanciamentos) => void;
	ano: number;
	anos: number[];
	onAno: (a: number) => void;
	periodo: PeriodoRelatorio;
	onPeriodo: (p: PeriodoRelatorio) => void;
	refinos: RefinosFinanciamentos;
	onRefinos: (r: Partial<RefinosFinanciamentos>) => void;
	onLimpar: () => void;
	tomadores: string[];
	bancos: Banco[];
	carregando: boolean;
	exportando: boolean;
	podeExportar: boolean;
	onExportar: () => void;
}> = (p) => {
	const usaPeriodo = VISOES.find((v) => v.id === p.visao)?.usaPeriodo ?? false;
	const dicaPeriodo = usaPeriodo
		? p.periodo === '12m'
			? 'Últimos 12 meses termina no mês atual (o ano não se aplica)'
			: 'Período dos contratos assinados / das parcelas pagas'
		: 'Esta visão mostra a posição de hoje; o período não se aplica';
	const algumFiltro = !!p.refinos.tomador || contarFiltrosExtras(p.refinos) > 0;

	return (
		<div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-sm p-2">
			<AbasVisao visao={p.visao} onVisao={p.onVisao} />

			<span className="inline-flex gap-1" title={dicaPeriodo}>
				<select
					aria-label="Ano"
					value={p.ano}
					disabled={!usaPeriodo || p.periodo === '12m'}
					onChange={(e) => p.onAno(parseInt(e.target.value))}
					className={select}
				>
					{p.anos.map((a) => (
						<option key={a} value={a}>
							{a}
						</option>
					))}
				</select>
				<select
					aria-label="Período"
					value={p.periodo}
					disabled={!usaPeriodo}
					onChange={(e) => p.onPeriodo(e.target.value as PeriodoRelatorio)}
					className={select}
				>
					{(['Período', 'Mês'] as const).map((grupo) => (
						<optgroup key={grupo} label={grupo}>
							{OPCOES_PERIODO_RELATORIO.filter((o) => o.grupo === grupo).map((o) => (
								<option key={o.valor} value={o.valor}>
									{o.rotulo}
								</option>
							))}
						</optgroup>
					))}
				</select>
			</span>

			<select
				aria-label="Tomador"
				title="Tomador"
				value={p.refinos.tomador || ''}
				onChange={(e) => p.onRefinos({ tomador: e.target.value || undefined })}
				className={`${select} max-w-[11rem] ${p.refinos.tomador ? 'border-blue-300 bg-blue-50 text-blue-800' : ''}`}
			>
				<option value="">Todos os tomadores</option>
				{/* A remembered tomador that no longer exists still shows as selected */}
				{[...p.tomadores, ...(p.refinos.tomador && p.refinos.tomador !== SEM_TOMADOR_FINANCIAMENTO && !p.tomadores.includes(p.refinos.tomador) ? [p.refinos.tomador] : [])].map((t) => (
					<option key={t} value={t}>
						{t}
					</option>
				))}
				<option value={SEM_TOMADOR_FINANCIAMENTO}>{SEM_TOMADOR_FINANCIAMENTO}</option>
			</select>

			<MaisFiltros refinos={p.refinos} onRefinos={p.onRefinos} bancos={p.bancos} />

			{algumFiltro && (
				<button
					type="button"
					onClick={p.onLimpar}
					className={`h-9 px-2 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg ${foco}`}
				>
					<FontAwesomeIcon icon={faXmark} aria-hidden />
					Limpar filtros
				</button>
			)}

			<div className="ml-auto flex items-center gap-2">
				{p.carregando && (
					<span className="text-xs text-gray-500 inline-flex items-center gap-1.5" role="status">
						<FontAwesomeIcon icon={faSpinner} className="animate-spin" aria-hidden />
						<span className="hidden sm:inline">Atualizando</span>
					</span>
				)}
				<button
					type="button"
					onClick={p.onExportar}
					disabled={p.exportando || !p.podeExportar}
					title="Exporta esta visão, com os filtros escolhidos e as parcelas"
					className={`h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-green-600 text-green-700 bg-white text-sm font-medium hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed ${foco}`}
				>
					<FontAwesomeIcon icon={p.exportando ? faSpinner : faFileExcel} className={p.exportando ? 'animate-spin' : ''} aria-hidden />
					Exportar Excel
				</button>
			</div>
		</div>
	);
};

export default BarraFiltrosFinanciamentos;
