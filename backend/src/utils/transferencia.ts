/** Business-rule violation in a transfer between accounts (maps to HTTP 400). */
export class TransferenciaInvalidaError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TransferenciaInvalidaError';
	}
}

/** Returns the Portuguese validation message, or null when the transfer is valid. */
export function validarTransferencia(data: { contaOrigemId?: unknown; contaDestinoId?: unknown; valor?: unknown }): string | null {
	const origem = Number(data.contaOrigemId);
	const destino = Number(data.contaDestinoId);
	const valor = Number(data.valor);
	if (!Number.isInteger(origem) || origem <= 0 || !Number.isInteger(destino) || destino <= 0) {
		return 'Conta de origem e conta de destino são obrigatórias.';
	}
	if (origem === destino) {
		return 'A conta de origem e destino devem ser diferentes (não é possível transferir para a mesma conta).';
	}
	if (!Number.isFinite(valor) || valor <= 0) {
		return 'O valor da transferência deve ser maior que zero.';
	}
	return null;
}

/** Both legs share the same uuid but need distinct identificador_ofx (UNIQUE). */
export function identificadoresTransferencia(uuid: string): { saida: string; entrada: string } {
	return { saida: `${uuid}|saida`, entrada: `${uuid}|entrada` };
}

/** Parametros.idPlanoTransferenciaEntreContas → positive integer or null (never NaN). */
export function parsePlanoTransferencia(raw: unknown): number | null {
	if (raw === null || raw === undefined || raw === '') return null;
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : null;
}
