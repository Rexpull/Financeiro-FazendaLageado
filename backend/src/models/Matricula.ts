/** Matrícula of a rural property offered as guarantee in financing contracts. */
export interface Matricula {
	id: number;
	/** Digits only, no thousands dots ("3041"); shown as "3.041" */
	numero: string;
	/** Optional: property name / notes */
	descricao?: string | null;
	/** Read-only: contracts whose numeroGarantia includes this matrícula */
	contratos?: number;
}
