// Integration tests: Fluxo de Caixa (centros) — POST /api/fluxoCaixa, POST /api/fluxoCaixa/anoAnterior and the
// financing detail (GET /api/fluxoCaixa/detalhar?planoId=todos), against an isolated local D1 seeded with the
// production schema snapshot (test/fixtures/schema.sql).
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import schemaSql from './fixtures/schema.sql?raw';
import { anosFiltroFluxo, montarFluxoMensal } from '../frontend/src/pages/Financeiro/FluxoDeCaixa/fluxoMensalRegras';
import { resumoAnoFluxo } from '../frontend/src/pages/Financeiro/FluxoDeCaixa/fluxoGraficoRegras';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

type ValorCredor = { valor: number; descricao: string };
type Mes = {
	receitas: Record<string, number>;
	despesas: Record<string, { descricao: string; filhos: Record<string, number> }>;
	financiamentos: { pagos: Record<string, ValorCredor>; contratados: Record<string, ValorCredor> };
};
type Fluxo = { dadosMensais: Mes[]; parcelasVincendasAnuais: Record<string, number> };
type Detalhe = Array<{ numeroContrato: string; credor: string; tomador?: string; parcelas: Array<{ valor: number }> }>;

// When a JWT_SECRET reaches the pool (e.g. a local .dev.vars), call the API as a real signed-in user.
let authHeader: Record<string, string> = {};
async function prepararAuth() {
	const secret = (env as unknown as { JWT_SECRET?: string }).JWT_SECRET;
	if (!secret) return;
	await db.prepare(`INSERT INTO usuario (id, nome, usuario, email, senha) VALUES (1, 'Teste', 'teste', 'teste@fazenda.test', 'x')`).run();
	const token = await new SignJWT({ id: 1, email: 'teste@fazenda.test' })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(secret));
	authHeader = { Authorization: `Bearer ${token}` };
}

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) {
		await db.prepare(sql).run();
	}
}

async function seed() {
	await db.prepare(`INSERT INTO banco (id, nome, codigo) VALUES (1, 'SICREDI', '748')`).run();
	await db.prepare(`INSERT INTO contaCorrente (id, tipo, idBanco, responsavel) VALUES (24, 'contaCorrente', 1, 'BB GFS')`).run();
	await db
		.prepare(
			`INSERT INTO CentroCustos (id, descricao, tipo, tipoReceitaDespesa) VALUES
			 (42, 'Leite', 'CUSTEIO', 'DESPESA'),
			 (50, 'Leite', 'INVESTIMENTO', 'DESPESA'),
			 (60, 'Venda Leite', 'CUSTEIO', 'RECEITA')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, idBanco, idPessoa, responsavel, dataContrato, valor, numeroContrato) VALUES
			 (1, 1, NULL, 'GJN', '2024-06-06', 1000, 'A'),
			 (2, NULL, NULL, 'JPT', '2025-03-10', 5000, 'B'),
			 (3, NULL, NULL, 'MLF', '2023-01-01', 800, 'C')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO parcelaFinanciamento (idFinanciamento, valor, status, numParcela, dt_vencimento, dt_liquidacao) VALUES
			 (1, 300, 'Liquidado', 1, '2025-10-15', '2025-10-14'),
			 (1, 200, 'Liquidado', 2, '2025-10-20', NULL),
			 (1, 999, 'Aberto', 3, '2025-11-15', '2025-10-01'),
			 (2, 2500, 'Aberto', 1, '2026-03-10', NULL),
			 (2, 2500.5, 'Aberto', 2, '2027-03-10', NULL),
			 (3, 150.25, 'Liquidado', 4, '2025-10-05', '2025-10-06')`,
		)
		.run();
	await db
		.prepare(
			`INSERT INTO MovimentoBancario (id, dtMovimento, historico, idContaCorrente, valor, saldo, identificador_ofx, tipoMovimento, modalidadeMovimento, idCentroCustos) VALUES
			 (1, '2025-10-05T00:00:00.000Z', 'Venda de leite', 24, 2000, 0, 'OFX-1', 'C', 'padrao', 60),
			 (2, '2025-10-06T00:00:00.000Z', 'Ração e ordenhadeira', 24, -1000, 0, 'OFX-2', 'D', 'padrao', NULL)`,
		)
		.run();
	await db
		.prepare(`INSERT INTO MovimentoCentroCustos (idMovimentoBancario, idCentroCustos, valor) VALUES (2, 42, 700), (2, 50, 300)`)
		.run();
}

async function postFluxo(path: string, ano: string, contas = ['24']): Promise<Fluxo> {
	const res = await SELF.fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeader },
		body: JSON.stringify({ ano, contas, tipoAgrupamento: 'centros' }),
	});
	expect(res.status).toBe(200);
	return (await res.json()) as Fluxo;
}

async function detalhe(subtipo: 'pagos' | 'contratados', mes: number, ano: number): Promise<Detalhe> {
	const params = new URLSearchParams({ planoId: 'todos', tipo: 'financiamentos', subtipo, mes: String(mes), ano: String(ano), tipoAgrupamento: 'centros' });
	const res = await SELF.fetch(`${BASE}/api/fluxoCaixa/detalhar?${params}`, { headers: authHeader });
	expect(res.status).toBe(200);
	return (await res.json()) as Detalhe;
}

const somaCredores = (o: Record<string, ValorCredor>) => Object.values(o).reduce((a, c) => a + c.valor, 0);
const somaDetalhe = (d: Detalhe) => d.flatMap((f) => f.parcelas).reduce((a, p) => a + p.valor, 0);

describe('Fluxo de Caixa (centros)', () => {
	beforeAll(async () => {
		await applySchema();
		await prepararAuth();
		await seed();
	});

	it('anoAnterior is the same engine as POST /api/fluxoCaixa (créditos novos included)', async () => {
		const anterior = await postFluxo('/api/fluxoCaixa/anoAnterior', '2026');
		const direto = await postFluxo('/api/fluxoCaixa', '2025');
		expect(anterior).toEqual(direto);

		// Créditos novos = all parcelas of the contract signed in Mar/2025 (even 2026/2027 ones), no lender registered
		expect(anterior.dadosMensais[2].financiamentos.contratados).toEqual({ f_2: { valor: 5000.5, descricao: 'JPT' } });
		expect(anterior.dadosMensais[9].receitas).toEqual({ 60: 2000 });
		expect(anterior.dadosMensais[9].despesas['1000'].filhos).toEqual({ 42: 700 });
		expect(anterior.dadosMensais[9].despesas['2000'].filhos).toEqual({ 50: 300 });
	});

	it('Quitados cell equals the detail: Liquidado only, liquidation date or due date', async () => {
		const { dadosMensais } = await postFluxo('/api/fluxoCaixa', '2025');
		const celula = somaCredores(dadosMensais[9].financiamentos.pagos);
		const det = await detalhe('pagos', 9, 2025);
		expect(celula).toBe(650.25); // 300 + 200 (no dt_liquidacao) + 150.25 (no lender); 999 'Aberto' excluded
		expect(somaDetalhe(det)).toBe(celula);
		expect(det.map((f) => f.numeroContrato).sort()).toEqual(['A', 'C']);
	});

	it('Créditos novos cell equals the detail', async () => {
		const { dadosMensais } = await postFluxo('/api/fluxoCaixa', '2025');
		const det = await detalhe('contratados', 2, 2025);
		expect(somaDetalhe(det)).toBe(somaCredores(dadosMensais[2].financiamentos.contratados));
	});

	it('contract without banco/pessoa is counted in Quitados (key f_<id>, label = responsável)', async () => {
		const { dadosMensais } = await postFluxo('/api/fluxoCaixa', '2025');
		expect(dadosMensais[9].financiamentos.pagos).toEqual({
			b_1: { valor: 500, descricao: 'SICREDI' },
			f_3: { valor: 150.25, descricao: 'MLF' },
		});
	});

	it('financing does not depend on the selected accounts', async () => {
		const todas = await postFluxo('/api/fluxoCaixa', '2025');
		const outra = await postFluxo('/api/fluxoCaixa', '2025', ['999']);
		expect(outra.dadosMensais.map((m) => m.financiamentos)).toEqual(todas.dadosMensais.map((m) => m.financiamentos));
		expect(outra.dadosMensais[9].receitas).toEqual({});
	});

	it('Gráfico cards use the table rules (C = R − D, financing left out)', async () => {
		const anterior = await postFluxo('/api/fluxoCaixa/anoAnterior', '2026');
		const resumo = resumoAnoFluxo(anterior.dadosMensais);
		expect(resumo.acumulado).toBe(montarFluxoMensal(anterior.dadosMensais).total.saldoAposInvestimentos);
		expect(resumo.acumulado).toBe(1000); // 2000 − 700 − 300
		expect(resumo.lucratividade).toBe(50);
	});
});

describe('Fluxo filter years', () => {
	it('goes from 2024 to next year, so 2027 is reachable in 2026', () => {
		expect(anosFiltroFluxo(new Date(2026, 9, 24))).toEqual(['2024', '2025', '2026', '2027']);
		expect(anosFiltroFluxo()).toContain(String(new Date().getFullYear() + 1));
	});
});
