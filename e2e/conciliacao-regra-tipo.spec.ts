// Conciliação Bancária on the screen: the plano × centro type rule (investimento → investimento, custeio →
// custeio; rule of 13/11/2026) and what must keep working around it (receitas, lines without a plano,
// "Detalhar por itens", "Memórias da conta"). The API is mocked: see helpers/conciliacaoApiMock.ts.
import { test, expect, type Page } from '@playwright/test';
import { installConciliacaoMocks, type MovimentoMock } from './helpers/conciliacaoApiMock';

const ANTIGA: MovimentoMock = { id: 1, historico: 'Pagamento de Boleto - JUCA INDUSTRIA', valor: -23541, idPlanoContas: 310, idCentroCustos: 42 };
const INVESTIMENTO_OK: MovimentoMock = { id: 2, historico: 'Pagamento de Boleto - G5 CONSTRUCOES', valor: -8000, idPlanoContas: 310, idCentroCustos: 50 };
const SEM_CLASSIFICACAO: MovimentoMock = { id: 3, historico: 'Pagamento de Boleto - CEMIG', valor: -500 };
const RECEITA: MovimentoMock = { id: 4, historico: 'Recebimento Pix - LATICINIO SERRA AZUL', valor: 15000 };

const campoCentro = (page: Page) => page.locator('input[placeholder="Selecionar centro..."]');
/** Entries of the open plano/centro list, without the fixed "Limpar seleção" and the empty-list message. */
const opcoes = (page: Page) => page.locator('ul.overflow-y-auto li').filter({ hasNotText: /Limpar seleção|Nenhum resultado/ });
const salvar = (page: Page) => page.getByRole('button', { name: /Salvar classificação/ });

/** Opens "Conciliar" by the plano cell of the line (despesa) or by the centre cell (a receita has no plano). */
async function abrirLinha(page: Page, historico: string, coluna: 'plano' | 'centro' = 'plano') {
	await page.goto('/financeiro/conciliacao-bancaria', { waitUntil: 'networkidle' });
	await page.locator('tr', { hasText: historico }).first().locator('td').nth(coluna === 'plano' ? 3 : 4).click();
	await expect(salvar(page)).toBeVisible();
}

const nomes = async (page: Page) => (await opcoes(page).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

test.describe('Conciliação: plano × centro por tipo', () => {
	test('linha classificada antes da regra: aviso em vermelho e não salva como está', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [ANTIGA] });
		await abrirLinha(page, 'JUCA');
		await expect(page.getByRole('alert')).toContainText('O plano de contas é de investimento');
		await salvar(page).click();
		await expect(salvar(page)).toBeVisible();
		expect(api.puts).toHaveLength(0);
	});

	test('plano de investimento só oferece centros de investimento, e salvar envia o centro escolhido', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [ANTIGA] });
		await abrirLinha(page, 'JUCA');
		await campoCentro(page).click();
		await expect(opcoes(page)).toHaveCount(2);
		expect(await nomes(page)).toEqual(expect.arrayContaining([expect.stringContaining('Estrutura e patrimônio'), expect.stringContaining('Agricultura - Máquinas')]));
		await expect(page.getByRole('button', { name: 'Custeio', exact: true })).toBeDisabled();
		await expect(page.getByText('só aparecem centros desse tipo')).toBeVisible();

		await opcoes(page).filter({ hasText: 'Estrutura e patrimônio' }).click();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await salvar(page).click();
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0]).toMatchObject({ id: 1, body: { idCentroCustos: 50 } });
		expect(api.puts[0].body.idPlanoContas).toBeUndefined(); // the plano did not change: not sent
	});

	test('trocar para um plano de custeio tira o centro de investimento e passa a oferecer só custeio', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [INVESTIMENTO_OK] });
		await abrirLinha(page, 'G5 CONSTRUCOES');
		await expect(page.getByRole('alert')).toHaveCount(0);
		await page.locator('input[placeholder="Selecionar plano..."]').click();
		await page.getByRole('button', { name: 'Custeio', exact: true }).click();
		await opcoes(page).filter({ hasText: 'Energia elétrica' }).click();
		await expect(campoCentro(page)).toHaveValue('');

		await campoCentro(page).click();
		await expect(opcoes(page)).toHaveCount(2);
		await expect(page.getByRole('button', { name: 'Investimento', exact: true })).toBeDisabled();
		await opcoes(page).filter({ hasText: 'Leite - Recria' }).click();
		await salvar(page).click();
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].body).toMatchObject({ idPlanoContas: 300, idCentroCustos: 43 });
	});
});

test.describe('Conciliação: o que continua como era', () => {
	test('despesa sem plano: os dois tipos de centro continuam à escolha', async ({ page }) => {
		await installConciliacaoMocks(page, { movimentos: [SEM_CLASSIFICACAO] });
		await abrirLinha(page, 'CEMIG');
		await campoCentro(page).click();
		const custeio = page.getByRole('button', { name: 'Custeio', exact: true });
		const investimento = page.getByRole('button', { name: 'Investimento', exact: true });
		await expect(custeio).toBeEnabled();
		await expect(investimento).toBeEnabled();
		expect(await nomes(page)).toEqual(expect.arrayContaining([expect.stringContaining('Leite - Produção'), expect.stringContaining('Leite - Recria')]));
		await investimento.click();
		await expect(opcoes(page).filter({ hasText: 'Estrutura e patrimônio' })).toBeVisible();
		await expect(opcoes(page).filter({ hasText: 'Leite - Recria' })).toHaveCount(0);
	});

	test('receita: só centros de receita, e salva sem plano de contas', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [RECEITA] });
		await abrirLinha(page, 'LATICINIO', 'centro');
		await campoCentro(page).click();
		await expect(opcoes(page)).toHaveCount(1);
		await opcoes(page).filter({ hasText: 'Receita do leite' }).click();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await salvar(page).click();
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].body).toMatchObject({ idCentroCustos: 60 });
	});

	test('"Detalhar por itens": o centro de cada item segue o tipo do plano do item', async ({ page }) => {
		await installConciliacaoMocks(page, { movimentos: [INVESTIMENTO_OK] });
		await abrirLinha(page, 'G5 CONSTRUCOES');
		await page.getByRole('button', { name: 'Detalhar por itens' }).click();
		const grupos = (i: number) => page.getByLabel(`Centro de custos do item ${i}`).locator('optgroup').evaluateAll((os) => os.map((o) => (o as HTMLOptGroupElement).label));
		expect(await grupos(1)).toEqual(['Investimento']);
		await page.getByRole('button', { name: /Adicionar item/ }).click();
		expect(await grupos(2)).toEqual(['Custeio', 'Investimento']);
		const planoItem2 = page.getByLabel('Plano de contas do item 2');
		await planoItem2.selectOption(await planoItem2.locator('optgroup[label="Custeio"] option').first().getAttribute('value'));
		expect(await grupos(2)).toEqual(['Custeio']);
	});

	test('"Memórias da conta" mostra o percentual de cada centro do rateio', async ({ page }) => {
		await installConciliacaoMocks(page, {
			movimentos: [SEM_CLASSIFICACAO],
			memorias: [
				{ id: 7, historicoExemplo: 'Pagamento de Boleto - CEMIG', tipoMovimento: 'D', planos: [{ id: 300, pct: 100 }], centros: [{ id: 42, pct: 70 }, { id: 43, pct: 30 }] },
			],
		});
		await page.goto('/financeiro/conciliacao-bancaria', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Ações', exact: true }).click();
		await page.getByText('Memórias da conta').first().click();
		const linha = page.locator('.ReactModal__Content tbody tr').first();
		await expect(linha).toContainText('Energia elétrica');
		await expect(linha).toContainText(/Leite - Produção \(Custeio\)\s*70\s*%/);
		await expect(linha).toContainText(/Leite - Recria \(Custeio\)\s*30\s*%/);
	});
});

test.describe('Conciliação: rateio, movimentação sem efeito e lançamento manual', () => {
	const modalRateio = (page: Page) => page.locator('.ReactModal__Content').last();

	test('rateio de centros: com plano de investimento só entram centros de investimento; sem plano, todos', async ({ page }) => {
		await installConciliacaoMocks(page, { movimentos: [INVESTIMENTO_OK, SEM_CLASSIFICACAO] });
		await abrirLinha(page, 'G5 CONSTRUCOES');
		await page.getByTitle('Rateio em múltiplos centros').click();
		const tipo = modalRateio(page).locator('select').filter({ hasText: 'Todos' });
		await expect(tipo).toBeDisabled();
		await expect(tipo).toHaveValue('INVESTIMENTO');
		await expect(modalRateio(page).getByText('Agricultura - Máquinas')).toBeVisible();
		await expect(modalRateio(page).getByText('Leite - Recria')).toHaveCount(0);

		await abrirLinha(page, 'CEMIG');
		await page.getByTitle('Rateio em múltiplos centros').click();
		await expect(tipo).toBeEnabled();
		await expect(tipo).toHaveValue('TODOS');
		await expect(modalRateio(page).getByText('Agricultura - Máquinas')).toBeVisible();
		await expect(modalRateio(page).getByText('Leite - Recria')).toBeVisible();
	});

	test('linha antiga pode virar movimentação sem efeito: a regra só vale para receita/despesa', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [ANTIGA] });
		await abrirLinha(page, 'JUCA');
		await expect(page.getByRole('alert')).toHaveCount(1);
		await page.getByRole('button', { name: 'Movimentações sem efeito' }).click();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await salvar(page).click();
		await expect.poll(() => api.puts.length).toBe(1);
		expect(api.puts[0].body).toMatchObject({ modalidadeMovimento: 'transferencia', idCentroCustos: null });
	});

	test('lançamento manual: o plano escolhido define os centros oferecidos, e a entrada só oferece centros de receita', async ({ page }) => {
		const api = await installConciliacaoMocks(page, { movimentos: [] });
		await page.goto('/financeiro/conciliacao-bancaria', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Lançar Manual' }).click();
		const modal = page.locator('.ReactModal__Content').last();
		const centros = modal.locator('select[name="idCentroCustos"]');
		const oferecidos = async () => (await centros.locator('option').allInnerTexts()).filter((t) => !/^Selecione/.test(t)).map((t) => t.trim());
		const escolherPlano = async (busca: string, nome: string) => {
			await modal.getByPlaceholder('Pesquisar plano de contas...').fill(busca);
			await modal.locator('li', { hasText: nome }).first().click();
		};

		await modal.getByRole('button', { name: 'Entrada (crédito)' }).click();
		expect(await oferecidos()).toEqual([expect.stringContaining('Receita do leite')]);

		await modal.getByRole('button', { name: 'Saída (débito)' }).click();
		expect(await oferecidos()).toHaveLength(4); // no plano yet: every despesa centre
		await escolherPlano('Obras', 'Obras e instalações');
		expect(await oferecidos()).toEqual(['Agricultura - Máquinas · Investimento', 'Estrutura e patrimônio · Investimento']);
		await centros.selectOption('50');
		await escolherPlano('Energia', 'Energia elétrica');
		await expect(centros).toHaveValue(''); // the investimento centre does not fit a custeio plano
		expect(await oferecidos()).toEqual(['Leite - Produção · Custeio', 'Leite - Recria · Custeio']);

		await centros.selectOption('43');
		await modal.locator('input[name="valor"]').fill('150,00');
		await modal.locator('input[name="historico"]').fill('Conta de energia do curral');
		await modal.getByRole('button', { name: 'Confirmar' }).click();
		await expect.poll(() => api.posts.length).toBe(1);
		expect(api.posts[0]).toMatchObject({ idPlanoContas: 300, valor: -150 });
		expect(JSON.stringify(api.posts[0])).toContain('43');
	});
});
