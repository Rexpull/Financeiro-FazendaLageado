export interface FluxoCaixaMes {
	receitas: {
		[idPai: number]: {
			descricao: string;
			filhos: {
				[idFilho: number]: number; 
			};
		};
	};
	despesas: {
		[idPai: number]: {
			descricao: string;
			filhos: {
				[idFilho: number]: number;
			};
		};
	};
	investimentos: {
		[idPlano: number]: number;
	};
	financiamentos: {
		[credorKey: string]: {
			valor: number;
			descricao: string;
		};
	} | {
		pagos: {
			[credorKey: string]: {
				valor: number;
				descricao: string;
			};
		};
		contratados: {
			[credorKey: string]: {
				valor: number;
				descricao: string;
			};
		};
	};

	pendentesSelecao?: { [idConta: number]: number };

	saldoInicial: number;
	saldoFinal: number;
	lucro: number;
}
