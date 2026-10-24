import { HistoricoImportacaoOFX } from '../models/HistoricoImportacaoOFX';

// Table check runs lazily, awaited, at most once per worker instance (retried only if it failed).
let tabelaVerificada: Promise<boolean> | null = null;

export class HistoricoImportacaoOFXRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	private async ready(): Promise<void> {
		if (!tabelaVerificada) tabelaVerificada = this.ensureTableExists();
		const ok = await tabelaVerificada;
		if (!ok) tabelaVerificada = null;
	}

	private async ensureTableExists(): Promise<boolean> {
		try {
			// Verificar se a tabela existe
			const { results } = await this.db.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name='HistoricoImportacaoOFX'
			`).all();

			if (results.length === 0) {
				console.log('🔧 Criando tabela HistoricoImportacaoOFX...');
				
				// Criar a tabela
				await this.db.prepare(`
					CREATE TABLE HistoricoImportacaoOFX (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						idUsuario INTEGER NOT NULL,
						nomeArquivo TEXT NOT NULL,
						dataImportacao TEXT NOT NULL,
						idMovimentos TEXT NOT NULL,
						totalizadores TEXT NOT NULL,
						novosMovimentos INTEGER NOT NULL,
						existentesMovimentos INTEGER NOT NULL,
						idContaCorrente INTEGER NOT NULL,
						criadoEm TEXT NOT NULL,
						atualizadoEm TEXT NOT NULL
					)
				`).run();

				// Criar índices
				await this.db.prepare(`
					CREATE INDEX idx_historico_usuario ON HistoricoImportacaoOFX(idUsuario)
				`).run();

				await this.db.prepare(`
					CREATE INDEX idx_historico_data ON HistoricoImportacaoOFX(dataImportacao DESC)
				`).run();

				console.log('✅ Tabela HistoricoImportacaoOFX criada com sucesso');
			}
			return true;
		} catch (error) {
			console.error('❌ Erro ao verificar/criar tabela HistoricoImportacaoOFX:', error);
			return false;
		}
	}

	async getAllByUsuario(idUsuario: number): Promise<HistoricoImportacaoOFX[]> {
		await this.ready();
		try {
			const { results } = await this.db
				.prepare(`
					SELECT 
						id,
						idUsuario,
						nomeArquivo,
						dataImportacao,
						idMovimentos,
						totalizadores,
						novosMovimentos,
						existentesMovimentos,
						idContaCorrente,
						criadoEm,
						atualizadoEm
					FROM HistoricoImportacaoOFX 
					WHERE idUsuario = ?
					ORDER BY dataImportacao DESC
					LIMIT 10
				`)
				.bind(idUsuario)
				.all();

			return results.map((row: any) => ({
				id: row.id,
				idUsuario: row.idUsuario,
				nomeArquivo: row.nomeArquivo,
				dataImportacao: row.dataImportacao,
				idMovimentos: JSON.parse(row.idMovimentos || '[]'),
				totalizadores: JSON.parse(row.totalizadores || '{}'),
				novosMovimentos: row.novosMovimentos,
				existentesMovimentos: row.existentesMovimentos,
				idContaCorrente: row.idContaCorrente,
				criadoEm: row.criadoEm,
				atualizadoEm: row.atualizadoEm,
			}));
		} catch (error) {
			console.error('Erro ao buscar histórico de importações:', error);
			throw new Error('Erro ao buscar histórico de importações');
		}
	}

	async create(historico: Omit<HistoricoImportacaoOFX, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<number> {
		await this.ready();
		try {
			const {
				idUsuario,
				nomeArquivo,
				dataImportacao,
				idMovimentos,
				totalizadores,
				novosMovimentos,
				existentesMovimentos,
				idContaCorrente,
			} = historico;

			const { meta } = await this.db
				.prepare(`
					INSERT INTO HistoricoImportacaoOFX (
						idUsuario,
						nomeArquivo,
						dataImportacao,
						idMovimentos,
						totalizadores,
						novosMovimentos,
						existentesMovimentos,
						idContaCorrente,
						criadoEm,
						atualizadoEm
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
				`)
				.bind(
					idUsuario,
					nomeArquivo,
					dataImportacao,
					JSON.stringify(idMovimentos),
					JSON.stringify(totalizadores),
					novosMovimentos,
					existentesMovimentos,
					idContaCorrente
				)
				.run();

			return meta.last_row_id;
		} catch (error) {
			console.error('Erro ao criar histórico de importação:', error);
			throw new Error('Erro ao criar histórico de importação');
		}
	}

	async deleteByUsuario(idUsuario: number): Promise<void> {
		await this.ready();
		try {
			await this.db
				.prepare('DELETE FROM HistoricoImportacaoOFX WHERE idUsuario = ?')
				.bind(idUsuario)
				.run();
		} catch (error) {
			console.error('Erro ao deletar histórico de importações:', error);
			throw new Error('Erro ao deletar histórico de importações');
		}
	}

	async deleteById(id: number, idUsuario: number): Promise<void> {
		await this.ready();
		try {
			await this.db
				.prepare('DELETE FROM HistoricoImportacaoOFX WHERE id = ? AND idUsuario = ?')
				.bind(id, idUsuario)
				.run();
		} catch (error) {
			console.error('Erro ao deletar histórico de importação:', error);
			throw new Error('Erro ao deletar histórico de importação');
		}
	}
}
