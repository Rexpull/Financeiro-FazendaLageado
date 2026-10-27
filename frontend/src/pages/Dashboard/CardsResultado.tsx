import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SavingsIcon from '@mui/icons-material/Savings';
import type { TotaisPorCentros } from './totaisPorCentros';
import { brl, pct } from '../../Utils/formatos';

/** Card look shared by "Receitas e despesas" and "Resultado consolidado". */
export const CARD_SX = {
	border: '1px solid #e0e0e0',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: 3,
	py: 1.5,
	borderRadius: 3,
	boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
	transition: 'box-shadow 0.2s',
	'&:hover': { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' },
} as const;

/** Share of the revenue, in % (null when there is no revenue). */
export const sobreReceita = (valor: number, receitas: number): number | null => (receitas > 0 ? (valor / receitas) * 100 : null);

const textoPct = (valor: number, receitas: number) => {
	const p = sobreReceita(valor, receitas);
	// "% da receita" is the column header: repeating it on every line overflowed the card at 1366px
	return p == null ? '—' : pct(p);
};

/** Receitas | Saldo após investimentos (destaque, ao centro) | Despesas — same cards on both screens. */
const CardsResultado: React.FC<{ totais: TotaisPorCentros }> = ({ totais }) => {
	const { receitas, custeio, investimento, despesas } = totais;
	// Same names and rules as the Fluxo de Caixa / Relatório de Centro de Custos:
	// saldo operacional = R − custeio; saldo após investimentos = R − custeio − investimento = R − D
	const saldoOperacional = receitas - custeio;
	const saldo = receitas - despesas;
	// Lucratividade = saldo após investimentos ÷ receitas (same name as the Fluxo de Caixa column)
	const lucratividade = sobreReceita(saldo, receitas);
	const corSaldo = (v: number) => (v >= 0 ? 'success.main' : 'error.main');

	const linhasDespesas = [
		{ rotulo: 'Despesas', valor: despesas, destaque: true },
		{ rotulo: 'Custeio:', valor: custeio },
		{ rotulo: 'Investimento:', valor: investimento },
	];

	return (
		<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr 1.25fr' }, gap: 2, alignItems: 'stretch' }}>
			<Paper elevation={3} sx={CARD_SX}>
				<Box>
					<Typography variant="subtitle2" sx={{ fontSize: '0.95rem' }}>
						Receitas
					</Typography>
					<Typography variant="h5" fontWeight="bold" color="success.main" sx={{ fontSize: { xs: '1.35rem', md: '1.5rem' } }}>
						{brl(receitas)}
					</Typography>
				</Box>
				<TrendingUpIcon color="success" sx={{ fontSize: 48 }} />
			</Paper>

			<Paper
				elevation={3}
				sx={{ ...CARD_SX, border: '2px solid', borderColor: saldo >= 0 ? 'success.light' : 'error.light', justifyContent: 'center', gap: 2, textAlign: 'center' }}
			>
				<SavingsIcon sx={{ fontSize: 52, color: saldo >= 0 ? '#4caf50' : '#f44336' }} />
				<Box>
					<Typography
						variant="subtitle2"
						sx={{ fontSize: '1rem', fontWeight: 700 }}
						title="Receitas menos todas as despesas (custeio e investimentos). Financiamentos ficam de fora."
					>
						Saldo após investimentos
					</Typography>
					<Typography variant="h4" fontWeight="bold" color={corSaldo(saldo)} sx={{ fontSize: { xs: '1.6rem', md: '2rem' }, lineHeight: 1.2 }}>
						{brl(saldo)}
					</Typography>
					<Typography
						variant="caption"
						sx={{ fontSize: '0.85rem', display: 'block', mt: 0.5, fontWeight: 600 }}
						color={corSaldo(saldo)}
						title="Saldo após investimentos ÷ receitas"
					>
						Lucratividade: {pct(lucratividade)}
					</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ fontSize: '0.85rem', display: 'block', mt: 0.25 }}
						title="Receitas menos despesas operacionais (custeio)"
					>
						Saldo operacional:{' '}
						<Box component="strong" sx={{ color: corSaldo(saldoOperacional) }}>
							{brl(saldoOperacional)}
						</Box>
					</Typography>
				</Box>
			</Paper>

			<Paper elevation={3} sx={{ ...CARD_SX, justifyContent: 'flex-start' }}>
				{/* Label | value | % in aligned columns (layout proposed by the client) */}
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: 'auto auto auto',
						columnGap: 1.5,
						rowGap: 0.25,
						alignItems: 'baseline',
						fontVariantNumeric: 'tabular-nums',
						minWidth: 0,
					}}
				>
					<Box component="span" />
					<Box component="span" />
					<Typography component="span" sx={{ justifySelf: 'end', fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
						% da receita
					</Typography>
					{linhasDespesas.map((l) => (
						<React.Fragment key={l.rotulo}>
							<Typography
								component="span"
								sx={l.destaque ? { fontSize: '0.95rem', fontWeight: 700 } : { fontSize: '0.85rem', color: 'text.secondary' }}
							>
								{l.rotulo}
							</Typography>
							<Typography
								component="span"
								sx={{
									justifySelf: 'end',
									whiteSpace: 'nowrap',
									color: 'error.main',
									...(l.destaque ? { fontSize: { xs: '1.2rem', md: '1.35rem' }, fontWeight: 700 } : { fontSize: '0.9rem', fontWeight: 600 }),
								}}
							>
								{brl(l.valor)}
							</Typography>
							<Typography
								component="span"
								sx={{ justifySelf: 'end', whiteSpace: 'nowrap', fontSize: '0.8rem', color: l.destaque ? 'error.main' : 'text.secondary', fontWeight: l.destaque ? 600 : 400 }}
							>
								{textoPct(l.valor, receitas)}
							</Typography>
						</React.Fragment>
					))}
				</Box>
			</Paper>
		</Box>
	);
};

export default CardsResultado;
