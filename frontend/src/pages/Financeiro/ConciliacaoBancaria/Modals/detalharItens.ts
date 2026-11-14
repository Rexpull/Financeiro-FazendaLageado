import { valorMonetarioPositivo } from '../../../../Utils/valorMonetario';
import { normalizarTipoClassificacao } from '../../../../../../backend/src/utils/regraTipoPlanoCentro';

/**
 * "Detalhar por itens": one bank line (e.g. a card bill paid in one debit) split into items, each with
 * its own value, plano and centro. The system stores plans (Resultado) and centres (MovimentoCentroCustos)
 * as two separate lists, and every screen reads them separately (Fluxo/Dashboard by centre), so the
 * items are saved as the total per plano and the total per centro.
 */
export type ItemDetalhe = { valor: string; idPlano: number | null; idCentro: number | null };

export type TotalPorId = { id: number; valor: number };

export type ResultadoDetalhe =
	| { ok: true; planos: TotalPorId[]; centros: TotalPorId[] }
	| { ok: false; erro: string };

const centavos = (v: number) => Math.round(v * 100);

/** Sum of the typed values in cents (blank / invalid count as 0). */
export function somaItensCentavos(itens: ItemDetalhe[]): number {
	return itens.reduce((acc, it) => acc + centavos(valorMonetarioPositivo(it.valor) ?? 0), 0);
}

function agrupar(pares: Array<{ id: number; c: number }>): TotalPorId[] {
	const mapa = new Map<number, number>();
	for (const { id, c } of pares) mapa.set(id, (mapa.get(id) ?? 0) + c);
	return [...mapa].map(([id, c]) => ({ id, valor: c / 100 }));
}

/** Type (custeio/investimento) of a plano and of a centro, to check each item (rule of 13/11/2026). */
export type TiposDetalhe = {
	plano: (id: number) => string | null | undefined;
	centro: (id: number) => string | null | undefined;
};

/**
 * Validates the items and groups them by plano and by centro.
 * `exigePlano` is false for credits (receitas only take a centre).
 * With `tipos`, each item of a despesa must have plano and centro of the same type.
 */
export function agruparItens(itens: ItemDetalhe[], valorMovimento: number, exigePlano: boolean, tipos?: TiposDetalhe): ResultadoDetalhe {
	if (itens.length === 0) return { ok: false, erro: 'Adicione pelo menos um item.' };
	const pares: Array<{ idPlano: number | null; idCentro: number; c: number }> = [];
	for (let i = 0; i < itens.length; i++) {
		const it = itens[i];
		const n = i + 1;
		const v = valorMonetarioPositivo(it.valor);
		if (v == null) return { ok: false, erro: `Item ${n}: informe um valor maior que zero.` };
		if (exigePlano && !it.idPlano) return { ok: false, erro: `Item ${n}: escolha o plano de contas.` };
		if (!it.idCentro) return { ok: false, erro: `Item ${n}: escolha o centro de custos.` };
		if (exigePlano && tipos && it.idPlano) {
			const tipoPlano = normalizarTipoClassificacao(tipos.plano(it.idPlano));
			const tipoCentro = normalizarTipoClassificacao(tipos.centro(it.idCentro));
			if (tipoPlano && tipoCentro && tipoPlano !== tipoCentro) {
				return { ok: false, erro: `Item ${n}: o plano é de ${tipoPlano}, escolha um centro de custos de ${tipoPlano}.` };
			}
		}
		pares.push({ idPlano: it.idPlano, idCentro: it.idCentro, c: centavos(v) });
	}
	const total = centavos(Math.abs(valorMovimento));
	const soma = pares.reduce((a, p) => a + p.c, 0);
	if (soma !== total) {
		const dif = Math.abs(total - soma) / 100;
		const txt = dif.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
		return { ok: false, erro: soma < total ? `Faltam ${txt} para fechar o valor da linha.` : `Os itens passam ${txt} do valor da linha.` };
	}
	return {
		ok: true,
		planos: exigePlano ? agrupar(pares.map((p) => ({ id: p.idPlano as number, c: p.c }))) : [],
		centros: agrupar(pares.map((p) => ({ id: p.idCentro, c: p.c }))),
	};
}

const valorTexto = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Items to start from when the modal opens, built from what the line already has. Plans and centres
 * are stored apart, so items can only be rebuilt when one side has a single entry; otherwise the
 * modal starts with one item holding the whole value.
 */
export function itensIniciais(planos: TotalPorId[], centros: TotalPorId[], valorMovimento: number): ItemDetalhe[] {
	const total = Math.abs(valorMovimento);
	if (planos.length > 1 && centros.length <= 1) {
		return planos.map((p) => ({ valor: valorTexto(p.valor), idPlano: p.id, idCentro: centros[0]?.id ?? null }));
	}
	if (centros.length > 1 && planos.length <= 1) {
		return centros.map((c) => ({ valor: valorTexto(c.valor), idPlano: planos[0]?.id ?? null, idCentro: c.id }));
	}
	if (planos.length <= 1 && centros.length <= 1) {
		return [{ valor: valorTexto(total), idPlano: planos[0]?.id ?? null, idCentro: centros[0]?.id ?? null }];
	}
	return [{ valor: valorTexto(total), idPlano: null, idCentro: null }];
}
