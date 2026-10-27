import React, { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getMovimentosDashboard, type FaixaDatas, type MovimentoDashboard } from '../../services/dashboardService';
import { formatarDataISO } from '../../Utils/dataSemFuso';
import { brl } from '../../Utils/formatos';

export type ConsultaMovimentos = {
	titulo: string;
	tipo: 'C' | 'D';
	centros: number[];
	periodo: FaixaDatas;
	contas?: number[];
};

/**
 * Movements behind a value of the Dashboard "Detalhamento" (like the Fluxo de Caixa detail):
 * data, histórico, conta, valor and the total, which equals the value clicked.
 */
const ModalMovimentosDashboard: React.FC<{ consulta: ConsultaMovimentos | null; onClose: () => void }> = ({ consulta, onClose }) => {
	const [movimentos, setMovimentos] = useState<MovimentoDashboard[] | null>(null);
	const [erro, setErro] = useState<string | null>(null);
	const [tentativa, setTentativa] = useState(0);
	const [filtro, setFiltro] = useState('');

	useEffect(() => {
		if (!consulta) return;
		let ativo = true;
		setMovimentos(null);
		setErro(null);
		getMovimentosDashboard(consulta)
			.then((m) => {
				if (ativo) setMovimentos(m);
			})
			.catch((e) => {
				console.error(e);
				if (ativo) setErro(e instanceof Error && e.message ? e.message : 'Erro ao buscar os lançamentos');
			});
		return () => {
			ativo = false;
		};
	}, [consulta, tentativa]);

	useEffect(() => {
		if (!consulta) setFiltro('');
	}, [consulta]);

	const filtrados = useMemo(() => {
		const f = filtro.trim().toLowerCase();
		if (!movimentos || !f) return movimentos ?? [];
		return movimentos.filter(
			(m) =>
				formatarDataISO(m.data).includes(f) ||
				m.historico.toLowerCase().includes(f) ||
				m.conta.toLowerCase().includes(f) ||
				brl(m.valor).toLowerCase().includes(f),
		);
	}, [movimentos, filtro]);

	const total = filtrados.reduce((s, m) => s + m.valor, 0);
	const cor = consulta?.tipo === 'C' ? 'success.main' : 'error.main';

	return (
		<Dialog open={!!consulta} onClose={onClose} fullWidth maxWidth="md">
			<DialogTitle sx={{ pr: 6, fontWeight: 700 }}>
				{consulta?.titulo}
				<IconButton aria-label="Fechar" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				{erro ? (
					<Alert
						severity="error"
						action={
							<Button color="inherit" size="small" onClick={() => setTentativa((t) => t + 1)}>
								Tentar novamente
							</Button>
						}
					>
						Não foi possível carregar os lançamentos. {erro}
					</Alert>
				) : !movimentos ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
						<CircularProgress />
					</Box>
				) : (
					<>
						<TextField
							size="small"
							fullWidth
							placeholder="Filtrar por data, histórico, conta ou valor..."
							value={filtro}
							onChange={(e) => setFiltro(e.target.value)}
							sx={{ mb: 1.5 }}
						/>
						<TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider', borderRadius: 1 }}>
							<Table stickyHeader size="small">
								<TableHead>
									<TableRow>
										<TableCell sx={{ fontWeight: 700, width: 100 }}>Data</TableCell>
										<TableCell sx={{ fontWeight: 700 }}>Histórico</TableCell>
										<TableCell sx={{ fontWeight: 700, width: 140 }}>Conta</TableCell>
										<TableCell align="right" sx={{ fontWeight: 700, width: 150 }}>
											Valor
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{filtrados.map((m, i) => (
										<TableRow key={`${m.id}-${i}`} hover>
											<TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataISO(m.data)}</TableCell>
											<TableCell>{m.historico}</TableCell>
											<TableCell sx={{ whiteSpace: 'nowrap' }}>{m.conta}</TableCell>
											<TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: cor }}>
												{brl(m.valor)}
											</TableCell>
										</TableRow>
									))}
									{filtrados.length === 0 && (
										<TableRow>
											<TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
												Nenhum lançamento encontrado.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</TableContainer>
					</>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, justifyContent: 'space-between' }}>
				<Typography variant="body2" color="text.secondary">
					{movimentos ? `${filtrados.length} lançamento(s)${filtro.trim() ? ' (filtrados)' : ''}` : ''}
				</Typography>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
					{movimentos && (
						<Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
							Total: <Box component="span" sx={{ color: cor }}>{brl(total)}</Box>
						</Typography>
					)}
					<Button onClick={onClose} variant="outlined" color="inherit">
						Fechar
					</Button>
				</Box>
			</DialogActions>
		</Dialog>
	);
};

export default ModalMovimentosDashboard;
