import type { Page } from '@playwright/test';

const MOCK_ORIGIN = process.env.PLAYWRIGHT_API_MOCK_ORIGIN ?? 'http://127.0.0.1:19999';

const json = (body: unknown, status = 200) => ({
	status,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

export const CONTA = { id: 24, bancoNome: 'Banco do Brasil', numConta: '11432-4', responsavel: 'BB GFS', codigoBanco: '001' };

const plano = (id: number, hierarquia: string, descricao: string, tipo: string) => ({
	id,
	nivel: hierarquia.split('.').length,
	hierarquia,
	descricao,
	tipo,
	inativo: false,
	idReferente: null,
});

/** Despesa planos of both types and one receita plano (the names are unique on purpose). */
export const PLANOS = [
	plano(4, '001', 'Receita', 'custeio'),
	plano(100, '001.001.001', 'Venda de leite', 'custeio'),
	plano(14, '002', 'Despesa', 'custeio'),
	plano(300, '002.001.001', 'Energia elétrica', 'custeio'),
	plano(301, '002.001.002', 'Manutenção de máquinas', 'custeio'),
	plano(310, '002.005.001', 'Obras e instalações', 'investimento'),
	plano(311, '002.005.002', 'Compra de máquinas', 'investimento'),
];

const centro = (id: number, descricao: string, tipo: string, tipoReceitaDespesa: string) => ({ id, descricao, tipo, tipoReceitaDespesa, inativo: false });

export const CENTROS = [
	centro(42, 'Leite - Produção', 'CUSTEIO', 'DESPESA'),
	centro(43, 'Leite - Recria', 'CUSTEIO', 'DESPESA'),
	centro(50, 'Estrutura e patrimônio', 'INVESTIMENTO', 'DESPESA'),
	centro(51, 'Agricultura - Máquinas', 'INVESTIMENTO', 'DESPESA'),
	centro(60, 'Receita do leite', 'CUSTEIO', 'RECEITA'),
];

export type MovimentoMock = {
	id: number;
	historico: string;
	valor: number;
	idPlanoContas?: number | null;
	idCentroCustos?: number | null;
	modalidadeMovimento?: string;
	resultadoList?: Array<{ idPlanoContas: number; valor: number }>;
	centroCustosList?: Array<{ idCentroCustos: number; valor: number }>;
};

export type MemoriaMock = {
	id: number;
	historicoExemplo: string;
	tipoMovimento: 'C' | 'D';
	planos: Array<{ id: number; pct: number }>;
	centros: Array<{ id: number; pct: number }>;
};

export type PutCapturado = { id: number; body: Record<string, unknown> };

const DIA = '2026-11-10T00:00:00.000Z';

function completo(m: MovimentoMock) {
	const abs = Math.abs(m.valor);
	const tipo = m.valor < 0 ? 'D' : 'C';
	return {
		dtMovimento: DIA,
		saldo: 0,
		ideagro: false,
		parcelado: false,
		idContaCorrente: CONTA.id,
		identificadorOfx: `E2E${m.id}|${DIA}|${m.valor.toFixed(2)}`,
		tipoMovimento: tipo,
		modalidadeMovimento: 'padrao',
		idPlanoContas: null,
		idCentroCustos: null,
		idPessoa: null,
		idBanco: null,
		idFinanciamento: null,
		idMemoriaConciliacao: null,
		...m,
		resultadoList:
			m.resultadoList?.map((r) => ({ ...r, idMovimentoBancario: m.id, dtMovimento: DIA, idContaCorrente: CONTA.id, tipo })) ??
			(m.idPlanoContas ? [{ idMovimentoBancario: m.id, idPlanoContas: m.idPlanoContas, valor: abs, dtMovimento: DIA, idContaCorrente: CONTA.id, tipo }] : []),
		centroCustosList:
			m.centroCustosList?.map((c) => ({ ...c, idMovimentoBancario: m.id })) ??
			(m.idCentroCustos ? [{ idMovimentoBancario: m.id, idCentroCustos: m.idCentroCustos, valor: abs }] : []),
	};
}

/**
 * API of the Conciliação Bancária screen, in memory: the lines given, the planos and centros above, and
 * every PUT/POST of a movement captured (the worker itself is covered by test/regraTipoPlanoCentro.spec.ts).
 */
export async function installConciliacaoMocks(page: Page, opts: { movimentos: MovimentoMock[]; memorias?: MemoriaMock[] }) {
	const linhas = new Map(opts.movimentos.map((m) => [m.id, completo(m)]));
	const puts: PutCapturado[] = [];
	const posts: Array<Record<string, unknown>> = [];
	const naoTratadas: string[] = [];

	await page.route(`${MOCK_ORIGIN}/**`, async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		const caminho = url.pathname;
		const method = req.method();
		const idMov = /^\/api\/movBancario\/(\d+)$/.exec(caminho);

		if (caminho === '/api/auth/session') return route.fulfill(json({ ok: true }));
		if (caminho === '/api/contas' || caminho === '/api/contaCorrente') return route.fulfill(json([CONTA]));
		if (caminho === '/api/planoContas') return route.fulfill(json(PLANOS));
		if (caminho === '/api/centro-custos') return route.fulfill(json(CENTROS));
		if (caminho === '/api/parametro') {
			return route.fulfill(json([{ id: 1, idPlanoTransferenciaEntreContas: 171, idPlanoEntradaFinanciamentos: 197, idPlanoPagamentoFinanciamentos: 199 }]));
		}
		if (caminho === '/api/movBancario/paginado') {
			const movimentos = [...linhas.values()];
			return route.fulfill(json({ movimentos, total: movimentos.length, currentPage: 1, totalPages: 1, hasNext: false, hasPrev: false }));
		}
		if (idMov && method === 'GET') return route.fulfill(json(linhas.get(Number(idMov[1])) ?? null));
		if (idMov && method === 'PUT') {
			const id = Number(idMov[1]);
			const body = req.postDataJSON() as Record<string, unknown>;
			puts.push({ id, body });
			const salvo = { ...linhas.get(id)!, ...body } as ReturnType<typeof completo>;
			linhas.set(id, salvo);
			return route.fulfill(json(salvo));
		}
		if (caminho === '/api/movBancario' && method === 'POST') {
			const body = req.postDataJSON() as Record<string, unknown>;
			posts.push(body);
			return route.fulfill(json({ ...body, id: 9000 + posts.length }, 201));
		}
		if (caminho.startsWith('/api/memoriaConciliacao/movimento/')) {
			const mov = linhas.get(Number(caminho.split('/').pop()));
			return route.fulfill(json({ chave: (mov?.historico ?? '').toUpperCase(), tipoMovimento: mov?.tipoMovimento ?? 'D', memoria: null, variacoes: 0 }));
		}
		if (caminho === '/api/memoriaConciliacao') {
			return route.fulfill(
				json(
					(opts.memorias ?? []).map((m) => ({
						idContaCorrente: CONTA.id,
						chave: m.historicoExemplo.toUpperCase(),
						modalidadeMovimento: 'padrao',
						idPessoa: null,
						usos: 3,
						ultimoUsoEm: '2026-11-10 12:00:00',
						criadoEm: '2026-10-01 12:00:00',
						atualizadoEm: '2026-10-01 12:00:00',
						...m,
					})),
				),
			);
		}
		if (caminho.startsWith('/api/notificacoes')) return route.fulfill(json({ total: 0, contas: [] }));
		if (method === 'GET') {
			naoTratadas.push(`${method} ${caminho}`);
			return route.fulfill(json([]));
		}
		naoTratadas.push(`${method} ${caminho}`);
		return route.fulfill({ status: 404, body: 'playwright mock: unhandled ' + caminho });
	});

	await page.addInitScript((conta) => {
		localStorage.setItem('user', JSON.stringify({ id: 1, nome: 'E2E', email: 'e2e@test.com', foto_perfil: '', token: 'playwright-test-token' }));
		localStorage.setItem('contaSelecionada', JSON.stringify(conta));
	}, CONTA);

	return { puts, posts, naoTratadas };
}
