import React, { useEffect, useState } from 'react';
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Collapse,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tabs,
	Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { getContratosPeriodo, type ContratoPeriodo, type FaixaDatas } from '../../services/dashboardService';
import { formatarDataISO } from '../../Utils/dataSemFuso';
import { brl } from '../../Utils/formatos';

export type AbaContratos = 'novos' | 'quitados';

const ABAS: Record<AbaContratos, { rotulo: string; coluna: string; dica: string }> = {
	novos: {
		rotulo: 'Créditos novos',
		coluna: 'Parcelas do contrato',
		dica: 'Contratos assinados no período. O valor é a soma de todas as parcelas do contrato (já com os juros).',
	},
	quitados: {
		rotulo: 'Quitados / amortizados',
		coluna: 'Pago no período',
		dica: 'Contratos com parcelas liquidadas no período. O valor é a soma dessas parcelas.',
	},
};

const corStatus = (status: string): 'success' | 'error' | 'warning' =>
	status === 'Liquidado' ? 'success' : status === 'Vencido' ? 'error' : 'warning';

const LinhaContrato: React.FC<{ c: ContratoPeriodo; temTomador: boolean }> = ({ c, temTomador }) => {
	const [aberto, setAberto] = useState(false);
	return (
		<>
			<TableRow hover onClick={() => setAberto((a) => !a)} sx={{ cursor: 'pointer', '& > td': { borderBottom: aberto ? 'none' : undefined } }}>
				<TableCell sx={{ width: 40, px: 1 }}>
					<IconButton size="small" aria-label={aberto ? 'Recolher parcelas' : 'Ver parcelas'}>
						{aberto ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
					</IconButton>
				</TableCell>
				<TableCell sx={{ fontWeight: 600 }}>{c.numeroContrato}</TableCell>
				<TableCell>{c.credor}</TableCell>
				{temTomador && <TableCell>{c.tomador || '—'}</TableCell>}
				<TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarDataISO(c.dataContrato)}</TableCell>
				<TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
					{brl(c.valorContratado)}
				</TableCell>
				<TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
					{brl(c.valorNoPeriodo)}
				</TableCell>
			</TableRow>
			<TableRow>
				<TableCell colSpan={temTomador ? 7 : 6} sx={{ py: 0, bgcolor: 'grey.50' }}>
					<Collapse in={aberto} unmountOnExit>
						<Box sx={{ py: 1.5, px: { xs: 0, sm: 4 } }}>
							{c.parcelas.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									Contrato sem parcelas cadastradas.
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell sx={{ fontWeight: 700 }}>Parcela</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Vencimento</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Liquidação</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>Situação</TableCell>
											<TableCell align="right" sx={{ fontWeight: 700 }}>
												Valor
											</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{c.parcelas.map((p) => (
											<TableRow key={p.id}>
												<TableCell>{p.numParcela}</TableCell>
												<TableCell>{formatarDataISO(p.dt_vencimento)}</TableCell>
												<TableCell>{formatarDataISO(p.dt_liquidacao, '—')}</TableCell>
												<TableCell>
													<Chip label={p.status} size="small" color={corStatus(p.status)} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
												</TableCell>
												<TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
													{brl(p.valor)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</Box>
					</Collapse>
				</TableCell>
			</TableRow>
		</>
	);
};

/**
 * Contracts behind the "Créditos novos" and "Quitados" values of a period (Resultado consolidado and
 * Financiamentos). Each list adds up to the value on the card.
 */
const ModalContratosPeriodo: React.FC<{
	aberto: AbaContratos | null;
	periodo: FaixaDatas & { rotulo: string };
	onClose: () => void;
}> = ({ aberto, periodo, onClose }) => {
	const [aba, setAba] = useState<AbaContratos>('novos');
	const [dados, setDados] = useState<{ chave: string; novos: ContratoPeriodo[]; quitados: ContratoPeriodo[] } | null>(null);
	const [erro, setErro] = useState<string | null>(null);
	const [tentativa, setTentativa] = useState(0);
	const chave = `${periodo.inicio}|${periodo.fim}`;

	useEffect(() => {
		if (aberto) setAba(aberto);
	}, [aberto]);

	useEffect(() => {
		if (!aberto || dados?.chave === chave) return;
		let ativo = true;
		setErro(null);
		getContratosPeriodo({ inicio: periodo.inicio, fim: periodo.fim })
			.then((r) => {
				if (ativo) setDados({ chave, ...r });
			})
			.catch((e) => {
				console.error(e);
				if (ativo) setErro(e instanceof Error && e.message ? e.message : 'Erro ao buscar os contratos');
			});
		return () => {
			ativo = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [aberto, chave, tentativa]);

	const carregado = dados?.chave === chave ? dados : null;
	const lista = carregado ? carregado[aba] : [];
	const total = lista.reduce((s, c) => s + c.valorNoPeriodo, 0);
	const temTomador = lista.some((c) => c.tomador);

	return (
		<Dialog open={!!aberto} onClose={onClose} fullWidth maxWidth="lg">
			<DialogTitle sx={{ pr: 6, fontWeight: 700 }}>
				Contratos de financiamento — {periodo.rotulo}
				<IconButton aria-label="Fechar" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<Tabs value={aba} onChange={(_e, v: AbaContratos) => setAba(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
				{(Object.keys(ABAS) as AbaContratos[]).map((k) => (
					<Tab
						key={k}
						value={k}
						label={carregado ? `${ABAS[k].rotulo} (${carregado[k].length})` : ABAS[k].rotulo}
						sx={{ fontWeight: 700 }}
					/>
				))}
			</Tabs>
			<DialogContent>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
					{ABAS[aba].dica} Clique em um contrato para ver as parcelas.
				</Typography>
				{erro ? (
					<Alert
						severity="error"
						action={
							<Button color="inherit" size="small" onClick={() => setTentativa((t) => t + 1)}>
								Tentar novamente
							</Button>
						}
					>
						Não foi possível carregar os contratos. {erro}
					</Alert>
				) : !carregado ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
						<CircularProgress />
					</Box>
				) : lista.length === 0 ? (
					<Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
						{aba === 'novos' ? 'Nenhum contrato novo' : 'Nenhuma parcela quitada'} em {periodo.rotulo}.
					</Typography>
				) : (
					<TableContainer sx={{ maxHeight: '55vh', border: 1, borderColor: 'divider', borderRadius: 1 }}>
						<Table stickyHeader size="small">
							<TableHead>
								<TableRow>
									<TableCell />
									<TableCell sx={{ fontWeight: 700 }}>Contrato</TableCell>
									<TableCell sx={{ fontWeight: 700 }}>Banco / credor</TableCell>
									{temTomador && <TableCell sx={{ fontWeight: 700 }}>Tomador</TableCell>}
									<TableCell sx={{ fontWeight: 700 }}>Data do contrato</TableCell>
									<TableCell align="right" sx={{ fontWeight: 700 }}>
										Valor contratado
									</TableCell>
									<TableCell align="right" sx={{ fontWeight: 700 }}>
										{ABAS[aba].coluna}
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{lista.map((c) => (
									<LinhaContrato key={`${aba}-${c.id}`} c={c} temTomador={temTomador} />
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, justifyContent: 'flex-end', gap: 2 }}>
				{carregado && (
					<Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
						Total {aba === 'novos' ? 'de créditos novos' : 'quitado'}: {brl(total)}
					</Typography>
				)}
				<Button onClick={onClose} variant="outlined" color="inherit">
					Fechar
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ModalContratosPeriodo;
