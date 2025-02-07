import { BancoRepository } from "../repositories/BancoRepository";

export class BancoService {
  private bancoRepository: BancoRepository;

  constructor(bancoRepository: BancoRepository) {
    this.bancoRepository = bancoRepository;
  }

  async listarBancos() {
    return this.bancoRepository.getAll();
  }

  async buscarBanco(id: number) {
    return this.bancoRepository.getById(id);
  }

  async criarBanco(nome: string, codigo: string) {
    if (!nome || !codigo) throw new Error("Nome e Código são obrigatórios");
    await this.bancoRepository.create(nome, codigo);
  }

  async atualizarBanco(id: number, nome: string, codigo: string) {
    if (!nome || !codigo) throw new Error("Nome e Código são obrigatórios");
    await this.bancoRepository.update(id, nome, codigo);
  }

  async excluirBanco(id: number) {
    await this.bancoRepository.delete(id);
  }
}
