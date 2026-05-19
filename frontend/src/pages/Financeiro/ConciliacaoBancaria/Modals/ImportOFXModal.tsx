import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave } from '@fortawesome/free-solid-svg-icons';
import SelectContaCorrente from '../Modals/SelectContaCorrente';
import ConciliacaoOFXModal from '../ConciliacaoOFX';
import { parseOFXFile, TotalizadoresOFX } from '../../../../Utils/parseOfxFile';
import { MovimentoBancario } from '../../../../../../backend/src/models/MovimentoBancario';
import { toast } from 'react-toastify';
import { salvarMovimentosOFX } from '../../../../services/movimentoBancarioService';
import { criarHistoricoImportacao } from '../../../../services/historicoImportacaoOFXService';

Modal.setAppElement('#root');

interface ImportOFXProps {
	isOpen: boolean;
	onClose: () => void;
	handleImport: (file: File) => void;
}

const ImportOFXModal: React.FC<ImportOFXProps> = ({ isOpen, onClose, handleImport }) => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [error, setError] = useState<string>('');
	const [modalContaIsOpen, setModalContaIsOpen] = useState(false);
	const [modalConciliacaoIsOpen, setModalConciliacaoIsOpen] = useState(false);
	const [movimentosOFX, setMovimentosOFX] = useState<MovimentoBancario[]>([]);
	const [totalizadores, setTotalizadores] = useState<TotalizadoresOFX>({
		receitas: 0,
		despesas: 0,
		liquido: 0,
		saldoFinal: 0,
		dtInicialExtrato: '',
		dtFinalExtrato: '',
	});

	const [novosMovimentos, setNovosMovimentos] = useState(0);
	const [existentesMovimentos, setExistentesMovimentos] = useState(0);

	const [loading, setLoading] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [totalMovimentos, setTotalMovimentos] = useState(0);
	const autoImportStarted = useRef(false);

	useEffect(() => {
		if (isOpen) {
			setSelectedFile(null);
			setError('');
			setNovosMovimentos(0);
			setExistentesMovimentos(0);
			setMovimentosOFX([]);
			setTotalizadores({
				receitas: 0,
				despesas: 0,
				liquido: 0,
				saldoFinal: 0,
				dtInicialExtrato: '',
				dtFinalExtrato: '',
			});
			setLoading(false);
		}
	}, [isOpen]);

	// 🔹 Função para validar e armazenar o arquivo
	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			setSelectedFile(null);
			setError('Nenhum arquivo selecionado.');
			return;
		}

		// 🔹 Verifica se a extensão do arquivo é .ofx
		if (!file.name.toLowerCase().endsWith('.ofx')) {
			setSelectedFile(null);
			setError('Apenas arquivos .OFX são permitidos.');
			return;
		}

		setSelectedFile(file);
		setError('');
	};

	const handleConfirmImport = async () => {
		if (selectedFile) {
			try {
				const { movimentos, totalizadores } = await parseOFXFile(selectedFile);
				console.log(
					`OFX parse: ${movimentos.length} movimento(s)`,
					movimentos.map((m) => ({ historico: m.historico, valor: m.valor }))
				);

				if (movimentos.length === 0) {
					setError('Nenhum movimento válido encontrado no arquivo OFX.');
					return;
				}

				setMovimentosOFX(movimentos);
				setTotalizadores(totalizadores);

				const stored = localStorage.getItem('contaSelecionada');
				const conta = stored ? JSON.parse(stored) : null;
				if (conta?.id) {
					setModalContaIsOpen(false);
					autoImportStarted.current = true;
					void runImportWithConta(conta.id, movimentos, totalizadores);
					return;
				}

				setModalContaIsOpen(true);
			} catch (error) {
				setError('Erro ao processar o arquivo OFX.');
			}
		}
	};

	const runImportWithConta = async (
		idContaCorrente: number,
		movimentosParaSalvar?: MovimentoBancario[],
		totalizadoresImport?: TotalizadoresOFX
	) => {
		const lista = movimentosParaSalvar ?? movimentosOFX;
		const totals = totalizadoresImport ?? totalizadores;

		setLoading(true);
		setCurrentIndex(0);
		setTotalMovimentos(lista.length);

		try {
			const resultado = await salvarMovimentosOFX(
				lista,
				idContaCorrente,
				setCurrentIndex,
				(novos, existentes) => {
					setNovosMovimentos(novos);
					setExistentesMovimentos(existentes);
				}
			);

			setMovimentosOFX(resultado.movimentos);

			try {
				const usuarioLogado = JSON.parse(localStorage.getItem('user') || '{}');
				const idUsuario = usuarioLogado.id;

				if (idUsuario) {
					await criarHistoricoImportacao({
						idUsuario,
						nomeArquivo: selectedFile?.name || 'Desconhecido',
						dataImportacao: new Date().toISOString(),
						idMovimentos: resultado.movimentos.map((m) => m.id),
						totalizadores: totals,
						novosMovimentos: resultado.novos,
						existentesMovimentos: resultado.existentes,
						idContaCorrente,
					});
				}
			} catch (historicoError) {
				console.error('❌ Erro ao salvar histórico:', historicoError);
				toast.warning('Importação concluída, mas histórico não foi salvo.');
			}

			const salvos = resultado.movimentos.length;
			const esperados = lista.length;
			if (salvos < esperados) {
				toast.warning(
					`Importação parcial: ${salvos} de ${esperados} movimentos salvos. Verifique o console.`
				);
			} else {
				toast.success(
					`Importação concluída! ${resultado.novos} novos, ${resultado.existentes} existentes.`
				);
			}
		} catch (error) {
			toast.error('Erro ao salvar movimentos!');
			console.error('Erro ao salvar movimentos:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!modalContaIsOpen) {
			autoImportStarted.current = false;
			return;
		}
		if (autoImportStarted.current || movimentosOFX.length === 0) return;

		const stored = localStorage.getItem('contaSelecionada');
		if (!stored) return;

		try {
			const conta = JSON.parse(stored);
			if (conta?.id) {
				autoImportStarted.current = true;
				setModalContaIsOpen(false);
				void runImportWithConta(conta.id);
			}
		} catch {
			/* ignore invalid JSON */
		}
	}, [modalContaIsOpen, movimentosOFX.length]);

	const handleSelectConta = async () => {
		const conta = JSON.parse(localStorage.getItem('contaSelecionada') || '{}');
		const idContaCorrente = conta?.id;

		if (!idContaCorrente) {
			toast.error('Conta corrente não selecionada.');
			return;
		}

		setModalContaIsOpen(false);
		await runImportWithConta(idContaCorrente);
	};

	const handleContinuarConciliacao = () => {
		setModalConciliacaoIsOpen(true);
		onClose();
	};

	const totalImportado = novosMovimentos + existentesMovimentos;

	return (
		<>
			<Modal
				isOpen={isOpen}
				onRequestClose={() => {}}
				shouldCloseOnOverlayClick={false}
				className="bg-white rounded-lg shadow-lg w-full max-w-[500px] mx-auto"
				overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			>
				{/* 🔹 Cabeçalho */}
				<div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-t-lg border-b">
					<h2 className="text-xl font-semibold text-gray-800">Buscar Arquivo OFX</h2>
					<button disabled={loading || (novosMovimentos > 0 || existentesMovimentos > 0)} onClick={onClose} className="text-gray-500 hover:text-gray-700">
						<FontAwesomeIcon icon={faTimes} size="xl" />
					</button>
				</div>

				{/* 🔹 Corpo do Modal */}
				<div className="p-4">
					<label className="block text-sm font-medium text-gray-700 mb-2">Arquivo OFX</label>
					<input
						disabled={loading || (novosMovimentos > 0 || existentesMovimentos > 0)}
						type="file"
						accept=".ofx"
						className="w-full p-2 border border-gray-300 rounded bg-white cursor-pointer"
						onChange={handleFileChange}
					/>
					{error && <p className="text-red-500 text-xs mt-2">{error}</p>}
				</div>
				{loading && totalImportado >= 0 && (
				<div className="flex flex-col items-center justify-center mb-3 mt-4 gap-2 w-full px-6">
					<span className="text-red-600 font-medium">
						Importando movimento {currentIndex} de {totalMovimentos}
					</span>
					<div className="w-full bg-gray-200 rounded-full h-4">
						<div
							className="bg-red-500 h-4 rounded-full transition-all duration-300"
							style={{ width: `${(currentIndex / totalMovimentos) * 100}%` }}
						/>
					</div>

					<div className="flex justify-center gap-3 items-center text-center text-sm mt-2 text-gray-600">
						<div>
							Movimentos novos importados: <strong>{novosMovimentos}</strong>
						</div>
						|
						<div>
							Movimentos já existentes: <strong>{existentesMovimentos}</strong>
						</div>
					</div>
				</div>
				)}
				{/* 🔹 Botão de Importação */}
				<div className="p-4 flex justify-end border-t">
					
					{(novosMovimentos > 0 || existentesMovimentos > 0) && (			
					<button
						onClick={handleContinuarConciliacao}
						className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
						disabled={loading}
					>
						<FontAwesomeIcon icon={faSave} />
						Continuar para Conciliação
					</button>
						)} 
						{!loading && (totalImportado === 0) && (
					<button
						className={`text-white font-semibold px-5 py-2 rounded flex items-center gap-2 transition ${
							selectedFile ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 cursor-not-allowed'
						}`}
						onClick={handleConfirmImport}
						disabled={!selectedFile || loading}
					>
						<FontAwesomeIcon icon={faSave} />
						Importar
					</button>
						)}
				</div>
				
			</Modal>
			<SelectContaCorrente isOpen={modalContaIsOpen} onClose={() => setModalContaIsOpen(false)} onSelect={handleSelectConta} />
			<ConciliacaoOFXModal
				isOpen={modalConciliacaoIsOpen}
				onClose={() => setModalConciliacaoIsOpen(false)}
				movimentos={movimentosOFX}
				totalizadores={totalizadores}
			/>
		</>
	);
};

export default ImportOFXModal;
