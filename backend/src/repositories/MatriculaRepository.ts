import { Matricula } from '../models/Matricula';
import { juntarMatriculas, normalizarMatricula, ordenarMatriculas, separarMatriculas } from '../utils/matriculas';

export const DDL_MATRICULA = `CREATE TABLE IF NOT EXISTS matricula (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	numero TEXT NOT NULL UNIQUE,
	descricao TEXT,
	criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
)`;

let schemaPronto: Promise<unknown> | null = null;
/** Creates the table on the first call of each isolate (no manual migration needed for the table). */
export function garantirSchemaMatricula(db: D1Database): Promise<unknown> {
	if (!schemaPronto) {
		schemaPronto = db
			.prepare(DDL_MATRICULA)
			.run()
			.catch((err) => {
				schemaPronto = null;
				throw err;
			});
	}
	return schemaPronto;
}

/** Validation or conflict message shown as is to the user. */
export class ErroMatricula extends Error {
	constructor(
		message: string,
		readonly status: 400 | 404 | 409,
	) {
		super(message);
	}
}

type Garantia = { id: number; numeroGarantia: string | null };

export class MatriculaRepository {
	constructor(private db: D1Database) {}

	private async garantias(): Promise<Garantia[]> {
		const { results } = await this.db
			.prepare(`SELECT id, numeroGarantia FROM Financiamento WHERE numeroGarantia IS NOT NULL AND TRIM(numeroGarantia) <> ''`)
			.all<Garantia>();
		return results ?? [];
	}

	private contratosPorMatricula(garantias: Garantia[]): Map<string, number> {
		const uso = new Map<string, number>();
		for (const g of garantias) for (const m of separarMatriculas(g.numeroGarantia)) uso.set(m, (uso.get(m) ?? 0) + 1);
		return uso;
	}

	/** Registered matrículas with how many contracts use each, sorted by number. */
	async listar(): Promise<Matricula[]> {
		await garantirSchemaMatricula(this.db);
		const { results } = await this.db.prepare(`SELECT id, numero, descricao FROM matricula`).all<Matricula>();
		const uso = this.contratosPorMatricula(await this.garantias());
		return ordenarMatriculas((results ?? []).map((m) => ({ ...m, contratos: uso.get(m.numero) ?? 0 })));
	}

	private async buscar(id: number): Promise<Matricula | null> {
		return (await this.db.prepare(`SELECT id, numero, descricao FROM matricula WHERE id = ?`).bind(id).first<Matricula>()) ?? null;
	}

	private validar(dados: Partial<Matricula>): { numero: string; descricao: string | null } {
		const numero = normalizarMatricula(dados.numero);
		if (!numero) throw new ErroMatricula('Informe o número da matrícula.', 400);
		if (separarMatriculas(numero).length !== 1 || numero.length > 30) throw new ErroMatricula('Informe uma matrícula por vez.', 400);
		const descricao = String(dados.descricao ?? '').trim().slice(0, 200) || null;
		return { numero, descricao };
	}

	private async assertNumeroLivre(numero: string, id?: number) {
		const outra = await this.db.prepare(`SELECT id FROM matricula WHERE numero = ?`).bind(numero).first<{ id: number }>();
		if (outra && outra.id !== id) throw new ErroMatricula(`A matrícula ${numero} já está cadastrada.`, 409);
	}

	async criar(dados: Partial<Matricula>): Promise<Matricula> {
		await garantirSchemaMatricula(this.db);
		const { numero, descricao } = this.validar(dados);
		await this.assertNumeroLivre(numero);
		const { meta } = await this.db.prepare(`INSERT INTO matricula (numero, descricao) VALUES (?, ?)`).bind(numero, descricao).run();
		return { id: Number(meta.last_row_id), numero, descricao, contratos: this.contratosPorMatricula(await this.garantias()).get(numero) ?? 0 };
	}

	/** Changing the number (a typo) also changes it in the contracts that use it. */
	async atualizar(id: number, dados: Partial<Matricula>): Promise<Matricula> {
		await garantirSchemaMatricula(this.db);
		const atual = await this.buscar(id);
		if (!atual) throw new ErroMatricula('Matrícula não encontrada.', 404);
		const { numero, descricao } = this.validar(dados);
		await this.assertNumeroLivre(numero, id);
		const garantias = await this.garantias();
		const stmts = [this.db.prepare(`UPDATE matricula SET numero = ?, descricao = ? WHERE id = ?`).bind(numero, descricao, id)];
		if (numero !== atual.numero) {
			for (const g of garantias) {
				const lista = separarMatriculas(g.numeroGarantia);
				if (!lista.includes(atual.numero)) continue;
				const novo = juntarMatriculas(lista.map((m) => (m === atual.numero ? numero : m)));
				stmts.push(this.db.prepare(`UPDATE Financiamento SET numeroGarantia = ? WHERE id = ?`).bind(novo, g.id));
			}
		}
		await this.db.batch(stmts);
		return { id, numero, descricao, contratos: this.contratosPorMatricula(await this.garantias()).get(numero) ?? 0 };
	}

	/** Refuses while a contract still uses it (409). */
	async excluir(id: number): Promise<void> {
		await garantirSchemaMatricula(this.db);
		const atual = await this.buscar(id);
		if (!atual) throw new ErroMatricula('Matrícula não encontrada.', 404);
		const usos = this.contratosPorMatricula(await this.garantias()).get(atual.numero) ?? 0;
		if (usos > 0) {
			throw new ErroMatricula(
				`A matrícula está em ${usos === 1 ? '1 contrato' : `${usos} contratos`}. Tire-a dos financiamentos antes de excluir.`,
				409,
			);
		}
		await this.db.prepare(`DELETE FROM matricula WHERE id = ?`).bind(id).run();
	}
}
