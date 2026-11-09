import { ErroMatricula, MatriculaRepository } from '../repositories/MatriculaRepository';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

/**
 * /api/matricula — matrículas offered as guarantee
 * - GET           list (with how many contracts use each)
 * - POST          { numero, descricao? }
 * - PUT /:id      { numero, descricao? } (a new number is also changed in the contracts)
 * - DELETE /:id   refused (409) while a contract uses it
 */
export async function handleMatricula(req: Request, DB: D1Database): Promise<Response> {
	const partes = new URL(req.url).pathname.split('/').filter(Boolean); // ['api', 'matricula', id?]
	const repo = new MatriculaRepository(DB);
	const id = partes.length === 3 ? Number(partes[2]) : null;
	if (id !== null && !(Number.isInteger(id) && id > 0)) return json({ error: 'Matrícula inválida.' }, 400);
	try {
		if (req.method === 'GET' && id === null) return json(await repo.listar());
		if (req.method === 'POST' && id === null) return json(await repo.criar(await req.json()), 201);
		if (req.method === 'PUT' && id !== null) return json(await repo.atualizar(id, await req.json()));
		if (req.method === 'DELETE' && id !== null) {
			await repo.excluir(id);
			return json({ ok: true });
		}
		return json({ error: 'Rota não encontrada' }, 404);
	} catch (error) {
		if (error instanceof ErroMatricula) return json({ error: error.message }, error.status);
		console.error('Erro em matricula:', error);
		return json({ error: 'Erro ao processar a matrícula.' }, 500);
	}
}
