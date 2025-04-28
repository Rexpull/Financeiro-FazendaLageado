import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faSearchDollar } from '@fortawesome/free-solid-svg-icons';
import { listarContas } from '../../../services/contaCorrenteService';
import FiltroFluxoCaixaModal from './FiltroFluxoCaixaModal';
import { buscarFluxoCaixa } from '../../../services/fluxoCaixaService';
import { FluxoCaixaMes } from '../../../../../backend/src/models/FluxoCaixaDTO';
import { formatarMoeda, formatarMoedaOuTraco, parseMoeda } from '../../../Utils/formataMoeda';

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
	const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
	const [anoSelecionado, setAnoSelecionado] = useState<string>(String(new Date().getFullYear()));
	const [meses, setMeses] = useState<string[]>([]);
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
			setContasSelecionadas(contas.map((c: any) => c.id));
		}

		buscarContas();
	}, []);

	const gerarFluxo = async () => {
		try {
			setIsLoading(false);
			const dados = await buscarFluxoCaixa(anoSelecionado, contasSelecionadas);
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
				filhos: Object.entries(filhos).map(([idFilho, _]) => ({
					id: idFilho,
					descricao: `Plano ${idFilho}`,
				})),
			}));

			const subSaidas = Object.entries(despesas).map(([id, { descricao, filhos }]) => ({
				id,
				descricao,
				filhos: Object.entries(filhos).map(([idFilho, _]) => ({
					id: idFilho,
					descricao: `Plano ${idFilho}`,
				})),
			}));

			const subFinanciamentos = Object.keys(dados[0]?.financiamentos || {}).map((idConta) => ({
				id: idConta,
				descricao: `Conta ${idConta}`,
				filhos: [],
			}));
			
			const subInvestimentos = Object.keys(dados[0]?.investimentos || {}).map((idPlano) => ({
				id: idPlano,
				descricao: `Plano ${idPlano}`,
				filhos: [],
			}));

			const subPendentes = Object.keys(dados[0]?.pendentesSelecao || {}).map((idConta) => ({
				id: idConta,
				descricao: `Conta ${idConta}`,
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
		setExpandido({ entradas: true, saidas: true, financiamentos: true, investimentos: true });
		setExpandidoSub(novasSubs);
	};

	const recolherTodos = () => {
		const novasSubs: any = {};
		Object.values(categorias).forEach((cat) => cat.subcategorias.forEach((sub) => (novasSubs[sub.id] = false)));
		setExpandido({ entradas: false, saidas: false, financiamentos: false, investimentos: false });
		setExpandidoSub(novasSubs);
	};

	const calcularTotais = (tipo: keyof FluxoCaixaMes): string[] => {
		return dadosFluxo.map((mes) => {
			if (tipo === 'financiamentos' || tipo === 'investimentos' || tipo === 'pendentesSelecao') {
				const soma = Object.values(mes[tipo] ?? {}).reduce((a, b) => a + b, 0);
				return 'R$ ' + formatarMoedaOuTraco(soma);
			}
			let total = 0;
			Object.values(mes[tipo] ?? {}).forEach((subcat: any) => {
				total += Object.values(subcat.filhos ?? {}).reduce((a: number, b: number) => a + b, 0);
			});
			return 'R$ ' + formatarMoedaOuTraco(total);
		});
	};

	const calcularSaldoMes = (): string[] => {
		return dadosFluxo.map((mes) => {
			const receita = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: number) => a + b, 0);
			}, 0);
			const despesa = Object.values(mes.despesas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: number) => a + b, 0);
			}, 0);

			return 'R$ ' + formatarMoeda(receita - despesa);
		});
	};

	const calcularLucro = (): string[] => {
		return dadosFluxo.map((mes) => {
			const receita = Object.values(mes.receitas ?? {}).reduce((acc, subcat: any) => {
				return acc + Object.values(subcat.filhos).reduce((a: number, b: number) => a + b, 0);
			}, 0);
			const investimento = Object.values(mes.investimentos ?? {}).reduce((a, b) => a + b, 0);
			if (investimento === 0) return '% -';
			const lucro = (receita / investimento) * 100;
			return `% ${lucro.toFixed(1)}`;
		});
	};

	const buscarValorFilho = (tipo: keyof FluxoCaixaMes, planoId: string): string[] => {
		return dadosFluxo.map((mes) => {
			let valor = 0;
			Object.values(mes[tipo] ?? {}).forEach((subcat: any) => {
				if (subcat.filhos?.[planoId]) {
					valor += subcat.filhos[planoId];
				}
			});
			return 'R$ ' + formatarMoedaOuTraco(valor);
		});
	};

	// const categorias = {
	// 	entradas: {
	// 		label: 'Receitas',
	// 		cor: 'bg-blue-500',
	// 		subcategorias: [
	// 			{
	// 				id: '1',
	// 				descricao: 'Receitas com Vendas',
	// 				filhos: [
	// 					{ id: '1.1', descricao: 'Receitas com Leite' },
	// 					{ id: '1.2', descricao: 'Receitas com Milho' },
	// 				],
	// 			},
	// 		],
	// 	},
	// 	saidas: {
	// 		label: 'Despesas',
	// 		cor: 'bg-red-500',
	// 		subcategorias: [
	// 			{
	// 				id: '2',
	// 				descricao: 'Despesas com Pessoal',
	// 				filhos: [{ id: '2.1', descricao: 'Uniformes' }],
	// 			},
	// 		],
	// 	},
	// 	financiamentos: {
	// 		label: 'Financiamentos',
	// 		cor: 'bg-red-500',
	// 		subcategorias: [
	// 			{
	// 				descricao: '1524 - SICOOB - Ronaldo',
	// 			},
	// 			{
	// 				descricao: '1523 - SICREDI - Marcus',
	// 			},
	// 		],
	// 	},
	// 	investimentos: {
	// 		label: 'Investimentos',
	// 		cor: 'bg-yellow-500',
	// 		subcategorias: [
	// 			{
	// 				descricao: 'Receitas - Investimentos Fixos',
	// 			},
	// 			{
	// 				descricao: 'Despesas - Investimentos Fixos',
	// 			},
	// 		],
	// 	},
	// };

	// Move this function above the line where it is used
	const gerarCategoriasDinamicas = (): any => {
		if (!dadosFluxo.length) return {};

		const receitas = dadosFluxo[0].receitas || {};
		const despesas = dadosFluxo[0].despesas || {};

		const entradas = {
			label: 'Receitas',
			cor: 'bg-blue-500',
			subcategorias: Object.entries(receitas).map(([id, { descricao, filhos }]) => ({
				id,
				descricao,
				filhos: Object.entries(filhos).map(([idFilho, _]) => ({
					id: idFilho,
					descricao: `Plano ${idFilho}`,
				})),
			})),
		};

		const saidas = {
			label: 'Despesas',
			cor: 'bg-red-500',
			subcategorias: Object.entries(despesas).map(([id, { descricao, filhos }]) => ({
				id,
				descricao,
				filhos: Object.entries(filhos).map(([idFilho, _]) => ({
					id: idFilho,
					descricao: `Plano ${idFilho}`,
				})),
			})),
		};

		const financiamentos = {
			label: 'Financiamentos',
			cor: 'bg-red-500',
			subcategorias: Object.keys(dadosFluxo[0].financiamentos).map((idConta) => ({
				descricao: `Conta ${idConta}`,
			})),
		};

		const investimentos = {
			label: 'Investimentos',
			cor: 'bg-yellow-500',
			subcategorias: Object.keys(dadosFluxo[0].investimentos).map((idPlano) => ({
				descricao: `Plano ${idPlano}`,
			})),
		};

		return { entradas, saidas, financiamentos, investimentos };
	};

	const renderCategoria = (key: keyof typeof categorias, categoria: any) => {
		const isReceita = key === 'entradas';
		const isDespesa = key === 'saidas';
		const isFinanciamento = key === 'financiamentos';
		const isInvestimento = key === 'investimentos';

		const bgCategoria = isReceita
			? '#82b4ff'
			: isDespesa
			? '#ffbe82'
			: isFinanciamento
			? '#ffc0c0'
			: isInvestimento
			? '#ffefbd'
			: '#e2e8f0';

		const bgCategoriaValor = isReceita
			? '#c7eafe'
			: isDespesa
			? '#ffe6bc'
			: isFinanciamento
			? '#fce1e3'
			: isInvestimento
			? '#fff4d0'
			: '#f8fafc';

		return (
			<>
				{/* Linha da categoria */}
				<tr className="font-bold border border-gray-300">
					<td
						className="px-3 py-2 sticky left-0 z-10 text-left cursor-pointer"
						style={{ backgroundColor: bgCategoria }}
						onClick={() => toggleCategoria(key)}
					>
						<FontAwesomeIcon icon={expandido[key] ? faMinus : faPlus} className="mr-2 text-blue-600" />
						{categoria.label}
					</td>
					{meses.map((_, idx) => (
						<td key={idx} className="text-center px-3 py-2 border border-gray-300" style={{ backgroundColor: bgCategoriaValor }}>
							R$ 0,00
						</td>
					))}
				</tr>

				{/* Subcategorias e filhos */}
				{expandido[key] &&
					Array.isArray(categoria.subcategorias) &&
					categoria.subcategorias.map((sub: any) =>
						sub.filhos ? (
							<React.Fragment key={`sub-${key}-${sub.id}`}>
								<tr className="cursor-pointer border border-gray-300 bg-gray-100">
									<td className="px-6 py-2 sticky left-0 z-10 text-left font-bold bg-gray-100" onClick={() => toggleSubcategoria(sub.id)}>
										<FontAwesomeIcon icon={expandidoSub[sub.id] ? faMinus : faPlus} className="ml-2 mr-2 text-blue-600" />
										{sub.id}. {sub.descricao}
									</td>
									{meses.map((_, idx) => (
										<td key={`head-${sub.id}-${idx}`} className="text-center px-3 py-2 border border-gray-300 bg-gray-100">
											R$ 0,00
										</td>
									))}
								</tr>
								{/* Filhos da subcategoria */}

								{expandidoSub[sub.id] &&
									sub.filhos.map((filho: any) => {
										const valores = buscarValorFilho(key, filho.id);
										return (
											<tr key={`filho-${key}-${sub.id}-${filho.id}`} className="bg-white border border-gray-200">
												<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
													<div className="ml-7">
														{filho.id}. {filho.descricao}
													</div>
												</td>
												{valores.map((valor, idx) => (
													<td key={`valor-${filho.id}-${idx}`} className="text-center px-3 py-1 border border-gray-300">
														{valor}
													</td>
												))}
											</tr>
										);
									})}
							</React.Fragment>
						) : (
							<tr key={`subdireto-${key}-${sub.descricao}`} className="bg-white border border-gray-200">
								<td className="px-6 py-2 sticky left-0 z-10 bg-white text-left">
									<div className="ml-7">{sub.descricao}</div>
								</td>
								{meses.map((_, idx) => (
									<td key={`direto-${sub.descricao}-${idx}`} className="text-center px-3 py-2 border border-gray-300">
										R$ -
									</td>
								))}
							</tr>
						)
					)}
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
			<div className="bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto">
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
							{Object.entries(categorias).map(([key, cat]) => renderCategoria(key, cat))}

							{/* Totalizadores */}
							<tr className="bg-gray-100 font-bold border border-gray-300">
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
								{calcularTotais('receitas').map((_, idx) => {
									const saldo = calcularSaldoMes()[idx];
									const fin = calcularTotais('financiamentos')
										[idx].replace(/[^\d,-]+/g, '')
										.replace(',', '.');
									const inv = calcularTotais('investimentos')
										[idx].replace(/[^\d,-]+/g, '')
										.replace(',', '.');
									const total = parseMoeda(saldo) + parseMoeda(fin) + parseMoeda(inv);

									return (
										<td key={idx} className="text-center border border-gray-300 bg-white">
											{'R$ ' + formatarMoeda(total)}
										</td>
									);
								})}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Lucratividade</td>
								{calcularLucro().map((valor, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										{valor}
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
					gerarFluxo();
				}}
			/>
		</div>
	);
};

export default MovimentoBancarioTable;
