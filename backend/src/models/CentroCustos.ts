export interface CentroCustos {
  id: number;
  descricao: string;
  tipo?: 'CUSTEIO' | 'INVESTIMENTO';
  tipoReceitaDespesa?: 'RECEITA' | 'DESPESA';
}
