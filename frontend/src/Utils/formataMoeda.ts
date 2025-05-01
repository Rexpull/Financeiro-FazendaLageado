export const formatarMoeda = (valor: number | string, casasDecimais: number = 2): string => {
    if (typeof valor === "string") {
        valor = valor.replace(/[^\d,-]/g, '').replace(',', '.'); 
        valor = parseFloat(valor);
    }
    
    if (isNaN(valor)) {
		return "0,00";
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
	if (!valor) return 0;

	const limpo = valor
		.replace(/\s/g, '')        
		.replace('R$', '')      
		.replace(/\./g, '')       
		.replace(',', '.');      

	const parsed = parseFloat(limpo);
	return isNaN(parsed) ? 0 : parsed;
};

