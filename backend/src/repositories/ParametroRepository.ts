import { Parametro } from '../models/Parametro';

export class ParametroRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getAll(): Promise<Parametro[]> {
		const { results } = await this.db
			.prepare(
				`
            SELECT * FROM parametros
        `,
			)
			.all();

		return results.map((result: Record<string, unknown>) => ({
			idPlanoTransferenciaEntreContas: result.idPlanoTransferenciaEntreContas as number,
			idPlanoEntradaFinanciamentos: result.idPlanoEntradaFinanciamentos as number,
			idPlanoPagamentoFinanciamentos: result.idPlanoPagamentoFinanciamentos as number,
			idPlanoEstornos:
				result.idPlanoEstornos != null && result.idPlanoEstornos !== ''
					? (Number(result.idPlanoEstornos) as number)
					: null,
			idPlanoAplicacaoResgateInvestimentos:
				result.idPlanoAplicacaoResgateInvestimentos != null && result.idPlanoAplicacaoResgateInvestimentos !== ''
					? (Number(result.idPlanoAplicacaoResgateInvestimentos) as number)
					: null,
		})) as Parametro[];
	}

	async update(parametro: Parametro): Promise<void> {
		await this.db
			.prepare(
				`
            UPDATE parametros 
            SET idPlanoTransferenciaEntreContas = ?, 
                idPlanoEntradaFinanciamentos = ?, 
                idPlanoPagamentoFinanciamentos = ?,
                idPlanoEstornos = ?,
                idPlanoAplicacaoResgateInvestimentos = ?
            WHERE id = 1
        `,
			)
			.bind(
				parametro.idPlanoTransferenciaEntreContas,
				parametro.idPlanoEntradaFinanciamentos,
				parametro.idPlanoPagamentoFinanciamentos,
				parametro.idPlanoEstornos ?? null,
				parametro.idPlanoAplicacaoResgateInvestimentos ?? null,
			)
			.run();
	}
}
