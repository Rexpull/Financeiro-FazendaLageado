import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import type { Matricula } from '../../../../../backend/src/models/Matricula';
import { formatarMatricula, juntarMatriculas, normalizarMatricula, separarMatriculas } from '../../../../../backend/src/utils/matriculas';
import { listarMatriculas, salvarMatricula } from '../../../services/matriculaService';

const NOVO = '__novo__';
const linkClass = 'text-xs text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded';

/**
 * Tomador picked from the ones already registered (a typo would split the same tomador in two in the
 * reports); "+ Novo tomador" switches to a text box. A new name equal to an existing one (case aside)
 * takes the existing spelling.
 */
export const CampoTomador: React.FC<{
	id: string;
	value: string;
	tomadores: string[];
	onChange: (v: string) => void;
	className: string;
	erro?: string;
}> = ({ id, value, tomadores, onChange, className, erro }) => {
	const naLista = (v: string) => tomadores.find((t) => t.trim().toUpperCase() === v.trim().toUpperCase());
	const [digitando, setDigitando] = useState(false);
	// new contract with no tomadores yet, or a value outside the list: type it
	const modoTexto = digitando || tomadores.length === 0 || (!!value.trim() && !naLista(value));

	if (modoTexto) {
		return (
			<>
				<input
					id={id}
					className={className}
					placeholder="Nome ou sigla do tomador (ex.: GFS)"
					value={value}
					autoFocus={digitando}
					onChange={(e) => onChange(e.target.value)}
					onBlur={() => {
						// typed one that already exists: take its spelling and go back to the list
						const existente = naLista(value);
						if (!existente) return;
						if (existente !== value) onChange(existente);
						setDigitando(false);
					}}
				/>
				{tomadores.length > 0 && (
					<button
						type="button"
						className={linkClass}
						onClick={() => {
							setDigitando(false);
							if (!naLista(value)) onChange('');
						}}
					>
						Escolher da lista
					</button>
				)}
				{erro && <p className="text-red-500 text-xs">{erro}</p>}
			</>
		);
	}
	return (
		<>
			<select
				id={id}
				className={className}
				value={naLista(value) ?? ''}
				onChange={(e) => {
					if (e.target.value === NOVO) {
						onChange('');
						setDigitando(true);
					} else onChange(e.target.value);
				}}
			>
				<option value="">Selecione o tomador</option>
				{tomadores.map((t) => (
					<option key={t} value={t}>
						{t}
					</option>
				))}
				<option value={NOVO}>+ Novo tomador</option>
			</select>
			{erro && <p className="text-red-500 text-xs">{erro}</p>}
		</>
	);
};

/**
 * Matrículas given as guarantee: chips of the chosen ones + a list of the registered ones; a new matrícula
 * can be registered here. The value is numeroGarantia in its canonical form ("2319, 21175").
 */
export const CampoMatriculas: React.FC<{
	id: string;
	value: string | null | undefined;
	onChange: (v: string | null) => void;
	className: string;
	aberto: boolean;
}> = ({ id, value, onChange, className, aberto }) => {
	const [matriculas, setMatriculas] = useState<Matricula[]>([]);
	const [falhou, setFalhou] = useState(false);
	const [cadastrando, setCadastrando] = useState(false);
	const [nova, setNova] = useState('');
	const [salvando, setSalvando] = useState(false);

	useEffect(() => {
		if (!aberto) return;
		let vivo = true;
		setFalhou(false);
		listarMatriculas()
			.then((l) => vivo && setMatriculas(l))
			.catch(() => vivo && setFalhou(true));
		return () => {
			vivo = false;
		};
	}, [aberto]);

	const escolhidas = useMemo(() => separarMatriculas(value), [value]);
	const porNumero = useMemo(() => new Map(matriculas.map((m) => [m.numero, m])), [matriculas]);
	const disponiveis = matriculas.filter((m) => !escolhidas.includes(m.numero));
	const definir = (lista: string[]) => onChange(juntarMatriculas(lista));

	const cadastrar = async () => {
		const numero = normalizarMatricula(nova);
		if (!numero) return;
		if (porNumero.has(numero)) {
			definir([...escolhidas, numero]);
			setNova('');
			setCadastrando(false);
			return;
		}
		setSalvando(true);
		try {
			const m = await salvarMatricula({ numero, descricao: null });
			setMatriculas((l) => [...l, m]);
			definir([...escolhidas, m.numero]);
			setNova('');
			setCadastrando(false);
			toast.success(`Matrícula ${formatarMatricula(m.numero)} cadastrada.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Não foi possível cadastrar a matrícula.');
		} finally {
			setSalvando(false);
		}
	};

	return (
		<div>
			{escolhidas.length > 0 && (
				<ul className="flex flex-wrap gap-1.5 mb-1.5" aria-label="Matrículas escolhidas">
					{escolhidas.map((n) => {
						const m = porNumero.get(n);
						return (
							<li
								key={n}
								className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-sm"
								title={m?.descricao || undefined}
							>
								{formatarMatricula(n)}
								{m?.descricao && <span className="text-blue-700/70 text-xs max-w-[9rem] truncate">· {m.descricao}</span>}
								<button
									type="button"
									onClick={() => definir(escolhidas.filter((x) => x !== n))}
									className="w-5 h-5 rounded-full hover:bg-blue-100 text-blue-700"
									aria-label={`Tirar a matrícula ${formatarMatricula(n)}`}
								>
									<FontAwesomeIcon icon={faTimes} size="xs" />
								</button>
							</li>
						);
					})}
				</ul>
			)}
			{cadastrando ? (
				<div className="flex gap-2">
					<input
						id={id}
						className={className}
						placeholder="Nº da matrícula (ex.: 3.041)"
						inputMode="numeric"
						value={nova}
						autoFocus
						disabled={salvando}
						onChange={(e) => setNova(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								cadastrar();
							} else if (e.key === 'Escape') setCadastrando(false);
						}}
					/>
					<button
						type="button"
						onClick={cadastrar}
						disabled={salvando || !normalizarMatricula(nova)}
						className="shrink-0 px-3 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
					>
						{salvando ? 'Salvando...' : 'Cadastrar'}
					</button>
					<button type="button" onClick={() => setCadastrando(false)} className="shrink-0 px-2 text-sm text-gray-600 hover:underline">
						Cancelar
					</button>
				</div>
			) : (
				<select
					id={id}
					className={className}
					value=""
					disabled={falhou}
					onChange={(e) => {
						if (e.target.value === NOVO) setCadastrando(true);
						else if (e.target.value) definir([...escolhidas, e.target.value]);
					}}
				>
					<option value="">
						{falhou ? 'Não foi possível carregar as matrículas' : escolhidas.length ? 'Adicionar outra matrícula' : 'Sem garantia (escolha uma matrícula)'}
					</option>
					{disponiveis.map((m) => (
						<option key={m.id} value={m.numero}>
							{formatarMatricula(m.numero)}
							{m.descricao ? ` — ${m.descricao}` : ''}
						</option>
					))}
					<option value={NOVO}>+ Cadastrar nova matrícula</option>
				</select>
			)}
			{!cadastrando && <p className="text-xs text-gray-500 mt-1">Um contrato pode ter várias matrículas.</p>}
		</div>
	);
};
