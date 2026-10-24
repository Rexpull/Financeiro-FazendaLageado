import { describe, it, expect } from 'vitest';
import type { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import { ErroSalvamentoParcial, salvarContratoComParcelas, type ServicosSalvamento } from './salvarContrato';

/** In-memory API with the same POST/PUT convention as the services (id > 0 → PUT). */
function apiFalsa(opcoes: { falharParcela?: (p: ParcelaFinanciamento, tentativa: number) => boolean } = {}) {
	const contratos = new Map<number, Financiamento>();
	const parcelas = new Map<number, ParcelaFinanciamento>();
	const chamadas: string[] = [];
	let proximoContrato = 100;
	let proximaParcela = 1000;
	let tentativasParcela = 0;
	const servicos: ServicosSalvamento = {
		async salvarFinanciamento(f) {
			if (f.id > 0) {
				chamadas.push(`PUT contrato ${f.id}`);
				contratos.set(f.id, f);
				return { id: f.id };
			}
			const id = proximoContrato++;
			chamadas.push(`POST contrato ${id}`);
			contratos.set(id, { ...f, id });
			return { id };
		},
		async salvarParcela(p) {
			tentativasParcela++;
			if (opcoes.falharParcela?.(p, tentativasParcela)) throw new Error('HTTP 500');
			if (p.id > 0) {
				chamadas.push(`PUT parcela ${p.numParcela}`);
				parcelas.set(p.id, p);
				return { ...p };
			}
			const id = proximaParcela++;
			chamadas.push(`POST parcela ${p.numParcela}`);
			parcelas.set(id, { ...p, id });
			return { ...p, id };
		},
		async excluirParcela(id) {
			chamadas.push(`DELETE parcela ${id}`);
			parcelas.delete(id);
		},
	};
	return { servicos, contratos, parcelas, chamadas };
}

const novaParcela = (numParcela: number): ParcelaFinanciamento => ({
	id: 0,
	idFinanciamento: 0,
	idMovimentoBancario: null,
	valor: 1000,
	status: 'Aberto',
	numParcela,
	dt_lancamento: '2026-10-24',
	dt_vencimento: `2027-0${numParcela}-10`,
	dt_liquidacao: null,
});

const contratoNovo = { id: 0, responsavel: 'Ronaldo', dataContrato: '2026-10-01', valor: 3000, numeroContrato: 'C-1' } as Financiamento;

describe('salvarContratoComParcelas (ModalFinanciamento)', () => {
	it('new contract: POST once, then one POST per installment', async () => {
		const api = apiFalsa();
		const r = await salvarContratoComParcelas(
			{ contrato: contratoNovo, parcelas: [novaParcela(1), novaParcela(2)], idsSalvos: [] },
			api.servicos,
		);
		expect(api.chamadas).toEqual(['POST contrato 100', 'POST parcela 1', 'POST parcela 2']);
		expect(r.contrato.id).toBe(100);
		expect(r.parcelas.map((p) => p.idFinanciamento)).toEqual([100, 100]);
		expect(r.idsSalvos).toEqual([1000, 1001]);
	});

	it('an installment fails → "Salvar" again does NOT duplicate the contract nor the installments already created', async () => {
		// 2nd installment fails only on the first attempt
		const api = apiFalsa({ falharParcela: (p, tentativa) => p.numParcela === 2 && tentativa === 2 });
		const inicial = { contrato: contratoNovo, parcelas: [novaParcela(1), novaParcela(2), novaParcela(3)], idsSalvos: [] };

		const erro = await salvarContratoComParcelas(inicial, api.servicos).catch((e) => e);
		expect(erro).toBeInstanceOf(ErroSalvamentoParcial);
		expect((erro as Error).message).toBe('Erro ao salvar a parcela 2: HTTP 500');
		const parcial = (erro as ErroSalvamentoParcial).estado;
		expect(parcial.contrato.id).toBe(100);
		expect(parcial.parcelas.map((p) => p.id)).toEqual([1000, 0, 0]);

		// The form keeps `parcial` and the user clicks "Salvar" again
		const final = await salvarContratoComParcelas(parcial, api.servicos);
		expect(api.chamadas).toEqual([
			'POST contrato 100',
			'POST parcela 1',
			'PUT contrato 100',
			'PUT parcela 1',
			'POST parcela 2',
			'POST parcela 3',
		]);
		expect(api.contratos.size).toBe(1);
		expect([...api.parcelas.values()].map((p) => p.numParcela).sort()).toEqual([1, 2, 3]);
		expect(final.parcelas.every((p) => p.id > 0 && p.idFinanciamento === 100)).toBe(true);
	});

	it('installments created in a failed attempt and then dropped (fewer installments) are deleted on the retry', async () => {
		const api = apiFalsa({ falharParcela: (p, tentativa) => p.numParcela === 3 && tentativa === 3 });
		const erro = (await salvarContratoComParcelas(
			{ contrato: contratoNovo, parcelas: [novaParcela(1), novaParcela(2), novaParcela(3)], idsSalvos: [] },
			api.servicos,
		).catch((e) => e)) as ErroSalvamentoParcial;
		// user regenerates with 1 installment: #1 keeps its id, #2 (already created) is gone from the list
		const retry = { ...erro.estado, parcelas: erro.estado.parcelas.slice(0, 1) };
		const final = await salvarContratoComParcelas(retry, api.servicos);
		expect(api.chamadas.slice(-3)).toEqual(['PUT contrato 100', 'PUT parcela 1', 'DELETE parcela 1001']);
		expect(final.idsSalvos).toEqual([1000]);
		expect(api.parcelas.size).toBe(1);
	});

	it('editing: PUT contract and kept installments, POST new ones, DELETE the removed ones', async () => {
		const api = apiFalsa();
		const existente = { ...novaParcela(1), id: 501, idFinanciamento: 7 };
		const removida = 502;
		const r = await salvarContratoComParcelas(
			{ contrato: { ...contratoNovo, id: 7 }, parcelas: [existente, novaParcela(2)], idsSalvos: [501, removida] },
			api.servicos,
		);
		expect(api.chamadas).toEqual(['PUT contrato 7', 'PUT parcela 1', 'POST parcela 2', `DELETE parcela ${removida}`]);
		expect(r.idsSalvos.sort()).toEqual([1000, 501].sort());
	});

	it('contract request failing is a plain error (nothing was created)', async () => {
		const api = apiFalsa();
		api.servicos.salvarFinanciamento = async () => {
			throw new Error('Campos obrigatórios não preenchidos');
		};
		const erro = await salvarContratoComParcelas({ contrato: contratoNovo, parcelas: [novaParcela(1)], idsSalvos: [] }, api.servicos).catch(
			(e) => e,
		);
		expect(erro).not.toBeInstanceOf(ErroSalvamentoParcial);
		expect((erro as Error).message).toBe('Campos obrigatórios não preenchidos');
	});
});
