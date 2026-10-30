import { CaixaRepository } from './CaixaRepository';
import { hojeISO } from '../utils/relatorioFinanciamentos';
import {
	anexarObservacao,
	dataBR,
	erroDataRenegociacao,
	jurosDasParcelas,
	mensagemParcelasVinculadas,
	motivoParcelaBloqueada,
	numerarParcelas,
	somaValores,
	statusNovaParcela,
	type CondicoesAnteriores,
	type ParcelaAnterior,
	type RenegociacaoValidada,
	type TipoRenegociacao,
} from '../utils/renegociacao';
import { RegistroEmUsoError } from '../utils/verificarUsoRegistro';
import type { RenegociacaoSaldoRow } from '../utils/saldoDevedor';

/** 400 with a pt-BR message for the client. */
export class RenegociacaoInvalidaError extends Error {
	readonly status = 400;
	constructor(message: string) {
		super(message);
		this.name = 'RenegociacaoInvalidaError';
	}
}

export class FinanciamentoNaoEncontradoError extends Error {
	readonly status = 404;
	constructor() {
		super('Financiamento não encontrado');
		this.name = 'FinanciamentoNaoEncontradoError';
	}
}

export interface RenegociacaoHistorico {
	id: number;
	idFinanciamento: number;
	numeroContrato: string | null;
	tipo: TipoRenegociacao;
	dataRenegociacao: string;
	idFinanciamentoNovo: number | null;
	numeroContratoNovo: string | null;
	parcelasAnteriores: ParcelaAnterior[];
	condicoesAnteriores: CondicoesAnteriores | null;
	observacao: string | null;
	criadoEm: string | null;
}

export interface ResultadoRenegociacao {
	idFinanciamento: number;
	idFinanciamentoNovo: number | null;
	parcelasRemovidas: number;
	valorRemovido: number;
	parcelasCriadas: number;
	valorCriado: number;
}

// Mesmo SQL de migration_renegociacao.sql (idempotente). Sem FOREIGN KEY: o D1 aplica FKs e isso
// travaria a exclusão de contratos pelas telas; FinanciamentoRepository.deleteById limpa as referências.
const DDL_TABELA = [
	`CREATE TABLE IF NOT EXISTS financiamentoRenegociacao (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		idFinanciamento INTEGER NOT NULL,
		tipo TEXT NOT NULL CHECK(tipo IN ('ADITIVO', 'NOVO_CONTRATO')),
		dataRenegociacao TEXT NOT NULL,
		idFinanciamentoNovo INTEGER,
		parcelasAnteriores TEXT NOT NULL DEFAULT '[]',
		parcelasNovas TEXT NOT NULL DEFAULT '[]',
		condicoesAnteriores TEXT,
		observacao TEXT,
		criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE INDEX IF NOT EXISTS idx_financiamento_renegociacao_contrato ON financiamentoRenegociacao(idFinanciamento)`,
	`CREATE INDEX IF NOT EXISTS idx_financiamento_renegociacao_novo ON financiamentoRenegociacao(idFinanciamentoNovo)`,
];
const DDL_COLUNA_ORIGEM = `ALTER TABLE Financiamento ADD COLUMN idFinanciamentoOrigem INTEGER`;

/**
 * Creates financiamentoRenegociacao and Financiamento.idFinanciamentoOrigem when missing (one check per
 * call: 1 batch with 2 reads). Safe to run concurrently: CREATE ... IF NOT EXISTS, and a "duplicate column"
 * from a parallel ALTER is ignored.
 */
export async function garantirSchemaRenegociacao(db: D1Database): Promise<void> {
	const [tabela, colunas] = await db.batch([
		db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financiamentoRenegociacao'`),
		db.prepare(`PRAGMA table_info(Financiamento)`),
	]);
	if ((tabela.results ?? []).length === 0) {
		await db.batch(DDL_TABELA.map((sql) => db.prepare(sql)));
	}
	const temOrigem = (colunas.results ?? []).some((c) => (c as { name?: string }).name === 'idFinanciamentoOrigem');
	if (!temOrigem) {
		try {
			await db.prepare(DDL_COLUNA_ORIGEM).run();
		} catch (error) {
			if (!(error instanceof Error && /duplicate column/i.test(error.message))) throw error;
		}
	}
}

type ContratoAtual = {
	id: number;
	idBanco: number | null;
	idPessoa: number | null;
	responsavel: string;
	valor: number;
	taxaJurosAnual: number | null;
	totalJuros: number | null;
	numeroContrato: string;
	numeroGarantia: string | null;
	observacao: string | null;
	modalidade: string | null;
	nomeModalidadeParticular: string | null;
	dataContrato: string | null;
	ultimaRenegociacao: string | null;
};

type ParcelaAtual = {
	id: number;
	numParcela: number;
	dt_vencimento: string;
	valor: number;
	status: string;
	idMovimentoBancario: number | null;
	nResultados: number;
};

const D1_MAX_BINDS = 90;

const PARCELAS_ALTERADAS = 'parcelas alteradas durante a renegociacao';

/** Runs the renegotiation batch; the guard statement failing (malformed JSON) becomes a 409 with a clear message. */
async function executarComGuarda(db: D1Database, stmts: D1PreparedStatement[]) {
	try {
		return await db.batch(stmts);
	} catch (error) {
		if (error instanceof Error && /malformed JSON/i.test(error.message)) {
			throw new RegistroEmUsoError(
				'As parcelas deste contrato mudaram enquanto a renegociação era feita (alguma foi paga, conciliada ou incluída). Feche e abra a renegociação de novo.',
			);
		}
		throw error;
	}
}

function emLotes<T>(lista: T[], tamanho = D1_MAX_BINDS): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
	return out;
}

function parseJson<T>(raw: unknown, padrao: T): T {
	if (typeof raw !== 'string' || !raw) return padrao;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return padrao;
	}
}

export class RenegociacaoRepository {
	private pronto: Promise<void> | null = null;

	constructor(private db: D1Database) {}

	ensureSchema(): Promise<void> {
		if (!this.pronto) {
			this.pronto = garantirSchemaRenegociacao(this.db).catch((err) => {
				this.pronto = null;
				throw err;
			});
		}
		return this.pronto;
	}

	/** Every renegotiation, as the saldo devedor history needs it (utils/saldoDevedor.parcelasComRenegociacoes). */
	async listarParaSaldo(): Promise<RenegociacaoSaldoRow[]> {
		await this.ensureSchema();
		const { results } = await this.db
			.prepare(
				`SELECT id, idFinanciamento, tipo, dataRenegociacao, parcelasAnteriores, parcelasNovas, condicoesAnteriores FROM financiamentoRenegociacao`,
			)
			.all<RenegociacaoSaldoRow>();
		return results ?? [];
	}

	/** History of a contract: renegotiations of it and the one it came from (newest first). */
	async listar(idFinanciamento: number): Promise<RenegociacaoHistorico[]> {
		await this.ensureSchema();
		const { results } = await this.db
			.prepare(
				`SELECT r.id, r.idFinanciamento, f.numeroContrato, r.tipo, r.dataRenegociacao, r.idFinanciamentoNovo,
				        fn.numeroContrato AS numeroContratoNovo, r.parcelasAnteriores, r.condicoesAnteriores, r.observacao, r.criadoEm
				   FROM financiamentoRenegociacao r
				   LEFT JOIN Financiamento f ON f.id = r.idFinanciamento
				   LEFT JOIN Financiamento fn ON fn.id = r.idFinanciamentoNovo
				  WHERE r.idFinanciamento = ? OR r.idFinanciamentoNovo = ?
				  ORDER BY r.dataRenegociacao DESC, r.id DESC`,
			)
			.bind(idFinanciamento, idFinanciamento)
			.all();
		return (results ?? []).map((row) => {
			const r = row as Record<string, unknown>;
			return {
				id: Number(r.id),
				idFinanciamento: Number(r.idFinanciamento),
				numeroContrato: (r.numeroContrato as string | null) ?? null,
				tipo: r.tipo as TipoRenegociacao,
				dataRenegociacao: String(r.dataRenegociacao).slice(0, 10),
				idFinanciamentoNovo: r.idFinanciamentoNovo == null ? null : Number(r.idFinanciamentoNovo),
				numeroContratoNovo: (r.numeroContratoNovo as string | null) ?? null,
				parcelasAnteriores: parseJson<ParcelaAnterior[]>(r.parcelasAnteriores, []),
				condicoesAnteriores: parseJson<CondicoesAnteriores | null>(r.condicoesAnteriores, null),
				observacao: (r.observacao as string | null) ?? null,
				criadoEm: (r.criadoEm as string | null) ?? null,
			};
		});
	}

	/**
	 * Renegotiates contract `id` in ONE db.batch (one transaction): snapshot + delete of its open parcelas
	 * (and their Caixa choices), new parcelas, contract conditions / new contract, history row.
	 * Throws FinanciamentoNaoEncontradoError (404), RenegociacaoInvalidaError (400) or RegistroEmUsoError (409).
	 */
	async renegociar(id: number, dados: RenegociacaoValidada, hoje: string = hojeISO()): Promise<ResultadoRenegociacao> {
		await this.ensureSchema();
		// caixaParcelaConsiderada is cleaned in the same batch: make sure it exists
		await new CaixaRepository(this.db).ensureTables();

		const [contratoRes, parcelasRes] = await this.db.batch([
			this.db
				.prepare(
					`SELECT id, idBanco, idPessoa, responsavel, valor, taxaJurosAnual, totalJuros, numeroContrato, numeroGarantia,
					        observacao, modalidade, nomeModalidadeParticular, dataContrato,
					        (SELECT MAX(dataRenegociacao) FROM financiamentoRenegociacao r WHERE r.idFinanciamento = Financiamento.id) AS ultimaRenegociacao
					   FROM Financiamento WHERE id = ?`,
				)
				.bind(id),
			this.db
				.prepare(
					`SELECT p.id, p.numParcela, p.dt_vencimento, p.valor, p.status, p.idMovimentoBancario,
					        (SELECT COUNT(*) FROM Resultado r WHERE r.idParcelaFinanciamento = p.id) AS nResultados
					   FROM parcelaFinanciamento p
					  WHERE p.idFinanciamento = ?
					  ORDER BY p.numParcela, p.dt_vencimento, p.id`,
				)
				.bind(id),
		]);
		const contrato = contratoRes.results?.[0] as ContratoAtual | undefined;
		if (!contrato) throw new FinanciamentoNaoEncontradoError();
		const erroData = erroDataRenegociacao(dados, {
			dataContrato: contrato.dataContrato,
			ultimaRenegociacao: contrato.ultimaRenegociacao,
			hoje,
		});
		if (erroData) throw new RenegociacaoInvalidaError(erroData);

		const parcelas = ((parcelasRes.results ?? []) as ParcelaAtual[]).map((p) => ({
			...p,
			nResultados: Number(p.nResultados) || 0,
			dt_vencimento: String(p.dt_vencimento ?? '').slice(0, 10),
		}));
		const pagas = parcelas.filter((p) => p.status === 'Liquidado');
		const abertas = parcelas.filter((p) => p.status !== 'Liquidado');
		if (abertas.length === 0) {
			throw new RenegociacaoInvalidaError('Este contrato não tem parcelas em aberto para renegociar.');
		}
		const bloqueadas = abertas
			.map((p) => ({ numParcela: p.numParcela, motivo: motivoParcelaBloqueada(p) }))
			.filter((p): p is { numParcela: number; motivo: string } => p.motivo != null);
		if (bloqueadas.length > 0) throw new RegistroEmUsoError(mensagemParcelasVinculadas(bloqueadas));

		const novoContrato = dados.novoContrato;
		if (dados.tipo === 'NOVO_CONTRATO' && novoContrato) {
			if (novoContrato.numeroContrato.trim().toUpperCase() === String(contrato.numeroContrato).trim().toUpperCase()) {
				throw new RenegociacaoInvalidaError(
					'O novo contrato tem o mesmo número deste. Para manter o número, escolha "Aditivo (mesmo contrato)".',
				);
			}
		}

		// Kept parcelas (paid) of this contract: an aditivo continues their numbering; a new contract starts at 1
		const numeracao = numerarParcelas(dados.parcelas, dados.tipo === 'ADITIVO' ? pagas.map((p) => p.numParcela) : []);
		if (!numeracao.ok) throw new RenegociacaoInvalidaError(numeracao.erro);
		const novas = numeracao.dados;

		const snapshot: ParcelaAnterior[] = abertas.map((p) => ({
			numParcela: p.numParcela,
			dt_vencimento: p.dt_vencimento,
			valor: Number(p.valor) || 0,
			status: p.status,
		}));
		const condicoesAnteriores: CondicoesAnteriores = {
			valor: Number(contrato.valor) || 0,
			taxaJurosAnual: contrato.taxaJurosAnual ?? null,
			totalJuros: contrato.totalJuros ?? null,
			modalidade: contrato.modalidade ?? null,
			numeroContrato: contrato.numeroContrato,
			numeroGarantia: contrato.numeroGarantia ?? null,
		};
		const idsRemover = abertas.map((p) => p.id);

		const stmts: D1PreparedStatement[] = [];
		// 0) guard: the parcelas must still be the ones read above (none paid, linked or added in between); if not,
		//    json() fails, the whole batch is rolled back and the snapshot never disagrees with what was deleted
		stmts.push(
			this.db
				.prepare(
					`SELECT CASE WHEN
					   (SELECT COUNT(*) FROM parcelaFinanciamento WHERE idFinanciamento = ?1) <> ?2
					   OR (SELECT COUNT(*) FROM parcelaFinanciamento p
					        WHERE p.idFinanciamento = ?1 AND p.status <> 'Liquidado' AND p.idMovimentoBancario IS NULL
					          AND NOT EXISTS (SELECT 1 FROM Resultado r WHERE r.idParcelaFinanciamento = p.id)) <> ?3
					 THEN json('${PARCELAS_ALTERADAS}') END`,
				)
				.bind(id, parcelas.length, abertas.length),
		);
		// 1) remove the open parcelas (never a paid / linked one: the WHERE repeats the rules) and their Caixa choices
		for (const lote of emLotes(idsRemover)) {
			const ph = lote.map(() => '?').join(',');
			stmts.push(this.db.prepare(`DELETE FROM caixaParcelaConsiderada WHERE idParcela IN (${ph})`).bind(...lote));
			stmts.push(
				this.db
					.prepare(
						`DELETE FROM parcelaFinanciamento
						  WHERE id IN (${ph}) AND idFinanciamento = ? AND status <> 'Liquidado' AND idMovimentoBancario IS NULL
						    AND NOT EXISTS (SELECT 1 FROM Resultado r WHERE r.idParcelaFinanciamento = parcelaFinanciamento.id)`,
					)
					.bind(...lote, id),
			);
		}

		const datasNovas = novas.map((p) => p.dt_vencimento);
		const inserirParcela = (idSql: string, idBind: number, p: (typeof novas)[number]) =>
			this.db
				.prepare(
					`INSERT INTO parcelaFinanciamento (idMovimentoBancario, idFinanciamento, valor, status, numParcela, dt_lancamento, dt_vencimento, dt_liquidacao)
					 VALUES (NULL, ${idSql}, ?, ?, ?, ?, ?, NULL)`,
				)
				.bind(idBind, p.valor, statusNovaParcela(p.dt_vencimento, hoje), p.numParcela, hoje, p.dt_vencimento);

		const dataTexto = dataBR(dados.dataRenegociacao);
		let idFinanciamentoNovo: number | null = null;

		if (dados.tipo === 'ADITIVO') {
			const c = dados.condicoes;
			const datas = [...pagas.map((p) => p.dt_vencimento), ...datasNovas].filter(Boolean).sort();
			const modalidade = c?.modalidade ?? contrato.modalidade ?? null;
			const nomeParticular =
				modalidade === 'PARTICULAR' ? c?.nomeModalidadeParticular ?? contrato.nomeModalidadeParticular ?? null : null;
			if (modalidade === 'PARTICULAR' && !nomeParticular) {
				throw new RenegociacaoInvalidaError('Informe o nome quando a modalidade é Particular.');
			}
			const linha = `Aditivo em ${dataTexto}${dados.observacao ? ` — ${dados.observacao}` : ''}`;
			stmts.push(
				this.db
					.prepare(
						`UPDATE Financiamento
						    SET valor = ?, taxaJurosAnual = ?, modalidade = ?, nomeModalidadeParticular = ?, numeroGarantia = ?,
						        observacao = ?, dataVencimentoPrimeiraParcela = ?, dataVencimentoUltimaParcela = ?,
						        atualizadoEm = CURRENT_TIMESTAMP
						  WHERE id = ?`,
					)
					.bind(
						c?.valor ?? contrato.valor,
						c?.taxaJurosAnual ?? contrato.taxaJurosAnual ?? null,
						modalidade,
						nomeParticular,
						c?.numeroGarantia ?? contrato.numeroGarantia ?? null,
						anexarObservacao(contrato.observacao, linha),
						datas[0] ?? null,
						datas[datas.length - 1] ?? null,
						id,
					),
			);
			for (const p of novas) stmts.push(inserirParcela('?', id, p));
			stmts.push(
				this.db
					.prepare(
						`INSERT INTO financiamentoRenegociacao (idFinanciamento, tipo, dataRenegociacao, idFinanciamentoNovo, parcelasAnteriores, parcelasNovas, condicoesAnteriores, observacao)
						 VALUES (?, 'ADITIVO', ?, NULL, ?, ?, ?, ?)`,
					)
					// parcelasNovas: numbers of the aditivo parcelas — they enter the saldo devedor on the renegotiation date
					.bind(
						id,
						dados.dataRenegociacao,
						JSON.stringify(snapshot),
						JSON.stringify(novas.map((p) => p.numParcela)),
						JSON.stringify(condicoesAnteriores),
						dados.observacao,
					),
			);
			await executarComGuarda(this.db, stmts);
		} else if (novoContrato) {
			const semCredor = !novoContrato.idBanco && !novoContrato.idPessoa;
			const idBanco = semCredor ? contrato.idBanco ?? null : novoContrato.idBanco;
			const idPessoa = semCredor ? contrato.idPessoa ?? null : novoContrato.idPessoa;
			const modalidade = novoContrato.modalidade ?? 'RENEGOCIACAO';
			const nomeParticular =
				modalidade === 'PARTICULAR'
					? novoContrato.nomeModalidadeParticular ?? (contrato.modalidade === 'PARTICULAR' ? contrato.nomeModalidadeParticular : null) ?? null
					: null;
			if (modalidade === 'PARTICULAR' && !nomeParticular) {
				throw new RenegociacaoInvalidaError('Informe o nome quando a modalidade é Particular.');
			}
			const datas = [...datasNovas].sort();
			const observacaoNovo = anexarObservacao(
				novoContrato.observacao,
				`Renegociação do contrato ${contrato.numeroContrato} em ${dataTexto}`,
			);
			stmts.push(
				this.db
					.prepare(
						`INSERT INTO Financiamento (
							idBanco, idPessoa, responsavel, dataContrato, valor, taxaJurosAnual, taxaJurosMensal, numeroContrato,
							numeroGarantia, observacao, dataVencimentoPrimeiraParcela, dataVencimentoUltimaParcela, totalJuros,
							modalidade, nomeModalidadeParticular, idFinanciamentoOrigem
						 ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						idBanco,
						idPessoa,
						novoContrato.responsavel ?? contrato.responsavel,
						novoContrato.dataContrato,
						novoContrato.valor,
						novoContrato.taxaJurosAnual,
						novoContrato.numeroContrato,
						novoContrato.numeroGarantia,
						observacaoNovo,
						datas[0] ?? null,
						datas[datas.length - 1] ?? null,
						jurosDasParcelas(novoContrato.valor, novas),
						modalidade,
						nomeParticular,
						id,
					),
			);
			// D1 runs the batch as one transaction with no interleaving: the newest contract whose origin is
			// `id` is the one just inserted.
			const idNovoSql = `(SELECT MAX(id) FROM Financiamento WHERE idFinanciamentoOrigem = ?)`;
			for (const p of novas) stmts.push(inserirParcela(idNovoSql, id, p));
			const linha = `Renegociado em ${dataTexto} → contrato ${novoContrato.numeroContrato}`;
			// the old contract keeps its paid parcelas; dates follow what is left
			const datasRestantes = pagas.map((p) => p.dt_vencimento).filter(Boolean).sort();
			stmts.push(
				this.db
					.prepare(
						`UPDATE Financiamento
						    SET observacao = ?, dataVencimentoPrimeiraParcela = ?, dataVencimentoUltimaParcela = ?, atualizadoEm = CURRENT_TIMESTAMP
						  WHERE id = ?`,
					)
					.bind(
						anexarObservacao(contrato.observacao, dados.observacao ? `${linha} — ${dados.observacao}` : linha),
						datasRestantes[0] ?? null,
						datasRestantes[datasRestantes.length - 1] ?? null,
						id,
					),
			);
			stmts.push(
				this.db
					.prepare(
						`INSERT INTO financiamentoRenegociacao (idFinanciamento, tipo, dataRenegociacao, idFinanciamentoNovo, parcelasAnteriores, condicoesAnteriores, observacao)
						 VALUES (?, 'NOVO_CONTRATO', ?, ${idNovoSql}, ?, ?, ?)`,
					)
					.bind(id, dados.dataRenegociacao, id, JSON.stringify(snapshot), JSON.stringify(condicoesAnteriores), dados.observacao),
			);
			stmts.push(this.db.prepare(`SELECT MAX(id) AS id FROM Financiamento WHERE idFinanciamentoOrigem = ?`).bind(id));
			const resultados = await executarComGuarda(this.db, stmts);
			const ultimo = resultados[resultados.length - 1]?.results?.[0] as { id?: number } | undefined;
			idFinanciamentoNovo = ultimo?.id != null ? Number(ultimo.id) : null;
		}

		return {
			idFinanciamento: id,
			idFinanciamentoNovo,
			parcelasRemovidas: snapshot.length,
			valorRemovido: somaValores(snapshot),
			parcelasCriadas: novas.length,
			valorCriado: somaValores(novas),
		};
	}
}
