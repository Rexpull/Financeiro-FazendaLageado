import React from 'react';
import type { MovimentoBancario } from '../../../../../backend/src/models/MovimentoBancario';

/**
 * "memória" pill shown before the classification of a line that came classified by a memória de
 * conciliação on import. It disappears when the line is reclassified by hand.
 */
const EtiquetaMemoria: React.FC<{ mov: Pick<MovimentoBancario, 'idMemoriaConciliacao'> }> = ({ mov }) =>
	mov.idMemoriaConciliacao ? (
		<span
			className="inline-block mr-1.5 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-medium leading-tight align-middle no-underline"
			title="Classificado pela memória da conta"
		>
			memória
		</span>
	) : null;

export default EtiquetaMemoria;
