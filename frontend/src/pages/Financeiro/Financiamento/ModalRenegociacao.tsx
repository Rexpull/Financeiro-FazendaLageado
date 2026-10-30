import React, { useEffect, useRef, useState } from 'react';
import CurrencyInput from 'react-currency-input-field';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCircleCheck, faHandshake, faPlus, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
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
	erroTaxa,
	gerarParcelas,
	limparTaxa,
	venceAntes,
	mensagemConfirmacao,
	montarPayload,
	mudancasCondicoes,
	novaLinha,
	primeiroNumero,
	renumerar,
	situacaoContrato,
	totalLinhas,
	type InicioParcelas,
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

const CLASSE_BASE =
	'w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2';
const classeCampo = (invalido = false) =>
	`${CLASSE_BASE} h-10 ${invalido ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-[#FA500C] focus:ring-orange-100'}`;
const CLASSE_TEXTO = `${CLASSE_BASE} py-2 border-gray-300 focus:border-[#FA500C] focus:ring-orange-100 resize-y`;
const classeCelula = (invalido = false) => `${CLASSE_CELULA_BASE} ${invalido ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`;
const CLASSE_CELULA_BASE =
	'w-full h-9 rounded-md border px-2 text-sm focus:outline-none focus:border-[#FA500C] focus:ring-2 focus:ring-orange-100';
const TITULO_SECAO = 'mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500';

/** Label + field + one line below (the error, or else the hint), so fields side by side stay aligned. */
const Campo: React.FC<{
	id: string;
	rotulo: string;
	obrigatorio?: boolean;
	ajuda?: string;
	erro?: string;
	className?: string;
	children: React.ReactNode;
}> = ({ id, rotulo, obrigatorio, ajuda, erro, className, children }) => (
	<div className={className}>
		<label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 whitespace-nowrap">
			{rotulo}
			{obrigatorio && <span className="text-red-500"> *</span>}
		</label>
		{children}
		{erro ? (
			<p className="mt-1 text-xs text-red-600" data-erro>
				{erro}
			</p>
		) : ajuda ? (
			<p className="mt-1 text-xs text-gray-500">{ajuda}</p>
		) : null}
	</div>
);

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
	const corpoRef = useRef<HTMLDivElement>(null);
	// bumped on each failed "Renegociar": scrolls to (and focuses) the first field with an error
	const [tentativa, setTentativa] = useState(0);
	useEffect(() => {
		if (!tentativa) return;
		const primeiro = corpoRef.current?.querySelector<HTMLElement>('[data-erro]');
		if (!primeiro) return;
		primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
		primeiro.parentElement?.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
	}, [tentativa]);

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
		const datas = s.abertas
			.map((p) => String(p.dt_vencimento ?? '').slice(0, 10))
			.filter(Boolean)
			.sort();
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
				.map((p, i) => ({
					chave: i + 1,
					numParcela: inicio + i,
					dt_vencimento: String(p.dt_vencimento ?? '').slice(0, 10),
					valor: Number(p.valor) || 0,
				})),
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

	// a new parcela cannot be due before the aditivo / the new contract
	const inicio: InicioParcelas =
		tipo === 'ADITIVO' ? { data: dataAditivo, rotulo: 'do aditivo' } : { data: dataNovo, rotulo: 'do novo contrato' };
	/** Which generator field the error is about (to mark it red). */
	const campoGerador = (erro = erros.gerador) =>
		!erro
			? null
			: /quantidade/i.test(erro)
				? 'qtd'
				: /vencimento/i.test(erro)
					? 'primeiro'
					: /valor a parcelar/i.test(erro)
						? 'base'
						: null;

	const gerar = () => {
		const r = gerarParcelas({
			quantidade,
			primeiroVencimento,
			periodicidade,
			valor: lerDinheiro(valorBase) ?? 0,
			juros: lerDinheiro(juros) ?? 0,
			numeroInicial: inicioNumeracao,
		});
		const erro = !r.ok
			? r.erro
			: inicio.data && primeiroVencimento < inicio.data
				? `O 1º vencimento não pode ser antes da data ${inicio.rotulo} (${formatarDataISO(inicio.data)}).`
				: null;
		if (erro || !r.ok) {
			setErros((prev) => ({ ...prev, gerador: erro ?? '' }));
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
			if (novoValorAditivo.trim() && !((lerDinheiro(novoValorAditivo) ?? 0) > 0))
				e.novoValorAditivo = 'O novo valor deve ser maior que zero.';
			const erroTaxaAditivo = erroTaxa(novaTaxaAditivo);
			if (erroTaxaAditivo) e.novaTaxaAditivo = erroTaxaAditivo;
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
			if (!((lerDinheiro(valorNovo) ?? 0) > 0)) e.valorNovo = 'Informe o valor contratado.';
			const erroTaxaNovo = erroTaxa(taxaNovo);
			if (erroTaxaNovo) e.taxaNovo = erroTaxaNovo;
			if (modalidade === 'PARTICULAR' && !nomeParticular.trim()) e.nomeParticular = 'Informe o nome quando a modalidade é Particular.';
		}
		const erroTabela = erroLinhas(linhas, inicio);
		if (erroTabela) e.parcelas = erroTabela;
		setErros(e);
		return Object.keys(e).length === 0;
	};

	const pedirConfirmacao = () => {
		// no toast here: it would open over this button (bottom-right) and stay while the mouse is on it
		if (!validar()) {
			setTentativa((n) => n + 1);
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
			toast.error(error instanceof Error && error.message ? error.message : 'Erro ao renegociar o contrato.', {
				autoClose: false,
				position: 'top-center',
			});
			throw error; // keeps the confirmation open
		}
	};

	const pedirFechar = () => {
		if (alteradoRef.current) setDescartar(true);
		else onClose();
	};

	const dinheiro = (
		id: string,
		valor: string,
		onChange: (v: string) => void,
		opcoes: { placeholder?: string; invalido?: boolean } = {},
	) => (
		<CurrencyInput
			id={id}
			className={classeCampo(opcoes.invalido)}
			{...PROPS_MOEDA_BRL}
			decimalScale={2}
			prefix="R$ "
			allowNegativeValue={false}
			placeholder={opcoes.placeholder}
			value={valor}
			onValueChange={(v) => {
				marcar();
				onChange(v ?? '');
			}}
		/>
	);

	const opcaoTipo = (valor: TipoRenegociacao, titulo: string, descricao: string) => {
		const ativo = tipo === valor;
		return (
			<label
				className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
					ativo ? 'border-[#FA500C] bg-orange-50 ring-1 ring-[#FA500C]' : 'border-gray-300 bg-white hover:border-gray-400'
				}`}
			>
				<input
					type="radio"
					name="tipoRenegociacao"
					value={valor}
					checked={ativo}
					onChange={() => trocarTipo(valor)}
					className="mt-0.5 h-4 w-4 shrink-0 accent-[#FA500C]"
				/>
				<span>
					<span className="block text-sm font-semibold text-gray-900">{titulo}</span>
					<span className="block text-xs text-gray-600 mt-0.5 leading-snug">{descricao}</span>
				</span>
			</label>
		);
	};

	const hoje = hojeISO();
	const abertasOrdenadas = [...situacao.abertas].sort(
		(a, b) => String(a.dt_vencimento).localeCompare(String(b.dt_vencimento)) || a.numParcela - b.numParcela,
	);
	const diferenca = Math.round((total - situacao.valorAberto) * 100) / 100;
	const taxaAtual =
		financiamento.taxaJurosAnual != null && Number(financiamento.taxaJurosAnual) <= 100
			? `${String(financiamento.taxaJurosAnual).replace('.', ',')}% a.a.`
			: null;
	const qtd = (n: number) => `${n} ${n === 1 ? 'parcela' : 'parcelas'}`;

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={pedirFechar}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-xl w-full max-w-[1180px] mx-auto max-h-[92vh] flex flex-col overflow-hidden outline-none"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-150 p-4"
				contentLabel="Renegociar contrato"
			>
				{/* Cabeçalho: o contrato e as condições de hoje */}
				<div className="shrink-0 flex justify-between items-start gap-4 bg-yellow-100 px-6 py-4 border-b">
					<div className="min-w-0">
						<h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
							<FontAwesomeIcon icon={faHandshake} /> Renegociar contrato {financiamento.numeroContrato}
						</h2>
						<dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
							<div className="flex gap-1">
								<dt className="text-gray-500">Credor</dt>
								<dd className="font-medium">{nomeCredor}</dd>
							</div>
							<div className="flex gap-1">
								<dt className="text-gray-500">Tomador</dt>
								<dd className="font-medium">{financiamento.responsavel || '—'}</dd>
							</div>
							<div className="flex gap-1">
								<dt className="text-gray-500">Valor contratado</dt>
								<dd className="font-medium">{brl(financiamento.valor)}</dd>
							</div>
							{taxaAtual && (
								<div className="flex gap-1">
									<dt className="text-gray-500">Taxa</dt>
									<dd className="font-medium">{taxaAtual}</dd>
								</div>
							)}
						</dl>
					</div>
					<button onClick={pedirFechar} className="text-gray-500 hover:text-gray-700 p-1" aria-label="Fechar" title="Fechar">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</button>
				</div>

				<div ref={corpoRef} className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
					{/* Esquerda: tipo, condições e o que sai */}
					<div className="p-6 space-y-6 lg:border-r border-gray-200">
						<section>
							<h3 className={TITULO_SECAO}>Tipo de renegociação</h3>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo de renegociação">
								{opcaoTipo('ADITIVO', 'Aditivo', 'Mantém o número. Troca as parcelas em aberto e, se quiser, a taxa.')}
								{opcaoTipo('NOVO_CONTRATO', 'Novo contrato', 'Este fica como "Renegociado" e as parcelas vão para outro número.')}
							</div>
						</section>

						<section>
							<h3 className={TITULO_SECAO}>{tipo === 'ADITIVO' ? 'Condições do aditivo' : 'Dados do novo contrato'}</h3>
							{tipo === 'ADITIVO' ? (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
									<Campo id="ren-data-aditivo" rotulo="Data do aditivo" obrigatorio erro={erros.dataAditivo}>
										<input
											id="ren-data-aditivo"
											type="date"
											min={dataMinima}
											max={dataMaxima}
											className={classeCampo(!!erros.dataAditivo)}
											value={dataAditivo}
											onChange={(e) => {
												marcar();
												setDataAditivo(e.target.value);
												limparErro('dataAditivo');
											}}
										/>
									</Campo>
									<Campo id="ren-taxa-aditivo" rotulo="Nova taxa (% a.a.)" ajuda="Vazio mantém a taxa atual." erro={erros.novaTaxaAditivo}>
										<input
											id="ren-taxa-aditivo"
											type="text"
											inputMode="decimal"
											className={classeCampo(!!erros.novaTaxaAditivo)}
											placeholder={taxaAtual ? `Atual: ${taxaAtual.replace(' a.a.', '')}` : 'Ex.: 12,5'}
											value={novaTaxaAditivo}
											onChange={(e) => {
												marcar();
												setNovaTaxaAditivo(limparTaxa(e.target.value));
												limparErro('novaTaxaAditivo');
											}}
										/>
									</Campo>
									<Campo
										id="ren-valor-aditivo"
										rotulo="Novo valor do contrato"
										ajuda="Vazio mantém o valor contratado."
										erro={erros.novoValorAditivo}
										className="sm:col-span-2"
									>
										{dinheiro(
											'ren-valor-aditivo',
											novoValorAditivo,
											(v) => {
												setNovoValorAditivo(v);
												limparErro('novoValorAditivo');
											},
											{ placeholder: `Atual: ${brl(financiamento.valor)}`, invalido: !!erros.novoValorAditivo },
										)}
									</Campo>
									<Campo id="ren-obs-aditivo" rotulo="Observação" className="sm:col-span-2">
										<textarea
											id="ren-obs-aditivo"
											rows={2}
											className={CLASSE_TEXTO}
											placeholder={`Fica no contrato como "Aditivo em ${formatarDataISO(dataAditivo)}"`}
											value={observacaoAditivo}
											onChange={(e) => {
												marcar();
												setObservacaoAditivo(e.target.value);
											}}
										/>
									</Campo>
								</div>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
									<Campo id="ren-numero" rotulo="Nº do novo contrato" obrigatorio erro={erros.numeroNovo}>
										<input
											id="ren-numero"
											className={classeCampo(!!erros.numeroNovo)}
											value={numeroNovo}
											onChange={(e) => {
												marcar();
												setNumeroNovo(e.target.value);
												limparErro('numeroNovo');
											}}
										/>
									</Campo>
									<Campo id="ren-data-contrato" rotulo="Data do contrato" obrigatorio erro={erros.dataNovo}>
										<input
											id="ren-data-contrato"
											type="date"
											min={dataMinima}
											max={dataMaxima}
											className={classeCampo(!!erros.dataNovo)}
											value={dataNovo}
											onChange={(e) => {
												marcar();
												setDataNovo(e.target.value);
												limparErro('dataNovo');
											}}
										/>
									</Campo>
									<Campo id="ren-credor" rotulo="Credor" obrigatorio erro={erros.credor} className="sm:col-span-2">
										<select
											id="ren-credor"
											className={classeCampo(!!erros.credor)}
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
									</Campo>
									<Campo id="ren-valor" rotulo="Valor contratado" obrigatorio erro={erros.valorNovo}>
										{dinheiro(
											'ren-valor',
											valorNovo,
											(v) => {
												setValorNovo(v);
												limparErro('valorNovo');
												valorDoContratoMudou(v);
											},
											{ invalido: !!erros.valorNovo },
										)}
									</Campo>
									<Campo id="ren-taxa" rotulo="Taxa (% a.a.)" erro={erros.taxaNovo}>
										<input
											id="ren-taxa"
											type="text"
											inputMode="decimal"
											className={classeCampo(!!erros.taxaNovo)}
											placeholder="Ex.: 12,5"
											value={taxaNovo}
											onChange={(e) => {
												marcar();
												setTaxaNovo(limparTaxa(e.target.value));
												limparErro('taxaNovo');
											}}
										/>
									</Campo>
									<Campo id="ren-tomador" rotulo="Tomador (responsável)">
										<input
											id="ren-tomador"
											className={classeCampo()}
											value={responsavel}
											onChange={(e) => {
												marcar();
												setResponsavel(e.target.value);
											}}
										/>
									</Campo>
									<Campo id="ren-garantia" rotulo="Nº garantia">
										<input
											id="ren-garantia"
											className={classeCampo()}
											value={garantia}
											onChange={(e) => {
												marcar();
												setGarantia(e.target.value);
											}}
										/>
									</Campo>
									<Campo id="ren-modalidade" rotulo="Modalidade">
										<select
											id="ren-modalidade"
											className={classeCampo()}
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
									</Campo>
									{modalidade === 'PARTICULAR' && (
										<Campo id="ren-nome-particular" rotulo="Nome (Particular)" obrigatorio erro={erros.nomeParticular}>
											<input
												id="ren-nome-particular"
												className={classeCampo(!!erros.nomeParticular)}
												value={nomeParticular}
												onChange={(e) => {
													marcar();
													setNomeParticular(e.target.value);
													limparErro('nomeParticular');
												}}
											/>
										</Campo>
									)}
									<Campo id="ren-obs" rotulo="Observação" className="sm:col-span-2">
										<textarea
											id="ren-obs"
											rows={2}
											className={CLASSE_TEXTO}
											value={observacaoNovo}
											onChange={(e) => {
												marcar();
												setObservacaoNovo(e.target.value);
											}}
										/>
									</Campo>
								</div>
							)}
						</section>
					</div>

					{/* Direita: novas parcelas */}
					<div className="p-6 space-y-6 bg-gray-50/60">
						<section>
							<h3 className={TITULO_SECAO}>Parcelas em aberto que serão substituídas</h3>
							<div className="rounded-lg border border-gray-200 overflow-hidden">
								<div className="max-h-48 overflow-y-auto">
									<table className="w-full text-sm">
										<tbody className="divide-y divide-gray-100">
											{abertasOrdenadas.map((p) => {
												const vencida = String(p.dt_vencimento ?? '').slice(0, 10) < hoje;
												return (
													<tr key={p.id ?? p.numParcela}>
														<td className="px-3 py-2 text-gray-500 w-10 tabular-nums">{p.numParcela}</td>
														<td className="px-3 py-2 tabular-nums">{formatarDataISO(String(p.dt_vencimento ?? '').slice(0, 10))}</td>
														<td className="px-3 py-2">
															<span
																className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
																	vencida ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
																}`}
															>
																{vencida ? 'Vencida' : 'A vencer'}
															</span>
														</td>
														<td className="px-3 py-2 text-right tabular-nums">{brl(p.valor)}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
								<div className="flex justify-between bg-gray-50 border-t border-gray-200 px-3 py-2 text-sm">
									<span className="text-gray-600">{qtd(situacao.qtdAbertas)} em aberto</span>
									<span className="font-semibold tabular-nums">{brl(situacao.valorAberto)}</span>
								</div>
							</div>
							{situacao.qtdPagas > 0 && (
								<p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
									<FontAwesomeIcon icon={faCircleCheck} className="text-green-600" />
									{`${qtd(situacao.qtdPagas)} já paga${situacao.qtdPagas === 1 ? '' : 's'} (${brl(situacao.valorPago)}) continua${situacao.qtdPagas === 1 ? '' : 'm'} como está.`}
								</p>
							)}
						</section>

						<section className="space-y-4">
							<h3 className={`${TITULO_SECAO} !mb-0`}>Novas parcelas</h3>

							<div className="rounded-lg border border-gray-200 bg-white p-4">
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-3">
									<Campo id="ren-qtd" rotulo="Quantidade">
										<input
											id="ren-qtd"
											type="number"
											min={1}
											step={1}
											inputMode="numeric"
											className={classeCampo(campoGerador() === 'qtd')}
											value={quantidade}
											onChange={(e) => {
												setQuantidade(e.target.value);
												limparErro('gerador');
											}}
										/>
									</Campo>
									<Campo id="ren-primeiro" rotulo="1º vencimento">
										<input
											id="ren-primeiro"
											type="date"
											min={inicio.data || undefined}
											className={classeCampo(campoGerador() === 'primeiro')}
											value={primeiroVencimento}
											onChange={(e) => {
												setPrimeiroVencimento(e.target.value);
												limparErro('gerador');
											}}
										/>
									</Campo>
									<Campo id="ren-periodicidade" rotulo="Periodicidade">
										<select
											id="ren-periodicidade"
											className={classeCampo()}
											value={periodicidade}
											onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}
										>
											<option value="mensal">Mensal</option>
											<option value="trimestral">Trimestral</option>
											<option value="semestral">Semestral</option>
											<option value="anual">Anual</option>
										</select>
									</Campo>
									<Campo id="ren-base" rotulo="Valor a parcelar">
										<CurrencyInput
											id="ren-base"
											className={classeCampo(campoGerador() === 'base')}
											{...PROPS_MOEDA_BRL}
											decimalScale={2}
											prefix="R$ "
											allowNegativeValue={false}
											value={valorBase}
											onValueChange={(v) => {
												baseEditadaRef.current = true;
												setValorBase(v ?? '');
												limparErro('gerador');
											}}
										/>
									</Campo>
									<Campo id="ren-juros" rotulo="+ Juros (R$)">
										<CurrencyInput
											id="ren-juros"
											className={classeCampo()}
											{...PROPS_MOEDA_BRL}
											decimalScale={2}
											prefix="R$ "
											allowNegativeValue={false}
											value={juros}
											onValueChange={(v) => setJuros(v ?? '')}
										/>
									</Campo>
									<div className="flex flex-col justify-end">
										<button
											type="button"
											onClick={gerar}
											className="h-10 w-full rounded-md border border-[#FA500C] bg-white text-sm font-semibold text-[#FA500C] hover:bg-orange-50 transition"
										>
											Gerar parcelas
										</button>
									</div>
								</div>
								{erros.gerador ? (
									<p className="mt-2 text-xs text-red-600">{erros.gerador}</p>
								) : (
									<p className="mt-2 text-xs text-gray-500">
										(Valor + juros) ÷ quantidade. Os centavos que sobram vão para a última parcela.
									</p>
								)}
							</div>

							<div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
								<div className="max-h-[320px] overflow-y-auto">
									<table className="w-full text-sm">
										<thead className="bg-gray-50 sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-500">
											<tr>
												<th className="px-3 py-2 text-left font-medium w-12">Nº</th>
												<th className="pl-5 pr-3 py-2 text-left font-medium">Vencimento</th>
												<th className="pl-3 pr-5 py-2 text-right font-medium">Valor</th>
												<th className="px-2 py-2 w-10">
													<span className="sr-only">Remover</span>
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-100">
											{linhas.length === 0 ? (
												<tr>
													<td colSpan={4} className="px-3 py-6 text-center text-gray-500">
														Nenhuma parcela. Use "Gerar parcelas" ou "Adicionar parcela".
													</td>
												</tr>
											) : (
												linhas.map((l) => (
													<tr key={l.chave}>
														<td className="px-3 py-1.5 text-gray-500 tabular-nums">{l.numParcela}</td>
														<td className="px-3 py-1.5">
															<input
																type="date"
																aria-label={`Vencimento da parcela ${l.numParcela}`}
																value={l.dt_vencimento}
																onChange={(e) => alterarLinha(l.chave, 'dt_vencimento', e.target.value)}
																min={inicio.data || undefined}
																className={classeCelula((!!erros.parcelas && !l.dt_vencimento) || venceAntes(l, inicio))}
															/>
														</td>
														<td className="px-3 py-1.5">
															<CurrencyInput
																aria-label={`Valor da parcela ${l.numParcela}`}
																className={`${classeCelula(!!erros.parcelas && !(Number(l.valor) > 0))} text-right tabular-nums`}
																{...PROPS_MOEDA_BRL}
																decimalScale={2}
																prefix="R$ "
																allowNegativeValue={false}
																value={textosValor[l.chave] ?? paraTexto(l.valor)}
																onValueChange={(v) => {
																	setTextosValor((prev) => ({ ...prev, [l.chave]: v ?? '' }));
																	alterarLinha(l.chave, 'valor', lerDinheiro(v ?? '') ?? 0);
																}}
															/>
														</td>
														<td className="px-2 py-1.5 text-center">
															<button
																type="button"
																className="text-gray-400 hover:text-red-600 p-1"
																title="Remover esta parcela"
																aria-label={`Remover a parcela ${l.numParcela}`}
																onClick={() => {
																	marcar();
																	setLinhas((prev) =>
																		renumerar(
																			prev.filter((x) => x.chave !== l.chave),
																			inicioNumeracao,
																		),
																	);
																}}
															>
																<FontAwesomeIcon icon={faTrash} />
															</button>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
								<div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-sm">
									<button
										type="button"
										className="text-blue-700 hover:underline flex items-center gap-1.5 font-medium"
										onClick={() => {
											marcar();
											limparErro('parcelas');
											setLinhas((prev) => [...prev, novaLinha(prev, inicioNumeracao, hojeISO())]);
										}}
									>
										<FontAwesomeIcon icon={faPlus} /> Adicionar parcela
									</button>
									<span className="text-gray-600">
										Total <span className="ml-2 font-semibold text-gray-900 tabular-nums">{brl(total)}</span>
									</span>
								</div>
							</div>
							{erros.parcelas ? (
								<p className="text-xs text-red-600" data-erro>
									{erros.parcelas}
								</p>
							) : (
								linhas.some((l) => venceAntes(l, inicio)) && (
									<p className="text-xs text-red-600">
										Em vermelho: vence antes da data {inicio.rotulo} ({formatarDataISO(inicio.data)}). Mude a data ou gere as parcelas de
										novo.
									</p>
								)
							)}
						</section>
					</div>
				</div>

				{/* Rodapé: antes → depois, sempre à vista */}
				<div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t bg-white px-6 py-4">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-live="polite">
						<div>
							<span className="block text-xs text-gray-500">Em aberto hoje</span>
							<span className="font-semibold tabular-nums">
								{brl(situacao.valorAberto)} <span className="font-normal text-gray-500">· {qtd(situacao.qtdAbertas)}</span>
							</span>
						</div>
						<FontAwesomeIcon icon={faArrowRight} className="hidden sm:inline text-gray-400" />
						<div>
							<span className="block text-xs text-gray-500">Depois da renegociação</span>
							<span className="font-semibold tabular-nums">
								{brl(total)} <span className="font-normal text-gray-500">· {qtd(linhas.length)}</span>
							</span>
						</div>
						<span
							className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
								diferenca > 0
									? 'bg-orange-100 text-orange-800'
									: diferenca < 0
										? 'bg-green-100 text-green-800'
										: 'bg-gray-100 text-gray-600'
							}`}
						>
							{diferenca === 0 ? 'Sem diferença' : `${diferenca > 0 ? '+' : '−'}${brl(Math.abs(diferenca))}`}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-3 justify-end">
						{Object.keys(erros).length > 0 && (
							<span className="text-sm text-red-600" role="alert">
								Corrija os campos em vermelho.
							</span>
						)}
						<button
							onClick={pedirFechar}
							className="h-10 px-4 rounded-md border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 text-sm"
						>
							Cancelar
						</button>
						<button
							onClick={pedirConfirmacao}
							className="h-10 px-5 rounded-md bg-primary hover:opacity-90 font-semibold text-white flex items-center justify-center gap-2 text-sm"
						>
							<FontAwesomeIcon icon={faHandshake} /> Renegociar
						</button>
					</div>
				</div>
			</Modal>

			<DialogModal
				isOpen={confirmar}
				onClose={() => setConfirmar(false)}
				onConfirm={salvar}
				title={tipo === 'ADITIVO' ? 'Confirmar o aditivo?' : 'Confirmar o novo contrato?'}
				type="warn"
				message={`${mensagemConfirmacao({
					tipo,
					situacao,
					qtdNovas: linhas.length,
					valorNovas: total,
					numeroContratoNovo: numeroNovo.trim(),
				})}${
					tipo === 'ADITIVO'
						? `\n\n${mudancasCondicoes({
								taxaAtual: financiamento.taxaJurosAnual,
								taxaNova: novaTaxaAditivo.trim() ? lerDinheiro(novaTaxaAditivo) : null,
								valorAtual: financiamento.valor,
								valorNovo: novoValorAditivo.trim() ? lerDinheiro(novoValorAditivo) : null,
							})}`.trimEnd()
						: ''
				}`}
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
