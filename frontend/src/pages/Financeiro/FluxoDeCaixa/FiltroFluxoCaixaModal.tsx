import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTimes, faSearch } from "@fortawesome/free-solid-svg-icons";
import { ContaCorrente } from "../../../../../backend/src/models/ContaCorrente";

Modal.setAppElement("#root");

interface Props {
	isOpen: boolean;
	onClose: () => void;
	contasDisponiveis: any[];
	anoSelecionado: string;
	contasSelecionadas: string[];
	onAplicarFiltro: (ano: string, contas: string[]) => void;
}

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

    useEffect(() => {
        if (isOpen) {
            setAno(anoSelecionado);
            setContasSelecionadasLocal(contasSelecionadas.map(id => id.toString()));
        }
    }, [isOpen, anoSelecionado, contasSelecionadas]);

	const toggleConta = (id: string) => {
		setContasSelecionadasLocal((prev) => {
			const novasContas = prev.includes(id) 
				? prev.filter((item) => item !== id) 
				: [...prev, id];
			return novasContas;
		});
	};

	const aplicarFiltro = () => {
		if (contasSelecionadasLocal.length === 0) {
			window.alert('Selecione pelo menos uma conta corrente para gerar o fluxo de caixa.');
			return;
		}
		const contasFiltradas = contasSelecionadasLocal.filter(id => 
			contasDisponiveis.some(conta => conta.id.toString() === id)
		);
		onAplicarFiltro(ano, contasFiltradas);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onRequestClose={onClose}
			shouldCloseOnOverlayClick={false}
			className="bg-white rounded-lg shadow-lg w-full max-w-[600px] mx-auto"
			overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		>
			<div className="flex justify-between items-center bg-gray-100 px-4 py-3 rounded-t-lg border-b">
				<h2 className="text-lg font-semibold text-gray-800">Filtrar Fluxo de Caixa</h2>
				<button onClick={onClose} className="text-gray-500 hover:text-gray-700">
					<FontAwesomeIcon icon={faTimes} size="lg" />
				</button>
			</div>

			<div className="px-5 py-4 space-y-3">
				<div>
					<label className="font-semibold block mb-1">Selecione as contas correntes</label>
					<div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
						{contasDisponiveis.map((conta: ContaCorrente) => {
							const contaId = conta.id.toString();
							const isChecked = contasSelecionadasLocal.includes(contaId);
							return (
								<div key={conta.id} className="flex items-center gap-2 mb-2">
									<input
										type="checkbox"
										id={`conta-${conta.id}`}
										checked={isChecked}
										onChange={() => toggleConta(contaId)}
									/>
									<label htmlFor={`conta-${conta.id}`} className="cursor-pointer">
										{(conta.numConta || conta.numCartao) + " - " + conta.bancoNome + " - " + conta.responsavel}
									</label>
								</div>
							);
						})}
					</div>
				</div>

				<div>
					<label className="font-semibold block mb-1">Ano</label>
					<select
						value={ano}
						onChange={(e) => setAno((e.target as HTMLSelectElement).value)}
						className="w-full border px-3 py-2 rounded bg-white"
					>
						<option value="2024">2024</option>
						<option value="2025">2025</option>
					</select>
				</div>
			</div>

			<div className="flex justify-end gap-3 px-5 py-4 border-t">
				<button
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
