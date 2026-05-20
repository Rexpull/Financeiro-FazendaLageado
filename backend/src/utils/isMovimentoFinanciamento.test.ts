import { describe, it, expect } from 'vitest';
import {
	excluirMovimentoReceitasDespesasFluxo,
	isMovimentoFinanciamento,
	movimentoUsaPlanosFinanciamento,
} from './isMovimentoFinanciamento';

describe('isMovimentoFinanciamento', () => {
	it('detects modality and linked contract', () => {
		expect(isMovimentoFinanciamento({ modalidadeMovimento: 'financiamento' })).toBe(true);
		expect(isMovimentoFinanciamento({ idFinanciamento: 5, modalidadeMovimento: 'padrao' })).toBe(true);
		expect(isMovimentoFinanciamento({ modalidadeMovimento: 'padrao' })).toBe(false);
	});
});

describe('excluirMovimentoReceitasDespesasFluxo', () => {
	it('excludes financing parameter plans from operational buckets', () => {
		expect(
			excluirMovimentoReceitasDespesasFluxo(
				{ idPlanoContas: 10, modalidadeMovimento: 'padrao' },
				{ entrada: 10, pagamento: 20 }
			)
		).toBe(true);
		expect(
			movimentoUsaPlanosFinanciamento(
				{ resultadoList: [{ idPlanoContas: 20 }] },
				{ entrada: 10, pagamento: 20 }
			)
		).toBe(true);
		expect(
			excluirMovimentoReceitasDespesasFluxo(
				{ idPlanoContas: 99, modalidadeMovimento: 'padrao' },
				{ entrada: 10, pagamento: 20 }
			)
		).toBe(false);
	});
});
