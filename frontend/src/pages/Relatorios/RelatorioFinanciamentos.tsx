import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import {
	getRelatorioFinanciamentos,
	type RelatorioFinanciamentosData,
	type ValorContratoFinanciamento,
} from '../../services/relatorioService';
import { listarBancos } from '../../services/bancoService';
import type { Banco } from '../../../../backend/src/models/Banco';
import BreadCrumb from '../../components/BreadCrumb';
import { brl, pct } from '../../Utils/formatos';
import { formatarDataISO } from '../../Utils/dataSemFuso';
import { MESES_CURTOS, rotuloMesGrafico, ultimoDiaDoIntervalo } from '../Dashboard/periodoDashboard';
import {
	anosDisponiveis,
	graficosExportados,
	intervaloRelatorio,
	lerPreferencias,
	linhasDe,
	planilhasExcel,
	preferenciasPadrao,
	proximosMeses,
	somarPorContrato,
	somaValores,
	VISOES,
	type ModoCompromissos,
	type PreferenciasFinanciamentos,
	type RefinosFinanciamentos,
	type VisaoFinanciamentos,
} from './financiamentosRelatorio';
import TabelaContratosFinanciamento from './TabelaContratosFinanciamento';
import ModalContratosFinanciamento, { type ConteudoModalContratos } from './ModalContratosFinanciamento';
import BarraFiltrosFinanciamentos, { FAIXAS_JUROS, MODALIDADES } from './BarraFiltrosFinanciamentos';
import GraficoBarrasFinanciamentos, { CORES_FINANCIAMENTOS as CORES } from './GraficoBarrasFinanciamentos';

const anoAtual = new Date().getFullYear();
const CHAVE_PREFERENCIAS = 'relatorioFinanciamentos.preferencias.v1';

const foco = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
const cartao = 'bg-white border border-gray-200 rounded-xl shadow-sm';
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function preferenciasSalvas(): PreferenciasFinanciamentos {
	try {
		return lerPreferencias(window.localStorage.getItem(CHAVE_PREFERENCIAS), anoAtual);
	} catch {
		return preferenciasPadrao(anoAtual);
	}
}

// ---- Small building blocks ----

/** Summary tile. Clickable tiles open the contracts behind the value. */
const Kpi: React.FC<{
	rotulo: string;
	valor: string;
	detalhe?: React.ReactNode;
	destaque?: boolean;
	onClick?: () => void;
	dica?: string;
}> = ({ rotulo, valor, detalhe, destaque, onClick, dica }) => {
	const conteudo = (
		<>
			<span className={`flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide ${destaque ? 'text-blue-800' : 'text-gray-500'}`}>
				{rotulo}
				{onClick && <FontAwesomeIcon icon={faChevronRight} className="text-[10px] opacity-60" aria-hidden />}
			</span>
			<span
				// Never break a money value in the middle ("R$ 18.802." / "391,37"): one line, size follows the screen
				className={`block mt-1 tabular-nums whitespace-nowrap ${
					destaque
						? 'text-[clamp(1rem,1.55vw,1.5rem)] font-bold text-blue-900'
						: 'text-[clamp(0.95rem,1.3vw,1.25rem)] font-semibold text-gray-900'
				}`}
			>
				{valor}
			</span>
			{detalhe && <span className="block mt-0.5 text-xs text-gray-500">{detalhe}</span>}
		</>
	);
	const base = `rounded-xl border p-3 sm:p-4 text-left min-w-0 ${destaque ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`;
	return onClick ? (
		<button type="button" onClick={onClick} title={dica ?? 'Ver os contratos'} className={`${base} shadow-sm hover:border-blue-400 hover:shadow transition ${foco}`}>
			{conteudo}
		</button>
	) : (
		<div className={`${base} shadow-sm`} title={dica}>
			{conteudo}
		</div>
	);
};

const Kpis: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<div className={`grid grid-cols-2 gap-2 sm:gap-3 mb-4 ${React.Children.count(children) > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>{children}</div>
);

/** Money value of a chart header that opens the contracts behind it. */
const ValorLink: React.FC<{ rotulo: string; valor: number; cor?: string; onClick: () => void }> = ({ rotulo, valor, cor, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		title="Ver os contratos deste valor"
		className={`inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 rounded ${foco}`}
	>
		{cor && <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cor }} aria-hidden />}
		{rotulo}
		<strong className="tabular-nums text-gray-900 underline decoration-dotted underline-offset-4">{brl(valor)}</strong>
	</button>
);

/** Two-option switch (e.g. "Do ano" / "Por ano"). */
function Alternador<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: Array<[T, string]>; onChange: (v: T) => void; rotulo: string }) {
	return (
		<div role="group" aria-label={rotulo} className="inline-flex rounded-lg bg-gray-100 p-0.5">
			{opcoes.map(([v, texto]) => (
				<button
					key={v}
					type="button"
					aria-pressed={valor === v}
					onClick={() => onChange(v)}
					className={`h-7 px-3 rounded-md text-xs font-medium ${foco} ${valor === v ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
				>
					{texto}
				</button>
			))}
		</div>
	);
}

// ---- Page ----

const RelatorioFinanciamentos: React.FC = () => {
	const [pref, setPref] = useState<PreferenciasFinanciamentos>(preferenciasSalvas);
	const { visao, ano, periodo, refinos } = pref;
	const mostrarGrafico = !!pref.graficos[visao];

	const [bancos, setBancos] = useState<Banco[]>([]);
	const [dados, setDados] = useState<RelatorioFinanciamentosData | null>(null);
	const [anosComDados, setAnosComDados] = useState<number[]>([]);
	const [carregando, setCarregando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const [tentativa, setTentativa] = useState(0);
	const [exportando, setExportando] = useState(false);
	const [modal, setModal] = useState<ConteudoModalContratos | null>(null);

	const raizRef = useRef<HTMLDivElement>(null);
	const barraRef = useRef<HTMLDivElement>(null);
	const [alturaBarra, setAlturaBarra] = useState(0);

	const intervalo = useMemo(() => intervaloRelatorio(ano, periodo), [ano, periodo]);
	const datasPeriodo = `${formatarDataISO(intervalo.inicio)} a ${formatarDataISO(ultimoDiaDoIntervalo(intervalo.fim))}`;
	const atualizar = (parcial: Partial<PreferenciasFinanciamentos>) => setPref((p) => ({ ...p, ...parcial }));
	const atualizarRefinos = (r: Partial<RefinosFinanciamentos>) => setPref((p) => ({ ...p, refinos: { ...p.refinos, ...r } }));
	const limparFiltros = () => atualizar({ refinos: {} });
	const algumFiltro = !!refinos.tomador || !!(refinos.idBanco || refinos.modalidade || refinos.numeroGarantia || refinos.faixaJuros);

	// Remember the last tab and filters (localStorage may be blocked: ignore)
	useEffect(() => {
		try {
			window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(pref));
		} catch {
			/* private mode / blocked storage */
		}
	}, [pref]);

	// The layout's content column has overflow-x: hidden, which turns it into a scroll container and
	// disables position: sticky. While this page is open, use "clip" (same clipping, no scroll container).
	useEffect(() => {
		const pai = raizRef.current?.parentElement;
		if (!pai) return;
		const antes = pai.style.overflowX;
		pai.style.overflowX = 'clip';
		return () => {
			pai.style.overflowX = antes;
		};
	}, []);

	// Sticky table headers sit right under the toolbar (only sticky from the "sm" breakpoint up)
	useLayoutEffect(() => {
		const el = barraRef.current;
		if (!el) return;
		const medir = () => setAlturaBarra(getComputedStyle(el).position === 'sticky' ? el.offsetHeight : 0);
		medir();
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
		ro?.observe(el);
		window.addEventListener('resize', medir);
		return () => {
			ro?.disconnect();
			window.removeEventListener('resize', medir);
		};
	}, []);

	useEffect(() => {
		listarBancos()
			.then(setBancos)
			.catch((e) => console.error('Erro ao carregar bancos:', e));
	}, []);

	// One request brings every view and chart; the tabs only switch what is shown.
	useEffect(() => {
		let ativo = true;
		setCarregando(true);
		setErro(null);
		getRelatorioFinanciamentos({ ano, inicio: intervalo.inicio, fim: intervalo.fim, ...refinos })
			.then((r) => {
				if (!ativo) return;
				setDados(r);
				setAnosComDados((atuais) => anosDisponiveis(r.contratos, anoAtual, atuais));
			})
			.catch((e) => {
				console.error('Erro ao buscar relatório:', e);
				if (ativo) setErro('Não foi possível carregar o relatório de financiamentos.');
			})
			.finally(() => {
				if (ativo) setCarregando(false);
			});
		return () => {
			ativo = false;
		};
	}, [ano, intervalo.inicio, intervalo.fim, refinos, tentativa]);

	const anos = useMemo(() => anosDisponiveis([], anoAtual, [...anosComDados, ano]), [anosComDados, ano]);
	const hoje = formatarDataISO(dados?.hoje);
	const rotuloVisao = VISOES.find((v) => v.id === visao)?.rotulo ?? '';

	const abrir = (conteudo: Omit<ConteudoModalContratos, 'linhas'> & { refs: ValorContratoFinanciamento[] }) => {
		if (!dados) return;
		const { refs, ...resto } = conteudo;
		setModal({ ...resto, linhas: linhasDe(dados.contratos, refs) });
	};

	// ---- Excel: the view on the screen (+ its chart, if shown), same filters, plus the parcelas ----
	const descricaoFiltros = (d: RelatorioFinanciamentosData): Array<[string, string]> => {
		const usaPeriodo = VISOES.find((v) => v.id === visao)?.usaPeriodo;
		const nomeBanco = bancos.find((b) => b.id === refinos.idBanco)?.nome;
		return [
			['Visão', rotuloVisao],
			usaPeriodo ? ['Período', `${intervalo.rotulo} (${datasPeriodo})`] : ['Posição', `Hoje, ${formatarDataISO(d.hoje)}`],
			...(visao === 'ativos' && mostrarGrafico ? [['Ano dos compromissos', String(ano)] as [string, string]] : []),
			['Tomador', refinos.tomador || 'Todos'],
			['Banco', nomeBanco || 'Todos'],
			['Modalidade', MODALIDADES.find((m) => m.value === refinos.modalidade)?.label || 'Todas'],
			['Garantia', refinos.numeroGarantia || 'Todas'],
			['Faixa de juros', FAIXAS_JUROS.find((f) => f.value === refinos.faixaJuros)?.label || 'Todas'],
		];
	};

	const exportarExcel = () => {
		if (!dados) return;
		setExportando(true);
		try {
			const wb = XLSX.utils.book_new();
			const planilhas = planilhasExcel(dados, new Set([visao]), graficosExportados(visao, mostrarGrafico, pref.compromissos), descricaoFiltros(dados));
			for (const p of planilhas) {
				XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(p.linhas.length ? p.linhas : [{ Aviso: 'Nenhum registro para os filtros escolhidos' }]), p.nome);
			}
			const sufixo = VISOES.find((v) => v.id === visao)?.usaPeriodo ? `${dados.periodo.inicio}_a_${dados.periodo.ultimoDia}` : `posicao_${dados.hoje}`;
			XLSX.writeFile(wb, `financiamentos_${visao}_${sufixo}.xlsx`);
			toast.success('Excel gerado com sucesso!');
		} catch (error) {
			console.error('Erro ao exportar Excel:', error);
			toast.error('Erro ao gerar o Excel');
		} finally {
			setExportando(false);
		}
	};

	// ---- Pieces shared by the views ----
	const vazio = (texto: string) => (
		<>
			<p className="text-gray-700 font-medium">{texto}</p>
			{algumFiltro && (
				<button type="button" onClick={limparFiltros} className={`mt-2 text-sm text-blue-700 hover:text-blue-900 underline rounded ${foco}`}>
					Limpar filtros
				</button>
			)}
		</>
	);

	const cabecalho = (subtitulo: string) => (
		<div className="flex flex-wrap items-end justify-between gap-2 mb-3">
			<div className="min-w-0">
				<h2 className="text-lg font-semibold text-gray-900">{rotuloVisao}</h2>
				<p className="text-sm text-gray-500">{subtitulo}</p>
			</div>
			<button
				type="button"
				aria-pressed={mostrarGrafico}
				onClick={() => setPref((p) => ({ ...p, graficos: { ...p.graficos, [visao]: !p.graficos[visao] } }))}
				className={`h-9 px-3 inline-flex items-center gap-2 rounded-lg border text-sm font-medium ${foco} ${
					mostrarGrafico ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
				}`}
			>
				<FontAwesomeIcon icon={faChartColumn} aria-hidden />
				{mostrarGrafico ? 'Esconder gráfico' : 'Mostrar gráfico'}
			</button>
		</div>
	);

	const blocoTabela = (conteudo: React.ReactNode) => <section className={`${cartao} min-w-0 overflow-clip`}>{conteudo}</section>;

	// ---- Charts ----
	const graficoNovosXLiquidados = (d: RelatorioFinanciamentosData) => {
		const nxl = d.graficos.novosXLiquidados;
		const variosAnos = new Set(nxl.map((m) => m.ano)).size > 1;
		const novos = somarPorContrato(nxl.map((m) => m.novos.contratos));
		const liquidados = somarPorContrato(nxl.map((m) => m.liquidados.contratos));
		const abrirNovos = (refs: ValorContratoFinanciamento[], quando: string) =>
			abrir({ titulo: `Contratos novos — ${quando}`, dica: 'Soma de todas as parcelas dos contratos assinados (dívida assumida, com juros).', colunaValor: 'Novos (parcelas)', refs });
		const abrirLiquidados = (refs: ValorContratoFinanciamento[], quando: string) =>
			abrir({ titulo: `Parcelas pagas — ${quando}`, dica: 'Parcelas pagas no período.', colunaValor: 'Pago no período', mostrarSituacao: false, refs });
		return (
			<section className={`${cartao} p-3 sm:p-4 mb-4`} aria-label="Gráfico de contratos novos x liquidados">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-1">
					<h3 className="font-semibold text-gray-800">Contratos novos x liquidados — {intervalo.rotulo}</h3>
					<div className="flex flex-wrap gap-x-4">
						<ValorLink rotulo="Novos" cor={CORES.novos} valor={somaValores(novos)} onClick={() => abrirNovos(novos, intervalo.rotulo)} />
						<ValorLink rotulo="Liquidados" cor={CORES.liquidados} valor={somaValores(liquidados)} onClick={() => abrirLiquidados(liquidados, intervalo.rotulo)} />
					</div>
				</div>
				<GraficoBarrasFinanciamentos
					categorias={nxl.map((m) => rotuloMesGrafico(m, variosAnos))}
					series={[
						{ name: 'Novos', data: nxl.map((m) => m.novos.valor) },
						{ name: 'Liquidados', data: nxl.map((m) => m.liquidados.valor) },
					]}
					cores={[CORES.novos, CORES.liquidados]}
					vazio={`Nenhum contrato novo nem parcela paga em ${intervalo.rotulo}.`}
					onClickBarra={(serie, i) => {
						const m = nxl[i];
						if (!m) return;
						const quando = `${MESES_CURTOS[m.mes - 1]}/${m.ano}`;
						if (serie === 0) abrirNovos(m.novos.contratos, quando);
						else abrirLiquidados(m.liquidados.contratos, quando);
					}}
				/>
			</section>
		);
	};

	const graficoCompromissos = (d: RelatorioFinanciamentosData) => {
		const modo = pref.compromissos;
		const abrirCompromissos = (refs: ValorContratoFinanciamento[], quando: string) =>
			abrir({ titulo: `Compromissos financeiros — ${quando}`, dica: `Parcelas não pagas que vencem em ${quando} (inclui as vencidas).`, colunaValor: `Vence em ${quando}`, refs });
		const ca = d.graficos.compromissosDoAno;
		const cpa = d.graficos.compromissosPorAno;
		const anoHoje = Number(d.hoje.slice(0, 4));
		const temAtraso = cpa.some((a) => a.ano < anoHoje && a.valor > 0);
		const totalAno = somaValores(ca.meses);
		const totalPorAno = somaValores(cpa);
		return (
			<section className={`${cartao} p-3 sm:p-4 mb-4`} aria-label="Gráfico de compromissos financeiros">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-semibold text-gray-800">Compromissos financeiros</h3>
						<Alternador<ModoCompromissos>
							rotulo="Tipo de gráfico"
							valor={modo}
							opcoes={[
								['ano', 'Do ano'],
								['porAno', 'Por ano'],
							]}
							onChange={(v) => atualizar({ compromissos: v })}
						/>
						{modo === 'ano' && (
							<select
								aria-label="Ano dos compromissos"
								value={ano}
								onChange={(e) => atualizar({ ano: parseInt(e.target.value) })}
								className={`h-7 px-2 border border-gray-300 rounded-md text-xs bg-white ${foco}`}
							>
								{anos.map((a) => (
									<option key={a} value={a}>
										{a}
									</option>
								))}
							</select>
						)}
					</div>
					{modo === 'ano' ? (
						<ValorLink
							rotulo={`Total de ${ca.ano}`}
							valor={totalAno}
							onClick={() => abrirCompromissos(somarPorContrato(ca.meses.map((m) => m.contratos)), String(ca.ano))}
						/>
					) : (
						<ValorLink
							rotulo="Saldo devedor"
							valor={totalPorAno}
							onClick={() => abrirCompromissos(somarPorContrato(cpa.map((a) => a.contratos)), 'todos os anos')}
						/>
					)}
				</div>
				{modo === 'ano' ? (
					<GraficoBarrasFinanciamentos
						categorias={MESES_CURTOS}
						series={[{ name: 'Parcelas a pagar', data: ca.meses.map((m) => m.valor) }]}
						cores={[CORES.compromissos]}
						vazio={`Nenhuma parcela a pagar em ${ca.ano}.`}
						onClickBarra={(_s, i) => ca.meses[i] && abrirCompromissos(ca.meses[i].contratos, `${MESES_CURTOS[i]}/${ca.ano}`)}
					/>
				) : (
					<>
						<GraficoBarrasFinanciamentos
							categorias={cpa.map((a) => (a.ano < anoHoje ? `${a.ano} (atraso)` : String(a.ano)))}
							series={[{ name: 'Parcelas a pagar', data: cpa.map((a) => a.valor) }]}
							cores={cpa.map((a) => (a.ano < anoHoje ? CORES.atraso : CORES.compromissos))}
							corPorBarra
							vazio="Nenhuma parcela a pagar."
							onClickBarra={(_s, i) => cpa[i] && abrirCompromissos(cpa[i].contratos, String(cpa[i].ano))}
						/>
						{temAtraso && <p className="text-xs text-red-700 px-1 mt-1">Em vermelho: parcelas de anos anteriores ainda não pagas.</p>}
					</>
				)}
			</section>
		);
	};

	// ---- Views ----
	const visaoAtivos = (d: RelatorioFinanciamentosData) => {
		const prox = proximosMeses(d.contratos, d.ativos.contratos, d.hoje);
		const abrirAtivos = () => abrir({ titulo: 'Contratos ativos', dica: `Contratos com parcelas a pagar, posição de ${hoje}.`, refs: d.ativos.contratos });
		return (
			<>
				{cabecalho(`Todos os contratos com parcelas a pagar · posição de hoje, ${hoje}`)}
				<Kpis>
					<Kpi rotulo="Contratos" valor={String(d.ativos.quantidade)} onClick={abrirAtivos} />
					<Kpi rotulo="A vencer" valor={brl(d.ativos.valor)} detalhe="soma das parcelas a pagar" destaque onClick={abrirAtivos} />
					<Kpi rotulo="Valor dos contratos" valor={brl(d.ativos.valorContratos)} detalhe="valor original contratado" />
					<Kpi
						rotulo="Próximos 12 meses"
						valor={brl(prox.valor)}
						detalhe={prox.emAtraso ? <span className="text-red-700 font-medium">inclui {brl(prox.emAtraso)} em atraso</span> : 'parcelas que vencem em até 1 ano'}
						onClick={() =>
							abrir({
								titulo: 'Parcelas dos próximos 12 meses',
								dica: 'Parcelas não pagas que vencem em até 12 meses (inclui as vencidas).',
								colunaValor: 'Próximos 12 meses',
								refs: prox.contratos,
							})
						}
					/>
				</Kpis>
				{mostrarGrafico && graficoCompromissos(d)}
				{blocoTabela(
					<TabelaContratosFinanciamento linhas={linhasDe(d.contratos, d.ativos.contratos)} vazio={vazio('Nenhum contrato com parcelas a pagar.')} topoCabecalho={alturaBarra} />,
				)}
			</>
		);
	};

	const visaoContratados = (d: RelatorioFinanciamentosData) => {
		const abrirContratados = () =>
			abrir({ titulo: `Contratados em ${intervalo.rotulo}`, dica: 'Contratos assinados no período que ainda têm parcelas a pagar.', refs: d.contratados.contratos });
		return (
			<>
				{cabecalho(`Contratos assinados de ${datasPeriodo} que ainda têm parcelas a pagar`)}
				<Kpis>
					<Kpi rotulo="Contratos" valor={String(d.contratados.quantidade)} onClick={abrirContratados} />
					<Kpi rotulo="Valor contratado" valor={brl(d.contratados.valorContratos)} detalhe="valor original dos contratos" />
					<Kpi rotulo="A vencer" valor={brl(d.contratados.valor)} detalhe="soma das parcelas a pagar" destaque onClick={abrirContratados} />
				</Kpis>
				{mostrarGrafico && graficoNovosXLiquidados(d)}
				{blocoTabela(
					<TabelaContratosFinanciamento
						linhas={linhasDe(d.contratos, d.contratados.contratos)}
						vazio={vazio(`Nenhum contrato assinado em ${intervalo.rotulo} com parcelas a pagar.`)}
						topoCabecalho={alturaBarra}
					/>,
				)}
			</>
		);
	};

	const visaoLiquidados = (d: RelatorioFinanciamentosData) => {
		const l = d.liquidados;
		return (
			<>
				{cabecalho(`Contratos com parcelas pagas de ${datasPeriodo}`)}
				<Kpis>
					<Kpi
						rotulo="Contratos"
						valor={String(l.quantidade)}
						detalhe={`${plural(l.quitados, 'quitado', 'quitados')} · ${plural(l.amortizados, 'amortizado', 'amortizados')}${
							l.renegociados ? ` · ${plural(l.renegociados, 'renegociado', 'renegociados')}` : ''
						}`}
						onClick={() =>
							abrir({ titulo: `Liquidados em ${intervalo.rotulo}`, dica: 'Contratos com parcelas pagas no período.', colunaValor: 'Pago no período', mostrarSituacao: true, refs: l.contratos })
						}
						dica="Quitado: última parcela paga no período. Amortizado: pagou parcelas e ainda tem a vencer. Renegociado: o que faltava pagar foi para outro contrato."
					/>
					<Kpi
						rotulo="Pago no período"
						valor={brl(l.valor)}
						detalhe="soma das parcelas pagas"
						destaque
						onClick={() =>
							abrir({ titulo: `Pago em ${intervalo.rotulo}`, dica: 'Parcelas pagas no período, por contrato.', colunaValor: 'Pago no período', mostrarSituacao: true, refs: l.contratos })
						}
					/>
					<Kpi
						rotulo="Ainda a vencer"
						valor={brl(l.valorVincendo)}
						detalhe="destes contratos, hoje"
						onClick={() =>
							abrir({
								titulo: 'Ainda a vencer',
								dica: 'Parcelas que ainda faltam pagar nos contratos liquidados no período.',
								refs: linhasDe(d.contratos, l.contratos)
									.filter((x) => x.contrato.valorVincendo > 0)
									.map((x) => ({ idFinanciamento: x.contrato.idFinanciamento, valor: x.contrato.valorVincendo })),
							})
						}
					/>
				</Kpis>
				{mostrarGrafico && graficoNovosXLiquidados(d)}
				{blocoTabela(
					<TabelaContratosFinanciamento
						linhas={linhasDe(d.contratos, l.contratos)}
						colunaValor="Pago no período"
						mostrarSituacao
						vazio={vazio(`Nenhuma parcela paga em ${intervalo.rotulo}.`)}
						topoCabecalho={alturaBarra}
					/>,
				)}
			</>
		);
	};

	const visaoPorTomador = (d: RelatorioFinanciamentosData) => {
		const pt = d.porTomador;
		const maior = pt.grupos[0];
		const parte = (v: number) => (pt.valor ? (v / pt.valor) * 100 : 0);
		const abrirTomador = (g: (typeof pt.grupos)[number]) =>
			abrir({ titulo: `Contratos ativos — ${g.tomador}`, dica: 'Contratos deste tomador com parcelas a pagar.', refs: g.contratos });
		const thT = 'px-2 sm:px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-50 shadow-[inset_0_-1px_0_#e5e7eb]';
		const tdT = 'px-2 sm:px-3 py-2.5 text-[13px] sm:text-sm text-gray-700';
		return (
			<>
				{cabecalho(`Parcelas a pagar somadas por tomador · posição de hoje, ${hoje}`)}
				<Kpis>
					<Kpi rotulo="Tomadores" valor={String(pt.grupos.length)} detalhe={plural(pt.quantidade, 'contrato ativo', 'contratos ativos')} />
					<Kpi
						rotulo="A vencer"
						valor={brl(pt.valor)}
						detalhe="soma das parcelas a pagar"
						destaque
						onClick={() => abrir({ titulo: 'Contratos ativos', dica: `Contratos com parcelas a pagar, posição de ${hoje}.`, refs: d.ativos.contratos })}
					/>
					{maior && <Kpi rotulo="Maior tomador" valor={maior.tomador} detalhe={`${pct(parte(maior.valor))} do total · ${brl(maior.valor)}`} onClick={() => abrirTomador(maior)} />}
				</Kpis>
				{mostrarGrafico && (
					<section className={`${cartao} p-3 sm:p-4 mb-4`} aria-label="Gráfico de a vencer por tomador">
						<h3 className="font-semibold text-gray-800 mb-1">A vencer por tomador</h3>
						<GraficoBarrasFinanciamentos
							horizontal
							categorias={pt.grupos.map((g) => g.tomador)}
							series={[{ name: 'A vencer', data: pt.grupos.map((g) => g.valor) }]}
							cores={[CORES.tomador]}
							vazio="Nenhum valor a vencer."
							onClickBarra={(_s, i) => pt.grupos[i] && abrirTomador(pt.grupos[i])}
						/>
					</section>
				)}
				{blocoTabela(
					!pt.grupos.length ? (
						<div className="px-4 py-10 text-center text-sm text-gray-500">{vazio('Nenhum contrato com parcelas a pagar.')}</div>
					) : (
						<table className="w-full">
							<thead className="sticky z-10" style={{ top: alturaBarra }}>
								<tr>
									<th scope="col" className={`${thT} text-left`}>
										Tomador
									</th>
									<th scope="col" className={`${thT} text-right hidden sm:table-cell`}>
										Contratos
									</th>
									<th scope="col" className={`${thT} text-right`}>
										A vencer
									</th>
									<th scope="col" className={`${thT} text-left w-24 sm:w-56`}>
										% do total
									</th>
									<th scope="col" className={`${thT} text-right hidden md:table-cell`}>
										Valor dos contratos
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200">
								{pt.grupos.map((g, i) => {
									const p = parte(g.valor);
									return (
										<tr key={g.tomador} className="hover:bg-gray-50 cursor-pointer" onClick={() => abrirTomador(g)}>
											<td className={`${tdT} [overflow-wrap:anywhere]`}>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														abrirTomador(g);
													}}
													aria-label={`Ver contratos de ${g.tomador}`}
													className={`text-left rounded ${foco}`}
												>
													<span className="text-gray-400 tabular-nums mr-2">{i + 1}º</span>
													<span className="font-semibold text-gray-900">{g.tomador}</span>
													<span className="block text-xs text-gray-500 sm:hidden">{plural(g.quantidade, 'contrato', 'contratos')}</span>
												</button>
											</td>
											<td className={`${tdT} text-right tabular-nums hidden sm:table-cell`}>{g.quantidade}</td>
											<td className={`${tdT} text-right tabular-nums whitespace-nowrap font-bold text-gray-900`}>{brl(g.valor)}</td>
											<td className={tdT}>
												<div className="flex items-center gap-2">
													<div className="flex-1 h-2 bg-gray-100 rounded hidden sm:block" aria-hidden>
														<div className="h-2 rounded" style={{ width: `${Math.min(100, p)}%`, background: CORES.tomador }} />
													</div>
													<span className="text-xs tabular-nums text-gray-600 w-12 text-right">{pct(p)}</span>
												</div>
											</td>
											<td className={`${tdT} text-right tabular-nums whitespace-nowrap text-gray-600 hidden md:table-cell`}>{brl(g.valorContratos)}</td>
										</tr>
									);
								})}
							</tbody>
							<tfoot className="bg-gray-50 border-t-2 border-gray-200">
								<tr>
									<td className={`${tdT} font-semibold text-gray-900`}>Total</td>
									<td className={`${tdT} text-right tabular-nums font-semibold hidden sm:table-cell`}>{pt.quantidade}</td>
									<td className={`${tdT} text-right tabular-nums whitespace-nowrap font-bold text-gray-900`}>{brl(pt.valor)}</td>
									<td className={`${tdT} text-xs text-gray-600`}>
										<span className="block text-right sm:text-left">{pct(100)}</span>
									</td>
									<td className={`${tdT} text-right tabular-nums whitespace-nowrap font-semibold hidden md:table-cell`}>{brl(pt.valorContratos)}</td>
								</tr>
							</tfoot>
						</table>
					),
				)}
			</>
		);
	};

	const VISAO_RENDER: Record<VisaoFinanciamentos, (d: RelatorioFinanciamentosData) => React.ReactNode> = {
		ativos: visaoAtivos,
		contratados: visaoContratados,
		liquidados: visaoLiquidados,
		porTomador: visaoPorTomador,
	};

	return (
		<div ref={raizRef} className="min-h-screen">
			<BreadCrumb grupo="Relatórios" pagina="Financiamentos" />

			{/* Toolbar: sticky from the "sm" breakpoint up (on phones it would take too much of the screen) */}
			<div ref={barraRef} className="sm:sticky top-0 z-20 bg-white pt-1 pb-3 sm:pt-2">
				<BarraFiltrosFinanciamentos
					visao={visao}
					onVisao={(v) => atualizar({ visao: v })}
					ano={ano}
					anos={anos}
					onAno={(a) => atualizar({ ano: a })}
					periodo={periodo}
					onPeriodo={(p) => atualizar({ periodo: p })}
					refinos={refinos}
					onRefinos={atualizarRefinos}
					onLimpar={limparFiltros}
					tomadores={dados?.tomadores ?? []}
					bancos={bancos}
					carregando={carregando && !!dados}
					exportando={exportando}
					podeExportar={!!dados && !erro}
					onExportar={exportarExcel}
				/>
			</div>

			<div id="painel-fin" role="tabpanel" aria-labelledby={`aba-fin-${visao}`} className="mt-1">
				{erro ? (
					<div className="bg-white border border-red-200 rounded-xl p-6 text-center">
						<p className="text-red-700 mb-3">{erro}</p>
						<button
							type="button"
							onClick={() => setTentativa((t) => t + 1)}
							className={`px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 ${foco}`}
						>
							Tentar novamente
						</button>
					</div>
				) : !dados ? (
					<div className={`${cartao} p-12 flex flex-col items-center`} role="status">
						<div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" aria-hidden />
						<p className="mt-4 text-gray-700 font-medium">Carregando relatório...</p>
					</div>
				) : (
					<div className={carregando ? 'opacity-60 transition-opacity' : 'transition-opacity'}>{VISAO_RENDER[visao](dados)}</div>
				)}
			</div>

			<ModalContratosFinanciamento conteudo={modal} onClose={() => setModal(null)} />
		</div>
	);
};

export default RelatorioFinanciamentos;
