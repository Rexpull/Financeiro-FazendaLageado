import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faSearchDollar } from '@fortawesome/free-solid-svg-icons';
import { listarContas } from '../../../services/contaCorrenteService';
import { listarPlanoContas } from '../../../services/planoContasService';
import FiltroFluxoCaixaModal from './FiltroFluxoCaixaModal';
import { buscarFluxoCaixa, buscarDetalhamento } from '../../../services/fluxoCaixaService';
import { FluxoCaixaMes } from '../../../../../backend/src/models/FluxoCaixaDTO';
import { formatarMoeda, formatarMoedaOuTraco, parseMoeda } from '../../../Utils/formataMoeda';
import ModalDetalhamento from './ModalDetalhamento';
import { MovimentoDetalhado } from '../../../../../backend/src/models/MovimentoDetalhado';
import { PlanoConta } from '../../../../../backend/src/models/PlanoConta';
import ModalDetalhamentoFinanciamento from './ModalDetalhamentoFinanciamento';
import { FinanciamentoDetalhadoDTO } from '../../../../../backend/src/models/FinanciamentoDetalhadoDTO';

const MovimentoBancarioTable: React.FC = () => {
	const [dadosFluxo, setDadosFluxo] = useState<FluxoCaixaMes[]>([]);
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
	const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
	const [anoSelecionado, setAnoSelecionado] = useState<string>(String(new Date().getFullYear()));
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

		buscarContas();
		buscarPlanosContas();
	}, []);

	// Função para obter descrição do plano de contas
	const getDescricaoPlanoConta = (idPlano: string): string => {
		const plano = planosContas.find(p => p.id.toString() === idPlano);
		return plano ? plano.descricao : `Plano ${idPlano}`;
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

	const gerarFluxo = async (contasParaGerar?: string[]) => {
		try {
			const contas = contasParaGerar || contasSelecionadas;
			if (contas.length === 0) {
				console.error('Selecione pelo menos uma conta corrente para gerar o fluxo de caixa.');
				return;
			}

			setIsLoading(false);
			console.log('Gerando fluxo com contas:', contas);
			const dados = await buscarFluxoCaixa(anoSelecionado, contas);
			setDadosFluxo(dados);
			console.log('Dados do fluxo de caixa:', dados);

			const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
				(mes) => `${mes}/${anoSelecionado}`
			);
			setMeses(mesesDoAno);

			const receitas = dados[0]?.receitas || {};
			const despesas = dados[0]?.despesas || {};

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
		} catch (e) {
			console.error('Erro ao gerar fluxo de caixa:', e);
			const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido ao gerar fluxo de caixa';
			console.error(`Erro ao gerar fluxo de caixa: ${errorMessage}`);
		}
		setIsLoading(true);
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
			const dados = await buscarDetalhamento(planoId, mes, tipo, anoSelecionado);
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
			if (tipo === 'financiamentos' || tipo === 'investimentos' || tipo === 'pendentesSelecao') {
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
			const receita = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
			}, 0);

			const despesa = Object.values(mes.despesas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
			}, 0);

			return 'R$ ' + formatarMoeda(receita - despesa);
		});
	};

	const renderCategoria = (tipo: keyof FluxoCaixaMes, label: string, mainCor: string, valueCor: string) => {
		const possuiDados = dadosFluxo.some((mes) => mes[tipo] && Object.keys(mes[tipo] ?? {}).length > 0);

		const isFilhoDireto = tipo === 'financiamentos' || tipo === 'investimentos' || tipo === 'pendentesSelecao';

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
								if (tipo === 'financiamentos') {
									total = Object.values(dadosFluxo[idx]?.financiamentos ?? {}).reduce(
										(acc: number, item: any) => acc + (item.valor || 0),
										0
									);
								} else if (isFilhoDireto) {
									total = Object.values(dadosFluxo[idx]?.[tipo] ?? {}).reduce(
										(acc: number, item: any) => acc + (typeof item === 'number' ? item : 0),
										0
									);
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

				{/* Se for movimentação direta (Financiamento, Investimento ou Pendentes) */}
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

				{/* Se for movimentação direta (Investimento ou Pendentes) */}
				{expandido[tipo] && isFilhoDireto && tipo !== 'financiamentos' && (
					Array.from(new Set(dadosFluxo.flatMap((mes) => Object.keys(mes[tipo] ?? {})))).map((idFilho) => {
						let descricao = '';
						if (tipo === 'investimentos') {
							descricao = getDescricaoPlanoConta(idFilho);
						} else if (tipo === 'pendentesSelecao') {
							descricao = getDescricaoContaCorrente(idFilho);
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
									return (
										<td
											key={`valor-direto-${idFilho}-${idx}`}
											className="text-center px-3 py-1 border border-gray-300"
										>
											{filhoValor ? (
												<div
													className="cursor-pointer hover:underline hover:text-blue-600"
													onClick={() => abrirDetalhamento(idFilho, idx, tipo, descricao)}
												>
													{`R$ ${formatarMoeda(filhoValor)}`}
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

										const descricaoFilho = getDescricaoPlanoConta(idFilho);

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
							className={`px-4 py-2 font-bold text-sm cursor-not-allowed pointer-none opacity-30 ${
								activeTab === 'grafico' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'
							}`}
							onClick={() => setActiveTab('grafico')}
						>
							GRÁFICO DOS DADOS <span className="text-orange-500"> ( Em Breve )</span>
						</button>
					</div>
				</div>
				<div className="flex justify-end items-center gap-3 w-full">
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
					<button
						className="bg-primary text-white font-bold px-4 py-2 flex justify-center items-center rounded hover:bg-orange-500"
						onClick={() => setModalPesquisaAberto(true)}
					>
						Pesquisar Fluxo de Caixa <FontAwesomeIcon icon={faSearchDollar} className="ml-3 font-bold" />
					</button>
				</div>
			</div>
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
							{renderCategoria('investimentos', 'Investimentos', '#ffefbd', '#fff4d0')}
							{renderCategoria('pendentesSelecao', 'Pendentes Seleção', '#e2e8f0', '#f8fafc')}

							{/* Totalizadores */}
							<tr className="bg-gray-100 font-bold border border-gray-300" style={{ borderTop: '3px solid lightgrey' }}>
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo do mês (R x D)</td>

								{calcularSaldoMes().map((valor, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										{valor}
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Financiamentos</td>
								{calcularTotais('financiamentos').map((valor, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										{valor}
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Investimentos</td>
								{calcularTotais('investimentos').map((valor, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										{valor}
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Pendências</td>
								{calcularTotais('pendentesSelecao').map((valor, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										{valor}
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo Final</td>
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

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Lucratividade</td>

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
						</tbody>
					</table>
				)}
			</div>
			<FiltroFluxoCaixaModal
				isOpen={modalPesquisaAberto}
				onClose={() => setModalPesquisaAberto(false)}
				contasDisponiveis={contasCorrentes}
				anoSelecionado={anoSelecionado}
				contasSelecionadas={contasSelecionadas}
				onAplicarFiltro={(ano, contas) => {
					setAnoSelecionado(ano);
					setContasSelecionadas(contas);
					gerarFluxo(contas).then(() => {
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
		</div>
	);
};

export default MovimentoBancarioTable;
