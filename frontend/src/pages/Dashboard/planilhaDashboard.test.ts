import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { FORMATO_BRL, FORMATO_PERCENTUAL, planilhaComFormatos } from './planilhaDashboard';

describe('planilhaComFormatos (Excel do Dashboard)', () => {
	const linhas = [
		{ Nome: 'Soja', Valor: 1268523.95, '%': 0.6 },
		{ Nome: 'Milho', Valor: 845682.63, '%': 0.4 },
	];

	it('valores em reais ficam numéricos, com o formato de moeda', () => {
		const ws = planilhaComFormatos(linhas, { Valor: FORMATO_BRL, '%': FORMATO_PERCENTUAL }, { Nome: 40 });
		expect(ws.B2).toMatchObject({ t: 'n', v: 1268523.95, z: FORMATO_BRL });
		expect(ws.B3).toMatchObject({ t: 'n', z: FORMATO_BRL });
		expect(ws.C2).toMatchObject({ t: 'n', v: 0.6, z: FORMATO_PERCENTUAL });
		// Header and text cells untouched
		expect(ws.B1.z).toBeUndefined();
		expect(ws.A2.z).toBeUndefined();
		expect(ws['!cols']?.[0]).toEqual({ wch: 40 });
	});

	it('o formato é gravado no arquivo (R$ com separadores do Excel do usuário)', () => {
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, planilhaComFormatos(linhas, { Valor: FORMATO_BRL }), 'Receitas');
		const lido = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellNF: true });
		const celula = lido.Sheets.Receitas.B2;
		expect(celula.v).toBe(1268523.95);
		expect(celula.z).toBe(FORMATO_BRL);
	});
});
