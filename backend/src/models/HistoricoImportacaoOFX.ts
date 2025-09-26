export interface HistoricoImportacaoOFX {
	id: number;
	idUsuario: number;
	nomeArquivo: string;
	dataImportacao: string;
	idMovimentos: number[];
	totalizadores: {
		receitas: number;
		despesas: number;
		liquido: number;
		saldoFinal: number;
		dtInicialExtrato: string;
		dtFinalExtrato: string;
	};
	novosMovimentos: number;
	existentesMovimentos: number;
	idContaCorrente: number;
	criadoEm: string;
	atualizadoEm: string;
}
