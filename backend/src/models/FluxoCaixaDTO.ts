
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
		[idConta: number]: number;
	};

	pendentesSelecao?: { [idConta: number]: number };

	saldoInicial: number;
	saldoFinal: number;
	lucro: number;
}
