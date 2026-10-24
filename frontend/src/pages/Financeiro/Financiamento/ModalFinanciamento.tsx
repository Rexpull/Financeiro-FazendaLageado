import React, { useState, useEffect, useRef } from 'react';
import CurrencyInput from 'react-currency-input-field';
import { Financiamento } from '../../../../../backend/src/models/Financiamento';
import { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faSave, faTimes, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { salvarFinanciamento } from '../../../services/financiamentoService';
import {
	excluirParcelaFinanciamento,
	salvarParcelaFinanciamento,
} from '../../../services/financiamentoParcelasService';

import { Banco } from '../../../../../backend/src/models/Banco';
import { gerarDatasVencimento } from '../../../Utils/parcelamento';
import { hojeISO } from '../../../Utils/dataSemFuso';
import { brl } from '../../../Utils/formatos';
import {
	avisoDiferencaParcelas,
	erroQuantidadeParcelas,
	mensagemParcelasEmUso,
	parcelasRemovidasEmUso,
	periodicidadeParcelas,
	resumoParcelas,
	valoresDasParcelas,
} from './parcelaRegras';
import { ErroSalvamentoParcial, salvarContratoComParcelas, type EstadoSalvamento } from './salvarContrato';
import { Pessoa } from '../../../../../backend/src/models/Pessoa';
import DialogModal from '../../../components/DialogModal';

interface Props {
	/** `gravacaoIncompleta`: the user left after a partial save (contract created, some installments missing). */
	onClose: (gravacaoIncompleta?: boolean) => void;
	/** Called once, after the contract and its installments were saved (receives the saved contract, with id). */
	onSave: (data: Financiamento) => void;
	isOpen: boolean;
	bancos: Banco[];
	pessoas: Pessoa[];
	/** Contract to edit (with id) or pre-filled data for a new one (without id). */
	financiamentoData?: Financiamento | null;
}

type TipoParcelamento = 'mensal' | 'trimestral' | 'semestral' | 'anual';
const INTERVALO_MESES: Record<TipoParcelamento, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const TIPO_DA_PERIODICIDADE = { Mensal: 'mensal', Trimestral: 'trimestral', Semestral: 'semestral', Anual: 'anual' } as const;

type FormFinanciamento = Partial<
	Omit<Financiamento, 'valor' | 'taxaJurosAnual' | 'totalJuros'> & {
		valor?: string;
		taxaJurosAnual?: string;
		totalJuros?: string;
	}
>;

/** CurrencyInput text ('1.234,56' / '1234,56') → number; empty/invalid → 0. */
const lerValor = (s: string | number | null | undefined) => {
	const n = parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
};

const CAMPOS_TEXTO = [
	'responsavel',
	'dataContrato',
	'numeroContrato',
	'idBanco',
	'idPessoa',
	'modalidade',
	'nomeModalidadeParticular',
	'numeroGarantia',
	'observacao',
] as const;

/** Normalized snapshot of what the user can change: detects unsaved edits (Esc / X / Cancelar). */
const assinatura = (f: FormFinanciamento) =>
	JSON.stringify({
		campos: CAMPOS_TEXTO.map((c) => (f[c] === '' || f[c] == null ? null : f[c])),
		valor: lerValor(f.valor),
		totalJuros: lerValor(f.totalJuros),
		taxa: String(f.taxaJurosAnual ?? '').trim(),
		parcelas: (f.parcelasList ?? []).map((p) => [p.id, p.numParcela, Number(p.valor) || 0, p.dt_vencimento]),
	});

const ModalFinanciamento: React.FC<Props> = ({ onClose, onSave, isOpen, bancos, pessoas, financiamentoData }) => {
	const [tipoParcelamento, setTipoParcelamento] = useState<TipoParcelamento>('mensal');
	const [dataVencimentoInicial, setDataVencimentoInicial] = useState('');
	const [form, setForm] = useState<FormFinanciamento>({ parcelasList: [] });
	// text, not number: an empty field used to become NaN and pass the "< 1" check
	const [numParcelasTexto, setNumParcelasTexto] = useState('1');
	const [isLoading, setIsLoading] = useState(false);
	const [errors, setErrors] = useState<{ [key: string]: string }>({});
	// Contract created but not every installment saved: "Salvar" again resumes it (never a duplicate)
	const [salvamentoIncompleto, setSalvamentoIncompleto] = useState(false);
	const [showDescartar, setShowDescartar] = useState(false);
	const [showRegerar, setShowRegerar] = useState(false);
	// Installment ids that exist in the database for this contract (loaded + created by a partial save)
	const originalParcelIdsRef = useRef<number[]>([]);
	// Saved installments as loaded: removing a liquidated/linked one (fewer installments) is refused
	const originalParcelasRef = useRef<ParcelaFinanciamento[]>([]);
	const snapshotRef = useRef('');
	const parcelasEditadasRef = useRef(false);

	useEffect(() => {
		if (!isOpen) return;
		let inicial: FormFinanciamento;
		let parcelasIniciais: ParcelaFinanciamento[] = [];
		if (financiamentoData) {
			// copies: never change the parent's objects
			parcelasIniciais = (financiamentoData.parcelasList ?? []).map((p) => ({ ...p }));
			originalParcelasRef.current = parcelasIniciais.filter((p) => p.id > 0).map((p) => ({ ...p }));
			const tj = financiamentoData.totalJuros ?? null;
			const tja = financiamentoData.taxaJurosAnual ?? null;
			let totalJurosStr = tj != null && tj > 0 ? String(tj).replace('.', ',') : '0,00';
			let taxaPctStr = tja != null && tja > 0 ? String(tja).replace('.', ',') : '';
			// Legacy rows: contract interest (BRL) was stored in taxaJurosAnual before totalJuros existed in UI
			if ((tj == null || tj === 0) && tja != null && tja > 100) {
				totalJurosStr = String(tja).replace('.', ',');
				taxaPctStr = '';
			}
			inicial = {
				...financiamentoData,
				valor: financiamentoData.valor != null ? String(financiamentoData.valor).replace('.', ',') : '0,00',
				taxaJurosAnual: taxaPctStr,
				totalJuros: totalJurosStr,
				parcelasList: parcelasIniciais,
			};
		} else {
			originalParcelasRef.current = [];
			inicial = { parcelasList: [], taxaJurosAnual: '', totalJuros: '0,00' };
		}
		originalParcelIdsRef.current = originalParcelasRef.current.map((p) => p.id);
		setForm(inicial);
		snapshotRef.current = assinatura(inicial);
		parcelasEditadasRef.current = false;

		if (parcelasIniciais.length > 0) {
			setNumParcelasTexto(String(parcelasIniciais.length));
			setDataVencimentoInicial(String(parcelasIniciais[0].dt_vencimento ?? '').slice(0, 10));
			const periodicidade = periodicidadeParcelas(parcelasIniciais.map((p) => p.dt_vencimento));
			setTipoParcelamento(periodicidade ? TIPO_DA_PERIODICIDADE[periodicidade] : 'mensal');
		} else {
			setNumParcelasTexto('1');
			setDataVencimentoInicial(hojeISO());
			setTipoParcelamento('mensal');
		}
		setErrors({});
		setSalvamentoIncompleto(false);
		setShowDescartar(false);
		setShowRegerar(false);
	}, [isOpen, financiamentoData]);

	const limparErro = (...campos: string[]) =>
		setErrors((prev) => {
			if (!campos.some((c) => prev[c])) return prev;
			const next = { ...prev };
			for (const c of campos) delete next[c];
			return next;
		});

	const handleInputChange = (field: string, value: any) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleParcelaChange = (index: number, field: keyof ParcelaFinanciamento, value: any) => {
		parcelasEditadasRef.current = true;
		setForm((prev) => {
			const lista = [...(prev.parcelasList ?? [])];
			const parcela = { ...lista[index] };
			if (field === 'valor') {
				parcela.valor = typeof value === 'string' ? lerValor(value) : Number(value) || 0;
			} else {
				(parcela as unknown as Record<string, unknown>)[field] = value;
			}
			lista[index] = parcela;
			return { ...prev, parcelasList: lista };
		});
	};

	const valorCredor = form.idBanco && form.idPessoa ? '' : form.idBanco ? `b:${form.idBanco}` : form.idPessoa ? `p:${form.idPessoa}` : '';

	const handleCredorChange = (valor: string) => {
		const [tipo, id] = valor.split(':');
		setForm((prev) => ({
			...prev,
			idBanco: tipo === 'b' ? Number(id) : null,
			idPessoa: tipo === 'p' ? Number(id) : null,
		}));
		limparErro('bancoPessoa');
	};

	const validarFormulario = () => {
		const newErrors: { [key: string]: string } = {};
		const parcelas = form.parcelasList ?? [];

		if (!form.responsavel?.trim()) newErrors.responsavel = 'Informe o responsável.';
		if (!form.dataContrato) newErrors.dataContrato = 'Informe a data do contrato.';
		if (!(lerValor(form.valor) > 0)) newErrors.valor = 'Informe o valor contratado (maior que zero).';
		if (!form.numeroContrato?.trim()) newErrors.numeroContrato = 'Informe o número do contrato.';
		if (!form.modalidade) newErrors.modalidade = 'Escolha a modalidade.';
		if (form.modalidade === 'PARTICULAR' && !form.nomeModalidadeParticular?.trim()) {
			newErrors.nomeModalidadeParticular = 'Informe o nome quando a modalidade é Particular.';
		}
		if (!form.idBanco && !form.idPessoa) {
			newErrors.bancoPessoa = 'Escolha o credor: um banco ou uma pessoa.';
		} else if (form.idBanco && form.idPessoa) {
			newErrors.bancoPessoa = 'Escolha só um credor: banco ou pessoa.';
		}
		if (parcelas.length === 0) {
			newErrors.parcelas = 'Gere as parcelas antes de salvar (botão "Gerar parcelas").';
		} else if (parcelas.some((p) => !p.dt_vencimento)) {
			newErrors.parcelas = 'Todas as parcelas precisam de data de vencimento.';
		} else if (parcelas.some((p) => p.status !== 'Liquidado' && !(Number(p.valor) > 0))) {
			newErrors.parcelas = 'Todas as parcelas em aberto precisam de valor maior que zero.';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	/** Regenerating over saved or hand-typed installments asks first. */
	const regerarApagaDigitacao = () => {
		const lista = form.parcelasList ?? [];
		return lista.length > 0 && (parcelasEditadasRef.current || lista.some((p) => p.id > 0));
	};

	const gerarParcelas = (confirmado = false) => {
		const novosErros: { [key: string]: string } = {};
		const erroQtd = erroQuantidadeParcelas(numParcelasTexto);
		if (erroQtd) novosErros.numParcelas = erroQtd;
		if (!dataVencimentoInicial) novosErros.dataVencimentoInicial = 'Informe o 1º vencimento.';
		const valorContrato = lerValor(form.valor);
		if (!(valorContrato > 0)) novosErros.valor = 'Informe o valor contratado antes de gerar as parcelas.';
		if (Object.keys(novosErros).length > 0) {
			setErrors((prev) => ({ ...prev, ...novosErros }));
			toast.error(Object.values(novosErros)[0]);
			return;
		}
		limparErro('numParcelas', 'dataVencimentoInicial', 'valor', 'parcelas');

		if (!confirmado && regerarApagaDigitacao()) {
			setShowRegerar(true);
			return;
		}

		const numParcelas = Number(numParcelasTexto);
		// Same base for 1 or N installments: valor contratado + total de juros, residue on the last one
		const valores = valoresDasParcelas(valorContrato, lerValor(form.totalJuros), numParcelas);
		// Due dates by calendar arithmetic on the text (no timezone): 31/01 -> 28/02 -> 31/03, no month skipped.
		const vencimentos = gerarDatasVencimento(dataVencimentoInicial.slice(0, 10), numParcelas, INTERVALO_MESES[tipoParcelamento]);
		const dataLancamento = hojeISO();

		const parcelas: ParcelaFinanciamento[] = valores.map((valor, i) => ({
			id: 0,
			idFinanciamento: 0,
			status: 'Aberto',
			numParcela: i + 1,
			valor,
			dt_vencimento: vencimentos[i],
			dt_lancamento: dataLancamento,
			dt_liquidacao: null,
			idMovimentoBancario: null,
		}));

		const prev = form.parcelasList || [];
		const merged = parcelas.map((p) => {
			const match = prev.find((o) => o.numParcela === p.numParcela && o.id > 0);
			if (match?.status === 'Liquidado') {
				return { ...match };
			}
			if (match) {
				return {
					...p,
					id: match.id,
					idFinanciamento: match.idFinanciamento,
					status: match.status,
					dt_lancamento: match.dt_lancamento,
					dt_liquidacao: match.dt_liquidacao,
					// keep the link to the bank movement (the PUT rewrites idMovimentoBancario)
					idMovimentoBancario: match.idMovimentoBancario ?? null,
				};
			}
			return p;
		});

		// Fewer installments than before: liquidated/linked ones can never be dropped (blocked on save too)
		const emUso = parcelasRemovidasEmUso(originalParcelasRef.current, merged);
		if (emUso.length > 0) {
			toast.warning(mensagemParcelasEmUso(emUso));
		}

		parcelasEditadasRef.current = false;
		setForm((prevForm) => ({
			...prevForm,
			parcelasList: merged,
			dataVencimentoPrimeiraParcela: merged[0].dt_vencimento,
			dataVencimentoUltimaParcela: merged[merged.length - 1].dt_vencimento,
		}));
	};

	/** Keeps what the API already has (contract id, installment ids): a retry never creates duplicates. */
	const aplicarEstadoSalvo = (estado: EstadoSalvamento) => {
		const ids = new Set(estado.idsSalvos);
		originalParcelIdsRef.current = estado.idsSalvos;
		originalParcelasRef.current = originalParcelasRef.current.filter((p) => ids.has(p.id));
		setForm((prev) => ({ ...prev, id: estado.contrato.id, parcelasList: estado.parcelas }));
	};

	const handleSave = async () => {
		if (!validarFormulario()) {
			toast.error('Confira os campos marcados em vermelho.');
			return;
		}
		// Never delete a liquidated / movement-linked installment (contract history, saldo devedor, Caixa)
		const removidasEmUso = parcelasRemovidasEmUso(originalParcelasRef.current, form.parcelasList ?? []);
		if (removidasEmUso.length > 0) {
			toast.error(mensagemParcelasEmUso(removidasEmUso));
			return;
		}

		const parsePct = (s: string | undefined) => {
			if (s == null || String(s).trim() === '') return null;
			const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
			return Number.isFinite(n) ? n : null;
		};
		const parseMoney = (s: string | undefined) => {
			const n = lerValor(s);
			return n > 0 ? n : null;
		};

		const parcelas = form.parcelasList ?? [];
		// first / last due date from the list itself (dates can be edited in the table after "Gerar")
		const vencimentos = parcelas.map((p) => String(p.dt_vencimento ?? '').slice(0, 10)).filter(Boolean).sort();
		const contrato = {
			...form,
			id: form.id ?? 0,
			valor: lerValor(form.valor),
			taxaJurosAnual: parsePct(form.taxaJurosAnual),
			totalJuros: parseMoney(form.totalJuros),
			dataVencimentoPrimeiraParcela: vencimentos[0] ?? null,
			dataVencimentoUltimaParcela: vencimentos[vencimentos.length - 1] ?? null,
		} as Financiamento;
		const criando = !financiamentoData?.id;

		try {
			setIsLoading(true);
			const salvo = await salvarContratoComParcelas(
				{ contrato, parcelas, idsSalvos: originalParcelIdsRef.current },
				{
					salvarFinanciamento,
					salvarParcela: salvarParcelaFinanciamento,
					excluirParcela: excluirParcelaFinanciamento,
				},
			);
			aplicarEstadoSalvo(salvo);
			setSalvamentoIncompleto(false);
			toast.success(criando ? 'Financiamento criado com sucesso!' : 'Financiamento atualizado com sucesso!');
			onSave({ ...salvo.contrato, parcelasList: salvo.parcelas });
			onClose();
		} catch (error) {
			console.error('Erro ao salvar financiamento:', error);
			if (error instanceof ErroSalvamentoParcial) {
				aplicarEstadoSalvo(error.estado);
				setSalvamentoIncompleto(true);
				toast.error(
					`${error.message}. O contrato já está gravado: clique em Salvar de novo para concluir (ele não será duplicado).`,
					{ autoClose: false },
				);
			} else {
				toast.error(error instanceof Error && error.message ? error.message : 'Erro ao salvar financiamento. Tente novamente.');
			}
		} finally {
			setIsLoading(false);
		}
	};

	const temAlteracoes = () => salvamentoIncompleto || assinatura(form) !== snapshotRef.current;

	/** Esc, X and Cancelar: ask before throwing away what was typed. */
	const pedirFechar = () => {
		if (isLoading) return;
		if (temAlteracoes()) {
			setShowDescartar(true);
			return;
		}
		onClose();
	};

	const parcelasLista = form.parcelasList ?? [];
	const resumo = resumoParcelas({ valor: lerValor(form.valor), totalJuros: lerValor(form.totalJuros), taxaJurosAnual: null }, parcelasLista);
	const avisoDiferenca = avisoDiferencaParcelas(resumo);
	const inputClass = 'w-full p-2 bg-white border border-gray-300 rounded text-sm';

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={pedirFechar}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-[1300px] mx-auto z-150 max-h-[90vh] overflow-y-auto"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-150 p-4"
				contentLabel="Modal Financiamento"
			>
				<div className="flex justify-between items-center bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
					<h2 className="text-xl font-semibold text-gray-800">
						{financiamentoData?.id ? 'Editar Financiamento' : 'Novo Financiamento'}
					</h2>
					<button onClick={pedirFechar} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</button>
				</div>
				{salvamentoIncompleto && (
					<div className="mx-4 sm:mx-6 mt-4 p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm" role="alert">
						O contrato já foi gravado, mas nem todas as parcelas foram salvas. Clique em <strong>Salvar</strong> de novo para
						concluir — ele não será criado em dobro.
					</div>
				)}
				<div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-2">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:border-r lg:mr-4 lg:pr-6 w-full">
						<div>
							<label htmlFor="fin-responsavel" className="text-sm sm:text-base">
								Responsável <span className="text-red-500">*</span>
							</label>
							<input
								id="fin-responsavel"
								className={inputClass}
								placeholder="Digite o nome do responsável"
								value={form.responsavel || ''}
								onChange={(e) => handleInputChange('responsavel', e.target.value)}
							/>
							{errors.responsavel && <p className="text-red-500 text-xs">{errors.responsavel}</p>}
						</div>

						<div>
							<label htmlFor="fin-data-contrato" className="text-sm sm:text-base">
								Data do Contrato <span className="text-red-500">*</span>
							</label>
							<input
								id="fin-data-contrato"
								type="date"
								className={inputClass}
								value={form.dataContrato || ''}
								onChange={(e) => handleInputChange('dataContrato', e.target.value)}
							/>
							{errors.dataContrato && <p className="text-red-500 text-xs">{errors.dataContrato}</p>}
						</div>

						<div>
							<label htmlFor="fin-valor" className="text-sm sm:text-base">
								Valor contratado (principal) <span className="text-red-500">*</span>
							</label>
							<CurrencyInput
								id="fin-valor"
								className={inputClass}
								value={form.valor || '0,00'}
								decimalsLimit={2}
								prefix="R$ "
								decimalSeparator=","
								groupSeparator="."
								fixedDecimalLength={2}
								onValueChange={(value) => handleInputChange('valor', value || '0,00')}
							/>
							{errors.valor && <p className="text-red-500 text-xs">{errors.valor}</p>}
						</div>

						<div>
							<label htmlFor="fin-numero-contrato" className="text-sm sm:text-base">
								Número do Contrato <span className="text-red-500">*</span>
							</label>
							<input
								id="fin-numero-contrato"
								className={inputClass}
								placeholder="Digite o número do contrato"
								value={form.numeroContrato || ''}
								onChange={(e) => handleInputChange('numeroContrato', e.target.value)}
							/>
							{errors.numeroContrato && <p className="text-red-500 text-xs">{errors.numeroContrato}</p>}
						</div>

						<div className="col-span-1 sm:col-span-2">
							<label htmlFor="fin-credor" className="text-sm sm:text-base">
								Credor <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(banco ou pessoa)</span>
							</label>
							<select
								id="fin-credor"
								className={inputClass}
								value={valorCredor}
								onChange={(e) => handleCredorChange(e.target.value)}
							>
								<option value="">Selecione o banco ou a pessoa</option>
								<optgroup label="Bancos">
									{bancos.map((banco) => (
										<option key={`b${banco.id}`} value={`b:${banco.id}`}>
											{banco.nome}
										</option>
									))}
								</optgroup>
								<optgroup label="Pessoas">
									{pessoas.map((pessoa) => (
										<option key={`p${pessoa.id}`} value={`p:${pessoa.id}`}>
											{pessoa.nome}
										</option>
									))}
								</optgroup>
							</select>
							{errors.bancoPessoa && <p className="text-red-500 text-xs">{errors.bancoPessoa}</p>}
						</div>

						<div>
							<label htmlFor="fin-taxa" className="text-sm sm:text-base">Taxa de juros (% a.a.)</label>
							<input
								id="fin-taxa"
								type="text"
								inputMode="decimal"
								className={inputClass}
								placeholder="Ex.: 12,5"
								value={form.taxaJurosAnual ?? ''}
								onChange={(e) => handleInputChange('taxaJurosAnual', e.target.value)}
							/>
						</div>

						<div>
							<label htmlFor="fin-total-juros" className="text-sm sm:text-base">Total de juros do contrato (R$)</label>
							<CurrencyInput
								id="fin-total-juros"
								className={inputClass}
								value={form.totalJuros || '0,00'}
								decimalsLimit={2}
								prefix="R$ "
								decimalSeparator=","
								groupSeparator="."
								fixedDecimalLength={2}
								onValueChange={(value) => handleInputChange('totalJuros', value || '0,00')}
							/>
						</div>

						<div>
							<label htmlFor="fin-modalidade" className="text-sm sm:text-base">
								Modalidade <span className="text-red-500">*</span>
							</label>
							<select
								id="fin-modalidade"
								className={inputClass}
								value={form.modalidade || ''}
								onChange={(e) => {
									handleInputChange('modalidade', e.target.value || null);
									if (e.target.value !== 'PARTICULAR') {
										handleInputChange('nomeModalidadeParticular', null);
									}
								}}
							>
								<option value="">Selecione a modalidade</option>
								<option value="INVESTIMENTO">Investimento</option>
								<option value="CUSTEIO">Custeio</option>
								<option value="PARTICULAR">Particular</option>
								<option value="RENEGOCIACAO">Renegociação</option>
							</select>
							{errors.modalidade && <p className="text-red-500 text-xs">{errors.modalidade}</p>}
						</div>

						{form.modalidade === 'PARTICULAR' && (
							<div>
								<label htmlFor="fin-nome-particular" className="text-sm sm:text-base">
									Nome (Modalidade Particular) <span className="text-red-500">*</span>
								</label>
								<input
									id="fin-nome-particular"
									className={inputClass}
									value={form.nomeModalidadeParticular || ''}
									placeholder="Digite o nome"
									onChange={(e) => handleInputChange('nomeModalidadeParticular', e.target.value)}
								/>
								{errors.nomeModalidadeParticular && <p className="text-red-500 text-xs">{errors.nomeModalidadeParticular}</p>}
							</div>
						)}

						<div>
							<label htmlFor="fin-garantia" className="text-sm sm:text-base">Número da Garantia</label>
							<input
								id="fin-garantia"
								className={inputClass}
								value={form.numeroGarantia || ''}
								placeholder="Digite o número da garantia"
								onChange={(e) => handleInputChange('numeroGarantia', e.target.value)}
							/>
						</div>

						<div className="col-span-1 sm:col-span-2">
							<label htmlFor="fin-observacao" className="text-sm sm:text-base">Observação</label>
							<textarea
								id="fin-observacao"
								className={inputClass}
								placeholder="Digite a observação"
								value={form.observacao || ''}
								onChange={(e) => handleInputChange('observacao', e.target.value)}
							/>
						</div>

						{errors.parcelas && <p className="text-red-500 text-xs col-span-1 sm:col-span-2">{errors.parcelas}</p>}

						<div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row justify-end mt-6 gap-3">
							<button
								onClick={pedirFechar}
								className="text-gray-600 font-semibold hover:bg-gray-200 px-4 py-2 rounded text-sm sm:text-base"
								disabled={isLoading}
							>
								Cancelar
							</button>
							<button
								onClick={handleSave}
								className="bg-primary hover:bg-orange-600 font-semibold text-white px-4 py-2 rounded flex items-center justify-center text-sm sm:text-base"
								disabled={isLoading}
							>
								{isLoading ? (
									<>
										<span className="animate-spin mr-2">⏳</span>
										Salvando...
									</>
								) : (
									<>
										Salvar
										<FontAwesomeIcon icon={faSave} className="ml-2" />
									</>
								)}
							</button>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
						<div className="col-span-1 sm:col-span-2">
							<h3 className="font-semibold text-sm sm:text-base">Gerar parcelas</h3>
							<div className="border-t w-full pt-4 mt-2 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
								<div>
									<label htmlFor="fin-qtd-parcelas" className="text-sm">
										Quantidade de parcelas
									</label>
									<input
										id="fin-qtd-parcelas"
										type="number"
										min={1}
										step={1}
										inputMode="numeric"
										value={numParcelasTexto}
										onChange={(e) => {
											setNumParcelasTexto(e.target.value);
											limparErro('numParcelas');
										}}
										className="border p-2 rounded w-full text-sm"
									/>
								</div>
								<div>
									<label htmlFor="fin-primeiro-vencimento" className="text-sm">
										1º vencimento
									</label>
									<input
										id="fin-primeiro-vencimento"
										type="date"
										value={dataVencimentoInicial}
										onChange={(e) => {
											setDataVencimentoInicial(e.target.value);
											limparErro('dataVencimentoInicial');
										}}
										className="border p-2 rounded w-full text-sm"
									/>
								</div>
								<div>
									<label htmlFor="fin-periodicidade" className="text-sm">
										Periodicidade
									</label>
									<select
										id="fin-periodicidade"
										value={tipoParcelamento}
										onChange={(e) => setTipoParcelamento(e.target.value as TipoParcelamento)}
										className="border p-2 rounded w-full text-sm"
									>
										<option value="mensal">Mensal</option>
										<option value="trimestral">Trimestral</option>
										<option value="semestral">Semestral</option>
										<option value="anual">Anual</option>
									</select>
								</div>
								<button
									onClick={() => gerarParcelas()}
									className="bg-primary text-white px-4 py-2 rounded hover:bg-orange-500 transition w-full text-sm"
								>
									Gerar parcelas
									<FontAwesomeIcon icon={faGear} className="ml-2" />
								</button>
							</div>
							{(errors.numParcelas || errors.dataVencimentoInicial) && (
								<p className="text-red-500 text-xs mt-1">{errors.numParcelas || errors.dataVencimentoInicial}</p>
							)}
							<p className="text-xs text-gray-500 mt-2">
								Cada parcela = (valor contratado + total de juros) ÷ quantidade; os centavos que sobram vão para a última.
								Depois é possível ajustar vencimentos e valores na tabela.
							</p>
						</div>

						<div className="col-span-1 sm:col-span-2 max-h-64 overflow-y-auto mt-2">
							<div className="overflow-x-auto">
								<table className="w-full border min-w-[400px]">
									<thead className="bg-gray-100">
										<tr>
											<th className="p-2 text-xs sm:text-sm">Parcela</th>
											<th className="p-2 text-xs sm:text-sm">Vencimento</th>
											<th className="p-2 text-xs sm:text-sm">Valor</th>
										</tr>
									</thead>
									<tbody>
										{parcelasLista.length === 0 ? (
											<tr>
												<td colSpan={3} className="text-center py-3 text-gray-500 italic text-xs sm:text-sm">
													Nenhuma parcela gerada ainda
												</td>
											</tr>
										) : (
											parcelasLista.map((parcela, index) => (
												<tr key={index} className="text-center border-t">
													<td className="p-1 text-xs sm:text-sm">
														{parcela.numParcela}
														{parcela.status === 'Liquidado' && <span className="ml-1 text-green-700">(liquidada)</span>}
													</td>
													<td className="p-1">
														<input
															type="date"
															aria-label={`Vencimento da parcela ${parcela.numParcela}`}
															value={parcela.dt_vencimento}
															onChange={(e) => handleParcelaChange(index, 'dt_vencimento', e.target.value)}
															className="border p-1 rounded text-xs sm:text-sm w-full"
														/>
													</td>
													<td className="p-1">
														<CurrencyInput
															aria-label={`Valor da parcela ${parcela.numParcela}`}
															className="w-full p-1 border border-gray-300 rounded text-xs sm:text-sm"
															value={parcela.valor?.toString().replace('.', ',') || '0,00'}
															decimalsLimit={2}
															prefix="R$ "
															decimalSeparator=","
															groupSeparator="."
															fixedDecimalLength={2}
															onValueChange={(value) => handleParcelaChange(index, 'valor', value || '0,00')}
														/>
													</td>
												</tr>
											))
										)}
									</tbody>
									{parcelasLista.length > 0 && (
										<tfoot className="bg-gray-50 text-xs sm:text-sm">
											<tr className="border-t">
												<td colSpan={2} className="p-2 text-right text-gray-600">
													Soma das parcelas
												</td>
												<td className="p-2 text-center font-semibold">{brl(resumo.somaParcelas)}</td>
											</tr>
											<tr>
												<td colSpan={2} className="p-2 text-right text-gray-600">
													Valor contratado + juros
												</td>
												<td className="p-2 text-center">{brl(resumo.previsto)}</td>
											</tr>
										</tfoot>
									)}
								</table>
							</div>
						</div>
						{avisoDiferenca && (
							<p className="col-span-1 sm:col-span-2 text-xs text-amber-700 flex items-start gap-2">
								<FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
								<span>{avisoDiferenca}</span>
							</p>
						)}
					</div>
				</div>
			</Modal>

			<DialogModal
				isOpen={showDescartar}
				onClose={() => setShowDescartar(false)}
				onConfirm={async () => {
					setShowDescartar(false);
					onClose(salvamentoIncompleto);
				}}
				title={salvamentoIncompleto ? 'Contrato incompleto' : 'Descartar alterações?'}
				type="warn"
				message={
					salvamentoIncompleto
						? 'O contrato já foi gravado, mas nem todas as parcelas foram salvas. Se sair agora, ele fica incompleto (dá para completar depois, em Editar).\n\nSair mesmo assim?'
						: 'Há alterações não salvas neste contrato. Sair e descartar o que foi digitado?'
				}
				confirmLabel="Sair sem salvar"
				cancelLabel="Continuar editando"
			/>

			<DialogModal
				isOpen={showRegerar}
				onClose={() => setShowRegerar(false)}
				onConfirm={async () => {
					setShowRegerar(false);
					gerarParcelas(true);
				}}
				title="Gerar as parcelas de novo?"
				type="warn"
				message={`Isso substitui os vencimentos e valores das ${parcelasLista.length} parcelas da lista pelos novos (as liquidadas ficam como estão). Os valores digitados serão perdidos.`}
				confirmLabel="Gerar de novo"
				cancelLabel="Cancelar"
			/>
		</>
	);
};

export default ModalFinanciamento;
