import { intervaloDoMes, type NaturezaCaixa, type TipoLancamentoCaixa } from '../utils/caixaDiario';

export interface CaixaLancamento {
	id: number;
	tipo: TipoLancamentoCaixa;
	natureza: NaturezaCaixa;
	data: string;
	descricao: string;
	valor: number;
	criadoEm: string | null;
	atualizadoEm: string | null;
}

export interface CaixaLancamentoInput {
	tipo: TipoLancamentoCaixa;
	natureza: NaturezaCaixa;
	data: string;
	descricao: string;
	valor: number;
}

export interface CaixaParcela {
	id: number;
	data: string;
	valor: number;
	status: string;
	numParcela: number;
	idFinanciamento: number;
	contrato: string | null;
	tomador: string | null;
	banco: string | null;
}

export interface CaixaSaldoInicial {
	ano: number;
	mes: number;
	valor: number | null;
	atualizadoEm: string | null;
}

export interface CaixaDadosMes {
	saldoInicial: CaixaSaldoInicial;
	lancamentos: CaixaLancamento[];
	parcelas: CaixaParcela[];
}

// Mesmo DDL de migration_caixa.sql (idempotente).
const DDL = [
	`CREATE TABLE IF NOT EXISTS caixaSaldoInicial (
		ano INTEGER NOT NULL,
		mes INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
		valor REAL NOT NULL,
		atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (ano, mes)
	)`,
	`CREATE TABLE IF NOT EXISTS caixaLancamento (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		tipo TEXT NOT NULL CHECK(tipo IN ('BOLETO', 'PREVISAO')),
		natureza TEXT NOT NULL CHECK(natureza IN ('C', 'D')),
		data TEXT NOT NULL,
		descricao TEXT NOT NULL,
		valor REAL NOT NULL CHECK(valor > 0),
		criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
		atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS idx_caixa_lancamento_data ON caixaLancamento(data)`,
];

const COLUNAS_LANCAMENTO = `id, tipo, natureza, data, descricao, valor, criado_em, atualizado_em`;

function mapLancamento(r: Record<string, unknown>): CaixaLancamento {
	return {
		id: Number(r.id),
		tipo: r.tipo as TipoLancamentoCaixa,
		natureza: r.natureza as NaturezaCaixa,
		data: String(r.data).slice(0, 10),
		descricao: String(r.descricao ?? ''),
		valor: Number(r.valor),
		criadoEm: (r.criado_em as string | null) ?? null,
		atualizadoEm: (r.atualizado_em as string | null) ?? null,
	};
}

export class CaixaRepository {
	private pronto: Promise<void> | null = null;

	constructor(private db: D1Database) {}

	/** Cria as tabelas do caixa se ainda não existirem (uma verificação por instância, aguardada). */
	ensureTables(): Promise<void> {
		if (!this.pronto) {
			this.pronto = this.criarTabelasSeFaltarem().catch((err) => {
				this.pronto = null;
				throw err;
			});
		}
		return this.pronto;
	}

	private async criarTabelasSeFaltarem(): Promise<void> {
		const { results } = await this.db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('caixaSaldoInicial', 'caixaLancamento')`)
			.all();
		if (results.length === 2) return;
		await this.db.batch(DDL.map((sql) => this.db.prepare(sql)));
	}

	/** Saldo inicial, lançamentos e parcelas do mês em uma única ida ao D1 (batch, sem N+1). */
	async getDadosMes(ano: number, mes: number): Promise<CaixaDadosMes> {
		await this.ensureTables();
		const { inicio, fimExclusivo } = intervaloDoMes(ano, mes);

		const [saldoRes, lancRes, parcRes] = await this.db.batch([
			this.db.prepare(`SELECT valor, atualizado_em FROM caixaSaldoInicial WHERE ano = ? AND mes = ?`).bind(ano, mes),
			this.db
				.prepare(`SELECT ${COLUNAS_LANCAMENTO} FROM caixaLancamento WHERE data >= ? AND data < ? ORDER BY data, id`)
				.bind(inicio, fimExclusivo),
			// dt_vencimento pode estar como 'YYYY-MM-DD' ou com hora; a faixa por string cobre os dois.
			this.db
				.prepare(
					`SELECT pf.id, substr(pf.dt_vencimento, 1, 10) AS data, pf.valor, pf.status, pf.numParcela, pf.idFinanciamento,
					        f.numeroContrato AS contrato, f.responsavel AS tomador, b.nome AS banco
					   FROM parcelaFinanciamento pf
					   LEFT JOIN Financiamento f ON f.id = pf.idFinanciamento
					   LEFT JOIN banco b ON b.id = f.idBanco
					  WHERE pf.dt_vencimento >= ? AND pf.dt_vencimento < ?
					  ORDER BY pf.dt_vencimento, pf.id`,
				)
				.bind(inicio, fimExclusivo),
		]);

		const saldoRow = (saldoRes.results?.[0] ?? null) as Record<string, unknown> | null;
		return {
			saldoInicial: {
				ano,
				mes,
				valor: saldoRow ? Number(saldoRow.valor) : null,
				atualizadoEm: saldoRow ? ((saldoRow.atualizado_em as string | null) ?? null) : null,
			},
			lancamentos: (lancRes.results ?? []).map((r) => mapLancamento(r as Record<string, unknown>)),
			parcelas: (parcRes.results ?? []).map((row) => {
				const r = row as Record<string, unknown>;
				return {
					id: Number(r.id),
					data: String(r.data),
					valor: Number(r.valor),
					status: String(r.status ?? ''),
					numParcela: Number(r.numParcela),
					idFinanciamento: Number(r.idFinanciamento),
					contrato: (r.contrato as string | null) ?? null,
					tomador: (r.tomador as string | null) ?? null,
					banco: (r.banco as string | null) ?? null,
				};
			}),
		};
	}

	async salvarSaldoInicial(ano: number, mes: number, valor: number): Promise<CaixaSaldoInicial> {
		await this.ensureTables();
		const row = await this.db
			.prepare(
				`INSERT INTO caixaSaldoInicial (ano, mes, valor, atualizado_em) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
				 ON CONFLICT(ano, mes) DO UPDATE SET valor = excluded.valor, atualizado_em = CURRENT_TIMESTAMP
				 RETURNING ano, mes, valor, atualizado_em`,
			)
			.bind(ano, mes, valor)
			.first<Record<string, unknown>>();
		return {
			ano,
			mes,
			valor: row ? Number(row.valor) : valor,
			atualizadoEm: (row?.atualizado_em as string | null) ?? null,
		};
	}

	async removerSaldoInicial(ano: number, mes: number): Promise<CaixaSaldoInicial> {
		await this.ensureTables();
		await this.db.prepare(`DELETE FROM caixaSaldoInicial WHERE ano = ? AND mes = ?`).bind(ano, mes).run();
		return { ano, mes, valor: null, atualizadoEm: null };
	}

	async getLancamento(id: number): Promise<CaixaLancamento | null> {
		await this.ensureTables();
		const row = await this.db
			.prepare(`SELECT ${COLUNAS_LANCAMENTO} FROM caixaLancamento WHERE id = ?`)
			.bind(id)
			.first<Record<string, unknown>>();
		return row ? mapLancamento(row) : null;
	}

	async criarLancamento(l: CaixaLancamentoInput): Promise<CaixaLancamento> {
		await this.ensureTables();
		const row = await this.db
			.prepare(
				`INSERT INTO caixaLancamento (tipo, natureza, data, descricao, valor) VALUES (?, ?, ?, ?, ?)
				 RETURNING ${COLUNAS_LANCAMENTO}`,
			)
			.bind(l.tipo, l.natureza, l.data, l.descricao, l.valor)
			.first<Record<string, unknown>>();
		if (!row) throw new Error('Falha ao inserir lançamento do caixa');
		return mapLancamento(row);
	}

	async atualizarLancamento(id: number, l: CaixaLancamentoInput): Promise<CaixaLancamento | null> {
		await this.ensureTables();
		const row = await this.db
			.prepare(
				`UPDATE caixaLancamento
				    SET tipo = ?, natureza = ?, data = ?, descricao = ?, valor = ?, atualizado_em = CURRENT_TIMESTAMP
				  WHERE id = ?
				 RETURNING ${COLUNAS_LANCAMENTO}`,
			)
			.bind(l.tipo, l.natureza, l.data, l.descricao, l.valor, id)
			.first<Record<string, unknown>>();
		return row ? mapLancamento(row) : null;
	}

	async excluirLancamento(id: number): Promise<boolean> {
		await this.ensureTables();
		const res = await this.db.prepare(`DELETE FROM caixaLancamento WHERE id = ?`).bind(id).run();
		return (res.meta?.changes ?? 0) > 0;
	}
}
