import { PlanoConta } from "../models/PlanoConta";

export class PlanoContaRepository {
    private db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    async getAll(): Promise<PlanoConta[]> {
        const { results } = await this.db.prepare(`
            SELECT * FROM planoContas
        `).all();

        return results.map(result => ({
            id: result.id as number,
            nivel: result.nivel as number,
            hierarquia: result.hierarquia as string,
            descricao: result.descricao as string,
            inativo: result.inativo as boolean,
            tipo: result.tipo as string,
            idReferente: result.idReferente as number | null
        })) as PlanoConta[];
    }

    async getById(id: number): Promise<PlanoConta | null> {
        const { results } = await this.db.prepare(`
            SELECT * FROM planoContas WHERE id = ?
        `).bind(id).all();

        if (results.length > 0) {
            const result = results[0];
            return {
                id: result.id as number,
                nivel: result.nivel as number,
                hierarquia: result.hierarquia as string,
                descricao: result.descricao as string,
                inativo: result.inativo as boolean,
                tipo: result.tipo as string,
                idReferente: result.idReferente as number | null
            } as PlanoConta;
        }
        return null;
    }

    async create(plano: PlanoConta): Promise<number> {
        console.log("🔹 Criando novo plano de contas:", plano);

        
    
        const hierarquia = await this.gerarHierarquia(plano.nivel, plano.idReferente);
    
        // 🔹 Verifica se a hierarquia já existe
        const existente = await this.db.prepare(`
            SELECT COUNT(*) AS count FROM planoContas WHERE descricao = ?
        `).bind(plano.descricao).first();
    
        if ((existente as { count: number })?.count > 0) {
            throw new Error("Já existe um plano de contas com esta descrição.");
        }
    
        console.log(`✅ Salvando no banco: Nivel: ${plano.nivel}, Hierarquia: ${hierarquia}, Descrição: ${plano.descricao}`);
    
        const { meta } = await this.db.prepare(`
            INSERT INTO planoContas (nivel, hierarquia, descricao, inativo, tipo, idReferente)
            VALUES (?, ?, ?, ?, ?, ?);
        `).bind(
            plano.nivel,
            hierarquia,
            plano.descricao,
            plano.inativo ? 1 : 0,
            plano.tipo,
            plano.idReferente
        ).run();
    
        console.log("✅ Inserção concluída. ID gerado:", meta.last_row_id);
        return meta.last_row_id;
    }

    async update(id: number,plano: PlanoConta): Promise<void> {

        const existente = await this.db.prepare(`
            SELECT COUNT(*) AS count FROM planoContas WHERE descricao = ? AND id <> ?
        `).bind(plano.descricao, id).first();
    
        if ((existente as { count: number })?.count > 0) {
            throw new Error("Já existe um plano de contas com esta descrição.");
        }

        
        await this.db.prepare(`
            UPDATE planoContas 
            SET nivel = ?, hierarquia = ?, descricao = ?, inativo = ?, tipo = ?, idReferente = ?
            WHERE id = ?
        `).bind(
            plano.nivel,
            plano.hierarquia,
            plano.descricao,
            plano.inativo ? 1 : 0,
            plano.tipo,
            plano.idReferente,
            plano.id
        ).run();
    }

    async updateStatus(id: number, inativo: boolean): Promise<void> {
        await this.db.prepare(`
            UPDATE planoContas 
            SET inativo = ? 
            WHERE id = ?
        `).bind(inativo ? 1 : 0, id).run();
    }


    async deleteById(id: number): Promise<void> {
        // Verifica se existem planos referenciando o ID antes de excluir
        const { results } = await this.db.prepare(`
            SELECT id FROM planoContas WHERE idReferente = ?
        `).bind(id).all();

        if (results.length > 0) {
            throw new Error("Não é possível excluir este plano de contas, pois ele está referenciado em outros registros.");
        }

        await this.db.prepare(`
            DELETE FROM planoContas WHERE id = ?
        `).bind(id).run();
    }

    async gerarHierarquia(nivel: number, idReferente: number | null): Promise<string> {
        console.log(`🛠️ Gerando hierarquia - Nivel: ${nivel}, Referente: ${idReferente}`); // 👀 LOG PARA DEPURAÇÃO
    
        if (nivel === 1) {
            // 🔹 Buscar a última hierarquia de nível 1
            const result = await this.db.prepare(`
                SELECT MAX(CAST(hierarquia AS INTEGER)) AS ultimaHierarquia 
                FROM planoContas WHERE nivel = 1
            `).first();
    
            const proximoCodigo = result?.ultimaHierarquia 
                ? String(Number(result.ultimaHierarquia) + 1).padStart(3, "0") 
                : "001";
    
            console.log(`✅ Hierarquia gerada para nível 1: ${proximoCodigo}`);
            return proximoCodigo;
        } else {
            // 🔹 Buscar a hierarquia do plano de contas referenciado
            if (!idReferente) throw new Error("ID referente é obrigatório para níveis acima de 1.");
    
            const referente = await this.db.prepare(`
                SELECT hierarquia FROM planoContas WHERE id = ?
            `).bind(idReferente).first();
    
            if (!referente) throw new Error("Plano de contas referente não encontrado.");
    
            // 🔹 Buscar a última hierarquia que usa o mesmo prefixo
            const prefixo = referente.hierarquia;
            const result = await this.db.prepare(`
                SELECT MAX(CAST(SUBSTRING(hierarquia, LENGTH(?) + 2) AS INTEGER)) AS ultimaHierarquia 
                FROM planoContas 
                WHERE hierarquia LIKE ?
            `).bind(prefixo, `${prefixo}.%`).first();
    
            const proximoCodigo = result?.ultimaHierarquia 
                ? String(Number(result.ultimaHierarquia) + 1).padStart(3, "0") 
                : "001";
    
            console.log(`✅ Hierarquia gerada para nível ${nivel}: ${prefixo}.${proximoCodigo}`);
            return `${prefixo}.${proximoCodigo}`;
        }
    }
    
    
}
