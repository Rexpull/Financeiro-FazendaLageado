import { CentroCustosRepository } from "../repositories/CentroCustosRepository";

export class CentroCustosService {
  private centroCustosRepository: CentroCustosRepository;

  constructor(centroCustosRepository: CentroCustosRepository) {
    this.centroCustosRepository = centroCustosRepository;
  }

  async listarCentroCustos() {
    return this.centroCustosRepository.getAll();
  }

  async buscarCentroCustos(id: number) {
    return this.centroCustosRepository.getById(id);
  }

  async criarCentroCustos(descricao: string, tipo?: 'CUSTEIO' | 'INVESTIMENTO', tipoReceitaDespesa?: 'RECEITA' | 'DESPESA') {
    if (!descricao) throw new Error("Descrição é obrigatória");
    if (tipoReceitaDespesa && tipoReceitaDespesa !== 'RECEITA' && tipoReceitaDespesa !== 'DESPESA') {
      throw new Error("tipoReceitaDespesa deve ser 'RECEITA' ou 'DESPESA'");
    }
    if (tipoReceitaDespesa === 'DESPESA' && tipo && tipo !== 'CUSTEIO' && tipo !== 'INVESTIMENTO') {
      throw new Error("Tipo deve ser 'CUSTEIO' ou 'INVESTIMENTO' quando tipoReceitaDespesa for 'DESPESA'");
    }
    return await this.centroCustosRepository.create(descricao, tipo, tipoReceitaDespesa);
  }

  async atualizarCentroCustos(id: number, descricao: string, tipo?: 'CUSTEIO' | 'INVESTIMENTO', tipoReceitaDespesa?: 'RECEITA' | 'DESPESA') {
    if (!descricao) throw new Error("Descrição é obrigatória");
    if (tipoReceitaDespesa && tipoReceitaDespesa !== 'RECEITA' && tipoReceitaDespesa !== 'DESPESA') {
      throw new Error("tipoReceitaDespesa deve ser 'RECEITA' ou 'DESPESA'");
    }
    if (tipoReceitaDespesa === 'DESPESA' && tipo && tipo !== 'CUSTEIO' && tipo !== 'INVESTIMENTO') {
      throw new Error("Tipo deve ser 'CUSTEIO' ou 'INVESTIMENTO' quando tipoReceitaDespesa for 'DESPESA'");
    }
    await this.centroCustosRepository.update(id, descricao, tipo, tipoReceitaDespesa);
  }

  async excluirCentroCustos(id: number) {
    await this.centroCustosRepository.delete(id);
  }
}
