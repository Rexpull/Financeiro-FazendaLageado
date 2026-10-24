import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSearch } from "@fortawesome/free-solid-svg-icons";
import { ContaCorrente } from "../../../../../backend/src/models/ContaCorrente";
import { anosFiltroFluxo } from "./fluxoMensalRegras";

Modal.setAppElement("#root");

interface Props {
	isOpen: boolean;
	onClose: () => void;
	contasDisponiveis: ContaCorrente[];
	anoSelecionado: string;
	contasSelecionadas: string[];
	/** The Fluxo is always grouped by centro de custos (the plano de contas layout was removed). */
	onAplicarFiltro: (ano: string, contas: string[]) => void;
}

/** "1234-5 - Banco do Brasil - BB GFS" without "undefined" pieces; inactive accounts are flagged. */
const rotuloConta = (conta: ContaCorrente) => {
	const texto = [conta.numConta || conta.numCartao, conta.bancoNome, conta.responsavel].filter(Boolean).join(" - ") || `Conta ${conta.id}`;
	const inativa = conta.ativo === false || (conta.ativo as unknown) === 0;
	return inativa ? `${texto} (inativa)` : texto;
};

const FiltroFluxoCaixaModal: React.FC<Props> = ({
	isOpen,
	onClose,
	contasDisponiveis,
	anoSelecionado,
	contasSelecionadas,
	onAplicarFiltro,
}) => {
	const [ano, setAno] = useState<string>(anoSelecionado);
	const [contasSelecionadasLocal, setContasSelecionadasLocal] = useState<string[]>([]);
	const [erro, setErro] = useState("");
	// 2024 … next year (was hardcoded up to 2026)
	const anos = anosFiltroFluxo();

	useEffect(() => {
		if (isOpen) {
			setAno(anoSelecionado);
			setContasSelecionadasLocal(contasSelecionadas.map((id) => id.toString()));
			setErro("");
		}
	}, [isOpen, anoSelecionado, contasSelecionadas]);

	const toggleConta = (id: string) => {
		setErro("");
		setContasSelecionadasLocal((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
	};

	const todasMarcadas = contasDisponiveis.length > 0 && contasDisponiveis.every((c) => contasSelecionadasLocal.includes(c.id.toString()));
	const marcarTodas = () => {
		setErro("");
		setContasSelecionadasLocal(contasDisponiveis.map((c) => c.id.toString()));
	};
	const desmarcarTodas = () => setContasSelecionadasLocal([]);

	const aplicarFiltro = () => {
		const contasFiltradas = contasSelecionadasLocal.filter((id) => contasDisponiveis.some((conta) => conta.id.toString() === id));
		if (contasFiltradas.length === 0) {
			setErro("Selecione pelo menos uma conta corrente para gerar o fluxo de caixa.");
			return;
		}
		onAplicarFiltro(ano, contasFiltradas);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[600px] mx-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		>
			<div className="flex justify-between items-center bg-gray-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-lg font-semibold text-gray-800">Filtrar Fluxo de Caixa</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1" aria-label="Fechar">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>

			<div className="px-5 py-4 space-y-3">
				<div>
					<div className="flex flex-wrap items-center justify-between gap-2 mb-1">
						<label className="font-semibold block">
							Selecione as contas correntes{" "}
							<span className="font-normal text-sm text-gray-500">
								({contasSelecionadasLocal.length} de {contasDisponiveis.length})
							</span>
						</label>
						<button
							type="button"
							className="text-sm font-medium text-blue-600 hover:underline"
							onClick={todasMarcadas ? desmarcarTodas : marcarTodas}
						>
							{todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
						</button>
					</div>
					<div className={`max-h-48 overflow-y-auto border rounded p-2 bg-gray-50 ${erro ? "border-red-400" : ""}`}>
						{contasDisponiveis.map((conta: ContaCorrente) => {
							const contaId = conta.id.toString();
							const isChecked = contasSelecionadasLocal.includes(contaId);
							return (
								<div key={conta.id} className="flex items-center gap-2 py-1">
									<input
										type="checkbox"
										id={`conta-${conta.id}`}
										checked={isChecked}
										onChange={() => toggleConta(contaId)}
										className="h-4 w-4"
									/>
									<label htmlFor={`conta-${conta.id}`} className="cursor-pointer">
										{rotuloConta(conta)}
									</label>
								</div>
							);
						})}
					</div>
					{erro && (
						<p className="text-sm text-red-600 mt-1" role="alert">
							{erro}
						</p>
					)}
					<p className="text-xs text-gray-500 mt-1">
						Financiamentos (quitados e créditos novos) não dependem das contas selecionadas.
					</p>
				</div>

				<div>
					<label className="font-semibold block mb-1" htmlFor="fluxo-filtro-ano">
						Ano
					</label>
					<select
						id="fluxo-filtro-ano"
						value={ano}
						onChange={(e) => setAno((e.target as HTMLSelectElement).value)}
						className="w-full border px-3 py-2 rounded bg-white"
					>
						{anos.map((a) => (
							<option key={a} value={a}>
								{a}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="flex flex-wrap justify-end gap-3 px-5 py-4 border-t">
				<button
					type="button"
					className="bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded hover:bg-gray-100"
					onClick={onClose}
				>
					Cancelar
				</button>
				<button
					type="button"
					className="bg-orange-500 text-white font-bold px-4 py-2 rounded hover:bg-orange-600 flex items-center gap-2"
					onClick={aplicarFiltro}
				>
					<FontAwesomeIcon icon={faSearch} />
					Gerar Fluxo de Caixa
				</button>
			</div>
		</Modal>
	);
};

export default FiltroFluxoCaixaModal;
