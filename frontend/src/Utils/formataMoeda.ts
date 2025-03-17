export const formatarMoeda = (valor: number | string, casasDecimais: number = 2): string => {
    if (typeof valor === "string") {
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