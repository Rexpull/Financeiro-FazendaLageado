import { normalizeHistoricoOfx } from './ofxIdentificadorMatch';

/**
 * "Memória de conciliação": a line classified with "Lembrar" is remembered per conta + direction (C/D) +
 * the text of its histórico without dates, times and numbers. The next OFX imports of that conta bring the
 * same text already classified. The bank identificador is not used: Bradesco and Santander change it on
 * every export.
 */

/**
 * "Pix - Enviado - 05/11 18:02 Larissa Ferreira" → "PIX - ENVIADO - LARISSA FERREIRA".
 * Returns '' when nothing but numbers/punctuation is left (such a line is never remembered).
 */
export function chaveMemoria(historico: string | null | undefined): string {
	const s = normalizeHistoricoOfx(historico)
		.replace(/\d+/g, ' ') // dates, times, document numbers, values
		.replace(/[^A-Z\s]+/g, (m) => (m.includes('-') ? ' - ' : ' ')) // keep only dashes as separators
		.replace(/\s+/g, ' ')
		.replace(/(\s*-\s*)+/g, ' - ')
		.replace(/^[\s-]+|[\s-]+$/g, '')
		.trim();
	return /[A-Z]/.test(s) ? s : '';
}

export type Fatia = { id: number; pct: number };

/** R$ split → percentages (2 decimals), the last one closing 100%. */
export function percentuaisDe(lista: Array<{ id: number; valor: number }>): Fatia[] {
	const validos = lista.filter((l) => l.id > 0 && Math.abs(Number(l.valor) || 0) > 0);
	const total = validos.reduce((s, l) => s + Math.round(Math.abs(Number(l.valor)) * 100), 0);
	if (!validos.length || total <= 0) return [];
	const out: Fatia[] = [];
	let acumulado = 0;
	validos.forEach((l, i) => {
		if (i === validos.length - 1) {
			out.push({ id: l.id, pct: Math.round((100 - acumulado) * 100) / 100 });
			return;
		}
		const pct = Math.round(((Math.round(Math.abs(Number(l.valor)) * 100) / total) * 100) * 100) / 100;
		acumulado = Math.round((acumulado + pct) * 100) / 100;
		out.push({ id: l.id, pct });
	});
	return out;
}

/** Percentages → R$ of `valorMovimento` (absolute), in cents; the rounding remainder goes to the last one. */
export function valoresDe(fatias: Fatia[], valorMovimento: number): Array<{ id: number; valor: number }> {
	if (!fatias.length) return [];
	const totalCentavos = Math.round(Math.abs(Number(valorMovimento) || 0) * 100);
	let usados = 0;
	return fatias.map((f, i) => {
		const centavos = i === fatias.length - 1 ? totalCentavos - usados : Math.round((totalCentavos * f.pct) / 100);
		usados += centavos;
		return { id: f.id, valor: centavos / 100 };
	});
}

type Classificavel = {
	modalidadeMovimento?: string | null;
	idPlanoContas?: number | null;
	idCentroCustos?: number | null;
	idFinanciamento?: number | null;
	valor: number;
	resultadoList?: Array<{ idPlanoContas: number; valor: number }>;
	centroCustosList?: Array<{ idCentroCustos: number; valor: number }>;
};

/** Text that changes only when the classification of a line changes (modalidade, plans, centres, contract). */
export function assinaturaClassificacao(m: Classificavel): string {
	const total = Math.round(Math.abs(Number(m.valor) || 0) * 100);
	const lista = (pares: Array<[number, number]>, unico: number | null | undefined) => {
		const p = pares.length ? pares : unico ? ([[Number(unico), total]] as Array<[number, number]>) : [];
		return p
			.map(([id, v]) => `${id}:${Math.round(Math.abs(Number(v) || 0) * 100)}`)
			.sort()
			.join(',');
	};
	return [
		m.modalidadeMovimento ?? 'padrao',
		lista((m.resultadoList ?? []).map((r) => [Number(r.idPlanoContas), r.valor]), m.idPlanoContas),
		lista((m.centroCustosList ?? []).map((c) => [Number(c.idCentroCustos), c.valor]), m.idCentroCustos),
		Number(m.idFinanciamento) || 0,
	].join('|');
}
