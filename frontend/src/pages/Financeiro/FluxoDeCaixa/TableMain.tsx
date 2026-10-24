import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faSearchDollar } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { listarContas } from '../../../services/contaCorrenteService';
import { listarCentroCustos } from '../../../services/centroCustosService';
import FiltroFluxoCaixaModal from './FiltroFluxoCaixaModal';
import { buscarFluxoCaixa, buscarDetalhamento, buscarFluxoCaixaAnoAnterior } from '../../../services/fluxoCaixaService';
import ModalDetalhamento from './ModalDetalhamento';
import { MovimentoDetalhado } from '../../../../../backend/src/models/MovimentoDetalhado';
import { CentroCustos } from '../../../../../backend/src/models/CentroCustos';
import { ContaCorrente } from '../../../../../backend/src/models/ContaCorrente';
import ModalDetalhamentoFinanciamento from './ModalDetalhamentoFinanciamento';
import { FinanciamentoDetalhadoDTO } from '../../../../../backend/src/models/FinanciamentoDetalhadoDTO';
import FluxoCaixaGrafico from './FluxoCaixaGrafico';
import FluxoMensalCentros, { GrupoCentros } from './FluxoMensalCentros';
import { FluxoMesCentrosInput } from './fluxoMensalRegras';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026 · todas as contas (26)" / "2026 · 3 de 26 contas": active filter shown next to the button. */
function resumoFiltro(ano: string, selecionadas: number, total: number): string {
	if (!total) return ano;
	if (selecionadas >= total) return `${ano} · todas as contas (${total})`;
	return `${ano} · ${selecionadas} de ${total} ${total === 1 ? 'conta' : 'contas'}`;
}

/**
 * Fluxo de Caixa, always grouped by centro de custos (the plano de contas layout was removed: receitas are
 * classified by centro only, so it showed revenue R$ 0 and a meaningless saldo final).
 * Opens already loaded with the default filter: current year, all accounts.
 */
const MovimentoBancarioTable: React.FC = () => {
	const [dadosFluxo, setDadosFluxo] = useState<FluxoMesCentrosInput[]>([]);
	const [dadosFluxoAnterior, setDadosFluxoAnterior] = useState<FluxoMesCentrosInput[]>([]);
	const [activeTab, setActiveTab] = useState<'tabela' | 'grafico'>('tabela');
	const [modalPesquisaAberto, setModalPesquisaAberto] = useState(false);
	// Starts true: the first load runs as soon as the accounts arrive
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState<string | null>(null);
	const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([]);
	const [centrosCustos, setCentrosCustos] = useState<CentroCustos[]>([]);
	const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
	const [anoSelecionado, setAnoSelecionado] = useState<string>(String(new Date().getFullYear()));
	// Which groups show one column per centro de custos
	const [gruposExpandidos, setGruposExpandidos] = useState<Record<GrupoCentros, boolean>>({
		receitas: false,
		operacionais: false,
		investimentos: false,
	});
	const [meses, setMeses] = useState<string[]>([]);
	const [modalDetalhamentoAberto, setModalDetalhamentoAberto] = useState(false);
	const [movimentosDetalhados, setMovimentosDetalhados] = useState<MovimentoDetalhado[]>([]);
	const [tituloDetalhamento, setTituloDetalhamento] = useState<string>('');
	const [modalFinanciamentoDetalhesAberto, setModalFinanciamentoDetalhesAberto] = useState(false);
	const [financiamentosDetalhados, setFinanciamentosDetalhados] = useState<FinanciamentoDetalhadoDTO[]>([]);

	const gerarFluxo = async (contas: string[], ano: string) => {
		if (contas.length === 0) {
			setCarregando(false);
			setErro('Nenhuma conta corrente selecionada. Use "Pesquisar Fluxo de Caixa" para escolher as contas.');
			return;
		}
		try {
			setCarregando(true);
			setErro(null);
			// Same engine for both years (the Gráfico compares with the previous year)
			const [dados, dadosAnterior] = await Promise.all([
				buscarFluxoCaixa(ano, contas),
				buscarFluxoCaixaAnoAnterior(ano, contas),
			]);
			setDadosFluxo(dados.dadosMensais as unknown as FluxoMesCentrosInput[]);
			setDadosFluxoAnterior(dadosAnterior as unknown as FluxoMesCentrosInput[]);
			setMeses(MESES.map((mes) => `${mes}/${ano}`));
		} catch (e) {
			console.error('Erro ao gerar fluxo de caixa:', e instanceof Error ? e.message : e);
			setErro('Não foi possível carregar o fluxo de caixa.');
		} finally {
			setCarregando(false);
		}
	};

	useEffect(() => {
		listarContas()
			.then((resposta) => {
				// The API returns the backend model (numConta, bancoNome, responsavel…)
				const contas = resposta as unknown as ContaCorrente[];
				const todas = contas.map((c) => c.id.toString());
				setContasCorrentes(contas);
				setContasSelecionadas(todas);
				// Default filter: current year, all accounts
				gerarFluxo(todas, anoSelecionado);
			})
			.catch(() => {
				setCarregando(false);
				setErro('Não foi possível carregar as contas correntes.');
			});
		listarCentroCustos().then(setCentrosCustos).catch((e) => console.error('Erro ao carregar centros de custos:', e));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const getDescricaoCentroCustos = (idCentro: string): string => {
		const centro = centrosCustos.find((c) => c.id.toString() === idCentro);
		return centro ? centro.descricao : `Centro ${idCentro}`;
	};

	const expandirTodos = () => setGruposExpandidos({ receitas: true, operacionais: true, investimentos: true });
	const recolherTodos = () => setGruposExpandidos({ receitas: false, operacionais: false, investimentos: false });

	const abrirDetalhamento = async (
		planoId: string,
		mes: number,
		tipo: string,
		descricao: string,
		subtipoFinanciamento?: 'pagos' | 'contratados',
	) => {
		try {
			const dados = await buscarDetalhamento(planoId, mes, tipo, anoSelecionado, 'centros', subtipoFinanciamento, contasSelecionadas);
			setTituloDetalhamento(descricao);
			if (tipo === 'financiamentos') {
				setFinanciamentosDetalhados(dados as FinanciamentoDetalhadoDTO[]);
				setModalFinanciamentoDetalhesAberto(true);
			} else {
				setMovimentosDetalhados(dados as MovimentoDetalhado[]);
				setModalDetalhamentoAberto(true);
			}
		} catch (error) {
			console.error('Erro ao buscar detalhamento:', error);
			toast.error('Não foi possível abrir o detalhamento.');
		}
	};

	const abaClasse = (aba: 'tabela' | 'grafico') =>
		`px-4 py-2 font-bold text-sm ${activeTab === aba ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`;

	return (
		<div>
			{/* Phone: filter first, everything wraps. Desktop: tabs on the left, buttons on the right. */}
			<div className="flex flex-wrap items-center gap-3 mb-4">
				<div className={`order-1 md:order-3 flex flex-wrap items-center gap-x-3 gap-y-1 ${activeTab === 'grafico' ? 'md:ml-auto' : ''}`}>
					<span className="text-sm text-gray-600" title="Filtro aplicado (ano e contas correntes)">
						{resumoFiltro(anoSelecionado, contasSelecionadas.length, contasCorrentes.length)}
					</span>
					<button
						className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-500"
						onClick={() => setModalPesquisaAberto(true)}
					>
						Pesquisar Fluxo de Caixa <FontAwesomeIcon icon={faSearchDollar} className="ml-3 font-bold" />
					</button>
				</div>

				<div className="order-2 md:order-1 flex border-b border-gray-300 w-full md:w-auto">
					<button className={abaClasse('tabela')} onClick={() => setActiveTab('tabela')}>
						Tabela dos dados
					</button>
					<button className={abaClasse('grafico')} onClick={() => setActiveTab('grafico')}>
						Gráfico dos dados
					</button>
				</div>

				{activeTab === 'tabela' && (
					<div className="order-3 md:order-2 md:ml-auto flex flex-wrap items-center gap-2">
						<button
							className="bg-white border text-gray-800 font-medium px-4 py-1.5 flex justify-center items-center gap-3 rounded-md hover:bg-gray-100"
							onClick={recolherTodos}
						>
							Recolher todos <FontAwesomeIcon icon={faMinus} className="text-blue-500 font-bold" />
						</button>
						<button
							className="bg-white border text-gray-800 font-medium px-4 py-1.5 flex justify-center items-center gap-3 rounded-md hover:bg-gray-100"
							onClick={expandirTodos}
						>
							Expandir todos <FontAwesomeIcon icon={faPlus} className="text-blue-500 font-bold" />
						</button>
					</div>
				)}
			</div>

			{erro && !carregando && (
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
					<span>{erro}</span>
					{contasSelecionadas.length > 0 && (
						<button
							className="rounded border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100"
							onClick={() => gerarFluxo(contasSelecionadas, anoSelecionado)}
						>
							Tentar novamente
						</button>
					)}
				</div>
			)}

			{activeTab === 'tabela' ? (
				<div className="max-w-full relative">
					{carregando ? (
						<div className="flex justify-center items-center h-64">
							<div className="loader"></div>
						</div>
					) : (
						<FluxoMensalCentros
							dadosFluxo={dadosFluxo}
							meses={meses}
							ano={anoSelecionado}
							expandidos={gruposExpandidos}
							onToggleGrupo={(g) => setGruposExpandidos((prev) => ({ ...prev, [g]: !prev[g] }))}
							descricaoCentro={getDescricaoCentroCustos}
							onDetalharCentro={(idCentro, mesIdx, tipo, descricao) => abrirDetalhamento(idCentro, mesIdx, tipo, descricao)}
							onDetalharFinanciamento={(mesIdx, subtipo, descricao) =>
								abrirDetalhamento('todos', mesIdx, 'financiamentos', descricao, subtipo)
							}
						/>
					)}
				</div>
			) : (
				<FluxoCaixaGrafico
					anoSelecionado={anoSelecionado}
					dadosAtual={dadosFluxo}
					dadosAnterior={dadosFluxoAnterior}
					isLoading={carregando}
					centros={centrosCustos}
				/>
			)}
			<FiltroFluxoCaixaModal
				isOpen={modalPesquisaAberto}
				onClose={() => setModalPesquisaAberto(false)}
				contasDisponiveis={contasCorrentes}
				anoSelecionado={anoSelecionado}
				contasSelecionadas={contasSelecionadas}
				onAplicarFiltro={(ano, contas) => {
					setAnoSelecionado(ano);
					setContasSelecionadas(contas);
					gerarFluxo(contas, ano);
				}}
			/>

			<ModalDetalhamento
				isOpen={modalDetalhamentoAberto}
				onClose={() => setModalDetalhamentoAberto(false)}
				movimentos={movimentosDetalhados}
				titulo={tituloDetalhamento}
			/>

			<ModalDetalhamentoFinanciamento
				isOpen={modalFinanciamentoDetalhesAberto}
				onClose={() => setModalFinanciamentoDetalhesAberto(false)}
				financiamentos={financiamentosDetalhados}
				titulo={tituloDetalhamento}
			/>
		</div>
	);
};

export default MovimentoBancarioTable;
