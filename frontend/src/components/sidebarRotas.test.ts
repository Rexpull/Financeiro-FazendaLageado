import { describe, expect, it } from 'vitest';
import routesJsx from '../../routes.jsx?raw';
import { ROTAS_PESQUISA, filtrarRotasPesquisa } from './sidebarRotas';

const rotasDefinidas = new Set(['/', ...[...routesJsx.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => `/${m[1].replace(/^\//, '')}`)]);

describe('sidebar search routes', () => {
	it('every entry points to a route defined in routes.jsx', () => {
		expect(rotasDefinidas.has('/relatorios/fluxo-de-caixa')).toBe(true); // sanity check of the parser
		for (const r of ROTAS_PESQUISA) expect(rotasDefinidas.has(r.path), r.path).toBe(true);
	});

	it('paths are unique and every report of the menu is searchable', () => {
		expect(new Set(ROTAS_PESQUISA.map((r) => r.path)).size).toBe(ROTAS_PESQUISA.length);
		expect(filtrarRotasPesquisa('relatórios').map((r) => r.path)).toEqual([
			'/relatorios/fluxo-de-caixa',
			'/relatorios/centro-custos',
			'/relatorios/itens-classificados',
			'/relatorios/financiamentos',
		]);
	});

	it('filters by label, case-insensitively; empty term returns nothing', () => {
		expect(filtrarRotasPesquisa('FLUXO').map((r) => r.path)).toEqual(['/relatorios/fluxo-de-caixa']);
		expect(filtrarRotasPesquisa('centro de custos').map((r) => r.secao)).toEqual(['Cadastros', 'Relatórios']);
		expect(filtrarRotasPesquisa('   ')).toEqual([]);
	});

	it('ignores accents', () => {
		expect(filtrarRotasPesquisa('conciliacao').map((r) => r.path)).toEqual(['/financeiro/conciliacao-bancaria']);
		expect(filtrarRotasPesquisa('parametros').map((r) => r.path)).toEqual(['/parametros']);
	});
});
