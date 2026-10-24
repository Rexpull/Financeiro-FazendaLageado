/** Entries of the sidebar search. Paths must exist in frontend/routes.jsx; labels follow the menu. */
export type RotaPesquisa = { path: string; label: string; secao?: string };

export const ROTAS_PESQUISA: ReadonlyArray<RotaPesquisa> = [
	{ path: "/dashboard", label: "Dashboard" },
	{ path: "/cadastro/pessoa", label: "Pessoa", secao: "Cadastros" },
	{ path: "/cadastro/usuario", label: "Usuário", secao: "Cadastros" },
	{ path: "/cadastro/banco", label: "Banco", secao: "Cadastros" },
	{ path: "/cadastro/conta-corrente", label: "Conta Corrente", secao: "Cadastros" },
	{ path: "/cadastro/plano-de-contas", label: "Plano de Contas", secao: "Cadastros" },
	{ path: "/cadastro/centro-custos", label: "Centro de Custos", secao: "Cadastros" },
	{ path: "/financeiro/conciliacao-bancaria", label: "Conciliação Bancária", secao: "Financeiro" },
	{ path: "/financeiro/financiamento", label: "Financiamento", secao: "Financeiro" },
	{ path: "/relatorios/fluxo-de-caixa", label: "Fluxo de Caixa", secao: "Relatórios" },
	{ path: "/relatorios/centro-custos", label: "Centro de Custos", secao: "Relatórios" },
	{ path: "/relatorios/itens-classificados", label: "Plano de Contas", secao: "Relatórios" },
	{ path: "/relatorios/financiamentos", label: "Financiamentos", secao: "Relatórios" },
	{ path: "/parametros", label: "Parâmetros" },
];

/** Lower case without accents, so "conciliacao" finds "Conciliação". */
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Case- and accent-insensitive match on the label or the menu section ("relatórios" lists every report). */
export function filtrarRotasPesquisa(termo: string): RotaPesquisa[] {
	const t = normalizar(termo.trim());
	if (!t) return [];
	return ROTAS_PESQUISA.filter((r) => normalizar(`${r.label} ${r.secao ?? ""}`).includes(t));
}
