export interface Parametro {
	/** Movimentações sem efeito financeiro (conciliação) + transferências entre contas no sistema */
	idPlanoTransferenciaEntreContas: number;
	idPlanoEntradaFinanciamentos: number;
	idPlanoPagamentoFinanciamentos: number;
	/** Plano para conciliação tipo "Estornos" (ex.: TED devolvida); opcional até rodar a migração */
	idPlanoEstornos?: number | null;
	/** Plano para "Aplicação/Resgate em investimentos" na conciliação (Movimentação interna) */
	idPlanoAplicacaoResgateInvestimentos?: number | null;
}
