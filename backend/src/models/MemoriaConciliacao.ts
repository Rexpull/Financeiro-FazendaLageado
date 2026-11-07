/** "Memória de conciliação": how a repeated bank line of a conta is classified on the next imports. */
export interface MemoriaConciliacao {
	id: number;
	idContaCorrente: number;
	tipoMovimento: 'C' | 'D';
	/** histórico without accents, dates, times and numbers (utils/memoriaConciliacao.chaveMemoria) */
	chave: string;
	/** histórico of the line it was learned from, shown on the screen */
	historicoExemplo: string | null;
	modalidadeMovimento: 'padrao' | 'transferencia';
	/** plans and centres as percentages of the line value */
	planos: Array<{ id: number; pct: number }>;
	centros: Array<{ id: number; pct: number }>;
	idPessoa: number | null;
	usos: number;
	ultimoUsoEm: string | null;
	criadoEm: string | null;
	atualizadoEm: string | null;
}
