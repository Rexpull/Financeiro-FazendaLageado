import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faTimes,
	faPlus,
	faTrash,
	faMoneyBillWave,
	faUndo,
	faSave,
	faCalculator,
	faTriangleExclamation,
	faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { brl } from '../../../Utils/formatos';
import { formatarDataISO, hojeISO } from '../../../Utils/dataSemFuso';
import { Financiamento } from '../../../../../backend/src/models/Financiamento';
import { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import DialogModal from '../../../components/DialogModal';
import { NumericFormat } from 'react-number-format';
import { salvarParcelaFinanciamento, excluirParcelaFinanciamento } from '../../../services/parcelaFinanciamentoService';
import {
	descricaoParcela,
	descricaoParcelamento,
	mensagemEstorno,
	mensagemExcluirParcela,
	mensagemParcelasEmUso,
	mensagemRecalculo,
	parcelaEmUso,
	proximoIdTemporario,
	reabrirParcela,
	recalcularParcelasEmAberto,
	resumoParcelas,
	semIdTemporario,
	type ResultadoRecalculo,
} from './parcelaRegras';
import {
	avisoDiferencaContrato,
	descricaoHistorico,
	linhasSnapshot,
	rotuloOrigem,
	rotuloRenegociado,
	type RenegociacaoHistorico,
} from './renegociacaoRegras';
import { listarRenegociacoes } from '../../../services/financiamentoService';
import defaultIcon from '../../../assets/img/icon-Bancos/default.png';

// Importando logos dos bancos
import bancoBrasil from '../../../assets/img/icon-Bancos/banco-brasil.svg';
import santander from '../../../assets/img/icon-Bancos/santander.svg';
import caixa from '../../../assets/img/icon-Bancos/caixa.svg';
import bradesco from '../../../assets/img/icon-Bancos/bradesco.svg';
import itau from '../../../assets/img/icon-Bancos/itau.svg';
import inter from '../../../assets/img/icon-Bancos/inter.svg';
import sicredi from '../../../assets/img/icon-Bancos/sicredi.svg';
import sicoob from '../../../assets/img/icon-Bancos/sicoob.svg';
import safra from '../../../assets/img/icon-Bancos/safra.svg';
import nubank from '../../../assets/img/icon-Bancos/nubank.svg';
import original from '../../../assets/img/icon-Bancos/original.svg';
import bancoBrasilia from '../../../assets/img/icon-Bancos/banco-brasilia.svg';
import banrisul from '../../../assets/img/icon-Bancos/banrisul.svg';
import citiBank from '../../../assets/img/icon-Bancos/citi-bank.svg';
import hsbc from '../../../assets/img/icon-Bancos/hsbc.svg';
import banestes from '../../../assets/img/icon-Bancos/banestes.svg';
import bancoAmazonia from '../../../assets/img/icon-Bancos/banco-amazonia.svg';
import bancoNordeste from '../../../assets/img/icon-Bancos/banco-nordeste.svg';
import bankBoston from '../../../assets/img/icon-Bancos/bank-boston.svg';

interface Props {
	isOpen: boolean;
	/** Liquidar/Estornar are saved immediately: reload the list behind on close. */
	onClose: () => void;
	financiamento: Financiamento;
	/** Called after "Salvar" stored the edits. */
	onSave: (financiamento: Financiamento) => void;
	bancos: any[];
	pessoas: any[];
}

type RecalculoPendente = Extract<ResultadoRecalculo<ParcelaFinanciamento>, { ok: true }>;

/** What "Salvar" would store: detects unsaved edits on close. */
const assinaturaParcelas = (lista: ParcelaFinanciamento[]) =>
	JSON.stringify(lista.map((p) => [p.id, p.numParcela, Number(p.valor) || 0, p.dt_vencimento, p.status]));

const ModalParcelas: React.FC<Props> = ({ isOpen, onClose, financiamento, onSave, bancos, pessoas }) => {
	const [parcelas, setParcelas] = useState<ParcelaFinanciamento[]>([]);
	const [parcelaParaExcluir, setParcelaParaExcluir] = useState<ParcelaFinanciamento | null>(null);
	const [parcelaParaEstornar, setParcelaParaEstornar] = useState<ParcelaFinanciamento | null>(null);
	const [selectedParcela, setSelectedParcela] = useState<ParcelaFinanciamento | null>(null);
	const [liquidationModalOpen, setLiquidationModalOpen] = useState(false);
	const [liquidationDate, setLiquidationDate] = useState('');
	const [recalculoPendente, setRecalculoPendente] = useState<RecalculoPendente | null>(null);
	const [showDescartar, setShowDescartar] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [parcelasToDelete, setParcelasToDelete] = useState<number[]>([]);
	// Installments as stored in the database (updated by Liquidar/Estornar, which save immediately)
	const gravadasRef = useRef<ParcelaFinanciamento[]>([]);
	const [renegociacoes, setRenegociacoes] = useState<RenegociacaoHistorico[]>([]);

	// Renegotiation history (aditivos, novo contrato, or where this contract came from)
	const temHistorico = (financiamento.qtdRenegociacoes ?? 0) > 0 || financiamento.idFinanciamentoOrigem != null;
	useEffect(() => {
		setRenegociacoes([]);
		if (!isOpen || !temHistorico) return;
		let ativo = true;
		listarRenegociacoes(financiamento.id)
			.then((lista) => {
				if (ativo) setRenegociacoes(lista);
			})
			.catch((error) => console.error('Erro ao carregar renegociações:', error));
		return () => {
			ativo = false;
		};
	}, [isOpen, financiamento.id, temHistorico]);

	useEffect(() => {
		if (isOpen && financiamento.parcelasList) {
			const copia = financiamento.parcelasList.map((p) => ({ ...p }));
			setParcelas(copia);
			gravadasRef.current = copia;
			setParcelasToDelete([]);
			setRecalculoPendente(null);
			setShowDescartar(false);
		}
	}, [isOpen, financiamento]);

	const getBancoLogo = (codigo: string) => {
		const BancoLogos: { [key: string]: string } = {
			'001': bancoBrasil,
			'033': santander,
			'104': caixa,
			'237': bradesco,
			'341': itau,
			'077': inter,
			'748': sicredi,
			'756': sicoob,
			'422': safra,
			'260': nubank,
			'212': original,
			'070': bancoBrasilia,
			'389': banrisul,
			'745': citiBank,
			'399': hsbc,
			'021': banestes,
			'085': bancoAmazonia,
			'003': bancoNordeste,
			'318': bankBoston,
		};
		return BancoLogos[codigo] || defaultIcon;
	};

	const getBancoNome = (idBanco: number | null) => {
		const banco = bancos.find((b) => b.id === idBanco);
		return banco?.nome || 'Banco não encontrado';
	};

	const getPessoaNome = (idPessoa: number | null | undefined) => {
		const pessoa = pessoas.find((p) => p.id === idPessoa);
		return pessoa?.nome || 'Pessoa não encontrada';
	};

	/** Liquidar/Estornar saved this row: it is now the stored version too. */
	const marcarGravada = (parcela: ParcelaFinanciamento) => {
		setParcelas((lista) => lista.map((p) => (p.id === parcela.id ? parcela : p)));
		gravadasRef.current = gravadasRef.current.map((p) => (p.id === parcela.id ? parcela : p));
	};

	const handleAddParcela = () => {
		const novaParcela: ParcelaFinanciamento = {
			// Unique negative id per unsaved row (rows are keyed/edited/deleted by id); becomes 0 on save
			id: proximoIdTemporario(parcelas),
			idFinanciamento: financiamento.id,
			status: 'Aberto',
			numParcela: parcelas.length + 1,
			valor: 0,
			dt_vencimento: hojeISO(),
			dt_lancamento: hojeISO(),
			dt_liquidacao: null,
			idMovimentoBancario: null,
		};
		setParcelas([...parcelas, novaParcela]);
	};

	const handleDeleteParcela = (parcela: ParcelaFinanciamento) => {
		if (parcela.id > 0 && parcelaEmUso(parcela)) {
			toast.error(mensagemParcelasEmUso([parcela]));
			return;
		}
		setParcelaParaExcluir(parcela);
	};

	const handleDeleteConfirm = async () => {
		const alvo = parcelaParaExcluir;
		if (!alvo) return;
		if (alvo.id > 0) {
			setParcelasToDelete((ids) => [...ids, alvo.id]);
		}
		setParcelas((lista) => lista.filter((p) => p.id !== alvo.id));
		setParcelaParaExcluir(null);
	};

	const handleRecalcularParcelas = () => {
		// Same base as "Gerar parcelas": valor contratado + juros, minus what is already liquidated
		const resultado = recalcularParcelasEmAberto(parcelas, financiamento);
		if (!resultado.ok) {
			toast.warning(resultado.erro);
			return;
		}
		setRecalculoPendente(resultado);
	};

	const confirmarRecalculo = async () => {
		if (!recalculoPendente) return;
		setParcelas(recalculoPendente.parcelas);
		setRecalculoPendente(null);
		toast.success('Parcelas recalculadas. Clique em Salvar para gravar.');
	};

	const validarParcelas = () => {
		const semData = parcelas.some((p) => !p.dt_vencimento);
		const semValor = parcelas.some((p) => p.status !== 'Liquidado' && !(Number(p.valor) >= 0.01));
		if (semData || semValor) {
			toast.error('Todas as parcelas em aberto devem ter valor (mínimo R$ 0,01) e data de vencimento.');
			return false;
		}
		// The sum may differ from the contract value (installments include interest): only a warning in the header
		return true;
	};

	const handleSave = async () => {
		if (!validarParcelas()) return;
		setIsLoading(true);
		// local copies: on a failure, the rows already created keep their real id (no duplicate on retry)
		const atual = parcelas.map((p) => ({ ...p }));
		let pendentesExclusao = [...parcelasToDelete];
		try {
			for (let i = 0; i < atual.length; i++) {
				const p = atual[i];
				const resposta = await salvarParcelaFinanciamento({
					...semIdTemporario(p),
					valor: Number(p.valor),
					dt_liquidacao: p.dt_liquidacao || null,
					idMovimentoBancario: p.idMovimentoBancario || null,
					idFinanciamento: financiamento.id,
				});
				const novoId = Number((resposta as { id?: number } | null)?.id) || 0;
				if (!(p.id > 0) && novoId > 0) {
					atual[i] = { ...p, id: novoId };
				}
			}

			for (const id of parcelasToDelete) {
				await excluirParcelaFinanciamento(id);
				pendentesExclusao = pendentesExclusao.filter((x) => x !== id);
			}

			toast.success('Parcelas salvas com sucesso!');
			onClose();
			onSave(financiamento);
		} catch (error) {
			console.error('Erro ao salvar parcelas:', error);
			setParcelas(atual);
			setParcelasToDelete(pendentesExclusao);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao salvar parcelas');
		} finally {
			setIsLoading(false);
		}
	};

	const abrirLiquidacao = (parcela: ParcelaFinanciamento) => {
		setSelectedParcela(parcela);
		setLiquidationDate(hojeISO());
		setLiquidationModalOpen(true);
	};

	const fecharLiquidacao = () => {
		setLiquidationModalOpen(false);
		setSelectedParcela(null);
		setLiquidationDate('');
	};

	// Throwing keeps the dialog open (DialogModal only closes when onConfirm resolves)
	const handleLiquidarParcela = async () => {
		if (!selectedParcela) return;
		if (!liquidationDate) {
			toast.warning('Informe a data de liquidação.');
			throw new Error('Data de liquidação não informada');
		}
		if (!(selectedParcela.id > 0)) {
			// Liquidating an unsaved row would create it now and again on "Salvar" (duplicate installment)
			toast.warning('Salve as parcelas antes de liquidar uma parcela nova.');
			return;
		}

		const parcelaAtualizada = {
			...selectedParcela,
			status: 'Liquidado' as const,
			dt_liquidacao: liquidationDate,
		};
		try {
			await salvarParcelaFinanciamento(parcelaAtualizada);
		} catch (error) {
			console.error('Erro ao liquidar parcela:', error);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao liquidar parcela');
			throw error;
		}
		marcarGravada(parcelaAtualizada);
		fecharLiquidacao();
		toast.success('Parcela liquidada com sucesso!');
	};

	const handleEstornarParcela = async () => {
		const parcela = parcelaParaEstornar;
		if (!parcela) return;
		// Back to Vencido/Aberto, without liquidation date and unlinked from the paying movement
		const parcelaAtualizada = reabrirParcela(parcela);
		try {
			await salvarParcelaFinanciamento(parcelaAtualizada);
		} catch (error) {
			console.error('Erro ao estornar parcela:', error);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao estornar parcela');
			throw error;
		}
		marcarGravada(parcelaAtualizada);
		setParcelaParaEstornar(null);
		toast.success('Parcela estornada com sucesso!');
	};

	const temAlteracoes = parcelasToDelete.length > 0 || assinaturaParcelas(parcelas) !== assinaturaParcelas(gravadasRef.current);

	const fecharDeVez = () => {
		setParcelasToDelete([]);
		setParcelas([]);
		setSelectedParcela(null);
		setLiquidationDate('');
		setParcelaParaExcluir(null);
		setParcelaParaEstornar(null);
		setRecalculoPendente(null);
		setLiquidationModalOpen(false);
		setShowDescartar(false);
		onClose();
	};

	/** Esc, X and Fechar: ask before discarding edits that were not saved. */
	const handleClose = () => {
		if (isLoading) return;
		if (temAlteracoes) {
			setShowDescartar(true);
			return;
		}
		fecharDeVez();
	};

	const resumo = resumoParcelas(financiamento, parcelas);
	const avisoDiferenca = avisoDiferencaContrato(financiamento, resumo);
	const badgeRenegociado = rotuloRenegociado(financiamento);
	const badgeOrigem = rotuloOrigem(financiamento);

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={handleClose}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-[1000px] mx-auto max-h-[90vh] flex flex-col overflow-hidden"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-150 p-4"
				contentLabel="Gerenciar parcelas"
			>
				<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b shrink-0">
					<div className="flex items-center gap-3">
						{financiamento.idBanco ? (
							<img
								src={getBancoLogo(bancos.find((b) => b.id === financiamento.idBanco)?.codigo || '')}
								alt="Banco"
								className="w-12 h-12 object-contain"
							/>
						) : financiamento.idPessoa ? (
							<div className="bg-orange-300 w-12 h-12 flex items-center justify-center text-xl font-bold rounded-full">
								{getPessoaNome(financiamento.idPessoa)[0].toUpperCase()}
							</div>
						) : (
							<img src={defaultIcon} alt="Default" className="w-12 h-12 object-contain" />
						)}
						<div>
							<h2 className="text-xl font-semibold text-gray-800">
								Gerenciar Parcelas - {financiamento.numeroContrato}
							</h2>
							<p className="text-sm text-gray-600">
								{financiamento.idBanco ? getBancoNome(financiamento.idBanco) : getPessoaNome(financiamento.idPessoa)}
							</p>
						</div>
					</div>
					<button onClick={handleClose} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</button>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
					<p className="mb-4 flex items-start gap-2 text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded p-2">
						<FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
						<span>Liquidar e estornar são gravados na hora; as demais alterações só ao clicar em Salvar.</span>
					</p>

					{/* Resumo do Contrato */}
					<div className="bg-gray-50 p-4 rounded-lg mb-4">
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<div>
								<p className="text-sm text-gray-600">Valor contratado</p>
								<p className="font-semibold text-lg text-primary">{brl(resumo.contratado)}</p>
								{resumo.juros > 0 && <p className="text-xs text-gray-500">+ {brl(resumo.juros)} de juros</p>}
							</div>
							<div>
								<p className="text-sm text-gray-600">Parcelas (soma)</p>
								<p className="font-semibold text-lg">{brl(resumo.somaParcelas)}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Pago</p>
								<p className="font-semibold text-lg text-green-700">{brl(resumo.pago)}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Em aberto ({resumo.qtdEmAberto})</p>
								<p className="font-semibold text-lg text-red-700">{brl(resumo.emAberto)}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Responsável</p>
								<p className="font-semibold">{financiamento.responsavel}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Data do Contrato</p>
								<p className="font-semibold">{formatarDataISO(financiamento.dataContrato)}</p>
							</div>
							<div>
								<p className="text-sm text-gray-600">Parcelamento</p>
								<p className="font-semibold">{descricaoParcelamento(parcelas)}</p>
							</div>
						</div>
						{avisoDiferenca && (
							<p className="mt-3 text-xs text-amber-700 flex items-start gap-2">
								<FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
								<span>{avisoDiferenca}</span>
							</p>
						)}
					</div>

					{(badgeRenegociado || badgeOrigem || renegociacoes.length > 0) && (
						<div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
							<h3 className="font-semibold text-purple-900 flex flex-wrap items-center gap-2">
								Renegociações
								{badgeRenegociado && <span className="px-2 py-0.5 rounded text-xs bg-purple-200 text-purple-900">{badgeRenegociado}</span>}
								{badgeOrigem && <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">{badgeOrigem}</span>}
							</h3>
							<ul className="mt-2 space-y-3 text-sm">
								{renegociacoes.map((h) => {
									const { titulo, detalhe } = descricaoHistorico(h, financiamento.id);
									const removidas = linhasSnapshot(h);
									return (
										<li key={h.id}>
											<p className="font-semibold text-gray-800">{titulo}</p>
											<p className="text-gray-700">{detalhe}</p>
											{h.observacao && <p className="text-gray-600 italic">{h.observacao}</p>}
											{removidas.length > 0 && (
												<details className="mt-1 text-xs text-gray-600">
													<summary className="cursor-pointer">Parcelas que estavam em aberto antes</summary>
													<ul className="ml-4 list-disc">
														{removidas.map((linha, i) => (
															<li key={i}>{linha}</li>
														))}
													</ul>
												</details>
											)}
										</li>
									);
								})}
							</ul>
						</div>
					)}

					{/* Lista de Parcelas */}
					<div className="mb-4 flex flex-wrap gap-2 justify-between items-center border-t border-gray-200 pt-4">
						<h3 className="text-lg font-semibold">Parcelas</h3>
						<div className="flex gap-2">
							<button
								onClick={handleRecalcularParcelas}
								className=" hover:bg-gray-100 font-semibold text-gray-800 px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors"
								title="Divide (valor contratado + juros − já pago) entre as parcelas em aberto"
							>
								<FontAwesomeIcon icon={faCalculator} />
								<span>Recalcular Parcelas</span>
							</button>
							<button
								onClick={handleAddParcela}
								className="bg-blue-400 hover:bg-blue-500 font-semibold text-white px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors"
							>
								<FontAwesomeIcon icon={faPlus} />
								<span>Nova Parcela</span>
							</button>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50">
								<tr>
									<th className="p-2 text-left">Parcela</th>
									<th className="p-2 text-left">Vencimento</th>
									<th className="p-2 text-left">Valor</th>
									<th className="p-2 text-left">Status</th>
									<th className="p-2 text-left">Data Liquidação</th>
									<th className="p-2 text-right">Ações</th>
								</tr>
							</thead>
							<tbody>
								{parcelas.map((parcela) => (
									<tr key={parcela.id} className="border-t">
										<td className="p-2">{parcela.numParcela}</td>
										<td className="p-2">
											<input
												type="date"
												aria-label={`Vencimento da parcela ${parcela.numParcela}`}
												value={parcela.dt_vencimento}
												onChange={(e) => {
													const novasParcelas = parcelas.map((p) =>
														p.id === parcela.id ? { ...p, dt_vencimento: e.target.value } : p,
													);
													setParcelas(novasParcelas);
												}}
												className={`border p-1 rounded ${parcela.status === 'Liquidado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
												disabled={parcela.status === 'Liquidado'}
											/>
										</td>
										<td className="p-2">
											<NumericFormat
												aria-label={`Valor da parcela ${parcela.numParcela}`}
												className={`w-full p-1 border border-gray-300 rounded ${parcela.status === 'Liquidado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
												value={parcela.valor}
												prefix="R$ "
												decimalSeparator=","
												thousandSeparator="."
												fixedDecimalScale
												decimalScale={2}
												onValueChange={(values) => {
													const { floatValue } = values;
													const novasParcelas = parcelas.map((p) =>
														p.id === parcela.id ? { ...p, valor: floatValue || 0 } : p,
													);
													setParcelas(novasParcelas);
												}}
												disabled={parcela.status === 'Liquidado'}
											/>
										</td>
										<td className="p-2">
											<span
												className={`px-2 py-1 rounded font-semibold text-sm ${
													parcela.status === 'Liquidado'
														? 'bg-green-100 text-green-800'
														: parcela.status === 'Vencido'
														? 'bg-red-100 text-red-800'
														: 'bg-yellow-100 text-yellow-800'
												}`}
											>
												{parcela.status}
											</span>
										</td>
										<td className="p-2">
											{parcela.status === 'Liquidado' ? (
												<span className="text-sm text-gray-600">{formatarDataISO(parcela.dt_liquidacao)}</span>
											) : (
												<span className="text-sm text-gray-400">-</span>
											)}
										</td>
										<td className="p-2 text-right">
											<div className="flex justify-end gap-4">
												{parcela.status === 'Liquidado' ? (
													<button
														onClick={() => setParcelaParaEstornar(parcela)}
														className="bg-orange-400 hover:bg-yellow-500 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
														title="Estornar a liquidação"
														aria-label={`Estornar a liquidação da parcela ${parcela.numParcela}`}
													>
														<FontAwesomeIcon icon={faUndo} />
													</button>
												) : (
													<button
														onClick={() => abrirLiquidacao(parcela)}
														className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors"
														title="Liquidar parcela"
														aria-label={`Liquidar a parcela ${parcela.numParcela}`}
													>
														<FontAwesomeIcon icon={faMoneyBillWave} />
													</button>
												)}
												<button
													onClick={() => handleDeleteParcela(parcela)}
													className={`text-red-600 hover:text-red-800 ${parcela.status === 'Liquidado' ? 'opacity-50 cursor-not-allowed' : ''}`}
													title={parcela.status === 'Liquidado' ? 'Parcela liquidada não pode ser excluída' : 'Excluir parcela'}
													aria-label={`Excluir a parcela ${parcela.numParcela}`}
													disabled={parcela.status === 'Liquidado'}
												>
													<FontAwesomeIcon icon={faTrash} />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				<div className="shrink-0 flex flex-wrap justify-end items-center gap-3 border-t border-gray-300 px-4 sm:px-6 py-4">
					{temAlteracoes && <span className="mr-auto text-sm text-amber-700">Há alterações não salvas.</span>}
					<button
						onClick={handleClose}
						className="text-gray-600 font-semibold hover:bg-gray-200 px-4 py-2 rounded"
						disabled={isLoading}
					>
						Fechar
					</button>
					<button
						onClick={handleSave}
						className="bg-primary hover:bg-orange-600 font-semibold text-white px-4 py-2 rounded flex items-center"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<span className="animate-spin mr-2">⏳</span>
								Salvando...
							</>
						) : (
							<>
								Salvar <FontAwesomeIcon icon={faSave} className="ml-2" />
							</>
						)}
					</button>
				</div>
			</Modal>

			{/* Modal de Confirmação de Exclusão */}
			<DialogModal
				isOpen={parcelaParaExcluir != null}
				onClose={() => setParcelaParaExcluir(null)}
				onConfirm={handleDeleteConfirm}
				title="Excluir parcela?"
				type="warn"
				message={parcelaParaExcluir ? mensagemExcluirParcela(parcelaParaExcluir) : ''}
				confirmLabel="Excluir"
				cancelLabel="Cancelar"
			/>

			{/* Confirmação de Estorno */}
			<DialogModal
				isOpen={parcelaParaEstornar != null}
				onClose={() => setParcelaParaEstornar(null)}
				onConfirm={handleEstornarParcela}
				title="Estornar a liquidação?"
				type="warn"
				message={parcelaParaEstornar ? `${mensagemEstorno(parcelaParaEstornar)}\n\nO estorno é gravado na hora.` : ''}
				confirmLabel="Estornar"
				cancelLabel="Cancelar"
			/>

			{/* Confirmação do Recalcular */}
			<DialogModal
				isOpen={recalculoPendente != null}
				onClose={() => setRecalculoPendente(null)}
				onConfirm={confirmarRecalculo}
				title="Recalcular as parcelas em aberto?"
				type="warn"
				message={recalculoPendente ? mensagemRecalculo(recalculoPendente) : ''}
				confirmLabel="Recalcular"
				cancelLabel="Cancelar"
			/>

			{/* Descartar alterações ao fechar */}
			<DialogModal
				isOpen={showDescartar}
				onClose={() => setShowDescartar(false)}
				onConfirm={async () => fecharDeVez()}
				title="Descartar alterações?"
				type="warn"
				message="As alterações nas parcelas ainda não foram salvas (liquidações e estornos já estão gravados). Sair e descartar essas alterações?"
				confirmLabel="Sair sem salvar"
				cancelLabel="Continuar editando"
			/>

			{/* Modal de Liquidação */}
			<DialogModal
				isOpen={liquidationModalOpen}
				onClose={fecharLiquidacao}
				onConfirm={handleLiquidarParcela}
				title="Liquidar Parcela"
				type="info"
				message={
					<div className="space-y-3 text-left">
						{selectedParcela && <p className="font-medium">{descricaoParcela(selectedParcela, parcelas.length)}</p>}
						<label htmlFor="mp-data-liquidacao" className="block text-sm">
							Data da liquidação (pagamento)
						</label>
						<input
							id="mp-data-liquidacao"
							type="date"
							value={liquidationDate}
							onChange={(e) => setLiquidationDate(e.target.value)}
							className="w-full p-2 border rounded"
						/>
						{!liquidationDate && <p className="text-red-600 text-xs">Informe a data de liquidação.</p>}
						<p className="text-xs text-gray-500">A liquidação é gravada na hora.</p>
					</div>
				}
				confirmLabel="Liquidar"
				cancelLabel="Cancelar"
			/>
		</>
	);
};

export default ModalParcelas;
