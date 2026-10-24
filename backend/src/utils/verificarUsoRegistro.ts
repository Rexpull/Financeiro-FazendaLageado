// Checks whether a record is referenced elsewhere before it is deleted, so the API can answer
// 409 with a clear message instead of orphaning rows (or surfacing a raw FK error as 500).

export interface UsoRegistro {
	/** SELECT returning a single row with column `n` (count of references). */
	sql: string;
	binds: unknown[];
	/** Human description for n > 0, e.g. "3 lançamentos bancários". */
	rotulo: (n: number) => string;
}

export class RegistroEmUsoError extends Error {
	readonly status = 409;
	constructor(message: string) {
		super(message);
		this.name = 'RegistroEmUsoError';
	}
}

export function plural(n: number, singular: string, pluralForm: string): string {
	return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function juntarLista(itens: string[]): string {
	if (itens.length <= 1) return itens.join('');
	return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** Runs every count in one D1 batch and returns the descriptions of the references found. */
export async function verificarUso(db: D1Database, usos: UsoRegistro[]): Promise<string[]> {
	if (usos.length === 0) return [];
	const resultados = await db.batch(usos.map((u) => db.prepare(u.sql).bind(...u.binds)));
	return usos.flatMap((u, i) => {
		const n = Number((resultados[i]?.results?.[0] as { n?: number } | undefined)?.n ?? 0);
		return n > 0 ? [u.rotulo(n)] : [];
	});
}

/** Throws RegistroEmUsoError("<prefixo> <lista>. <sufixo>") when any reference exists. */
export async function garantirSemUso(
	db: D1Database,
	usos: UsoRegistro[],
	prefixo: string,
	sufixo = 'Remova ou altere esses vínculos antes de excluir.',
): Promise<void> {
	const encontrados = await verificarUso(db, usos);
	if (encontrados.length > 0) {
		throw new RegistroEmUsoError(`${prefixo} ${juntarLista(encontrados)}. ${sufixo}`);
	}
}

export function isForeignKeyError(error: unknown): boolean {
	return error instanceof Error && /FOREIGN KEY constraint failed/i.test(error.message);
}

/** Maps a delete failure to an HTTP status + Portuguese message. */
export function erroExclusao(error: unknown, entidade: string): { status: number; message: string } {
	if (error instanceof RegistroEmUsoError) return { status: 409, message: error.message };
	if (isForeignKeyError(error)) {
		return {
			status: 409,
			message: `Não é possível excluir ${entidade}: há registros vinculados. Remova os vínculos antes de excluir.`,
		};
	}
	return { status: 500, message: `Erro ao excluir ${entidade}.` };
}
