export interface PlanoConta {
    id: number;
    nivel: number;
    hierarquia: string;
    descricao: string;
    inativo: boolean;
    tipo: string;
    idReferente: number | null;
}
