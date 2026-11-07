import type { MovimentoBancario } from '../models/MovimentoBancario';
import type { MemoriaConciliacao } from '../models/MemoriaConciliacao';
import { chaveMemoria, percentuaisDe, valoresDe, type Fatia } from '../utils/memoriaConciliacao';
import { isMovimentoPendenteConcilacao } from '../utils/isMovimentoPendenteConcilacao';

/** Outcome of "Lembrar" on a PUT, shown to the user (the memory can be refused). */
export type ResultadoLembrar =
	| { acao: 'salva'; memoria: MemoriaConciliacao }
	| { acao: 'esquecida' }
	| { acao: 'recusada'; motivo: string };

/** What the classify modal needs to know about "Lembrar" for one line. */
export type AnaliseMemoria = {
	/** text that will be recognized ('' = nothing to recognize: the box is disabled) */
	chave: string;
	tipoMovimento: 'C' | 'D';
	/** memory that already applies to this line */
	memoria: MemoriaConciliacao | null;
	/** how many different planos (or "sem efeito" types) other recent lines with this text got in this conta */
	variacoes: number;
};

// Same SQL as migration_memoria_conciliacao.sql (idempotent).
const DDL_TABELA = [
	`CREATE TABLE IF NOT EXISTS memoriaConciliacao (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		idContaCorrente INTEGER NOT NULL,
		tipoMovimento TEXT NOT NULL CHECK(tipoMovimento IN ('C', 'D')),
		chave TEXT NOT NULL,
		historicoExemplo TEXT,
		modalidadeMovimento TEXT NOT NULL DEFAULT 'padrao',
		planosJson TEXT NOT NULL DEFAULT '[]',
		centrosJson TEXT NOT NULL DEFAULT '[]',
		idPessoa INTEGER,
		usos INTEGER NOT NULL DEFAULT 0,
		ultimoUsoEm TEXT,
		criadoEm TEXT DEFAULT CURRENT_TIMESTAMP,
		atualizadoEm TEXT DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_memoria_conciliacao_chave ON memoriaConciliacao(idContaCorrente, tipoMovimento, chave)`,
];
const DDL_COLUNA = `ALTER TABLE MovimentoBancario ADD COLUMN idMemoriaConciliacao INTEGER`;

/** Creates memoriaConciliacao and MovimentoBancario.idMemoriaConciliacao when missing. Safe to run concurrently. */
export async function garantirSchemaMemoria(db: D1Database): Promise<void> {
	const [tabela, colunas] = await db.batch([
		db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'memoriaConciliacao'`),
		db.prepare(`PRAGMA table_info(MovimentoBancario)`),
	]);
	if ((tabela.results ?? []).length === 0) {
		await db.batch(DDL_TABELA.map((sql) => db.prepare(sql)));
	}
	const temColuna = (colunas.results ?? []).some((c) => (c as { name?: string }).name === 'idMemoriaConciliacao');
	if (!temColuna) {
		try {
			await db.prepare(DDL_COLUNA).run();
		} catch (error) {
			if (!(error instanceof Error && /duplicate column/i.test(error.message))) throw error;
		}
	}
}

// One check per isolate (the schema only ever grows)
let schemaPronto: Promise<void> | null = null;
export function garantirSchemaMemoriaUmaVez(db: D1Database): Promise<void> {
	if (!schemaPronto) {
		schemaPronto = garantirSchemaMemoria(db).catch((err) => {
			schemaPronto = null;
			throw err;
		});
	}
	return schemaPronto;
}

type Row = {
	id: number;
	idContaCorrente: number;
	tipoMovimento: 'C' | 'D';
	chave: string;
	historicoExemplo: string | null;
	modalidadeMovimento: string;
	planosJson: string;
	centrosJson: string;
	idPessoa: number | null;
	usos: number;
	ultimoUsoEm: string | null;
	criadoEm: string | null;
	atualizadoEm: string | null;
};

const lerFatias = (json: string | null): Fatia[] => {
	try {
		const v = JSON.parse(json || '[]');
		return Array.isArray(v) ? v.filter((f) => Number(f?.id) > 0 && Number.isFinite(Number(f?.pct))).map((f) => ({ id: Number(f.id), pct: Number(f.pct) })) : [];
	} catch {
		return [];
	}
};

const paraMemoria = (r: Row): MemoriaConciliacao => ({
	id: r.id,
	idContaCorrente: r.idContaCorrente,
	tipoMovimento: r.tipoMovimento,
	chave: r.chave,
	historicoExemplo: r.historicoExemplo,
	modalidadeMovimento: r.modalidadeMovimento === 'transferencia' ? 'transferencia' : 'padrao',
	planos: lerFatias(r.planosJson),
	centros: lerFatias(r.centrosJson),
	idPessoa: r.idPessoa,
	usos: Number(r.usos) || 0,
	ultimoUsoEm: r.ultimoUsoEm,
	criadoEm: r.criadoEm,
	atualizadoEm: r.atualizadoEm,
});

/** C/D of a movement: its tipoMovimento, else the sign of the value. */
export const direcao = (m: Pick<MovimentoBancario, 'tipoMovimento' | 'valor'>): 'C' | 'D' =>
	m.tipoMovimento === 'C' || m.tipoMovimento === 'D' ? m.tipoMovimento : Number(m.valor) >= 0 ? 'C' : 'D';

/** Plans of a saved movement as {id, valor}: the Resultado rows, else the single plano. */
function planosDoMovimento(m: MovimentoBancario): Array<{ id: number; valor: number }> {
	const rl = (m.resultadoList ?? []).map((r) => ({ id: Number(r.idPlanoContas), valor: Math.abs(Number(r.valor) || 0) }));
	if (rl.length) return rl;
	return m.idPlanoContas ? [{ id: Number(m.idPlanoContas), valor: Math.abs(Number(m.valor) || 0) }] : [];
}

function centrosDoMovimento(m: MovimentoBancario): Array<{ id: number; valor: number }> {
	const cl = (m.centroCustosList ?? []).map((c) => ({ id: Number(c.idCentroCustos), valor: Math.abs(Number(c.valor) || 0) }));
	if (cl.length) return cl;
	return m.idCentroCustos ? [{ id: Number(m.idCentroCustos), valor: Math.abs(Number(m.valor) || 0) }] : [];
}

/**
 * The classification a memory gives to a new line of `valor`: fields create() persists as they are
 * (single id or a rateio list in R$ that adds up to |valor|).
 */
export function classificacaoDaMemoria(
	mem: MemoriaConciliacao,
	mov: Pick<MovimentoBancario, 'valor' | 'dtMovimento' | 'idContaCorrente' | 'tipoMovimento'>,
): Pick<MovimentoBancario, 'modalidadeMovimento' | 'idPlanoContas' | 'resultadoList' | 'idCentroCustos' | 'centroCustosList' | 'idPessoa'> {
	const tipo = direcao(mov);
	const planos = valoresDe(mem.planos, mov.valor);
	const centros = valoresDe(mem.centros, mov.valor);
	return {
		modalidadeMovimento: mem.modalidadeMovimento,
		idPlanoContas: planos.length === 1 ? planos[0].id : undefined,
		resultadoList:
			planos.length > 1
				? planos.map((p) => ({
						idPlanoContas: p.id,
						valor: p.valor,
						tipo,
						idContaCorrente: mov.idContaCorrente,
						dtMovimento: mov.dtMovimento,
					}))
				: undefined,
		idCentroCustos: centros.length === 1 ? centros[0].id : undefined,
		centroCustosList: centros.length > 1 ? centros.map((c) => ({ idMovimentoBancario: 0, idCentroCustos: c.id, valor: c.valor })) : undefined,
		idPessoa: mem.idPessoa ?? undefined,
	};
}

export class MemoriaConciliacaoRepository {
	constructor(private db: D1Database) {}

	ensureSchema(): Promise<void> {
		return garantirSchemaMemoriaUmaVez(this.db);
	}

	async listarPorConta(idContaCorrente: number): Promise<MemoriaConciliacao[]> {
		await this.ensureSchema();
		const { results } = await this.db
			.prepare(`SELECT * FROM memoriaConciliacao WHERE idContaCorrente = ? ORDER BY tipoMovimento DESC, chave`)
			.bind(idContaCorrente)
			.all<Row>();
		return (results ?? []).map(paraMemoria);
	}

	async buscarPorChave(idContaCorrente: number, tipoMovimento: 'C' | 'D', chave: string): Promise<MemoriaConciliacao | null> {
		if (!chave) return null;
		await this.ensureSchema();
		const r = await this.db
			.prepare(`SELECT * FROM memoriaConciliacao WHERE idContaCorrente = ? AND tipoMovimento = ? AND chave = ?`)
			.bind(idContaCorrente, tipoMovimento, chave)
			.first<Row>();
		return r ? paraMemoria(r) : null;
	}

	/** Memory that applies to a movement (same conta, direction and key), or null. */
	buscarDoMovimento(mov: MovimentoBancario): Promise<MemoriaConciliacao | null> {
		return this.buscarPorChave(Number(mov.idContaCorrente), direcao(mov), chaveMemoria(mov.historico));
	}

	/**
	 * Remembers the classification the movement has NOW (after the PUT). Refused for financing, for a text
	 * with nothing to recognize, and for a line still pending (an incomplete classification is not repeated).
	 */
	async salvarDoMovimento(mov: MovimentoBancario): Promise<ResultadoLembrar> {
		const chave = chaveMemoria(mov.historico);
		const modalidade = mov.modalidadeMovimento ?? 'padrao';
		if (modalidade === 'financiamento' || Number(mov.idFinanciamento) > 0) {
			return { acao: 'recusada', motivo: 'Lançamentos de financiamento não são lembrados.' };
		}
		if (!chave) return { acao: 'recusada', motivo: 'O histórico deste lançamento não tem texto para reconhecer.' };
		if (isMovimentoPendenteConcilacao(mov)) {
			return { acao: 'recusada', motivo: 'Complete a classificação (plano e centro de custos) para lembrar.' };
		}
		const planos = percentuaisDe(planosDoMovimento(mov));
		const centros = modalidade === 'transferencia' ? [] : percentuaisDe(centrosDoMovimento(mov));
		await this.ensureSchema();
		const tipo = direcao(mov);
		await this.db
			.prepare(
				`INSERT INTO memoriaConciliacao
					(idContaCorrente, tipoMovimento, chave, historicoExemplo, modalidadeMovimento, planosJson, centrosJson, idPessoa)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(idContaCorrente, tipoMovimento, chave) DO UPDATE SET
					historicoExemplo = excluded.historicoExemplo,
					modalidadeMovimento = excluded.modalidadeMovimento,
					planosJson = excluded.planosJson,
					centrosJson = excluded.centrosJson,
					idPessoa = excluded.idPessoa,
					atualizadoEm = CURRENT_TIMESTAMP`,
			)
			.bind(
				Number(mov.idContaCorrente),
				tipo,
				chave,
				mov.historico ?? null,
				modalidade,
				JSON.stringify(planos),
				JSON.stringify(centros),
				mov.idPessoa ? Number(mov.idPessoa) : null,
			)
			.run();
		const memoria = await this.buscarPorChave(Number(mov.idContaCorrente), tipo, chave);
		return memoria ? { acao: 'salva', memoria } : { acao: 'recusada', motivo: 'Não foi possível lembrar este lançamento.' };
	}

	/**
	 * For the classify modal: the text that will be recognized, the memory that already applies, and in how many
	 * different ways other recent lines with the same text were classified in this conta (a generic text such as
	 * "DÉB.TIT.COMPE EFETIVADO" pays several suppliers: the user is warned before remembering it).
	 */
	async analisarMovimento(mov: MovimentoBancario): Promise<AnaliseMemoria> {
		const chave = chaveMemoria(mov.historico);
		const tipoMovimento = direcao(mov);
		if (!chave) return { chave, tipoMovimento, memoria: null, variacoes: 0 };
		const memoria = await this.buscarPorChave(Number(mov.idContaCorrente), tipoMovimento, chave);
		const { results } = await this.db
			.prepare(
				`SELECT mb.historico, COALESCE(mb.modalidadeMovimento, 'padrao') AS modalidade, mb.idPlanoContas,
					(SELECT GROUP_CONCAT(r.idPlanoContas) FROM Resultado r WHERE r.idMovimentoBancario = mb.id) AS planos
				 FROM MovimentoBancario mb
				 WHERE mb.idContaCorrente = ? AND mb.id <> ?
				   AND (CASE WHEN mb.tipoMovimento IN ('C', 'D') THEN mb.tipoMovimento WHEN mb.valor >= 0 THEN 'C' ELSE 'D' END) = ?
				   AND COALESCE(mb.modalidadeMovimento, 'padrao') <> 'financiamento'
				 ORDER BY mb.dtMovimento DESC LIMIT 800`,
			)
			.bind(Number(mov.idContaCorrente), Number(mov.id) || 0, tipoMovimento)
			.all<{ historico: string; modalidade: string; idPlanoContas: number | null; planos: string | null }>();
		const ids = (lista: string | null, unico: number | null) =>
			[...new Set((lista ? lista.split(',') : unico ? [String(unico)] : []).map(Number))].sort((a, b) => a - b).join(',');
		const formas = new Set<string>();
		for (const r of results ?? []) {
			if (chaveMemoria(r.historico) !== chave) continue;
			const planos = ids(r.planos, r.idPlanoContas);
			if (!planos) continue; // without a plano the line says nothing about how the text is classified
			formas.add(`${r.modalidade}|${planos}`);
		}
		return { chave, tipoMovimento, memoria, variacoes: formas.size };
	}

	async excluir(id: number): Promise<boolean> {
		await this.ensureSchema();
		const res = await this.db.batch([
			this.db.prepare(`UPDATE MovimentoBancario SET idMemoriaConciliacao = NULL WHERE idMemoriaConciliacao = ?`).bind(id),
			this.db.prepare(`DELETE FROM memoriaConciliacao WHERE id = ?`).bind(id),
		]);
		return (res[1].meta?.changes ?? 0) > 0;
	}

	/** "Lembrar" unticked on a line: forgets the memory of that line's text (if any). */
	async excluirDoMovimento(mov: MovimentoBancario): Promise<ResultadoLembrar> {
		const mem = await this.buscarDoMovimento(mov);
		if (mem) await this.excluir(mem.id);
		return { acao: 'esquecida' };
	}

	/** Tags a line as classified by a memory and counts the use. */
	async registrarUso(idMovimento: number, idMemoria: number): Promise<void> {
		await this.db.batch([
			this.db.prepare(`UPDATE MovimentoBancario SET idMemoriaConciliacao = ? WHERE id = ?`).bind(idMemoria, idMovimento),
			this.db
				.prepare(`UPDATE memoriaConciliacao SET usos = usos + 1, ultimoUsoEm = CURRENT_TIMESTAMP WHERE id = ?`)
				.bind(idMemoria),
		]);
	}

	/** The line was reclassified by hand: it no longer shows the "memória" tag. */
	async desmarcarMovimento(idMovimento: number): Promise<void> {
		await this.ensureSchema();
		await this.db.prepare(`UPDATE MovimentoBancario SET idMemoriaConciliacao = NULL WHERE id = ?`).bind(idMovimento).run();
	}
}
