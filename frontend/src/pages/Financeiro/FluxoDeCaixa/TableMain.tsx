import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faSearchDollar } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip';
import { listarContas } from '../../../services/contaCorrenteService';
import { listarPlanoContas } from '../../../services/planoContasService';
import { listarCentroCustos } from '../../../services/centroCustosService';
import FiltroFluxoCaixaModal from './FiltroFluxoCaixaModal';
import { buscarFluxoCaixa, buscarDetalhamento, buscarFluxoCaixaAnoAnterior } from '../../../services/fluxoCaixaService';
import { FluxoCaixaMes } from '../../../../../backend/src/models/FluxoCaixaDTO';
import { formatarMoeda, formatarMoedaOuTraco, parseMoeda } from '../../../Utils/formataMoeda';
import ModalDetalhamento from './ModalDetalhamento';
import { MovimentoDetalhado } from '../../../../../backend/src/models/MovimentoDetalhado';
import { PlanoConta } from '../../../../../backend/src/models/PlanoConta';
import { CentroCustos } from '../../../../../backend/src/models/CentroCustos';
import ModalDetalhamentoFinanciamento from './ModalDetalhamentoFinanciamento';
import { FinanciamentoDetalhadoDTO } from '../../../../../backend/src/models/FinanciamentoDetalhadoDTO';
import FluxoCaixaGrafico from './FluxoCaixaGrafico';

const MovimentoBancarioTable: React.FC = () => {
	const [dadosFluxo, setDadosFluxo] = useState<FluxoCaixaMes[]>([]);
	const [dadosFluxoAnterior, setDadosFluxoAnterior] = useState<FluxoCaixaMes[]>([]);
	const [activeTab, setActiveTab] = useState<'tabela' | 'grafico'>('tabela');
	const [modalPesquisaAberto, setModalPesquisaAberto] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [expandido, setExpandido] = useState<{ [key: string]: boolean }>({
		entradas: true,
		saidas: true,
		financiamentos: true,
		investimentos: true,
		pendentes: true,
	});
	const [expandidoSub, setExpandidoSub] = useState<{ [key: string]: boolean }>({
		'1': true,
		'2': true,
	});
	const [contasCorrentes, setContasCorrentes] = useState<any[]>([]);
	const [planosContas, setPlanosContas] = useState<PlanoConta[]>([]);
	const [centrosCustos, setCentrosCustos] = useState<CentroCustos[]>([]);
	const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
	const [anoSelecionado, setAnoSelecionado] = useState<string>(String(new Date().getFullYear()));
	const [tipoAgrupamento, setTipoAgrupamento] = useState<'planos' | 'centros'>('centros');
	const [meses, setMeses] = useState<string[]>([]);
	const [modalDetalhamentoAberto, setModalDetalhamentoAberto] = useState(false);
	const [movimentosDetalhados, setMovimentosDetalhados] = useState<MovimentoDetalhado[]>([]);
	const [tituloDetalhamento, setTituloDetalhamento] = useState<string>('');
	const [modalFinanciamentoDetalhesAberto, setModalFinanciamentoDetalhesAberto] = useState(false);
	const [financiamentosDetalhados, setFinanciamentosDetalhados] = useState<FinanciamentoDetalhadoDTO[]>([]);

	interface Categoria {
		label: string;
		cor: string;
		subcategorias: { id: string; descricao: string; filhos?: { id: string; descricao: string }[] }[];
	}

	const [categorias, setCategorias] = useState<{
		entradas: Categoria;
		saidas: Categoria;
		financiamentos: Categoria;
		investimentos: Categoria;
		pendentes: Categoria;
	}>({
		entradas: { label: 'Receitas', cor: 'bg-blue-500', subcategorias: [] },
		saidas: { label: 'Despesas', cor: 'bg-red-500', subcategorias: [] },
		financiamentos: { label: 'Financiamentos', cor: 'bg-red-500', subcategorias: [] },
		investimentos: { label: 'Investimentos', cor: 'bg-yellow-500', subcategorias: [] },
		pendentes: { label: 'Pendentes Seleção', cor: 'bg-yellow-300', subcategorias: [] },
	});

	useEffect(() => {
		async function buscarContas() {
			const contas = await listarContas();
			setContasCorrentes(contas);
			if (contasSelecionadas.length === 0) {
				setContasSelecionadas(contas.map((c: any) => c.id.toString()));
			}
		}

		async function buscarPlanosContas() {
			const planos = await listarPlanoContas();
			setPlanosContas(planos);
		}

		async function buscarCentrosCustos() {
			const centros = await listarCentroCustos();
			setCentrosCustos(centros);
		}

		buscarContas();
		buscarPlanosContas();
		buscarCentrosCustos();
	}, []);

	// Função para obter descrição do plano de contas
	const getDescricaoPlanoConta = (idPlano: string): string => {
		const plano = planosContas.find(p => p.id.toString() === idPlano);
		return plano ? plano.descricao : `Plano ${idPlano}`;
	};

	// Função para obter descrição do centro de custos
	const getDescricaoCentroCustos = (idCentro: string): string => {
		const centro = centrosCustos.find(c => c.id.toString() === idCentro);
		return centro ? centro.descricao : `Centro ${idCentro}`;
	};

	// Função para obter descrição da conta corrente
	const getDescricaoContaCorrente = (idConta: string): string => {
		const conta = contasCorrentes.find((c) => c.id.toString() === idConta);
		if (!conta) {
			return `Conta ${idConta}`;
		}

		// Prioriza nomeBanco ou nome. Se não houver, usa 'Conta Corrente'.
		const nomeBanco = conta.nomeBanco || conta.nome || 'Conta Corrente';
		// Prioriza numConta ou numero. Se não houver, usa o ID.
		const numConta = conta.numConta || conta.numero || idConta;
		// Adiciona o responsável se existir.
		const responsavel = conta.responsavel ? ` - ${conta.responsavel}` : '';

		return `${nomeBanco} - ${numConta}${responsavel}`;
	};

	const gerarFluxo = async (contasParaGerar?: string[], tipoAgrupamentoParaGerar?: 'planos' | 'centros') => {
		try {
			setIsLoading(false);
			const contas = contasParaGerar || contasSelecionadas;
			const tipoAgrup = tipoAgrupamentoParaGerar || tipoAgrupamento;
			if (contas.length === 0) {
				console.error('Selecione pelo menos uma conta corrente para gerar o fluxo de caixa.');
				return;
			}
			const dados = await buscarFluxoCaixa(anoSelecionado, contas, tipoAgrup);
			const dadosAnterior = await buscarFluxoCaixaAnoAnterior(anoSelecionado, contas, tipoAgrup);
			setDadosFluxo(dados);
			setDadosFluxoAnterior(dadosAnterior);
			setIsLoading(true);
			console.log('Dados do fluxo de caixa:', dados);

			const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
				(mes) => `${mes}/${anoSelecionado}`
			);
			setMeses(mesesDoAno);

			const receitas = dados[0]?.receitas || {};
			const despesas = dados[0]?.despesas || {};

			// Adaptar renderização baseado no tipo de agrupamento
			if (tipoAgrup === 'centros') {
				// Agrupamento por Centro de Custos
				// Receitas são valores diretos (números), não objetos com filhos
				const subEntradas: any[] = [];
				Object.entries(receitas).forEach(([id, valor]) => {
					// Se for um número, é um centro de custos direto
					if (typeof valor === 'number') {
						subEntradas.push({
							id,
							descricao: getDescricaoCentroCustos(id),
							filhos: [],
							isDireto: true, // Flag para indicar que é direto
						});
					}
				});

				// Despesas separadas por Custeio e Investimentos (mantém estrutura de filhos)
				const subSaidas = Object.entries(despesas).map(([id, { descricao, filhos }]) => ({
					id,
					descricao,
					filhos: Object.entries(filhos).map(([idFilho, valor]) => ({
						id: idFilho,
						descricao: getDescricaoCentroCustos(idFilho),
					})),
				}));

				setCategorias((prev) => ({
					entradas: { ...prev.entradas, subcategorias: subEntradas },
					saidas: { ...prev.saidas, subcategorias: subSaidas },
					financiamentos: { ...prev.financiamentos, subcategorias: [] },
					investimentos: { ...prev.investimentos, subcategorias: [] },
					pendentes: {
						label: 'Pendentes Seleção',
						cor: '#fcd34d',
						subcategorias: Object.entries(dados[0]?.pendentesSelecao || {}).map(([idConta, valor]) => ({
							id: idConta,
							descricao: getDescricaoContaCorrente(idConta),
							filhos: [],
						})),
					},
				}));
			} else {
				// Agrupamento por Planos de Contas (lógica original)
				const subEntradas = Object.entries(receitas).map(([id, { descricao, filhos }]) => ({
					id,
					descricao,
					filhos: Object.entries(filhos).map(([idFilho, valor]) => ({
						id: idFilho,
						descricao: getDescricaoPlanoConta(idFilho),
					})),
				}));

				const subSaidas = Object.entries(despesas).map(([id, { descricao, filhos }]) => ({
					id,
					descricao,
					filhos: Object.entries(filhos).map(([idFilho, valor]) => ({
						id: idFilho,
						descricao: getDescricaoPlanoConta(idFilho),
					})),
				}));

				const subFinanciamentos = Object.entries(dados[0]?.financiamentos || {}).map(([idConta, valor]) => ({
					id: idConta,
					descricao: getDescricaoContaCorrente(idConta),
					filhos: [],
				}));

				const subInvestimentos = Object.entries(dados[0]?.investimentos || {}).map(([idPlano, valor]) => ({
					id: idPlano,
					descricao: getDescricaoPlanoConta(idPlano),
					filhos: [],
				}));

				const subPendentes = Object.entries(dados[0]?.pendentesSelecao || {}).map(([idConta, valor]) => ({
					id: idConta,
					descricao: getDescricaoContaCorrente(idConta),
					filhos: [],
				}));

				setCategorias((prev) => ({
					entradas: { ...prev.entradas, subcategorias: subEntradas },
					saidas: { ...prev.saidas, subcategorias: subSaidas },
					financiamentos: { ...prev.financiamentos, subcategorias: subFinanciamentos },
					investimentos: { ...prev.investimentos, subcategorias: subInvestimentos },
					pendentes: {
						label: 'Pendentes Seleção',
						cor: '#fcd34d',
						subcategorias: subPendentes,
					},
				}));
			}
		} catch (e) {
			console.error('Erro ao gerar fluxo de caixa:', e);
			const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido ao gerar fluxo de caixa';
			console.error(`Erro ao gerar fluxo de caixa: ${errorMessage}`);
			setIsLoading(true);
		}
	};

	const toggleCategoria = (cat: string) => {
		setExpandido((prev) => ({ ...prev, [cat]: !prev[cat] }));
	};

	const toggleSubcategoria = (subId: string) => {
		setExpandidoSub((prev) => ({ ...prev, [subId]: !prev[subId] }));
	};

	const expandirTodos = () => {
		const novasSubs: any = {};
		Object.values(categorias).forEach((cat) => cat.subcategorias.forEach((sub) => (novasSubs[sub.id] = true)));
		
		// Adicionar subcategorias de financiamentos quando for Centro de Custos
		if (tipoAgrupamento === 'centros') {
			novasSubs['fin-pagos'] = true;
			novasSubs['fin-contratados'] = true;
		}

		setExpandido({
			entradas: true,
			saidas: true,
			financiamentos: true,
			investimentos: true,
			pendentes: true,
		});
		setExpandidoSub(novasSubs);
	};

	const recolherTodos = () => {
		const novasSubs: any = {};
		Object.values(categorias).forEach((cat) => cat.subcategorias.forEach((sub) => (novasSubs[sub.id] = false)));

		setExpandido({
			entradas: false,
			saidas: false,
			financiamentos: false,
			investimentos: false,
			pendentes: false,
		});
		setExpandidoSub(novasSubs);
	};

	const abrirDetalhamento = async (planoId: string, mes: number, tipo: string, descricao: string) => {
		try {
			console.log('abrirDetalhamento', { planoId, mes, tipo, descricao });
			const dados = await buscarDetalhamento(planoId, mes, tipo, anoSelecionado, tipoAgrupamento);
			console.log('dados', dados);
			setTituloDetalhamento(descricao);
			console.log('tipo', tipo);
			if (tipo === 'financiamentos') {
				console.log('dados financiamentos', dados);
				setFinanciamentosDetalhados(dados as any);
				setModalFinanciamentoDetalhesAberto(true);
			} else {
				setMovimentosDetalhados(dados as MovimentoDetalhado[]);
				setModalDetalhamentoAberto(true);
			}
		} catch (error) {
			console.error('Erro ao buscar detalhamento:', error);
		}
	};

	const calcularTotais = (tipo: keyof FluxoCaixaMes): string[] => {
		return dadosFluxo.map((mes) => {
			// Quando agrupado por centros, receitas são valores diretos
			// Financiamentos quando centros têm estrutura diferente (pagos/contratados)
			const isDireto = tipo === 'investimentos' || tipo === 'pendentesSelecao' ||
				(tipoAgrupamento === 'centros' && tipo === 'receitas') ||
				(tipo === 'financiamentos' && tipoAgrupamento === 'planos');
			
			if (tipo === 'financiamentos' && tipoAgrupamento === 'centros') {
				// Para centros, calcular resultado (contratados - pagos)
				const pagos = Object.values((mes.financiamentos as any)?.pagos ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
				const contratados = Object.values((mes.financiamentos as any)?.contratados ?? {}).reduce((a: number, b: any) => a + (b.valor || 0), 0);
				return 'R$ ' + formatarMoedaOuTraco(contratados - pagos);
			}
			
			if (isDireto) {
				const soma = Object.values(mes[tipo] ?? {}).reduce((a, b: any) => a + (typeof b === 'number' ? b : 0), 0);
				return 'R$ ' + formatarMoedaOuTraco(soma);
			}
			let total = 0;
			Object.values(mes[tipo] ?? {}).forEach((subcat: any) => {
				total += Object.values(subcat.filhos ?? {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
			});
			return 'R$ ' + formatarMoedaOuTraco(total);
		});
	};

	const calcularSaldoMes = (): string[] => {
		return dadosFluxo.map((mes) => {
			let receita = 0;
			if (tipoAgrupamento === 'centros') {
				// Quando agrupado por centros, receitas são valores diretos (números)
				receita = Object.values(mes.receitas ?? {}).reduce((acc, item: any) => {
					return acc + (typeof item === 'number' ? item : 0);
				}, 0);
			} else {
				receita = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
					return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
				}, 0);
			}

			const despesa = Object.values(mes.despesas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
			}, 0);

			return 'R$ ' + formatarMoeda(receita - despesa);
		});
	};

	// Funções auxiliares para cálculos quando agrupado por Centro de Custos
	const calcularFinanciamentosPagos = (mesIndex: number): number => {
		if (tipoAgrupamento !== 'centros') return 0;
		const mes = dadosFluxo[mesIndex];
		if (!mes || !(mes.financiamentos as any)?.pagos) return 0;
		return Object.values((mes.financiamentos as any).pagos).reduce((acc: number, item: any) => acc + (item.valor || 0), 0);
	};

	const calcularFinanciamentosContratados = (mesIndex: number): number => {
		if (tipoAgrupamento !== 'centros') return 0;
		const mes = dadosFluxo[mesIndex];
		if (!mes || !(mes.financiamentos as any)?.contratados) return 0;
		return Object.values((mes.financiamentos as any).contratados).reduce((acc: number, item: any) => acc + (item.valor || 0), 0);
	};

	const calcularResultadoFinanciamentos = (mesIndex: number): number => {
		const contratados = calcularFinanciamentosContratados(mesIndex);
		const pagos = calcularFinanciamentosPagos(mesIndex);
		return contratados - pagos;
	};

	const calcularSaldoFinanciamentosAtivos = (mesIndex: number): number => {
		// Saldo acumulado (contratados - pagos acumulado ao longo dos meses)
		let saldoAcumulado = 0;
		for (let i = 0; i <= mesIndex; i++) {
			const contratados = calcularFinanciamentosContratados(i);
			const pagos = calcularFinanciamentosPagos(i);
			saldoAcumulado += (contratados - pagos);
		}
		return saldoAcumulado;
	};

	const calcularLucratividade = (mesIndex: number): number => {
		const mes = dadosFluxo[mesIndex];
		if (!mes) return 0;
		
		let receitas = 0;
		if (tipoAgrupamento === 'centros') {
			receitas = Object.values(mes.receitas ?? {}).reduce((acc, item: any) => {
				return acc + (typeof item === 'number' ? item : 0);
			}, 0);
		} else {
			receitas = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
			}, 0);
		}

		if (receitas === 0) return 0;

		const despesas = Object.values(mes.despesas ?? {}).reduce((acc, subcat: any) => {
			return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
		}, 0);

		const saldoRD = receitas - despesas;
		return (saldoRD / receitas) * 100;
	};

	const renderRodapeCentroCustos = () => {
		return (
			<>
				{/* Saldo (R - D) */}
				<tr 
					className="bg-gray-100 font-bold border border-gray-300 cursor-help" 
					style={{ borderTop: '3px solid lightgrey' }}
				>
					<td id="tooltip-saldo-rd-centros" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo (R - D)</td>
					{calcularSaldoMes().map((valor, idx) => (
						<td key={idx} className="text-center border border-gray-300 bg-white">
							{valor}
						</td>
					))}
				</tr>

				{/* Lucratividade do negócio */}
				<tr 
					className="bg-gray-100 font-bold border border-gray-300 cursor-help"
				>
					<td id="tooltip-lucratividade-centros" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Lucratividade do negócio</td>
					{dadosFluxo.map((mes, idx) => {
						const lucratividade = calcularLucratividade(idx);
						return (
							<td
								key={idx}
								className={`text-center border border-gray-300 bg-white ${
									lucratividade > 0 ? '!text-green-600' : lucratividade < 0 ? '!text-red-600' : 'text-gray-600'
								}`}
							>
								{`% ${formatarMoeda(lucratividade)}`}
							</td>
						);
					})}
				</tr>

				{/* Resultado financiamentos do mês */}
				<tr 
					className="bg-gray-100 font-bold border border-gray-300 cursor-help"
				>
					<td id="tooltip-resultado-fin-centros" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Resultado financiamentos do mês</td>
					{dadosFluxo.map((mes, idx) => {
						const resultado = calcularResultadoFinanciamentos(idx);
						return (
							<td
								key={idx}
								className={`text-center border border-gray-300 bg-white ${
									resultado > 0 ? '!text-green-600' : resultado < 0 ? '!text-red-600' : 'text-gray-600'
								}`}
							>
								{`R$ ${formatarMoeda(resultado)}`}
							</td>
						);
					})}
				</tr>

				{/* Saldo do mês (negócio e financiamentos) */}
				<tr 
					className="bg-gray-100 font-bold border border-gray-300 cursor-help"
				>
					<td id="tooltip-saldo-mes-centros" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo do mês (negócio e financiamentos)</td>
					{dadosFluxo.map((mes, idx) => {
						// Calcular saldo R-D diretamente
						let receita = 0;
						if (tipoAgrupamento === 'centros') {
							receita = Object.values(mes.receitas ?? {}).reduce((acc, item: any) => {
								return acc + (typeof item === 'number' ? item : 0);
							}, 0);
						} else {
							receita = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
								return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
							}, 0);
						}
						const despesa = Object.values(mes.despesas ?? {}).reduce((acc, subcat: any) => {
							return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
						}, 0);
						const saldoRD = receita - despesa;
						const resultadoFin = calcularResultadoFinanciamentos(idx);
						const saldoTotal = saldoRD + resultadoFin;
						return (
							<td
								key={idx}
								className={`text-center border border-gray-300 bg-white ${
									saldoTotal > 0 ? '!text-green-600' : saldoTotal < 0 ? '!text-red-600' : 'text-gray-600'
								}`}
							>
								{`R$ ${formatarMoeda(saldoTotal)}`}
							</td>
						);
					})}
				</tr>

				{/* Saldo dos financiamentos ativos */}
				<tr 
					className="bg-gray-100 font-bold border border-gray-300 cursor-help"
				>
					<td id="tooltip-saldo-ativos-centros" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo dos financiamentos ativos</td>
					{dadosFluxo.map((mes, idx) => {
						const saldoAtivo = calcularSaldoFinanciamentosAtivos(idx);
						return (
							<td
								key={idx}
								className={`text-center border border-gray-300 bg-white ${
									saldoAtivo > 0 ? '!text-green-600' : saldoAtivo < 0 ? '!text-red-600' : 'text-gray-600'
								}`}
							>
								{`R$ ${formatarMoeda(saldoAtivo)}`}
							</td>
						);
					})}
				</tr>
			</>
		);
	};

	const renderCategoria = (tipo: keyof FluxoCaixaMes, label: string, mainCor: string, valueCor: string) => {
		const possuiDados = dadosFluxo.some((mes) => mes[tipo] && Object.keys(mes[tipo] ?? {}).length > 0);

		// Quando agrupado por centros, receitas são diretas (sem hierarquia)
		// Financiamentos quando agrupado por centros têm estrutura com subcategorias (pagos/contratados)
		const isFilhoDireto = tipo === 'investimentos' || tipo === 'pendentesSelecao' || 
			(tipoAgrupamento === 'centros' && tipo === 'receitas') ||
			(tipo === 'financiamentos' && tipoAgrupamento === 'planos');
		const isFinanciamentosCentros = tipo === 'financiamentos' && tipoAgrupamento === 'centros';

		return (
			<>
				{/* Linha principal da categoria */}
				<tr className="font-bold border border-gray-300">
					<td
						className={`px-3 py-2 sticky left-0 z-10 text-left ${possuiDados ? 'cursor-pointer' : ''}`}
						style={{ backgroundColor: mainCor }}
						onClick={possuiDados ? () => toggleCategoria(tipo) : undefined}
					>
						{possuiDados && <FontAwesomeIcon icon={expandido[tipo] ? faMinus : faPlus} className="mr-2 text-blue-600" />}
						{label}
					</td>
					{meses.map((_, idx) => (
						<td key={idx} className="text-center px-3 py-2 border border-gray-300" style={{ backgroundColor: valueCor }}>
							{(() => {
								let total = 0;
								if (isFinanciamentosCentros) {
									// Quando agrupado por centros, calcular resultado (contratados - pagos)
									const pagos = Object.values((dadosFluxo[idx]?.financiamentos as any)?.pagos ?? {}).reduce(
										(acc: number, item: any) => acc + (item.valor || 0),
										0
									);
									const contratados = Object.values((dadosFluxo[idx]?.financiamentos as any)?.contratados ?? {}).reduce(
										(acc: number, item: any) => acc + (item.valor || 0),
										0
									);
									total = contratados - pagos;
								} else if (tipo === 'financiamentos') {
									total = Object.values(dadosFluxo[idx]?.financiamentos ?? {}).reduce(
										(acc: number, item: any) => acc + (item.valor || 0),
										0
									);
								} else if (isFilhoDireto) {
									// Para receitas quando agrupado por centros, os valores são números diretos
									if (tipoAgrupamento === 'centros' && tipo === 'receitas') {
										total = Object.values(dadosFluxo[idx]?.[tipo] ?? {}).reduce(
											(acc: number, item: any) => acc + (typeof item === 'number' ? item : 0),
											0
										);
									} else {
										total = Object.values(dadosFluxo[idx]?.[tipo] ?? {}).reduce(
											(acc: number, item: any) => acc + (typeof item === 'number' ? item : 0),
											0
										);
									}
								} else {
									Object.values(dadosFluxo[idx]?.[tipo] ?? {}).forEach((subcat: any) => {
										total += Object.values(subcat.filhos ?? {}).reduce(
											(acc: number, filho: any) => acc + (typeof filho === 'number' ? filho : 0),
											0
										);
									});
								}
								return total ? `R$ ${formatarMoeda(total)}` : 'R$ 0,00';
							})()}
						</td>
					))}
				</tr>

				{/* Financiamentos quando agrupado por centros (com subcategorias Pagos/Contratados) */}
				{expandido[tipo] && isFinanciamentosCentros && (
					<>
						{/* Subcategoria: Pagos */}
						<tr className="cursor-pointer border border-gray-300 bg-gray-100">
							<td className="px-6 py-2 sticky left-0 z-10 text-left font-bold bg-gray-100" onClick={() => toggleSubcategoria('fin-pagos')}>
								<FontAwesomeIcon icon={expandidoSub['fin-pagos'] ? faMinus : faPlus} className="ml-2 mr-2 text-blue-600" />
								Pagos
							</td>
							{meses.map((_, idx) => (
								<td key={`total-pagos-${idx}`} className="text-center px-3 py-2 border border-gray-300 bg-gray-100">
									{(() => {
										const pagos = Object.values((dadosFluxo[idx]?.financiamentos as any)?.pagos ?? {}).reduce(
											(total: number, item: any) => total + (item.valor || 0),
											0
										);
										return pagos ? `R$ ${formatarMoeda(pagos)}` : 'R$ 0,00';
									})()}
								</td>
							))}
						</tr>
						{expandidoSub['fin-pagos'] && 
							Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys((mes.financiamentos as any)?.pagos ?? {})))).map((credorKey) => {
								const credorInfo = (dadosFluxo.find((mes) => (mes.financiamentos as any)?.pagos?.[credorKey])?.financiamentos as any)?.pagos?.[credorKey];
								const descricao = credorInfo?.descricao || `Credor ${credorKey}`;
								return (
									<tr key={`pago-${credorKey}`} className="bg-white border border-gray-200">
										<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
											<div className="ml-7">{descricao}</div>
										</td>
										{meses.map((_, idx) => {
											const valor = (dadosFluxo[idx]?.financiamentos as any)?.pagos?.[credorKey]?.valor;
											return (
												<td
													key={`valor-pago-${credorKey}-${idx}`}
													className="text-center px-3 py-1 border border-gray-300"
												>
													{valor ? (
														<div
															className="cursor-pointer hover:underline hover:text-blue-600"
															onClick={() => abrirDetalhamento(credorKey, idx, 'financiamentos', descricao)}
														>
															{`R$ ${formatarMoeda(valor)}`}
														</div>
													) : (
														'R$ 0,00'
													)}
												</td>
											);
										})}
									</tr>
								);
							})
						}

						{/* Subcategoria: Contratados */}
						<tr className="cursor-pointer border border-gray-300 bg-gray-100">
							<td className="px-6 py-2 sticky left-0 z-10 text-left font-bold bg-gray-100" onClick={() => toggleSubcategoria('fin-contratados')}>
								<FontAwesomeIcon icon={expandidoSub['fin-contratados'] ? faMinus : faPlus} className="ml-2 mr-2 text-blue-600" />
								Contratados
							</td>
							{meses.map((_, idx) => (
								<td key={`total-contratados-${idx}`} className="text-center px-3 py-2 border border-gray-300 bg-gray-100">
									{(() => {
										const contratados = Object.values((dadosFluxo[idx]?.financiamentos as any)?.contratados ?? {}).reduce(
											(total: number, item: any) => total + (item.valor || 0),
											0
										);
										return contratados ? `R$ ${formatarMoeda(contratados)}` : 'R$ 0,00';
									})()}
								</td>
							))}
						</tr>
						{expandidoSub['fin-contratados'] && 
							Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys((mes.financiamentos as any)?.contratados ?? {})))).map((credorKey) => {
								const credorInfo = (dadosFluxo.find((mes) => (mes.financiamentos as any)?.contratados?.[credorKey])?.financiamentos as any)?.contratados?.[credorKey];
								const descricao = credorInfo?.descricao || `Credor ${credorKey}`;
								return (
									<tr key={`contratado-${credorKey}`} className="bg-white border border-gray-200">
										<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
											<div className="ml-7">{descricao}</div>
										</td>
										{meses.map((_, idx) => {
											const valor = (dadosFluxo[idx]?.financiamentos as any)?.contratados?.[credorKey]?.valor;
											return (
												<td
													key={`valor-contratado-${credorKey}-${idx}`}
													className="text-center px-3 py-1 border border-gray-300"
												>
													{valor ? (
														<div
															className="cursor-pointer hover:underline hover:text-blue-600"
															onClick={() => abrirDetalhamento(credorKey, idx, 'financiamentos', descricao)}
														>
															{`R$ ${formatarMoeda(valor)}`}
														</div>
													) : (
														'R$ 0,00'
													)}
												</td>
											);
										})}
									</tr>
								);
							})
						}
					</>
				)}

				{/* Se for movimentação direta (Financiamento quando planos, Investimento ou Pendentes) */}
				{expandido[tipo] && isFilhoDireto && tipo === 'financiamentos' && (
					Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys(mes[tipo] ?? {})))).map((idFilho) => {
						const financiamentoInfo = (dadosFluxo.find((mes) => (mes.financiamentos as any)?.[idFilho])?.financiamentos as any)?.[idFilho];
						const descricao = financiamentoInfo?.descricao || `Credor ${idFilho}`;
						return (
							<tr key={`filho-direto-${idFilho}`} className="bg-white border border-gray-200">
								<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
									<div className="ml-7">{descricao}</div>
								</td>
								{meses.map((_, idx) => {
									const valorFinanciamento = (dadosFluxo[idx]?.financiamentos as any)?.[idFilho]?.valor;
									return (
										<td
											key={`valor-direto-${idFilho}-${idx}`}
											className="text-center px-3 py-1 border border-gray-300"
										>
											{valorFinanciamento ? (
												<div
													className="cursor-pointer hover:underline hover:text-blue-600"
													onClick={() => abrirDetalhamento(idFilho, idx, 'financiamentos', descricao)}
												>
													{`R$ ${formatarMoeda(valorFinanciamento)}`}
												</div>
											) : (
												'R$ 0,00'
											)}
										</td>
									);
								})}
							</tr>
						);
					})
				)}

				{/* Se for movimentação direta (Investimento, Pendentes ou Receitas quando agrupado por centros) */}
				{expandido[tipo] && isFilhoDireto && tipo !== 'financiamentos' && (
					Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys(mes[tipo] ?? {})))).map((idFilho) => {
						let descricao = '';
						if (tipo === 'investimentos') {
							descricao = getDescricaoPlanoConta(idFilho);
						} else if (tipo === 'pendentesSelecao') {
							descricao = getDescricaoContaCorrente(idFilho);
						} else if (tipo === 'receitas' && tipoAgrupamento === 'centros') {
							descricao = getDescricaoCentroCustos(idFilho);
						} else {
							descricao = `Item ${idFilho}`;
						}
						return (
							<tr key={`filho-direto-${idFilho}`} className="bg-white border border-gray-200">
								<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
									<div className="ml-7">{descricao}</div>
								</td>
								{meses.map((_, idx) => {
									const filhoValor = (dadosFluxo[idx]?.[tipo] as any)?.[idFilho];
									// Para receitas quando agrupado por centros, o valor é um número direto
									const valor = typeof filhoValor === 'number' ? filhoValor : filhoValor;
									return (
										<td
											key={`valor-direto-${idFilho}-${idx}`}
											className="text-center px-3 py-1 border border-gray-300"
										>
											{valor ? (
												<div
													className="cursor-pointer hover:underline hover:text-blue-600"
													onClick={() => abrirDetalhamento(idFilho, idx, tipo, descricao)}
												>
													{`R$ ${formatarMoeda(valor)}`}
												</div>
											) : (
												'R$ 0,00'
											)}
										</td>
									);
								})}
							</tr>
						);
					})
				)}

				{/* Se for Receitas/Despesas (normal com expandir/recolher subcategorias) */}
				{expandido[tipo] &&
					!isFilhoDireto &&
					!isFinanciamentosCentros &&
					Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys(mes[tipo] ?? {})))).map((idPai) => {
						const pai = (dadosFluxo.find((mes) => (mes[tipo] as any)?.[idPai])?.[tipo] as any)?.[idPai];
						if (!pai) return null;

						return (
							<React.Fragment key={idPai}>
								<tr className="cursor-pointer border border-gray-300 bg-gray-100">
									<td className="px-6 py-2 sticky left-0 z-10 text-left font-bold bg-gray-100" onClick={() => toggleSubcategoria(idPai)}>
										<FontAwesomeIcon icon={expandidoSub[idPai] ? faMinus : faPlus} className="ml-2 mr-2 text-blue-600" />
										{pai.descricao}
									</td>
									{meses.map((_, idx) => (
										<td key={`total-pai-${idPai}-${idx}`} className="text-center px-3 py-2 border border-gray-300 bg-gray-100">
											{(() => {
												const valorPai = Object.values((dadosFluxo[idx]?.[tipo] as any)?.[idPai]?.filhos ?? {}).reduce(
													(total: number, filho: any) => total + (typeof filho === 'number' ? filho : 0),
													0
												);
												return valorPai ? `R$ ${formatarMoeda(valorPai)}` : 'R$ 0,00';
											})()}
										</td>
									))}
								</tr>

								{expandidoSub[idPai] &&
									Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys((mes[tipo] as any)?.[idPai]?.filhos ?? {})))).map((idFilho) => {
										const filho = (dadosFluxo.find((mes) => (mes[tipo] as any)?.[idPai]?.filhos?.[idFilho])?.[tipo] as any)?.[
											idPai
										]?.filhos?.[idFilho];
										if (!filho) return null;

										// Quando agrupado por centros, usar getDescricaoCentroCustos para despesas
										const descricaoFilho = (tipoAgrupamento === 'centros' && tipo === 'despesas') 
											? getDescricaoCentroCustos(idFilho)
											: getDescricaoPlanoConta(idFilho);

										return (
											<tr key={`filho-${idPai}-${idFilho}`} className="bg-white border border-gray-200">
												<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
													<div className="ml-7">{descricaoFilho}</div>
												</td>
												{meses.map((_, idx) => (
													<td
														key={`valor-${idFilho}-${idx}`}
														className="text-center px-3 py-1 border border-gray-300"
													>
														{(() => {
															const filhoValor = (dadosFluxo[idx]?.[tipo] as any)?.[idPai]?.filhos?.[idFilho];
															return filhoValor ? (
																<div
																	className="cursor-pointer hover:underline hover:text-blue-600"
																	onClick={() => abrirDetalhamento(idFilho, idx, tipo, descricaoFilho)}
																>
																	{`R$ ${formatarMoeda(filhoValor)}`}
																</div>
															) : (
																'R$ 0,00'
															);
														})()}
													</td>
												))}
											</tr>
										);
									})}
							</React.Fragment>
						);
					})}
			</>
		);
	};

	return (
		<div>
			<div className="flex justify-between items-end gap-5 mb-4">
				<div className="flex items-end gap-3 relative w-auto whitespace-nowrap">
					<div className="flex border-b border-gray-300">
						<button
							className={`px-4 py-2 font-bold text-sm ${
								activeTab === 'tabela' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
							}`}
							onClick={() => setActiveTab('tabela')}
						>
							TABELA DOS DADOS
						</button>
						<button
							className={`px-4 py-2 font-bold text-sm ${
								activeTab === 'grafico' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
							}`}
							onClick={() => setActiveTab('grafico')}
						>
							GRÁFICO DOS DADOS
						</button>
					</div>
				</div>
				<div className="flex justify-end items-center gap-3 w-full">
					{activeTab === 'tabela' && (
						<>
							<button
								className="bg-white border text-gray-800 font-medium px-4 py-1 flex justify-center items-center gap-3 rounded-md hover:bg-gray-100"
								onClick={() => recolherTodos()}
							>
								Recolher Todos <FontAwesomeIcon icon={faMinus} className="text-blue-500 font-bold" />
							</button>
							<button
								className="bg-white border text-gray-800 font-medium px-4 py-1 flex justify-center items-center gap-3 rounded-md hover:bg-gray-100"
								onClick={() => expandirTodos()}
							>
								Expandir Todos <FontAwesomeIcon icon={faPlus} className="text-blue-500 font-bold" />
							</button>
							|
						</>
					)}
					
					<button
						className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-500"
						onClick={() => setModalPesquisaAberto(true)}
					>
						Pesquisar Fluxo de Caixa <FontAwesomeIcon icon={faSearchDollar} className="ml-3 font-bold" />
					</button>
				</div>
			</div>
			{activeTab === 'tabela' ? (
				<div
					className="bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto max-w-full relative"
					style={{ overflowX: 'auto', position: 'relative' }}
				>
					{!isLoading ? (
						<div className="flex justify-center items-center h-64">
							<div className="loader"></div>
						</div>
					) : (
						<table className="table rounded-lg overflow-hidden w-full">
							<thead>
								<tr className="bg-gray-100 border border-gray-300">
									<th className="text-center text-lg px-3 py-2 border border-gray-300 sticky left-0 bg-white z-10 ">Fluxo Mensal</th>

									{meses.map((mes) => (
										<th
											key={mes}
											className="text-center text-md px-3 py-2 border border-gray-300 font-medium"
											style={{ fontSize: '1rem', lineHeight: '1.50rem' }}
										>
											{mes}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{/* Cabeçalho Saldo Inicial */}
								<tr className="saldoInicial border border-gray-300 ">
									<td className="sticky left-0 bg-white border border-gray-300 z-10 text-center">Saldo Inicial</td>
									{dadosFluxo.map((mes, idx) => (
										<td key={idx} className="text-center border border-gray-300">
											{'R$ ' + formatarMoeda(mes.saldoInicial)}
										</td>
									))}
								</tr>

								{/* Categorias dinâmicas */}
								{/* {Object.entries(categorias).map(([key, cat]) => renderCategoria(key, cat))} */}

								{renderCategoria('receitas', 'Receitas', '#82b4ff', '#c7eafe')}
								{renderCategoria('despesas', 'Despesas', '#ffbe82', '#ffe6bc')}
								{renderCategoria('financiamentos', 'Financiamentos', '#ffc0c0', '#fce1e3')}
								{/* Quando agrupado por centros, não mostrar seção de investimentos (já está nas despesas) */}
								{tipoAgrupamento === 'planos' && renderCategoria('investimentos', 'Investimentos', '#ffefbd', '#fff4d0')}
								{renderCategoria('pendentesSelecao', 'Pendentes Seleção', '#e2e8f0', '#f8fafc')}

								{/* Totalizadores - Customizado para Centro de Custos ou padrão para Planos de Contas */}
								{tipoAgrupamento === 'centros' ? (
									renderRodapeCentroCustos()
								) : (
									<>
										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help" 
											style={{ borderTop: '3px solid lightgrey' }}
										>
											<td id="tooltip-saldo-mes-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo do mês (R x D)</td>
											{calcularSaldoMes().map((valor, idx) => (
												<td key={idx} className="text-center border border-gray-300 bg-white">
													{valor}
												</td>
											))}
										</tr>

										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help"
										>
											<td id="tooltip-saldo-fin-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Financiamentos</td>
											{calcularTotais('financiamentos').map((valor, idx) => (
												<td key={idx} className="text-center border border-gray-300 bg-white">
													{valor}
												</td>
											))}
										</tr>

										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help"
										>
											<td id="tooltip-saldo-inv-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Investimentos</td>
											{calcularTotais('investimentos').map((valor, idx) => (
												<td key={idx} className="text-center border border-gray-300 bg-white">
													{valor}
												</td>
											))}
										</tr>

										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help"
										>
											<td id="tooltip-saldo-pend-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Pendências</td>
											{calcularTotais('pendentesSelecao').map((valor, idx) => (
												<td key={idx} className="text-center border border-gray-300 bg-white">
													{valor}
												</td>
											))}
										</tr>

										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help"
										>
											<td id="tooltip-saldo-final-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo Final</td>
											{dadosFluxo.map((mes, idx) => (
												<td
													key={idx}
													className={`text-center border border-gray-300 bg-white ${
														mes.saldoFinal > 0 ? '!text-green-600' : mes.saldoFinal < 0 ? '!text-red-600' : 'text-gray-600'
													}`}
												>
													{'R$ ' + formatarMoeda(mes.saldoFinal)}
												</td>
											))}
										</tr>

										<tr 
											className="bg-gray-100 font-bold border border-gray-300 cursor-help"
										>
											<td id="tooltip-lucratividade-planos" className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Lucratividade</td>
											{dadosFluxo.map((mes, idx) => (
												<td
													key={idx}
													className={`text-center border border-gray-300 bg-white ${
														mes.lucro > 0 ? '!text-green-600' : mes.lucro < 0 ? '!text-red-600' : 'text-gray-600'
													}`}
												>
													{'% ' + formatarMoeda(mes.lucro)}
												</td>
											))}
										</tr>
									</>
								)}
							</tbody>
						</table>
					)}
				</div>
			) : (
				<FluxoCaixaGrafico
					anoSelecionado={anoSelecionado}
					dadosAtual={dadosFluxo}
					dadosAnterior={dadosFluxoAnterior}
					isLoading={!isLoading}
					tipoAgrupamento={tipoAgrupamento}
				/>
			)}
			<FiltroFluxoCaixaModal
				isOpen={modalPesquisaAberto}
				onClose={() => setModalPesquisaAberto(false)}
				contasDisponiveis={contasCorrentes}
				anoSelecionado={anoSelecionado}
				contasSelecionadas={contasSelecionadas}
				tipoAgrupamento={tipoAgrupamento}
				onAplicarFiltro={(ano, contas, tipoAgrup) => {
					setAnoSelecionado(ano);
					setContasSelecionadas(contas);
					setTipoAgrupamento(tipoAgrup);
					gerarFluxo(contas, tipoAgrup).then(() => {
						expandirTodos();
					});
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

			{/* Tooltips para Centro de Custos */}
			{tipoAgrupamento === 'centros' && (
				<>
					<Tooltip anchorId="tooltip-saldo-rd-centros" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Receitas - Despesas<br/>
							Representa o resultado operacional do mês, sem considerar financiamentos.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-lucratividade-centros" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> (Saldo R-D / Receitas) × 100<br/>
							Indica a porcentagem de lucro sobre as receitas. Valores negativos indicam prejuízo.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-resultado-fin-centros" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Financiamentos Contratados - Financiamentos Pagos<br/>
							Representa o impacto líquido dos financiamentos no mês. Positivo = mais contratados que pagos.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-mes-centros" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Saldo (R-D) + Resultado Financiamentos<br/>
							Resultado final do mês considerando operações do negócio e movimentações de financiamentos.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-ativos-centros" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Soma acumulada de (Contratados - Pagos) desde o início do ano<br/>
							Representa o saldo total de financiamentos ainda não quitados até o mês atual.
						</div>
					</Tooltip>
				</>
			)}

			{/* Tooltips para Planos de Contas */}
			{tipoAgrupamento === 'planos' && (
				<>
					<Tooltip anchorId="tooltip-saldo-mes-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Receitas - Despesas<br/>
							Representa o resultado operacional do mês, sem considerar investimentos e financiamentos.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-fin-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Soma de todos os valores de financiamentos do mês<br/>
							Representa o total de parcelas de financiamentos pagas ou contratadas no período.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-inv-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Soma de todos os valores de investimentos do mês<br/>
							Representa o total de despesas classificadas como investimentos no período.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-pend-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Soma de movimentos sem plano de contas ou centro de custos atribuído<br/>
							Representa valores que ainda precisam ser classificados corretamente.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-saldo-final-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> Saldo Inicial + Saldo do mês (R-D) + Investimentos + Financiamentos + Pendências<br/>
							Representa o saldo total da conta corrente ao final do mês.
						</div>
					</Tooltip>
					<Tooltip anchorId="tooltip-lucratividade-planos" place="top" className="z-50">
						<div className="text-sm">
							<strong>Cálculo:</strong> ((Saldo Final - Saldo Inicial) / |Saldo Inicial|) × 100<br/>
							Indica a variação percentual do saldo no mês. Se saldo inicial for zero, usa 100% ou -100%.
						</div>
					</Tooltip>
				</>
			)}
		</div>
	);
};

export default MovimentoBancarioTable;
