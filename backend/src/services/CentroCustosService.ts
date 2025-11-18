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

  async criarCentroCustos(descricao: string, tipo: 'CUSTEIO' | 'INVESTIMENTO' = 'CUSTEIO') {
    if (!descricao) throw new Error("Descrição é obrigatória");
    if (tipo !== 'CUSTEIO' && tipo !== 'INVESTIMENTO') {
      throw new Error("Tipo deve ser 'CUSTEIO' ou 'INVESTIMENTO'");
    }
    return await this.centroCustosRepository.create(descricao, tipo);
  }

  async atualizarCentroCustos(id: number, descricao: string, tipo: 'CUSTEIO' | 'INVESTIMENTO') {
    if (!descricao) throw new Error("Descrição é obrigatória");
    if (!tipo) throw new Error("Tipo é obrigatório");
    if (tipo !== 'CUSTEIO' && tipo !== 'INVESTIMENTO') {
      throw new Error("Tipo deve ser 'CUSTEIO' ou 'INVESTIMENTO'");
    }
    await this.centroCustosRepository.update(id, descricao, tipo);
  }

  async excluirCentroCustos(id: number) {
    await this.centroCustosRepository.delete(id);
  }
}
