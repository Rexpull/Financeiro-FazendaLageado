import React, { useEffect, useState } from 'react';
import DialogModal from '../../../components/DialogModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faSearchDollar } from '@fortawesome/free-solid-svg-icons';
import { listarContas } from '../../../services/contaCorrenteService';
import FiltroFluxoCaixaModal from './FiltroFluxoCaixaModal';

const MovimentoBancarioTable: React.FC = () => {
	const [activeTab, setActiveTab] = useState<'tabela' | 'grafico'>('tabela');
	const [modalPesquisaAberto, setModalPesquisaAberto] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [expandido, setExpandido] = useState<{ [key: string]: boolean }>({
		entradas: true,
		saidas: true,
		financiamentos: true,
		investimentos: true,
	});
	const [expandidoSub, setExpandidoSub] = useState<{ [key: string]: boolean }>({
		'1': true,
		'2': true,
	});
	const [contasCorrentes, setContasCorrentes] = useState<any[]>([]);
	const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
	const [anoSelecionado, setAnoSelecionado] = useState<string>(String(new Date().getFullYear()));
	const [meses, setMeses] = useState<string[]>([]);


	useEffect(() => {
		async function buscarContas() {
			const contas = await listarContas();
			setContasCorrentes(contas);
			setContasSelecionadas(contas.map((c: any) => c.id));
		}

		buscarContas();
	}, []);

	const gerarFluxo = () => {
		const mesesDoAno = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(
			(mes) => `${mes}/${anoSelecionado}`
		);

		setMeses(mesesDoAno);
		setModalPesquisaAberto(false);
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

	const categorias = {
		entradas: {
			label: 'Receitas',
			cor: 'bg-blue-500',
			subcategorias: [
				{
					id: '1',
					descricao: 'Receitas com Vendas',
					filhos: [
						{ id: '1.1', descricao: 'Receitas com Leite' },
						{ id: '1.2', descricao: 'Receitas com Milho' },
					],
				},
			],
		},
		saidas: {
			label: 'Despesas',
			cor: 'bg-red-500',
			subcategorias: [
				{
					id: '2',
					descricao: 'Despesas com Pessoal',
					filhos: [{ id: '2.1', descricao: 'Uniformes' }],
				},
			],
		},
		financiamentos: {
			label: 'Financiamentos',
			cor: 'bg-red-500',
			subcategorias: [
				{
					descricao: '1524 - SICOOB - Ronaldo',
				},
				{
					descricao: '1523 - SICREDI - Marcus',
				},
			],
		},
		investimentos: {
			label: 'Investimentos',
			cor: 'bg-yellow-500',
			subcategorias: [
				{
					descricao: 'Receitas - Investimentos Fixos',
				},
				{
					descricao: 'Despesas - Investimentos Fixos',
				},
			],
		},
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
							<React.Fragment key={sub.id}>
								<tr className="cursor-pointer border border-gray-300 bg-gray-100">
									<td className="px-6 py-2 sticky left-0 z-10 text-left font-bold bg-gray-100" onClick={() => toggleSubcategoria(sub.id)}>
										<FontAwesomeIcon icon={expandidoSub[sub.id] ? faMinus : faPlus} className="ml-2 mr-2 text-blue-600" />
										{sub.id}. {sub.descricao}
									</td>
									{meses.map((_, idx) => (
										<td key={idx} className="text-center px-3 py-2 border border-gray-300 bg-gray-100">
											R$ 0,00
										</td>
									))}
								</tr>

								{expandidoSub[sub.id] &&
									sub.filhos.map((filho: any) => (
										<tr key={filho.id} className="bg-white border border-gray-200">
											<td className="px-10 py-1 sticky left-0 z-10 bg-white text-left">
												<div className="ml-7">
													{filho.id}. {filho.descricao}
												</div>
											</td>
											{meses.map((_, idx) => (
												<td key={idx} className="text-center px-3 py-1 border border-gray-300">
													R$ -
												</td>
											))}
										</tr>
									))}
							</React.Fragment>
						) : (
							// Caso seja financiamento ou investimento com filhos diretos
							<tr className="bg-white border border-gray-200">
								<td className="px-6 py-2 sticky left-0 z-10 bg-white text-left">
									<div className="ml-7">{sub.descricao}</div>
								</td>
								{meses.map((_, idx) => (
									<td key={idx} className="text-center px-3 py-2 border border-gray-300">
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
								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300">
										R$ 0,00
									</td>
								))}
							</tr>

							{/* Categorias dinâmicas */}
							{Object.entries(categorias).map(([key, cat]) => renderCategoria(key, cat))}

							{/* Totalizadores */}
							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo do mês (R x D)</td>

								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										R$ 0,00
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Financiamentos</td>
								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										R$ 0,00
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo de Investimentos</td>
								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										R$ 0,00
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Saldo Final</td>
								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										R$ 0,00
									</td>
								))}
							</tr>

							<tr className="bg-gray-100 font-bold border border-gray-300">
								<td className="sticky left-0 border border-gray-300 z-10 text-center bg-gray-200">Lucratividade</td>
								{meses.map((_, idx) => (
									<td key={idx} className="text-center border border-gray-300 bg-white">
										% -
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
