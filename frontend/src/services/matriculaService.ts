import type { Matricula } from '../../../backend/src/models/Matricula';

const API_URL = import.meta.env.VITE_API_URL;

async function erro(res: Response, padrao: string): Promise<Error> {
	try {
		const body = (await res.json()) as { error?: string };
		return new Error(body?.error || padrao);
	} catch {
		return new Error(padrao);
	}
}

/** Matrículas cadastradas (garantias), with how many contracts use each. */
export async function listarMatriculas(): Promise<Matricula[]> {
	const res = await fetch(`${API_URL}/api/matricula`);
	if (!res.ok) throw await erro(res, 'Não foi possível carregar as matrículas.');
	return res.json();
}

/** Creates (no id) or updates a matrícula; the error message comes from the backend (e.g. "já está cadastrada"). */
export async function salvarMatricula(m: Pick<Matricula, 'numero' | 'descricao'> & { id?: number }): Promise<Matricula> {
	const res = await fetch(m.id ? `${API_URL}/api/matricula/${m.id}` : `${API_URL}/api/matricula`, {
		method: m.id ? 'PUT' : 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ numero: m.numero, descricao: m.descricao ?? null }),
	});
	if (!res.ok) throw await erro(res, 'Não foi possível salvar a matrícula.');
	return res.json();
}

export async function excluirMatricula(id: number): Promise<void> {
	const res = await fetch(`${API_URL}/api/matricula/${id}`, { method: 'DELETE' });
	if (!res.ok) throw await erro(res, 'Não foi possível excluir a matrícula.');
}
