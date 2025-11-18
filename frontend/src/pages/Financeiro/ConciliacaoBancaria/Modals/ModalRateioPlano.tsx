import React, { useEffect, useState, useRef } from 'react';
import Modal from 'react-modal';
import { PlanoConta } from '../../../../../../backend/src/models/PlanoConta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faArrowLeft, faWarning, faSearch } from '@fortawesome/free-solid-svg-icons';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { formatarMoeda } from '../../../../Utils/formataMoeda';
import CurrencyInput from 'react-currency-input-field';
import { Resultado } from '../../../../../../backend/src/models/Resultado';
interface Rateio {
	idPlano: number;
	descricao: string;
	valor: number;
}

interface ModalRateioPlanoProps {
	isOpen: boolean;
	onClose: () => void;
	valorTotal: number;
	movimento: MovimentoBancario;
	planosDisponiveis: PlanoConta[];
	rateios: Rateio[];
	setRateios: (rateios: Rateio[]) => void;
	onConfirmar: (resultados: Resultado[] | { idPlano: number; porcentagem: number }[]) => void;
	movimentosMultiplos?: MovimentoBancario[];
}

const ModalRateioPlano: React.FC<ModalRateioPlanoProps> = ({
	isOpen,
	onClose,
	valorTotal,
	planosDisponiveis,
	movimento,
	rateios,
	setRateios,
	onConfirmar,
	movimentosMultiplos,
}) => {
	const [planoSelecionado, setPlanoSelecionado] = useState<PlanoConta | null>(null);
	const [valorParcial, setValorParcial] = useState<string>('0,00');
	const [searchPlano, setSearchPlano] = useState('');
	const [showSuggestions, setShowSuggestions] = useState(false);
	const isModoMultiplos = movimentosMultiplos && movimentosMultiplos.length > 1;
	const [tipoRateio, setTipoRateio] = useState<'valor' | 'porcentagem'>(isModoMultiplos ? 'porcentagem' : 'valor');
	const [porcentagemParcial, setPorcentagemParcial] = useState<string>('0');

	const valorNumericoParcial = Number(valorParcial.replace(/\./g, '').replace(',', '.')) || 0;
	const porcentagemNumericaParcial = Number(porcentagemParcial) || 0;

	const valorTotalAbsoluto = Math.abs(valorTotal);
	const totalRateado = rateios.reduce((acc, r) => acc + r.valor, 0);
	const valorRestante = valorTotalAbsoluto - totalRateado;

	// Calcular valor baseado na porcentagem
	const valorCalculadoPorcentagem = (porcentagemNumericaParcial / 100) * valorTotalAbsoluto;
	const valorFinalParcial = tipoRateio === 'valor' ? valorNumericoParcial : valorCalculadoPorcentagem;

	// Calcular porcentagem total dos rateios existentes
	const porcentagemTotalRateada = rateios.reduce((acc, r) => {
		const porcentagemRateio = (r.valor / valorTotalAbsoluto) * 100;
		return acc + porcentagemRateio;
	}, 0);

	// Calcular porcentagem restante
	const porcentagemRestante = 100 - porcentagemTotalRateada;

	const rateiosOriginais = useRef<Rateio[]>([]);

	// Filtrar planos baseado na busca
	const filteredPlanos = planosDisponiveis
		.filter((plano) => {
			const ehReceita = movimento.tipoMovimento === 'C';
			const hierarquiaCorreta = ehReceita ? plano.hierarquia.startsWith('001') : plano.hierarquia.startsWith('002');
			const buscaCorreta = plano.descricao.toLowerCase().includes(searchPlano.toLowerCase()) || 
								plano.hierarquia.toLowerCase().includes(searchPlano.toLowerCase());
			return plano.nivel === 3 && hierarquiaCorreta && buscaCorreta;
		})
		.slice(0, 10);

	// Funções de busca
	const handleSearchPlano = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchPlano(e.target.value);
		setShowSuggestions(true);
		setPlanoSelecionado(null);
	};

	const selectPlano = (plano: PlanoConta) => {
		setSearchPlano(plano.descricao);
		setPlanoSelecionado(plano);
		setShowSuggestions(false);
	};

	useEffect(() => {
		if (isOpen) {
			if (isModoMultiplos) {
				// Em modo múltiplos, não carregar do movimento
				setRateios([]);
				rateiosOriginais.current = [];
			} else if (movimento && (movimento.resultadoList ?? []).length > 0) {
				const convertidos: Rateio[] = (movimento.resultadoList ?? []).map((r) => {
					const plano = planosDisponiveis.find((p) => p.id === r.idPlanoContas);
					return {
						idPlano: r.idPlanoContas,
						descricao: plano?.descricao || `Plano ${r.idPlanoContas}`,
						valor: r.valor,
					};
				});
				rateiosOriginais.current = convertidos; // backup dos originais
				setRateios(convertidos); // atualiza visual
			}
		}
	}, [isOpen, isModoMultiplos]); // somente ao abrir

	// Limpar busca quando modal fechar
	useEffect(() => {
		if (!isOpen) {
			setSearchPlano('');
			setPlanoSelecionado(null);
			setShowSuggestions(false);
			setValorParcial('0,00');
			setPorcentagemParcial('0');
			setTipoRateio(isModoMultiplos ? 'porcentagem' : 'valor');
		}
	}, [isOpen, isModoMultiplos]);

	const handleCancelar = () => {
		setRateios(rateiosOriginais.current); // restaura valores
		onClose();
	};

	const handleConfirmar = () => {
		if (!podeConfirmar) return;

		if (isModoMultiplos) {
			// Retornar apenas porcentagens para múltiplos movimentos
			const rateiosPorcentagem: { idPlano: number; porcentagem: number }[] = rateios.map((r) => {
				const porcentagem = (r.valor / valorTotalAbsoluto) * 100;
				return {
					idPlano: r.idPlano,
					porcentagem: porcentagem,
				};
			});
			onConfirmar(rateiosPorcentagem);
		} else {
			// Comportamento normal para movimento único
			const novosResultados: Resultado[] = rateios.map((r) => ({
				idPlanoContas: r.idPlano,
				valor: r.valor,
				tipo: movimento.tipoMovimento ?? 'C',
				idContaCorrente: movimento.idContaCorrente,
				dtMovimento: movimento.dtMovimento,
			}));
			onConfirmar(novosResultados);
		}
	};

	const adicionarRateio = () => {
		if (planoSelecionado && valorFinalParcial > 0) {
			let valorParaAdicionar = valorFinalParcial;
			
			// Auto-correção para porcentagem: se estiver muito próximo de 100%, ajustar para o valor restante exato
			if (tipoRateio === 'porcentagem') {
				const porcentagemComNovoRateio = porcentagemTotalRateada + porcentagemNumericaParcial;
				if (porcentagemComNovoRateio >= 99.9) { // Próximo de 100%
					valorParaAdicionar = valorRestante; // Usar o valor restante exato
				}
			}
			
			// Validação para valor: não pode exceder o restante
			if (tipoRateio === 'valor' && valorParaAdicionar > valorRestante) {
				return; // Não adicionar se exceder
			}
			
			// Validação para porcentagem: não pode exceder 100%
			if (tipoRateio === 'porcentagem' && porcentagemTotalRateada + porcentagemNumericaParcial > 100) {
				return; // Não adicionar se exceder 100%
			}

			setRateios([
				...rateios,
				{
					idPlano: planoSelecionado.id,
					descricao: planoSelecionado.descricao,
					valor: valorParaAdicionar,
				},
			]);
			setPlanoSelecionado(null);
			setValorParcial('0,00');
			setPorcentagemParcial('0');
			setSearchPlano(''); // Limpar campo de busca
			setShowSuggestions(false); // Esconder sugestões
		}
	};

	const removerRateio = (index: number) => {
		const novosRateios = [...rateios];
		novosRateios.splice(index, 1);
		setRateios(novosRateios);
	};

	const podeConfirmar = tipoRateio === 'valor' 
		? totalRateado === valorTotalAbsoluto 
		: Math.abs(porcentagemTotalRateada - 100) < 0.01; // Tolerância de 0.01% para problemas de centavos

	const handlePorcentagemChange = (value: string) => {
		// Permitir apenas números e ponto decimal
		const cleanValue = value.replace(/[^0-9.]/g, '');
		
		// Validar se não excede 100%
		const numValue = parseFloat(cleanValue) || 0;
		if (numValue <= 100) {
			setPorcentagemParcial(cleanValue);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={handleCancelar}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto "
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
		>
			<div className="flex justify-between items-center bg-blue-50 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-xl font-semibold text-gray-800">
					Rateio de planos de contas - {movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'}
					{isModoMultiplos && ` (${movimentosMultiplos?.length} movimentos)`}
				</h2>
				<button onClick={handleCancelar} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="xl" />
				</button>
			</div>

			{/* Switch para tipo de rateio - oculto em modo múltiplos */}
			{!isModoMultiplos && (
				<div className="px-5 py-3 bg-gray-50 border-b">
					<div className="flex items-center justify-center gap-4">
						<span className={`text-sm font-medium ${tipoRateio === 'valor' ? 'text-blue-600' : 'text-gray-500'}`}>
							Rateio por Valor
						</span>
						<button
							type="button"
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
								tipoRateio === 'porcentagem' ? 'bg-blue-600' : 'bg-gray-200'
							}`}
							onClick={() => setTipoRateio(tipoRateio === 'valor' ? 'porcentagem' : 'valor')}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									tipoRateio === 'porcentagem' ? 'translate-x-6' : 'translate-x-1'
								}`}
							/>
						</button>
						<span className={`text-sm font-medium ${tipoRateio === 'porcentagem' ? 'text-blue-600' : 'text-gray-500'}`}>
							Rateio por Porcentagem
						</span>
					</div>
				</div>
			)}


			<div className="flex items-start gap-2 pt-3 p-5">
				<div className="w-3/4 relative">
					<label className="block text-sm font-medium text-gray-700 mb-1">Plano de Contas</label>
					<div className="relative">
						<input
							type="text"
							className="w-full p-2 border rounded pr-10"
							placeholder="Pesquisar plano de contas..."
							value={searchPlano}
							onChange={handleSearchPlano}
						disabled={!valorRestante || valorRestante <= 0}
						/>
						<FontAwesomeIcon icon={faSearch} className="absolute right-3 top-3 text-gray-400" />
					</div>
					{showSuggestions && searchPlano && (
						<ul className="absolute bg-white w-full border shadow-lg rounded mt-1 z-10 max-h-60 overflow-y-auto">
							{filteredPlanos.map((plano) => (
								<li 
									key={plano.id} 
									className="p-2 hover:bg-gray-200 text-sm cursor-pointer border-b last:border-b-0" 
									onClick={() => selectPlano(plano)}
								>
									<div className="font-medium">{plano.hierarquia}</div>
									<div className="text-gray-600">{plano.descricao}</div>
								</li>
							))}
							{filteredPlanos.length === 0 && (
								<li className="p-2 text-sm text-gray-500 text-center">
									Nenhum plano encontrado
								</li>
							)}
						</ul>
					)}
				</div>

				<div className="w-1/4">
					<label className="block text-sm font-medium text-gray-700 mb-1">
						{tipoRateio === 'valor' 
							? `Valor ${movimento.tipoMovimento === 'C' ? 'Receita' : 'Despesa'} R$`
							: 'Porcentagem %'
						}
					</label>
					<div className="flex items-center">
						{tipoRateio === 'valor' ? (
						<CurrencyInput
							name="valorParcial"
							className="w-full p-2 border rounded-l"
							placeholder="R$ 0,00"
							decimalsLimit={2}
							prefix="R$ "
							decimalSeparator=","
							groupSeparator="."
							value={valorParcial}
							onValueChange={(value) => setValorParcial(value || '0,00')}
							disabled={!planoSelecionado || valorRestante <= 0}
						/>
						) : (
							<input
								type="text"
								className="w-full p-2 border rounded-l"
								placeholder="0"
								value={porcentagemParcial}
								onChange={(e) => handlePorcentagemChange(e.target.value)}
								disabled={!planoSelecionado || porcentagemRestante <= 0}
							/>
						)}

						<button
							onClick={adicionarRateio}
							className="bg-green-500 text-white font-semibold px-4 py-2 rounded-r hover:bg-green-600"
							disabled={
								!planoSelecionado || 
								(tipoRateio === 'valor' && (valorFinalParcial <= 0 || valorFinalParcial > valorRestante)) ||
								(tipoRateio === 'porcentagem' && (porcentagemNumericaParcial <= 0 || porcentagemTotalRateada + porcentagemNumericaParcial > 100))
							}
						>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					{tipoRateio === 'valor' && valorRestante > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {formatarMoeda(valorRestante)}
						</div>
					)}
					{tipoRateio === 'porcentagem' && porcentagemRestante > 0 && (
						<div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
							<FontAwesomeIcon icon={faWarning} />
							Restante: {porcentagemRestante.toFixed(2)}%
						</div>
					)}
				</div>
			</div>

			<div className="pt-3 p-5">
				<div className="border rounded">
					<table className="w-full text-sm">
						<thead className="bg-gray-100">
							<tr>
								<th className="p-2 text-left">Plano de Conta</th>
								<th className="p-2 text-center">Valor</th>
								<th className="p-2 text-center">Porcentagem</th>
								<th className="p-2 text-right pr-2" style={{ width: '50px' }}>
									Ação
								</th>
							</tr>
						</thead>
						<tbody>
							{rateios.map((r, idx) => {
								const porcentagemRateio = (r.valor / valorTotalAbsoluto) * 100;
								return (
								<tr key={idx} className="border-t">
									<td className="p-2">{r.descricao}</td>
									<td className="p-2 text-center">{formatarMoeda(r.valor ? r.valor : 0)}</td>
										<td className="p-2 text-center">{porcentagemRateio.toFixed(2)}%</td>
									<td className="p-2 text-right pr-4" style={{ width: '50px' }}>
										<button onClick={() => removerRateio(idx)} className="text-red-500 hover:text-red-700">
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
								);
							})}
							{rateios.length === 0 && (
								<tr>
									<td colSpan={4} className="text-center text-gray-500 p-4">
										Nenhum plano adicionado.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex justify-between items-center gap-4 mt-4 p-5 border-t">
				<div className="flex justify-start gap-4 text-sm font-medium">
					<div className="flex flex-col gap-1">
					<span>Total Rateado:</span>
					<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
						R$ {formatarMoeda(totalRateado ? totalRateado : 0)} / R$ {formatarMoeda(valorTotalAbsoluto ? valorTotalAbsoluto : 0)}
					</span>
					</div>
					<div className="flex flex-col gap-1">
						<span>Porcentagem Total:</span>
						<span className={podeConfirmar ? 'text-green-600' : 'text-orange-500'}>
							{porcentagemTotalRateada.toFixed(2)}% / 100%
						</span>
					</div>
				</div>

				<div className="flex justify-end gap-3">
					<button
						onClick={handleCancelar}
						className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-200 rounded hover:bg-gray-200 font-semibold"
					>
						<FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
						Cancelar
					</button>
					<button
						onClick={handleConfirmar}
						className="px-4 py-2 bg-orange-500 text-white font-semibold rounded hover:bg-orange-600"
						disabled={!podeConfirmar}
					>
						<FontAwesomeIcon icon={faCheck} className="mr-2" />
						Confirmar Rateio
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default ModalRateioPlano;
