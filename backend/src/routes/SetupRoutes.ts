export async function handleRequest(req: Request, DB: D1Database): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const { method } = req;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  console.log(`📥 Recebendo requisição: ${method} ${pathname}`);

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!DB) {
      console.error("❌ Banco de dados não configurado!");
      return new Response(JSON.stringify({ error: "Banco de dados não configurado" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Verifica se a tabela 'banco' existe antes de qualquer operação
    const test = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='banco';").all();
    if (!test.results.length) {
      console.error("⚠ A tabela 'banco' não existe!");
      return new Response(JSON.stringify({ error: "Tabela 'banco' não encontrada" }), { status: 500, headers: corsHeaders });
    }

    // 📌 GET - Listar bancos
    if (method === "GET" && pathname === "/api/bancos") {
      console.log("📡 Buscando bancos no banco de dados...");
      const { results } = await DB.prepare("SELECT id, nome, codigo FROM banco;").all();
      console.log("✅ Bancos encontrados:", results);
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 📌 POST - Criar banco
    if (method === "POST" && pathname === "/api/bancos") {
      const { nome, codigo }: { nome: string; codigo: string } = await req.json();

      if (!nome || !codigo) {
        return new Response(JSON.stringify({ error: "Nome e Código são obrigatórios" }), { status: 400, headers: corsHeaders });
      }

      // ✅ Insere o banco e obtém o ID gerado automaticamente
      const result = await DB.prepare("INSERT INTO banco (nome, codigo) VALUES (?, ?) RETURNING id, nome, codigo")
        .bind(nome, codigo)
        .first(); // Pega o primeiro registro retornado

      console.log("✅ Banco criado:", result);

      return new Response(JSON.stringify(result), { status: 201, headers: corsHeaders }); // ✅ Retorna os dados do banco criado
    }


    // 📌 PUT - Editar banco
    if (method === "PUT" && pathname.startsWith("/api/bancos/")) {
      const id = parseInt(pathname.split("/")[3]);
      const { nome, codigo }: { nome: string; codigo: string } = await req.json();

      if (!nome || !codigo) {
        return new Response(JSON.stringify({ error: "Nome e Código são obrigatórios" }), { status: 400, headers: corsHeaders });
      }

      await DB.prepare("UPDATE banco SET nome = ?, codigo = ? WHERE id = ?").bind(nome, codigo, id).run();
      console.log("✅ Banco atualizado:", id, nome, codigo);
      return new Response(JSON.stringify({ message: "Banco atualizado com sucesso!" }), { status: 200, headers: corsHeaders });
    }

    // 📌 DELETE - Excluir banco
    if (method === "DELETE" && pathname.startsWith("/api/bancos/")) {
      const id = parseInt(pathname.split("/")[3]);

      await DB.prepare("DELETE FROM banco WHERE id = ?").bind(id).run();
      console.log("✅ Banco excluído:", id);
      return new Response(JSON.stringify({ message: "Banco excluído com sucesso!" }), { status: 200, headers: corsHeaders });
    }

    console.warn("⚠ Rota não encontrada:", pathname);
    return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });

  } catch (error) {
    console.error("❌ Erro no servidor:", error);
    return new Response(JSON.stringify({ error: "Erro no servidor", details: (error as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
