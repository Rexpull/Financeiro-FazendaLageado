import type { MemoriaConciliacao } from '../../../backend/src/models/MemoriaConciliacao';

const API_URL = import.meta.env.VITE_API_URL;

async function erro(res: Response, padrao: string): Promise<Error> {
	try {
		const body = (await res.json()) as { error?: string };
		return new Error(body?.error || padrao);
	} catch {
		return new Error(padrao);
	}
}

/** Memórias de conciliação of a conta ("Memórias da conta"). */
export async function listarMemoriasConta(idContaCorrente: number): Promise<MemoriaConciliacao[]> {
	const res = await fetch(`${API_URL}/api/memoriaConciliacao?idContaCorrente=${idContaCorrente}`);
	if (!res.ok) throw await erro(res, 'Não foi possível carregar as memórias da conta.');
	return res.json();
}

/** What "Lembrar" means for one line (backend MemoriaConciliacaoRepository.analisarMovimento). */
export type AnaliseMemoria = {
	/** text that will be recognized ('' = nothing to recognize) */
	chave: string;
	tipoMovimento: 'C' | 'D';
	/** memory that already applies to this line */
	memoria: MemoriaConciliacao | null;
	/** how many different planos other recent lines with this text got in this conta */
	variacoes: number;
};

export async function analisarMemoriaDoMovimento(idMovimento: number): Promise<AnaliseMemoria> {
	const res = await fetch(`${API_URL}/api/memoriaConciliacao/movimento/${idMovimento}`);
	if (!res.ok) throw await erro(res, 'Não foi possível verificar a memória do lançamento.');
	return res.json();
}

export async function excluirMemoria(id: number): Promise<void> {
	const res = await fetch(`${API_URL}/api/memoriaConciliacao/${id}`, { method: 'DELETE' });
	if (!res.ok) throw await erro(res, 'Não foi possível excluir a memória.');
}
