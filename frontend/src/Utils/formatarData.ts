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
