import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { brl } from '../../Utils/formatos';
import { somaValores, type LinhaContrato } from './financiamentosRelatorio';
import TabelaContratosFinanciamento from './TabelaContratosFinanciamento';

export type ConteudoModalContratos = {
	titulo: string;
	/** One short line saying what the value is */
	dica: string;
	linhas: LinhaContrato[];
	/** Highlighted column with each line's value in this context (absent: the "A vencer" column prevails) */
	colunaValor?: string;
	mostrarSituacao?: boolean;
};

/** Contracts behind a value of the report (KPI, tomador or chart bar), with expandable parcelas. */
const ModalContratosFinanciamento: React.FC<{ conteudo: ConteudoModalContratos | null; onClose: () => void }> = ({ conteudo, onClose }) => {
	const total = conteudo ? (conteudo.colunaValor ? somaValores(conteudo.linhas) : somaValores(conteudo.linhas.map((l) => ({ valor: l.contrato.valorVincendo })))) : 0;
	return (
		<Dialog open={!!conteudo} onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="modal-contratos-fin-titulo">
			<DialogTitle id="modal-contratos-fin-titulo" sx={{ pr: 6, fontWeight: 700, pb: 0.5 }}>
				{conteudo?.titulo}
				<IconButton aria-label="Fechar" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			{conteudo && (
				<Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1.5 }}>
					{conteudo.dica} Clique no contrato para ver as parcelas.
				</Typography>
			)}
			<DialogContent dividers sx={{ px: { xs: 0, sm: 3 }, pt: 0 }}>
				{conteudo && (
					// overflow-clip, not overflow-hidden: hidden would break the sticky table header inside the dialog
					<div className="sm:border sm:border-gray-200 sm:rounded-lg sm:mt-3 overflow-clip">
						<TabelaContratosFinanciamento
							linhas={conteudo.linhas}
							colunaValor={conteudo.colunaValor}
							mostrarSituacao={conteudo.mostrarSituacao}
							vazio="Nenhum contrato."
						/>
					</div>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
				{conteudo && (
					<Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
						{conteudo.linhas.length} {conteudo.linhas.length === 1 ? 'contrato' : 'contratos'} · {conteudo.colunaValor ?? 'A vencer'}: {brl(total)}
					</Typography>
				)}
				<Button onClick={onClose} variant="outlined" color="inherit">
					Fechar
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ModalContratosFinanciamento;
