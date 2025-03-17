export interface MovimentoOFX {
    dtMovimento: string;
    historico: string;
    valor: number;
  }
  
  export interface TotalizadoresOFX {
    receitas: number;
    despesas: number;
    liquido: number;
    saldoFinal: number;
  }
  
  export const parseOFXFile = (file: File): Promise<{ movimentos: MovimentoOFX[]; totalizadores: TotalizadoresOFX }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) {
          reject("Erro ao ler o arquivo.");
          return;
        }
        const ofxContent = event.target.result as string;
  
        const transactions = ofxContent.match(/<STMTTRN>(.*?)<\/STMTTRN>/gs) || [];
        let totalReceitas = 0;
        let totalDespesas = 0;
        let movimentos: MovimentoOFX[] = [];
  
        transactions.forEach((transaction) => {
          const dateMatch = transaction.match(/<DTPOSTED>(\d+)/);
          const memoMatch = transaction.match(/<MEMO>(.*?)<\/MEMO>/);
          const amountMatch = transaction.match(/<TRNAMT>(-?\d+\.\d+)/);
  
          if (!dateMatch || !amountMatch) return;
  
          const dateStr = dateMatch[1];
          const dtMovimento = `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
          const historico = memoMatch ? memoMatch[1] : "Sem descrição";
          const valor = parseFloat(amountMatch[1]);
  
          if (valor > 0) {
            totalReceitas += valor;
          } else {
            totalDespesas += valor;
          }
  
          movimentos.push({ dtMovimento, historico, valor });
        });
  
        const liquido = totalReceitas + totalDespesas;
        const saldoFinal = liquido; // Ajuste conforme necessário
  
        resolve({
          movimentos,
          totalizadores: {
            receitas: totalReceitas,
            despesas: totalDespesas,
            liquido,
            saldoFinal,
          },
        });
      };
  
      reader.onerror = () => reject("Erro ao processar o arquivo OFX.");
      reader.readAsText(file);
    });
  };
  