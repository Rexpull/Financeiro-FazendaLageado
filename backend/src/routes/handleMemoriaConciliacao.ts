import { MemoriaConciliacaoRepository } from '../repositories/MemoriaConciliacaoRepository';
import { MovimentoBancarioRepository } from '../repositories/MovimentoBancarioRepository';
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

/**
 * /api/memoriaConciliacao
 * - GET ?idContaCorrente=   memories of a conta
 * - GET /movimento/:id      what "Lembrar" means for that line: recognized text, memory that applies, variations
 * - DELETE /:id             forgets a memory (the lines it classified lose the tag, their classification stays)
 */
export async function handleMemoriaConciliacao(req: Request, DB: D1Database): Promise<Response> {
	const url = new URL(req.url);
	const partes = url.pathname.split('/').filter(Boolean); // ['api', 'memoriaConciliacao', ...]
	const repo = new MemoriaConciliacaoRepository(DB);
	try {
		await repo.ensureSchema();
		if (req.method === 'GET' && partes.length === 2) {
			const conta = Number(url.searchParams.get('idContaCorrente'));
			if (!Number.isInteger(conta) || conta <= 0) return json({ error: 'Informe a conta.' }, 400);
			return json(await repo.listarPorConta(conta));
		}
		if (req.method === 'GET' && partes[2] === 'movimento' && partes.length === 4) {
			const id = Number(partes[3]);
			const mov = Number.isInteger(id) && id > 0 ? await new MovimentoBancarioRepository(DB).getById(id) : null;
			if (!mov) return json({ error: 'Movimento não encontrado.' }, 404);
			return json(await repo.analisarMovimento(mov));
		}
		if (req.method === 'DELETE' && partes.length === 3) {
			const id = Number(partes[2]);
			if (!Number.isInteger(id) || id <= 0) return json({ error: 'Memória inválida.' }, 400);
			return (await repo.excluir(id)) ? json({ ok: true }) : json({ error: 'Memória não encontrada.' }, 404);
		}
		return json({ error: 'Rota não encontrada' }, 404);
	} catch (error) {
		console.error('Erro em memoriaConciliacao:', error);
		return json({ error: 'Erro ao processar a memória de conciliação.' }, 500);
	}
}
