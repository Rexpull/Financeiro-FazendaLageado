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
  
      // 📌 GET - Listar todas as Contas Correntes
      if (method === "GET" && pathname === "/api/contas") {
        console.log("📡 Buscando contas correntes no banco de dados...");
        const { results } = await DB.prepare(`
          SELECT c.id, c.tipo, c.idBanco, b.nome as bancoNome, c.agencia, c.numConta, c.numCartao, c.responsavel, c.observacao, c.ativo
          FROM contaCorrente c
          JOIN banco b ON c.idBanco = b.id;
        `).all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
  
      // 📌 POST - Criar Conta Corrente
      if (method === "POST" && pathname === "/api/contas") {
        const { tipo, idBanco, agencia, numConta, numCartao, responsavel, observacao, ativo } = await req.json();
  
        if (!tipo || !idBanco || !agencia || !responsavel) {
          return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), { status: 400, headers: corsHeaders });
        }
  
        const { meta } = await DB.prepare(`
          INSERT INTO contaCorrente (tipo, idBanco, agencia, numConta, numCartao, responsavel, observacao, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `).bind(tipo, idBanco, agencia, numConta, numCartao, responsavel, observacao, ativo ?? 1).run();
  
        return new Response(JSON.stringify({ id: meta.last_row_id, message: "Conta criada com sucesso!" }), { status: 201, headers: corsHeaders });
      }
  
      // 📌 PUT - Atualizar Conta Corrente
      if (method === "PUT" && pathname.startsWith("/api/contas/")) {
        const id = parseInt(pathname.split("/")[3]);
        const { tipo, idBanco, agencia, numConta, numCartao, responsavel, observacao, ativo } = await req.json();
  
        if (!tipo || !idBanco || !agencia || !responsavel) {
          return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos!" }), { status: 400, headers: corsHeaders });
        }
  
        await DB.prepare(`
          UPDATE contaCorrente SET tipo = ?, idBanco = ?, agencia = ?, numConta = ?, numCartao = ?, responsavel = ?, observacao = ?, ativo = ?
          WHERE id = ?;
        `).bind(tipo, idBanco, agencia, numConta, numCartao, responsavel, observacao, ativo, id).run();
  
        return new Response(JSON.stringify({ message: "Conta atualizada com sucesso!" }), { status: 200, headers: corsHeaders });
      }
  
      // 📌 DELETE - Excluir Conta Corrente
      if (method === "DELETE" && pathname.startsWith("/api/contas/")) {
        const id = parseInt(pathname.split("/")[3]);
  
        await DB.prepare("DELETE FROM contaCorrente WHERE id = ?;").bind(id).run();
  
        return new Response(JSON.stringify({ message: "Conta excluída com sucesso!" }), { status: 200, headers: corsHeaders });
      }
  
      return new Response("Rota não encontrada", { status: 404, headers: corsHeaders });
  
    } catch (error) {
      console.error("❌ Erro no servidor:", error);
      return new Response(JSON.stringify({ error: "Erro no servidor", details: (error as Error).message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
  