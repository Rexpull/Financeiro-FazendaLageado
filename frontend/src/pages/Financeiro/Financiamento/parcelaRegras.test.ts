import { describe, it, expect } from 'vitest';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';
import {
	avisoDiferencaParcelas,
	descricaoParcela,
	descricaoParcelamento,
	erroQuantidadeParcelas,
	jurosDoContrato,
	mensagemEstorno,
	mensagemExcluirContrato,
	mensagemParcelasEmUso,
	mensagemRecalculo,
	parcelaEmUso,
	parcelasRemovidasEmUso,
	periodicidadeParcelas,
	proximoIdTemporario,
	reabrirParcela,
	recalcularParcelasEmAberto,
	resumoParcelas,
	semIdTemporario,
	statusParcelaEmAberto,
	valoresDasParcelas,
} from './parcelaRegras';
import { gerarDatasVencimento } from '../../../Utils/parcelamento';

/** brl() uses a no-break space after "R$"; compare with plain spaces. */
const txt = (s: string | null) => (s ?? '').replace(/ /g, ' ');

const p = (over: Partial<ParcelaFinanciamento>): ParcelaFinanciamento => ({
	id: 1,
	idFinanciamento: 1,
	idMovimentoBancario: null,
	valor: 100,
	status: 'Aberto',
	numParcela: 1,
	dt_lancamento: '2025-01-01',
	dt_vencimento: '2025-01-10',
	dt_liquidacao: null,
	...over,
});

describe('statusParcelaEmAberto / reabrirParcela', () => {
	it('Vencido only before today, by calendar day', () => {
		expect(statusParcelaEmAberto('2025-01-09', '2025-01-10')).toBe('Vencido');
		expect(statusParcelaEmAberto('2025-01-10', '2025-01-10')).toBe('Aberto');
		expect(statusParcelaEmAberto('2025-01-10T00:00:00.000Z', '2025-01-10')).toBe('Aberto');
	});

	it('estorno clears the liquidation AND the paying movement', () => {
		const liquidada = p({ status: 'Liquidado', dt_liquidacao: '2025-01-10', idMovimentoBancario: 77 });
		expect(reabrirParcela(liquidada, '2025-02-01')).toMatchObject({ status: 'Vencido', dt_liquidacao: null, idMovimentoBancario: null });
		expect(reabrirParcela({ ...liquidada, dt_vencimento: '2099-01-10' }, '2025-02-01').status).toBe('Aberto');
	});
});

describe('parcelas em uso (ModalFinanciamento)', () => {
	const originais = [
		p({ id: 11, numParcela: 1, status: 'Liquidado', idMovimentoBancario: 5 }),
		p({ id: 12, numParcela: 2 }),
		p({ id: 13, numParcela: 3, idMovimentoBancario: 9 }),
		p({ id: 14, numParcela: 4, status: 'Liquidado' }),
	];

	it('lists only removed installments that are liquidated or linked', () => {
		expect(parcelaEmUso(originais[1])).toBe(false);
		expect(parcelasRemovidasEmUso(originais, [{ id: 11 }, { id: 0 }]).map((x) => x.id)).toEqual([13, 14]);
		expect(parcelasRemovidasEmUso(originais, originais)).toEqual([]);
	});

	it('message names each installment and why', () => {
		const msg = mensagemParcelasEmUso(parcelasRemovidasEmUso(originais, [{ id: 11 }]));
		expect(msg).toContain('as parcelas 3 (vinculada a lançamento) e 4 (liquidada)');
	});
});

describe('temporary ids (ModalParcelas)', () => {
	it('each new row gets a distinct negative id; saving turns it into 0', () => {
		const lista: ParcelaFinanciamento[] = [p({ id: 10 })];
		const a = proximoIdTemporario(lista);
		lista.push(p({ id: a }));
		const b = proximoIdTemporario(lista);
		expect(a).toBe(-1);
		expect(b).toBe(-2);
		expect(semIdTemporario(p({ id: b })).id).toBe(0);
		expect(semIdTemporario(p({ id: 10 })).id).toBe(10);
	});
});

describe('periodicidade (one rule for cards, list and modals)', () => {
	const datas = (n: number, intervalo: number, inicio = '2026-01-31') => gerarDatasVencimento(inicio, n, intervalo);

	it('24 monthly installments are Mensal (the list used to say "24x Anual")', () => {
		expect(periodicidadeParcelas(datas(24, 1))).toBe('Mensal');
		expect(descricaoParcelamento(datas(24, 1).map((d) => ({ dt_vencimento: d })))).toBe('24x Mensal');
	});

	it('monthly installments crossing the year are still Mensal (ModalParcelas used to say Anual)', () => {
		expect(periodicidadeParcelas(['2026-11-10', '2026-12-10', '2027-01-10'])).toBe('Mensal');
	});

	it('by the median gap: Anual ≥ 11 months, Semestral ≥ 5, Trimestral ≥ 2,5', () => {
		expect(periodicidadeParcelas(datas(5, 12))).toBe('Anual');
		expect(periodicidadeParcelas(datas(6, 6))).toBe('Semestral');
		expect(periodicidadeParcelas(datas(8, 3))).toBe('Trimestral');
		expect(periodicidadeParcelas(['2026-01-10', '2026-03-10'])).toBe('Mensal'); // 2 months
		// one odd gap does not change the label
		expect(periodicidadeParcelas(['2026-01-10', '2027-01-10', '2028-01-10', '2028-03-10', '2029-03-10', '2030-03-10'])).toBe('Anual');
	});

	it('unordered dates, ISO datetimes, single and empty lists', () => {
		expect(periodicidadeParcelas(['2028-05-01', '2026-05-01T00:00:00.000Z', '2027-05-01'])).toBe('Anual');
		expect(periodicidadeParcelas(['2026-05-01'])).toBeNull();
		expect(descricaoParcelamento([{ dt_vencimento: '2026-05-01' }])).toBe('1x (parcela única)');
		expect(descricaoParcelamento([])).toBe('Sem parcelas');
		expect(descricaoParcelamento(undefined)).toBe('Sem parcelas');
	});
});

describe('resumoParcelas / avisoDiferencaParcelas', () => {
	const f = { valor: 100000, totalJuros: 20000, taxaJurosAnual: 8 };
	const lista = [
		p({ valor: 40000, status: 'Liquidado' }),
		p({ valor: 40000, status: 'Vencido' }),
		p({ valor: 40000, status: 'Aberto' }),
	];

	it('contratado, soma, pago and em aberto (saldo devedor = parcelas not liquidated)', () => {
		expect(resumoParcelas(f, lista)).toEqual({
			contratado: 100000,
			juros: 20000,
			previsto: 120000,
			somaParcelas: 120000,
			pago: 40000,
			emAberto: 80000,
			qtdParcelas: 3,
			qtdEmAberto: 2,
			diferenca: 0,
		});
		expect(avisoDiferencaParcelas(resumoParcelas(f, lista))).toBeNull();
	});

	it('warns when the parcelas do not add up to contratado + juros', () => {
		const aviso = avisoDiferencaParcelas(resumoParcelas(f, lista.slice(0, 2)));
		expect(txt(aviso)).toContain('A soma das parcelas (R$ 80.000,00) está R$ 40.000,00 a menos que o valor contratado + juros (R$ 120.000,00)');
		expect(avisoDiferencaParcelas(resumoParcelas(f, []))).toBeNull();
	});

	it('cent rounding does not trigger the warning', () => {
		const tres = [p({ valor: 33.33 }), p({ valor: 33.33 }), p({ valor: 33.34 })];
		expect(avisoDiferencaParcelas(resumoParcelas({ valor: 100, totalJuros: null }, tres))).toBeNull();
	});

	it('legacy rows: interest in R$ stored in taxaJurosAnual (> 100)', () => {
		expect(jurosDoContrato({ totalJuros: null, taxaJurosAnual: 15000 })).toBe(15000);
		expect(jurosDoContrato({ totalJuros: 0, taxaJurosAnual: 12.5 })).toBe(0);
		expect(jurosDoContrato({ totalJuros: 900, taxaJurosAnual: 15000 })).toBe(900);
	});
});

describe('gerar / recalcular parcelas: base = valor contratado + juros', () => {
	it('1 or N installments use the same base, residue on the last one', () => {
		expect(valoresDasParcelas(100000, 5000, 1)).toEqual([105000]);
		expect(valoresDasParcelas(100, 0.01, 3)).toEqual([33.33, 33.33, 33.35]);
		expect(valoresDasParcelas(100, 0, 3)).toEqual([33.33, 33.33, 33.34]);
		expect(valoresDasParcelas(100000, 20000, 24).reduce((s, v) => s + v, 0)).toBeCloseTo(120000, 2);
	});

	it('quantidade de parcelas: whole number ≥ 1 (empty used to become NaN and pass)', () => {
		expect(erroQuantidadeParcelas('')).toBe('Informe a quantidade de parcelas.');
		expect(erroQuantidadeParcelas('  ')).toBe('Informe a quantidade de parcelas.');
		expect(erroQuantidadeParcelas('0')).toMatch(/inteiro/);
		expect(erroQuantidadeParcelas('2.5')).toMatch(/inteiro/);
		expect(erroQuantidadeParcelas(Number.NaN)).toMatch(/inteiro/);
		expect(erroQuantidadeParcelas('601')).toMatch(/no máximo 600/);
		expect(erroQuantidadeParcelas('24')).toBeNull();
		expect(erroQuantidadeParcelas(1)).toBeNull();
	});

	it('recalcular divides (contratado + juros − pago) among the open installments only', () => {
		const lista = [p({ id: 1, valor: 50000, status: 'Liquidado' }), p({ id: 2, valor: 1 }), p({ id: 3, valor: 2 }), p({ id: 4, valor: 3 })];
		const r = recalcularParcelasEmAberto(lista, { valor: 100000, totalJuros: 20000.01 });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.parcelas.map((x) => x.valor)).toEqual([50000, 23333.33, 23333.33, 23333.35]);
		expect(r.parcelas[0]).toBe(lista[0]);
		expect(txt(mensagemRecalculo(r))).toBe(
			'As 3 parcelas em aberto passarão a R$ 23.333,33 (a última, R$ 23.333,35, por causa dos centavos). ' +
				'Valores digitados serão substituídos.\n\n' +
				'Base: valor contratado + juros (R$ 120.000,01) menos o já pago (R$ 50.000,00) = R$ 70.000,01.',
		);
	});

	it('recalcular refuses when there is nothing to divide', () => {
		expect(recalcularParcelasEmAberto([], { valor: 10 })).toEqual({ ok: false, erro: 'Não há parcelas para recalcular.' });
		expect(recalcularParcelasEmAberto([p({ status: 'Liquidado' })], { valor: 10 })).toMatchObject({ ok: false, erro: expect.stringMatching(/em aberto/) });
		const pagoDemais = recalcularParcelasEmAberto([p({ valor: 200, status: 'Liquidado' }), p({})], { valor: 100 });
		expect(pagoDemais.ok).toBe(false);
	});
});

describe('confirmation texts', () => {
	it('liquidar shows parcela, value and due date', () => {
		expect(txt(descricaoParcela(p({ numParcela: 3, valor: 8750, dt_vencimento: '2026-09-10' }), 24))).toBe(
			'Parcela 3 de 24 · R$ 8.750,00 · vencimento 10/09/2026',
		);
	});

	it('estorno says what happens (it can be undone: liquidar again)', () => {
		const liquidada = p({ numParcela: 3, valor: 8750, status: 'Liquidado', dt_liquidacao: '2026-09-10', idMovimentoBancario: 9 });
		expect(txt(mensagemEstorno(liquidada))).toBe(
			'Estornar a parcela 3 (R$ 8.750,00, liquidada em 10/09/2026)? Ela volta a ficar em aberto e o vínculo com o lançamento bancário é desfeito.',
		);
		expect(txt(mensagemEstorno({ ...liquidada, idMovimentoBancario: null }))).toBe(
			'Estornar a parcela 3 (R$ 8.750,00, liquidada em 10/09/2026)? Ela volta a ficar em aberto.',
		);
	});

	it('excluir contrato names it, its parcelas and what blocks / is lost', () => {
		const f = {
			numeroContrato: 'C-77',
			valor: 120000,
			parcelasList: [
				p({ numParcela: 1, status: 'Liquidado', idMovimentoBancario: 5 }),
				p({ numParcela: 2, status: 'Liquidado' }),
				p({ numParcela: 3 }),
			],
		};
		expect(txt(mensagemExcluirContrato(f, 'Sicredi'))).toBe(
			'Excluir o contrato C-77 (Sicredi, R$ 120.000,00) e suas 3 parcelas?\n\n' +
				'A parcela 1 está vinculada a lançamentos bancários: a exclusão será recusada. Desfaça a conciliação desses lançamentos antes.\n\n' +
				'Atenção: a parcela 2 já está liquidada e também será apagada.',
		);
		expect(txt(mensagemExcluirContrato({ ...f, parcelasList: [] }, 'João'))).toBe('Excluir o contrato C-77 (João, R$ 120.000,00)?');
	});
});
