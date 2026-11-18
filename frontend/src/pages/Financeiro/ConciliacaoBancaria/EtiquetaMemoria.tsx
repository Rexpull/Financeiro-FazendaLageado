import React from 'react';
import type { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';

/**
 * "memória" pill shown before the classification of a line that came classified by a memória de
 * conciliação on import. It disappears when the line is reclassified by hand.
 * When the memory was found by a similar name (not the identical text) the pill says so and asks to check.
 */
const EtiquetaMemoria: React.FC<{ mov: Pick<MovimentoBancario, 'idMemoriaConciliacao' | 'memoriaPorNomeParecido'> }> = ({ mov }) =>
	!mov.idMemoriaConciliacao ? null : mov.memoriaPorNomeParecido ? (
		<span
			className="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 text-[11px] font-medium leading-tight align-middle no-underline"
			title="Classificado pela memória de um nome parecido (não é o texto idêntico): confira"
		>
			memória · nome parecido
		</span>
	) : (
		<span
			className="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-medium leading-tight align-middle no-underline"
			title="Classificado pela memória da conta"
		>
			memória
		</span>
	);

export default EtiquetaMemoria;
