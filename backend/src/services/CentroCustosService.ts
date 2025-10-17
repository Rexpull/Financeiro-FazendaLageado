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

  async criarCentroCustos(descricao: string) {
    if (!descricao) throw new Error("Descrição é obrigatória");
    return await this.centroCustosRepository.create(descricao);
  }

  async atualizarCentroCustos(id: number, descricao: string) {
    if (!descricao) throw new Error("Descrição é obrigatória");
    await this.centroCustosRepository.update(id, descricao);
  }

  async excluirCentroCustos(id: number) {
    await this.centroCustosRepository.delete(id);
  }
}
