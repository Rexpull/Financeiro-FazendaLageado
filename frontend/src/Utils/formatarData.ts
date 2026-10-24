export const formatarData = (data: string) => {
	const d = new Date(data);
	const dia = d.getUTCDate().toString().padStart(2, '0');
	const mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
	const ano = d.getUTCFullYear();
	const horas = d.getUTCHours().toString().padStart(2, '0');
	const minutos = d.getUTCMinutes().toString().padStart(2, '0');
	const segundos = d.getUTCSeconds().toString().padStart(2, '0');
	return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
  };
  
  export const formatarDataSemHora = (data: string) => {
	const d = new Date(data);
	const dia = d.getUTCDate().toString().padStart(2, '0');
	const mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
	const ano = d.getUTCFullYear();
	return `${dia}/${mes}/${ano}`;
  };
  

export const calcularDataAnteriorFimDia = (data: string) => {
  const d = new Date(data);
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

/**
 * dd/mm/aaaa read straight from the 'YYYY-MM-DD...' text (no Date/timezone conversion), so
 * '2026-10-13T00:00:00.000Z' never shows as 12/10 in Brazil (UTC−3). Falls back to the UTC date.
 */
export const formatarDataISO = (data?: string | null) => {
	if (!data) return '';
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data));
	if (m) return `${m[3]}/${m[2]}/${m[1]}`;
	return formatarDataSemHora(String(data));
};
