export const formatarMoeda = (valor: number | string, casasDecimais: number = 2): string => {
    if (typeof valor === "string") {
        valor = valor.replace(/[^\d,-]/g, '').replace(',', '.'); 
        valor = parseFloat(valor);
    }
    
    if (isNaN(valor)) {
        throw new Error("Valor inválido");
    }
    
    return valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais
    });
}

export const formatarMoedaOuTraco = (valor: number | string, casasDecimais: number = 2): string => {
	if (typeof valor === "string") {
		valor = valor.replace(/[^\d,-]/g, '').replace(',', '.'); 
		valor = parseFloat(valor);
	}

	if (isNaN(valor)) {
		throw new Error("Valor inválido");
	}

	if (valor === 0.0) {
		return "-";
	}

	return valor.toLocaleString("pt-BR", {
		minimumFractionDigits: casasDecimais,
		maximumFractionDigits: casasDecimais,
	});
};


export const parseMoeda = (valor: string): number => {
	const limpo = valor.replace(/[^\d,-]+/g, '').replace(',', '.');
	const parsed = parseFloat(limpo);
	return isNaN(parsed) ? 0 : parsed;
};
