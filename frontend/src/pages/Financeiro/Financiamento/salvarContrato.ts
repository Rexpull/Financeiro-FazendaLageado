import type { Financiamento } from '../../../../../backend/src/models/Financiamento';
import type { ParcelaFinanciamento } from '../../../../../backend/src/models/ParcelaFinanciamento';

/** What the form knows about the contract being saved; after a partial failure it carries the ids already created. */
export interface EstadoSalvamento {
	/** id 0 / missing → contract not created yet (POST); otherwise PUT. */
	contrato: Financiamento;
	/** id ≤ 0 → installment not created yet (POST); otherwise PUT. */
	parcelas: ParcelaFinanciamento[];
	/** Installment ids that exist in the database for this contract (loaded + created here): the removed ones are deleted. */
	idsSalvos: number[];
}

export interface ServicosSalvamento {
	salvarFinanciamento: (f: Financiamento) => Promise<{ id: number }>;
	salvarParcela: (p: ParcelaFinanciamento) => Promise<Pick<ParcelaFinanciamento, 'id'>>;
	excluirParcela: (id: number) => Promise<void>;
}

/**
 * Thrown after the contract was created/updated but an installment step failed. `estado` holds the
 * contract id and every installment id already created, so "Salvar" again resumes with PUTs instead
 * of creating a duplicate contract with all its installments.
 */
export class ErroSalvamentoParcial extends Error {
	constructor(
		message: string,
		public readonly estado: EstadoSalvamento,
	) {
		super(message);
		this.name = 'ErroSalvamentoParcial';
	}
}

const mensagemDe = (error: unknown) => (error instanceof Error && error.message ? error.message : 'erro desconhecido');

/** Contract first (POST once, PUT afterwards), then each installment, then deletes the removed ones. */
export async function salvarContratoComParcelas(estado: EstadoSalvamento, servicos: ServicosSalvamento): Promise<EstadoSalvamento> {
	const contrato: Financiamento = { ...estado.contrato };
	const parcelas = estado.parcelas.map((p) => ({ ...p }));
	const idsSalvos = new Set(estado.idsSalvos.filter((id) => id > 0));
	const instantaneo = (): EstadoSalvamento => ({
		contrato: { ...contrato },
		parcelas: parcelas.map((p) => ({ ...p })),
		idsSalvos: [...idsSalvos],
	});

	if (contrato.id > 0) {
		await servicos.salvarFinanciamento(contrato);
	} else {
		const { id } = await servicos.salvarFinanciamento({ ...contrato, id: 0 });
		if (!(id > 0)) throw new Error('O servidor não devolveu o código do contrato criado.');
		contrato.id = id;
	}

	const mantidos = new Set<number>();
	for (let i = 0; i < parcelas.length; i++) {
		const parcela = { ...parcelas[i], idFinanciamento: contrato.id };
		try {
			const salva = await servicos.salvarParcela(parcela);
			const id = parcela.id > 0 ? parcela.id : Number(salva?.id) || 0;
			parcelas[i] = { ...parcela, id };
			if (id > 0) {
				idsSalvos.add(id);
				mantidos.add(id);
			}
		} catch (error) {
			throw new ErroSalvamentoParcial(`Erro ao salvar a parcela ${parcela.numParcela}: ${mensagemDe(error)}`, instantaneo());
		}
	}

	for (const id of [...idsSalvos]) {
		if (mantidos.has(id)) continue;
		try {
			await servicos.excluirParcela(id);
			idsSalvos.delete(id);
		} catch (error) {
			throw new ErroSalvamentoParcial(`Erro ao excluir uma parcela removida: ${mensagemDe(error)}`, instantaneo());
		}
	}

	return instantaneo();
}
