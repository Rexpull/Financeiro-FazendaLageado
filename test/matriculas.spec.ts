// Matrículas (garantias): registered list, financing saves the guarantee in one canonical form, report
// filters by matrícula exactly, renaming a matrícula updates the contracts, deleting one in use is refused.
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import schemaSql from './fixtures/schema.sql?raw';

const BASE = 'https://worker.test';
const db = (env as unknown as { DB: D1Database }).DB;

async function applySchema() {
	const statements = schemaSql
		.split(/;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, '').trim())
		.filter(Boolean);
	for (const sql of statements) await db.prepare(sql).run();
	await db
		.prepare(
			`INSERT INTO Financiamento (id, responsavel, dataContrato, valor, numeroContrato, modalidade, numeroGarantia) VALUES
			(1, 'GFS', '2026-01-01', 1000, 'C-1', 'CUSTEIO', '2.319, 21.175 e 3041'),
			(2, 'GFS', '2026-01-01', 1000, 'C-2', 'CUSTEIO', '113041'),
			(3, 'RLF', '2026-01-01', 1000, 'C-3', 'CUSTEIO', NULL)`,
		)
		.run();
	await db.prepare(`INSERT INTO matricula (numero) VALUES ('3041'), ('2319'), ('21175'), ('113041'), ('9167')`).run();
}

const api = async (path: string, init?: RequestInit) => {
	const res = await SELF.fetch(`${BASE}${path}`, init);
	return { status: res.status, body: (await res.json()) as any };
};
const enviar = (method: string, path: string, body: unknown) =>
	api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('Matrículas (garantias)', () => {
	beforeEach(applySchema);

	it('lista com quantos contratos usam cada uma (texto antigo incluído)', async () => {
		const { status, body } = await api('/api/matricula');
		expect(status).toBe(200);
		expect(body.map((m: any) => [m.numero, m.contratos])).toEqual([
			['2319', 1],
			['3041', 1],
			['9167', 0],
			['21175', 1],
			['113041', 1],
		]);
	});

	it('cadastra sem ponto, recusa repetida e vazia', async () => {
		const nova = await enviar('POST', '/api/matricula', { numero: ' 117.404 ', descricao: 'Fazenda Nova' });
		expect(nova.status).toBe(201);
		expect(nova.body).toMatchObject({ numero: '117404', descricao: 'Fazenda Nova', contratos: 0 });
		expect((await enviar('POST', '/api/matricula', { numero: '117404' })).status).toBe(409);
		expect((await enviar('POST', '/api/matricula', { numero: '  ' })).status).toBe(400);
		expect((await enviar('POST', '/api/matricula', { numero: '1, 2' })).status).toBe(400);
	});

	it('trocar o número troca também nos contratos', async () => {
		const lista = (await api('/api/matricula')).body;
		const m3041 = lista.find((m: any) => m.numero === '3041');
		const r = await enviar('PUT', `/api/matricula/${m3041.id}`, { numero: '3042', descricao: 'corrigida' });
		expect(r.status).toBe(200);
		expect(r.body).toMatchObject({ numero: '3042', contratos: 1 });
		const f1 = await db.prepare(`SELECT numeroGarantia FROM Financiamento WHERE id = 1`).first<{ numeroGarantia: string }>();
		expect(f1?.numeroGarantia).toBe('2319, 3042, 21175');
		const f2 = await db.prepare(`SELECT numeroGarantia FROM Financiamento WHERE id = 2`).first<{ numeroGarantia: string }>();
		expect(f2?.numeroGarantia).toBe('113041'); // 113041 não contém a matrícula 3041
	});

	it('não exclui matrícula em uso; exclui a livre', async () => {
		const lista = (await api('/api/matricula')).body;
		const usada = lista.find((m: any) => m.numero === '3041');
		const livre = lista.find((m: any) => m.numero === '9167');
		const r = await api(`/api/matricula/${usada.id}`, { method: 'DELETE' });
		expect(r.status).toBe(409);
		expect(r.body.error).toContain('1 contrato');
		expect((await api(`/api/matricula/${livre.id}`, { method: 'DELETE' })).status).toBe(200);
		expect((await api(`/api/matricula/${livre.id}`, { method: 'DELETE' })).status).toBe(404);
	});

	it('financiamento grava a garantia sempre na mesma forma', async () => {
		const novo = await enviar('POST', '/api/financiamento', {
			responsavel: 'GFS',
			dataContrato: '2026-02-01',
			valor: 500,
			numeroContrato: 'C-9',
			modalidade: 'CUSTEIO',
			numeroGarantia: '21.175 e 2.319',
		});
		expect([200, 201]).toContain(novo.status);
		const salvo = await db.prepare(`SELECT numeroGarantia FROM Financiamento WHERE numeroContrato = 'C-9'`).first<{ numeroGarantia: string }>();
		expect(salvo?.numeroGarantia).toBe('2319, 21175');
	});

	it('relatório filtra pela matrícula exata e pela taxa "sem"', async () => {
		const ids = async (q: string) =>
			(await api(`/api/relatorio/financiamentos?ano=2026&${q}`)).body.ativos.contratos.map((c: any) => c.idFinanciamento).sort();
		expect(await ids('numeroGarantia=3041')).toEqual([1]);
		expect(await ids('numeroGarantia=113041')).toEqual([2]);
		expect(await ids('faixaJuros=sem')).toEqual([1, 2, 3]);
		expect(await ids('faixaJuros=%3C%3D8')).toEqual([]);
	});
});
