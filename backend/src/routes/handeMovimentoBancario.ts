import { MovimentoBancarioRepository } from "../repositories/MovimentoBancarioRepository";
import { MovimentoBancarioController } from "../controllers/MovimentoBancarioController";
import { PlanoContaRepository } from "../repositories/PlanoContaRepository";
import { ParcelaFinanciamentoRepository } from "../repositories/ParcelaFinanciamentoRepository";
import { ContaCorrenteRepository } from "../repositories/ContaCorrenteRepository";
import { FinanciamentoRepository } from "../repositories/FinanciamentoRepository";
import { PessoaRepository } from "../repositories/PessoaRepository";
import { BancoRepository } from "../repositories/BancoRepository";

export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
    const repository = new MovimentoBancarioRepository(DB);
    const planoContaRepository = new PlanoContaRepository(DB)
    const parcelaFinanciamentoRepository = new ParcelaFinanciamentoRepository(DB);
    const contaCorrenteRepository = new ContaCorrenteRepository(DB);
    const financiamentoRepository = new FinanciamentoRepository(DB);
    const pessoaRepository = new PessoaRepository(DB);
    const bancoRepository = new BancoRepository(DB);

    const controller = new MovimentoBancarioController(
        repository, 
        planoContaRepository, 
        parcelaFinanciamentoRepository, 
        contaCorrenteRepository,
        financiamentoRepository,
        pessoaRepository,
        bancoRepository
    );
    return controller.handleRequest(req);
}
