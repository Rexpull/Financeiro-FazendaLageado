export const formatarData = (data: string) => {
	return new Date(data).toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
};

export const formatarDataSemHora = (data: string) => {
	return new Date(data).toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
};

export const calcularDataAnteriorFimDia = (data: string) => {
  const d = new Date(data);
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};
