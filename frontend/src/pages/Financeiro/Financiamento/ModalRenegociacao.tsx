import React, { useEffect, useRef, useState } from 'react';
import CurrencyInput from 'react-currency-input-field';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faHandshake, faPlus, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { Banco } from '../../../../../backend/src/models/Banco';
import type { Pessoa } from '../../../../../backend/src/models/Pessoa';
import DialogModal from '../../../components/DialogModal';
import { renegociarFinanciamento, type ResultadoRenegociacao } from '../../../services/financiamentoService';
import { formatarDataISO, hojeISO } from '../../../Utils/dataSemFuso';
import { brl } from '../../../Utils/formatos';
import { parseValorMonetario, PROPS_MOEDA_BRL } from '../../../Utils/valorMonetario';
import { periodicidadeParcelas } from './parcelaRegras';
import {
	erroLinhas,
	gerarParcelas,
	mensagemConfirmacao,
	montarPayload,
	novaLinha,
	primeiroNumero,
	renumerar,
	situacaoContrato,
	textoDiferenca,
	totalLinhas,
	type LinhaParcela,
	type Periodicidade,
	type TipoRenegociacao,
} from './renegociacaoRegras';

interface Props {
	isOpen: boolean;
	onClose: () => void;
	/** Called after the API saved the renegotiation (the list reloads). */
	onSaved: (resultado: ResultadoRenegociacao) => void;
	financiamento: Financiamento;
	bancos: Banco[];
	pessoas: Pessoa[];
	nomeCredor: string;
}

const PERIODICIDADE: Record<string, Periodicidade> = { Mensal: 'mensal', Trimestral: 'trimestral', Semestral: 'semestral', Anual: 'anual' };

/** Money typed in a CurrencyInput ("1234,56") → number; empty/invalid → null. */
const lerDinheiro = (s: string) => {
	const n = parseValorMonetario(s);
	return Number.isFinite(n) ? n : null;
};
/** Number → CurrencyInput text ("1234,56"). */
const paraTexto = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',');

const inputClass = 'w-full p-2 bg-white border border-gray-300 rounded text-sm';

const ModalRenegociacao: React.FC<Props> = ({ isOpen, onClose, onSaved, financiamento, bancos, pessoas, nomeCredor }) => {
	const situacao = situacaoContrato(financiamento.parcelasList);
	const [tipo, setTipo] = useState<TipoRenegociacao>('ADITIVO');
	// aditivo
	const [dataAditivo, setDataAditivo] = useState('');
	const [novoValorAditivo, setNovoValorAditivo] = useState('');
	const [novaTaxaAditivo, setNovaTaxaAditivo] = useState('');
	const [observacaoAditivo, setObservacaoAditivo] = useState('');
	// novo contrato
	const [numeroNovo, setNumeroNovo] = useState('');
	const [dataNovo, setDataNovo] = useState('');
	const [credor, setCredor] = useState('');
	const [responsavel, setResponsavel] = useState('');
	const [valorNovo, setValorNovo] = useState('');
	const [taxaNovo, setTaxaNovo] = useState('');
	const [modalidade, setModalidade] = useState('RENEGOCIACAO');
	const [nomeParticular, setNomeParticular] = useState('');
	const [garantia, setGarantia] = useState('');
	const [observacaoNovo, setObservacaoNovo] = useState('');
	// gerador + tabela
	const [quantidade, setQuantidade] = useState('1');
	const [primeiroVencimento, setPrimeiroVencimento] = useState('');
	const [periodicidade, setPeriodicidade] = useState<Periodicidade>('mensal');
	const [valorBase, setValorBase] = useState('0,00');
	const [juros, setJuros] = useState('0,00');
	const [linhas, setLinhas] = useState<LinhaParcela[]>([]);
	// text typed in each value cell (by row key): a controlled number would drop a trailing "," while typing
	const [textosValor, setTextosValor] = useState<Record<number, string>>({});

	const [erros, setErros] = useState<Record<string, string>>({});
	const [confirmar, setConfirmar] = useState(false);
	const [descartar, setDescartar] = useState(false);
	const alteradoRef = useRef(false);
	const baseEditadaRef = useRef(false);

	useEffect(() => {
		if (!isOpen) return;
		const s = situacaoContrato(financiamento.parcelasList);
		const hoje = hojeISO();
		setTipo('ADITIVO');
		setDataAditivo(hoje);
		setNovoValorAditivo('');
		setNovaTaxaAditivo('');
		setObservacaoAditivo('');
		setNumeroNovo('');
		setDataNovo(hoje);
		setCredor(financiamento.idBanco ? `b:${financiamento.idBanco}` : financiamento.idPessoa ? `p:${financiamento.idPessoa}` : '');
		setResponsavel(financiamento.responsavel ?? '');
		setValorNovo('');
		setTaxaNovo('');
		setModalidade('RENEGOCIACAO');
		setNomeParticular('');
		setGarantia(financiamento.numeroGarantia ?? '');
		setObservacaoNovo('');
		// proposal = the parcelas open today (same dates and values): edit them, or generate new ones
		const datas = s.abertas.map((p) => String(p.dt_vencimento ?? '').slice(0, 10)).filter(Boolean).sort();
		setQuantidade(String(Math.max(1, s.qtdAbertas)));
		setPrimeiroVencimento(datas[0] ?? hoje);
		const per = periodicidadeParcelas(datas);
		setPeriodicidade(per ? PERIODICIDADE[per] : 'mensal');
		setValorBase(paraTexto(s.valorAberto));
		setJuros('0,00');
		const inicio = s.maiorNumeroPago + 1;
		setLinhas(
			[...s.abertas]
				.sort((a, b) => String(a.dt_vencimento).localeCompare(String(b.dt_vencimento)) || a.numParcela - b.numParcela)
				.map((p, i) => ({ chave: i + 1, numParcela: inicio + i, dt_vencimento: String(p.dt_vencimento ?? '').slice(0, 10), valor: Number(p.valor) || 0 })),
		);
		setTextosValor({});
		setErros({});
		setConfirmar(false);
		setDescartar(false);
		alteradoRef.current = false;
		baseEditadaRef.current = false;
	}, [isOpen, financiamento]);

	const inicioNumeracao = primeiroNumero(tipo, situacao);
	const total = totalLinhas(linhas);
	const marcar = () => {
		alteradoRef.current = true;
	};
	const limparErro = (campo: string) =>
		setErros((prev) => {
			if (!prev[campo]) return prev;
			const next = { ...prev };
			delete next[campo];
			return next;
		});

	const trocarTipo = (novo: TipoRenegociacao) => {
		setTipo(novo);
		setLinhas((prev) => renumerar(prev, primeiroNumero(novo, situacao)));
		setErros({});
		marcar();
	};

	/** The base of the generator follows the new contract value until the user types it himself. */
	const valorDoContratoMudou = (texto: string) => {
		if (!baseEditadaRef.current && (lerDinheiro(texto) ?? 0) > 0) setValorBase(texto);
	};

	const alterarLinha = (chave: number, campo: 'dt_vencimento' | 'valor', valor: string | number) => {
		marcar();
		limparErro('parcelas');
		setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
	};

	const gerar = () => {
		const r = gerarParcelas({
			quantidade,
			primeiroVencimento,
			periodicidade,
			valor: lerDinheiro(valorBase) ?? 0,
			juros: lerDinheiro(juros) ?? 0,
			numeroInicial: inicioNumeracao,
		});
		if (!r.ok) {
			setErros((prev) => ({ ...prev, gerador: r.erro }));
			toast.error(r.erro);
			return;
		}
		marcar();
		setErros((prev) => {
			const next = { ...prev };
			delete next.gerador;
			delete next.parcelas;
			return next;
		});
		setTextosValor({});
		setLinhas(r.linhas);
	};

	// Same limits as the API: not before the contract / its last aditivo, not after today
	const dataMinima = [financiamento.dataContrato, financiamento.ultimoAditivoEm]
		.map((d) => String(d ?? '').slice(0, 10))
		.filter(Boolean)
		.sort()
		.pop();
	const dataMaxima = hojeISO();
	const erroLimiteData = (d: string, palavra: string) =>
		d > dataMaxima
			? `A data ${palavra} não pode ser depois de hoje.`
			: dataMinima && d < dataMinima
				? `A data ${palavra} não pode ser antes de ${formatarDataISO(dataMinima)} (data do contrato ou do último aditivo).`
				: null;

	const validar = (): boolean => {
		const e: Record<string, string> = {};
		if (tipo === 'ADITIVO') {
			if (!dataAditivo) e.dataAditivo = 'Informe a data do aditivo.';
			else {
				const erroData = erroLimiteData(dataAditivo, 'do aditivo');
				if (erroData) e.dataAditivo = erroData;
			}
			if (novoValorAditivo.trim() && !((lerDinheiro(novoValorAditivo) ?? 0) > 0)) e.novoValorAditivo = 'O novo valor deve ser maior que zero.';
			if (novaTaxaAditivo.trim() && lerDinheiro(novaTaxaAditivo) == null) e.novaTaxaAditivo = 'Taxa inválida (ex.: 12,5).';
		} else {
			if (!numeroNovo.trim()) e.numeroNovo = 'Informe o número do novo contrato.';
			else if (numeroNovo.trim().toUpperCase() === String(financiamento.numeroContrato).trim().toUpperCase()) {
				e.numeroNovo = 'É o mesmo número deste contrato. Para manter o número, escolha "Aditivo".';
			}
			if (!dataNovo) e.dataNovo = 'Informe a data do contrato.';
			else {
				const erroData = erroLimiteData(dataNovo, 'do novo contrato');
				if (erroData) e.dataNovo = erroData;
			}
			if (!credor) e.credor = 'Escolha o credor: um banco ou uma pessoa.';
			if (!((lerDinheiro(valorNovo) ?? 0) > 0)) e.valorNovo = 'Informe o valor contratado (maior que zero).';
			if (taxaNovo.trim() && lerDinheiro(taxaNovo) == null) e.taxaNovo = 'Taxa inválida (ex.: 12,5).';
			if (modalidade === 'PARTICULAR' && !nomeParticular.trim()) e.nomeParticular = 'Informe o nome quando a modalidade é Particular.';
		}
		const erroTabela = erroLinhas(linhas);
		if (erroTabela) e.parcelas = erroTabela;
		setErros(e);
		return Object.keys(e).length === 0;
	};

	const pedirConfirmacao = () => {
		if (!validar()) {
			toast.error('Confira os campos marcados em vermelho.');
			return;
		}
		setConfirmar(true);
	};

	const salvar = async () => {
		const payload = montarPayload(tipo, linhas, {
			aditivo: {
				dataRenegociacao: dataAditivo,
				valor: novoValorAditivo.trim() ? lerDinheiro(novoValorAditivo) : null,
				taxaJurosAnual: novaTaxaAditivo.trim() ? lerDinheiro(novaTaxaAditivo) : null,
				observacao: observacaoAditivo,
			},
			novo: {
				numeroContrato: numeroNovo,
				dataContrato: dataNovo,
				credor,
				responsavel,
				valor: lerDinheiro(valorNovo) ?? 0,
				taxaJurosAnual: taxaNovo.trim() ? lerDinheiro(taxaNovo) : null,
				modalidade,
				nomeModalidadeParticular: nomeParticular,
				numeroGarantia: garantia,
				observacao: observacaoNovo,
			},
		});
		try {
			const resultado = await renegociarFinanciamento(financiamento.id, payload);
			toast.success(
				tipo === 'ADITIVO'
					? `Aditivo gravado: ${resultado.parcelasCriadas} parcela(s) nova(s) no contrato ${financiamento.numeroContrato}.`
					: `Contrato ${financiamento.numeroContrato} renegociado: criado o contrato ${numeroNovo.trim()}.`,
			);
			onSaved(resultado);
			onClose();
		} catch (error) {
			console.error('Erro ao renegociar:', error);
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao renegociar o contrato.', { autoClose: false });
			throw error; // keeps the confirmation open
		}
	};

	const pedirFechar = () => {
		if (alteradoRef.current) setDescartar(true);
		else onClose();
	};

	const erro = (campo: string) => erros[campo] && <p className="text-red-500 text-xs">{erros[campo]}</p>;
	const dinheiro = (id: string, valor: string, onChange: (v: string) => void, ariaLabel?: string) => (
		<CurrencyInput
			id={id}
			aria-label={ariaLabel}
			className={inputClass}
			{...PROPS_MOEDA_BRL}
			prefix="R$ "
			allowNegativeValue={false}
			value={valor}
			onValueChange={(v) => {
				marcar();
				onChange(v ?? '');
			}}
		/>
	);

	const opcaoTipo = (valor: TipoRenegociacao, titulo: string, descricao: string) => (
		<label
			className={`flex-1 border rounded p-3 cursor-pointer ${tipo === valor ? 'border-primary bg-orange-50' : 'border-gray-300 hover:bg-gray-50'}`}
		>
			<span className="flex items-center gap-2 font-semibold text-sm">
				<input type="radio" name="tipoRenegociacao" value={valor} checked={tipo === valor} onChange={() => trocarTipo(valor)} />
				{titulo}
			</span>
			<span className="block text-xs text-gray-600 mt-1">{descricao}</span>
		</label>
	);

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={pedirFechar}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-[1300px] mx-auto max-h-[90vh] overflow-y-auto"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-150 p-4"
				contentLabel="Renegociar contrato"
			>
				<div className="flex justify-between items-start bg-yellow-100 px-4 py-3 rounded-t-lg border-b">
					<div>
						<h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
							<FontAwesomeIcon icon={faHandshake} /> Renegociar contrato
						</h2>
						<p className="text-sm text-gray-700">
							Contrato <strong>{financiamento.numeroContrato}</strong> · Credor: {nomeCredor} · Tomador: {financiamento.responsavel || '—'}
						</p>
					</div>
					<button onClick={pedirFechar} className="text-gray-500 hover:text-gray-700" aria-label="Fechar" title="Fechar">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</button>
				</div>

				<div className="mx-4 sm:mx-6 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
					<div className="rounded border border-red-200 bg-red-50 p-3">
						<p className="font-semibold text-red-800">
							A vencer hoje: {brl(situacao.valorAberto)} em {situacao.qtdAbertas} {situacao.qtdAbertas === 1 ? 'parcela' : 'parcelas'}
						</p>
						<p className="text-xs text-red-900">Estas parcelas em aberto serão substituídas pelas novas.</p>
					</div>
					<div className="rounded border border-green-200 bg-green-50 p-3">
						<p className="font-semibold text-green-800">
							Pagas: {situacao.qtdPagas} {situacao.qtdPagas === 1 ? 'parcela' : 'parcelas'} ({brl(situacao.valorPago)})
						</p>
						<p className="text-xs text-green-900">As parcelas pagas continuam como estão.</p>
					</div>
				</div>

				<div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-2">
					{/* Tipo e condições */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:border-r lg:mr-4 lg:pr-6 w-full">
						<div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-3" role="radiogroup" aria-label="Tipo de renegociação">
							{opcaoTipo('ADITIVO', 'Aditivo (mesmo contrato)', 'O número do contrato continua o mesmo; mudam as condições e as parcelas a vencer.')}
							{opcaoTipo('NOVO_CONTRATO', 'Novo contrato (encerra este e cria outro)', 'Este contrato fica como "Renegociado" e as parcelas a vencer vão para um contrato novo, com outro número.')}
						</div>

						{tipo === 'ADITIVO' ? (
							<>
								<div>
									<label htmlFor="ren-data-aditivo" className="text-sm">
										Data do aditivo <span className="text-red-500">*</span>
									</label>
									<input
										id="ren-data-aditivo"
										type="date"
										min={dataMinima}
										max={dataMaxima}
										className={inputClass}
										value={dataAditivo}
										onChange={(e) => {
											marcar();
											setDataAditivo(e.target.value);
											limparErro('dataAditivo');
										}}
									/>
									{erro('dataAditivo')}
								</div>
								<div>
									<label htmlFor="ren-valor-aditivo" className="text-sm">
										Novo valor do contrato <span className="text-gray-500 text-xs">(vazio = mantém {brl(financiamento.valor)})</span>
									</label>
									{dinheiro('ren-valor-aditivo', novoValorAditivo, (v) => {
										setNovoValorAditivo(v);
										limparErro('novoValorAditivo');
									})}
									{erro('novoValorAditivo')}
								</div>
								<div>
									<label htmlFor="ren-taxa-aditivo" className="text-sm">
										Nova taxa de juros (% a.a.){' '}
										<span className="text-gray-500 text-xs">
											(vazio = mantém{financiamento.taxaJurosAnual != null && Number(financiamento.taxaJurosAnual) <= 100 ? ` ${String(financiamento.taxaJurosAnual).replace('.', ',')}%` : ''})
										</span>
									</label>
									<input
										id="ren-taxa-aditivo"
										type="text"
										inputMode="decimal"
										className={inputClass}
										placeholder="Ex.: 12,5"
										value={novaTaxaAditivo}
										onChange={(e) => {
											marcar();
											setNovaTaxaAditivo(e.target.value);
											limparErro('novaTaxaAditivo');
										}}
									/>
									{erro('novaTaxaAditivo')}
								</div>
								<div className="col-span-1 sm:col-span-2">
									<label htmlFor="ren-obs-aditivo" className="text-sm">
										Observação
									</label>
									<textarea
										id="ren-obs-aditivo"
										className={inputClass}
										placeholder={`Entra no contrato como "Aditivo em ${formatarDataISO(dataAditivo)}"`}
										value={observacaoAditivo}
										onChange={(e) => {
											marcar();
											setObservacaoAditivo(e.target.value);
										}}
									/>
								</div>
							</>
						) : (
							<>
								<div>
									<label htmlFor="ren-numero" className="text-sm">
										Nº do novo contrato <span className="text-red-500">*</span>
									</label>
									<input
										id="ren-numero"
										className={inputClass}
										value={numeroNovo}
										onChange={(e) => {
											marcar();
											setNumeroNovo(e.target.value);
											limparErro('numeroNovo');
										}}
									/>
									{erro('numeroNovo')}
								</div>
								<div>
									<label htmlFor="ren-data-contrato" className="text-sm">
										Data do contrato <span className="text-red-500">*</span>
									</label>
									<input
										id="ren-data-contrato"
										type="date"
										min={dataMinima}
										max={dataMaxima}
										className={inputClass}
										value={dataNovo}
										onChange={(e) => {
											marcar();
											setDataNovo(e.target.value);
											limparErro('dataNovo');
										}}
									/>
									{erro('dataNovo')}
								</div>
								<div>
									<label htmlFor="ren-credor" className="text-sm">
										Credor <span className="text-red-500">*</span>
									</label>
									<select
										id="ren-credor"
										className={inputClass}
										value={credor}
										onChange={(e) => {
											marcar();
											setCredor(e.target.value);
											limparErro('credor');
										}}
									>
										<option value="">Selecione o banco ou a pessoa</option>
										<optgroup label="Bancos">
											{bancos.map((b) => (
												<option key={`b${b.id}`} value={`b:${b.id}`}>
													{b.nome}
												</option>
											))}
										</optgroup>
										<optgroup label="Pessoas">
											{pessoas.map((p) => (
												<option key={`p${p.id}`} value={`p:${p.id}`}>
													{p.nome}
												</option>
											))}
										</optgroup>
									</select>
									{erro('credor')}
								</div>
								<div>
									<label htmlFor="ren-tomador" className="text-sm">
										Tomador (responsável)
									</label>
									<input
										id="ren-tomador"
										className={inputClass}
										value={responsavel}
										onChange={(e) => {
											marcar();
											setResponsavel(e.target.value);
										}}
									/>
								</div>
								<div>
									<label htmlFor="ren-valor" className="text-sm">
										Valor contratado <span className="text-red-500">*</span>
									</label>
									{dinheiro('ren-valor', valorNovo, (v) => {
										setValorNovo(v);
										limparErro('valorNovo');
										valorDoContratoMudou(v);
									})}
									{erro('valorNovo')}
								</div>
								<div>
									<label htmlFor="ren-taxa" className="text-sm">
										Taxa de juros ao ano (%)
									</label>
									<input
										id="ren-taxa"
										type="text"
										inputMode="decimal"
										className={inputClass}
										placeholder="Ex.: 12,5"
										value={taxaNovo}
										onChange={(e) => {
											marcar();
											setTaxaNovo(e.target.value);
											limparErro('taxaNovo');
										}}
									/>
									{erro('taxaNovo')}
								</div>
								<div>
									<label htmlFor="ren-modalidade" className="text-sm">
										Modalidade
									</label>
									<select
										id="ren-modalidade"
										className={inputClass}
										value={modalidade}
										onChange={(e) => {
											marcar();
											setModalidade(e.target.value);
										}}
									>
										<option value="RENEGOCIACAO">Renegociação</option>
										<option value="INVESTIMENTO">Investimento</option>
										<option value="CUSTEIO">Custeio</option>
										<option value="PARTICULAR">Particular</option>
									</select>
								</div>
								{modalidade === 'PARTICULAR' && (
									<div>
										<label htmlFor="ren-nome-particular" className="text-sm">
											Nome (Particular) <span className="text-red-500">*</span>
										</label>
										<input
											id="ren-nome-particular"
											className={inputClass}
											value={nomeParticular}
											onChange={(e) => {
												marcar();
												setNomeParticular(e.target.value);
												limparErro('nomeParticular');
											}}
										/>
										{erro('nomeParticular')}
									</div>
								)}
								<div>
									<label htmlFor="ren-garantia" className="text-sm">
										Nº garantia
									</label>
									<input
										id="ren-garantia"
										className={inputClass}
										value={garantia}
										onChange={(e) => {
											marcar();
											setGarantia(e.target.value);
										}}
									/>
								</div>
								<div className="col-span-1 sm:col-span-2">
									<label htmlFor="ren-obs" className="text-sm">
										Observação
									</label>
									<textarea
										id="ren-obs"
										className={inputClass}
										value={observacaoNovo}
										onChange={(e) => {
											marcar();
											setObservacaoNovo(e.target.value);
										}}
									/>
								</div>
							</>
						)}
					</div>

					{/* Novas parcelas */}
					<div className="w-full">
						<h3 className="font-semibold text-sm sm:text-base">Novas parcelas</h3>
						<div className="border-t pt-3 mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
							<div>
								<label htmlFor="ren-qtd" className="text-sm">
									Quantidade
								</label>
								<input
									id="ren-qtd"
									type="number"
									min={1}
									step={1}
									inputMode="numeric"
									className="border p-2 rounded w-full text-sm"
									value={quantidade}
									onChange={(e) => setQuantidade(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="ren-primeiro" className="text-sm">
									1º vencimento
								</label>
								<input
									id="ren-primeiro"
									type="date"
									className="border p-2 rounded w-full text-sm"
									value={primeiroVencimento}
									onChange={(e) => setPrimeiroVencimento(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="ren-periodicidade" className="text-sm">
									Periodicidade
								</label>
								<select
									id="ren-periodicidade"
									className="border p-2 rounded w-full text-sm"
									value={periodicidade}
									onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
								>
									<option value="mensal">Mensal</option>
									<option value="trimestral">Trimestral</option>
									<option value="semestral">Semestral</option>
									<option value="anual">Anual</option>
								</select>
							</div>
							<div>
								<label htmlFor="ren-base" className="text-sm">
									Valor a parcelar
								</label>
								<CurrencyInput
									id="ren-base"
									className="border p-2 rounded w-full text-sm"
									{...PROPS_MOEDA_BRL}
									prefix="R$ "
									allowNegativeValue={false}
									value={valorBase}
									onValueChange={(v) => {
										baseEditadaRef.current = true;
										setValorBase(v ?? '');
									}}
								/>
							</div>
							<div>
								<label htmlFor="ren-juros" className="text-sm">
									+ Juros (R$)
								</label>
								<CurrencyInput
									id="ren-juros"
									className="border p-2 rounded w-full text-sm"
									{...PROPS_MOEDA_BRL}
									prefix="R$ "
									allowNegativeValue={false}
									value={juros}
									onValueChange={(v) => setJuros(v ?? '')}
								/>
							</div>
							<button
								type="button"
								onClick={gerar}
								className="bg-primary text-white px-4 py-2 rounded hover:bg-orange-500 transition w-full text-sm"
							>
								Gerar parcelas <FontAwesomeIcon icon={faGear} className="ml-2" />
							</button>
						</div>
						{erros.gerador && <p className="text-red-500 text-xs mt-1">{erros.gerador}</p>}
						<p className="text-xs text-gray-500 mt-2">
							Cada parcela = (valor + juros) ÷ quantidade; os centavos que sobram vão para a última. A lista já vem com as parcelas
							que estão a vencer hoje: ajuste datas e valores ou gere de novo.
						</p>

						<div className="max-h-72 overflow-y-auto mt-3 overflow-x-auto">
							<table className="w-full border min-w-[420px]">
								<thead className="bg-gray-100 sticky top-0">
									<tr>
										<th className="p-2 text-xs sm:text-sm">Parcela</th>
										<th className="p-2 text-xs sm:text-sm">Vencimento</th>
										<th className="p-2 text-xs sm:text-sm">Valor</th>
										<th className="p-2 text-xs sm:text-sm w-10">
											<span className="sr-only">Remover</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{linhas.length === 0 ? (
										<tr>
											<td colSpan={4} className="text-center py-3 text-gray-500 italic text-xs sm:text-sm">
												Nenhuma parcela nova ainda
											</td>
										</tr>
									) : (
										linhas.map((l) => (
											<tr key={l.chave} className="text-center border-t">
												<td className="p-1 text-xs sm:text-sm">{l.numParcela}</td>
												<td className="p-1">
													<input
														type="date"
														aria-label={`Vencimento da parcela ${l.numParcela}`}
														value={l.dt_vencimento}
														onChange={(e) => alterarLinha(l.chave, 'dt_vencimento', e.target.value)}
														className="border p-1 rounded text-xs sm:text-sm w-full"
													/>
												</td>
												<td className="p-1">
													<CurrencyInput
														aria-label={`Valor da parcela ${l.numParcela}`}
														className="w-full p-1 border border-gray-300 rounded text-xs sm:text-sm"
														{...PROPS_MOEDA_BRL}
														prefix="R$ "
														allowNegativeValue={false}
														value={textosValor[l.chave] ?? paraTexto(l.valor)}
														onValueChange={(v) => {
															setTextosValor((prev) => ({ ...prev, [l.chave]: v ?? '' }));
															alterarLinha(l.chave, 'valor', lerDinheiro(v ?? '') ?? 0);
														}}
													/>
												</td>
												<td className="p-1">
													<button
														type="button"
														className="text-red-500 hover:text-red-700"
														title="Remover esta parcela"
														aria-label={`Remover a parcela ${l.numParcela}`}
														onClick={() => {
															marcar();
															setLinhas((prev) => renumerar(prev.filter((x) => x.chave !== l.chave), inicioNumeracao));
														}}
													>
														<FontAwesomeIcon icon={faTrash} />
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
								<tfoot className="bg-gray-50 text-xs sm:text-sm">
									<tr className="border-t">
										<td colSpan={2} className="p-2 text-right text-gray-600">
											Total das novas parcelas
										</td>
										<td className="p-2 text-center font-semibold">{brl(total)}</td>
										<td />
									</tr>
									<tr>
										<td colSpan={4} className="p-2 text-right font-medium text-gray-800">
											{textoDiferenca(total, situacao.valorAberto)}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
						<button
							type="button"
							className="mt-2 text-sm text-blue-700 hover:underline flex items-center gap-1"
							onClick={() => {
								marcar();
								limparErro('parcelas');
								setLinhas((prev) => [...prev, novaLinha(prev, inicioNumeracao, hojeISO())]);
							}}
						>
							<FontAwesomeIcon icon={faPlus} /> Adicionar parcela
						</button>
						{erro('parcelas')}
					</div>
				</div>

				<div className="flex flex-col sm:flex-row justify-end gap-3 border-t px-4 sm:px-6 py-4">
					<button onClick={pedirFechar} className="text-gray-600 font-semibold hover:bg-gray-200 px-4 py-2 rounded text-sm sm:text-base">
						Cancelar
					</button>
					<button
						onClick={pedirConfirmacao}
						className="bg-primary hover:bg-orange-600 font-semibold text-white px-4 py-2 rounded flex items-center justify-center text-sm sm:text-base"
					>
						Renegociar <FontAwesomeIcon icon={faHandshake} className="ml-2" />
					</button>
				</div>
			</Modal>

			<DialogModal
				isOpen={confirmar}
				onClose={() => setConfirmar(false)}
				onConfirm={salvar}
				title={tipo === 'ADITIVO' ? 'Confirmar o aditivo?' : 'Confirmar o novo contrato?'}
				type="warn"
				message={mensagemConfirmacao({
					tipo,
					situacao,
					qtdNovas: linhas.length,
					valorNovas: total,
					numeroContratoNovo: numeroNovo.trim(),
				})}
				confirmLabel="Confirmar renegociação"
				cancelLabel="Voltar"
			/>

			<DialogModal
				isOpen={descartar}
				onClose={() => setDescartar(false)}
				onConfirm={async () => {
					setDescartar(false);
					onClose();
				}}
				title="Descartar a renegociação?"
				type="warn"
				message="Nada foi gravado ainda. Sair e descartar o que foi digitado?"
				confirmLabel="Sair sem salvar"
				cancelLabel="Continuar editando"
			/>
		</>
	);
};

export default ModalRenegociacao;
