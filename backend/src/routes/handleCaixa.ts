import { CaixaRepository, type CaixaLancamento, type CaixaLancamentoInput } from '../repositories/CaixaRepository';
import { calcularCaixaDiario } from '../utils/caixaDiario';
import { coerceMonetaryValue } from '../utils/coerceMonetaryValue';

/**
 * Dashboard aba "Caixa" — rotas sob /api/caixa
 *   GET    /api/caixa?ano=2026&mes=10
 *   PUT    /api/caixa/saldo-inicial        { ano, mes, valor }   (valor null remove)
 *   POST   /api/caixa/lancamentos          { tipo, natureza, data, descricao, valor }
 *   PUT    /api/caixa/lancamentos/:id      (campos omitidos mantêm o valor atual)
 *   DELETE /api/caixa/lancamentos/:id
 */

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DESCRICAO_MAX = 200;
const VALOR_MAX = 1e12;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	});
}

const erro = (status: number, mensagem: string) => json({ error: mensagem }, status);

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

function inteiro(v: unknown): number | null {
	if (typeof v === 'number' && Number.isInteger(v)) return v;
	if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) return Number(v);
	return null;
}

function validarAnoMes(anoRaw: unknown, mesRaw: unknown): Resultado<{ ano: number; mes: number }> {
	const ano = inteiro(anoRaw);
	const mes = inteiro(mesRaw);
	if (ano === null || mes === null) {
		return { ok: false, erro: "Informe 'ano' e 'mes' numéricos (ex.: ano=2026 e mes=10)." };
	}
	if (ano < 2000 || ano > 2100) return { ok: false, erro: "'ano' deve estar entre 2000 e 2100." };
	if (mes < 1 || mes > 12) return { ok: false, erro: "'mes' deve estar entre 1 e 12." };
	return { ok: true, valor: { ano, mes } };
}

/** 'YYYY-MM-DD' de uma data que existe no calendário (rejeita 2026-02-30). */
function dataValida(v: unknown): v is string {
	if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
	const [a, m, d] = v.split('-').map(Number);
	const dt = new Date(Date.UTC(a, m - 1, d));
	return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function numero(v: unknown): number | null {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	// Aceita também texto numérico ("1234.56", "1.234,56"); qualquer outra coisa é inválida.
	if (typeof v === 'string' && /^\s*-?[\d.,]*\d[\d.,]*\s*$/.test(v)) {
		const n = coerceMonetaryValue(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Valida o corpo de um lançamento. Com `atual` (PUT), campos ausentes mantêm o valor gravado.
 * Boleto é sempre saída: natureza 'D' (forçada quando omitida; 'C' é rejeitada).
 */
function validarLancamento(body: Record<string, unknown>, atual?: CaixaLancamento): Resultado<CaixaLancamentoInput> {
	const tem = (k: string) => body[k] !== undefined;

	const tipo = tem('tipo') ? body.tipo : atual?.tipo;
	if (tipo !== 'BOLETO' && tipo !== 'PREVISAO') {
		return { ok: false, erro: "'tipo' deve ser 'BOLETO' ou 'PREVISAO'." };
	}

	let natureza: unknown;
	if (tipo === 'BOLETO') {
		if (tem('natureza') && body.natureza !== 'D') {
			return { ok: false, erro: "Boleto é sempre saída: 'natureza' deve ser 'D'." };
		}
		natureza = 'D';
	} else {
		natureza = tem('natureza') ? body.natureza : atual?.natureza;
		if (natureza !== 'C' && natureza !== 'D') {
			return { ok: false, erro: "Previsão precisa de 'natureza' 'C' (entrada) ou 'D' (saída)." };
		}
	}

	const data = tem('data') ? body.data : atual?.data;
	if (!dataValida(data)) {
		return { ok: false, erro: "'data' deve ser uma data válida no formato AAAA-MM-DD." };
	}

	const descricaoRaw = tem('descricao') ? body.descricao : atual?.descricao;
	const descricao = typeof descricaoRaw === 'string' ? descricaoRaw.trim() : '';
	if (!descricao) return { ok: false, erro: "Informe a 'descricao'." };
	if (descricao.length > DESCRICAO_MAX) {
		return { ok: false, erro: `'descricao' deve ter no máximo ${DESCRICAO_MAX} caracteres.` };
	}

	const valorNum = tem('valor') ? numero(body.valor) : (atual?.valor ?? null);
	if (valorNum === null) return { ok: false, erro: "Informe o 'valor' numérico." };
	const valor = centavos(valorNum);
	if (valor <= 0) return { ok: false, erro: "'valor' deve ser maior que zero." };
	if (valor > VALOR_MAX) return { ok: false, erro: "'valor' muito alto." };

	return { ok: true, valor: { tipo, natureza: natureza as 'C' | 'D', data, descricao, valor } };
}

async function lerCorpo(req: Request): Promise<Resultado<Record<string, unknown>>> {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return { ok: false, erro: 'Corpo da requisição deve ser um JSON válido.' };
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, erro: 'Corpo da requisição deve ser um objeto JSON.' };
	}
	return { ok: true, valor: body as Record<string, unknown> };
}

export async function handleRequest(req: Request, db: D1Database): Promise<Response> {
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	const url = new URL(req.url);
	const path = url.pathname.replace(/\/+$/, '');
	const { method } = req;
	const repo = new CaixaRepository(db);

	try {
		if (path === '/api/caixa') {
			if (method !== 'GET') return erro(405, 'Método não permitido.');
			const am = validarAnoMes(url.searchParams.get('ano'), url.searchParams.get('mes'));
			if (!am.ok) return erro(400, am.erro);
			const { ano, mes } = am.valor;

			const dados = await repo.getDadosMes(ano, mes);
			const calculo = calcularCaixaDiario({
				ano,
				mes,
				saldoInicial: dados.saldoInicial.valor,
				lancamentos: dados.lancamentos,
				parcelas: dados.parcelas,
			});
			return json({
				ano,
				mes,
				saldoInicial: dados.saldoInicial.valor,
				saldoInicialAtualizadoEm: dados.saldoInicial.atualizadoEm,
				...calculo,
				lancamentos: dados.lancamentos,
				parcelas: dados.parcelas,
			});
		}

		if (path === '/api/caixa/saldo-inicial') {
			if (method !== 'PUT') return erro(405, 'Método não permitido.');
			const corpo = await lerCorpo(req);
			if (!corpo.ok) return erro(400, corpo.erro);
			const am = validarAnoMes(corpo.valor.ano, corpo.valor.mes);
			if (!am.ok) return erro(400, am.erro);
			const { ano, mes } = am.valor;

			if (corpo.valor.valor === null) {
				return json(await repo.removerSaldoInicial(ano, mes));
			}
			const valor = numero(corpo.valor.valor);
			if (valor === null) return erro(400, "Informe o 'valor' do saldo inicial (número; null para remover).");
			if (Math.abs(valor) > VALOR_MAX) return erro(400, "'valor' muito alto.");
			return json(await repo.salvarSaldoInicial(ano, mes, centavos(valor)));
		}

		if (path === '/api/caixa/lancamentos') {
			if (method !== 'POST') return erro(405, 'Método não permitido.');
			const corpo = await lerCorpo(req);
			if (!corpo.ok) return erro(400, corpo.erro);
			const v = validarLancamento(corpo.valor);
			if (!v.ok) return erro(400, v.erro);
			return json(await repo.criarLancamento(v.valor), 201);
		}

		const m = path.match(/^\/api\/caixa\/lancamentos\/([^/]+)$/);
		if (m) {
			const id = inteiro(m[1]);
			if (id === null || id <= 0) return erro(400, 'Id de lançamento inválido.');

			if (method === 'DELETE') {
				const removido = await repo.excluirLancamento(id);
				return removido ? json({ ok: true, id }) : erro(404, 'Lançamento não encontrado.');
			}

			if (method === 'PUT') {
				const corpo = await lerCorpo(req);
				if (!corpo.ok) return erro(400, corpo.erro);
				const atual = await repo.getLancamento(id);
				if (!atual) return erro(404, 'Lançamento não encontrado.');
				const v = validarLancamento(corpo.valor, atual);
				if (!v.ok) return erro(400, v.erro);
				const atualizado = await repo.atualizarLancamento(id, v.valor);
				return atualizado ? json(atualizado) : erro(404, 'Lançamento não encontrado.');
			}

			return erro(405, 'Método não permitido.');
		}

		return erro(404, 'Rota não encontrada.');
	} catch (e) {
		console.error('Erro na rota /api/caixa:', e);
		return json(
			{ error: 'Erro ao processar a requisição do caixa.', details: e instanceof Error ? e.message : String(e) },
			500,
		);
	}
}
