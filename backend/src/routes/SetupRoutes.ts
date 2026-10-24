import { erroExclusao, garantirSemUso, plural } from "../utils/verificarUsoRegistro";

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

    // /api/notificacoes/* is served by routes/handleNotifications.ts (index.ts routes it there).

    // 📌 GET - Listar bancos
    if (method === "GET" && pathname === "/api/bancos") {
      console.log("📡 Buscando bancos no banco de dados...");
      const { results } = await DB.prepare("SELECT id, nome, codigo FROM banco;").all();
      console.log("✅ Bancos encontrados:", results);
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET" && pathname.startsWith("/api/bancos/")) {
      const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
      const raw = pathname.split("/")[3] ?? "";
      if (!/^\d+$/.test(raw)) {
        return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400, headers: jsonHeaders });
      }
      const result = await DB.prepare("SELECT id, nome, codigo FROM banco where id = ?;")
      .bind(parseInt(raw, 10))
      .first();
      if (!result) {
        return new Response(JSON.stringify({ error: "Banco não encontrado" }), { status: 404, headers: jsonHeaders });
      }
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
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
      const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
      if (!id || isNaN(id)) {
        return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400, headers: jsonHeaders });
      }

      try {
        // Accounts are listed with INNER JOIN banco, so deleting a bank in use would hide its accounts.
        await garantirSemUso(DB, [
          {
            sql: "SELECT COUNT(*) AS n FROM contaCorrente WHERE idBanco = ?",
            binds: [id],
            rotulo: (n) => plural(n, "conta corrente/cartão", "contas correntes/cartões"),
          },
          {
            sql: "SELECT COUNT(*) AS n FROM Financiamento WHERE idBanco = ?",
            binds: [id],
            rotulo: (n) => plural(n, "financiamento", "financiamentos"),
          },
          {
            sql: "SELECT COUNT(*) AS n FROM MovimentoBancario WHERE idBanco = ?",
            binds: [id],
            rotulo: (n) => plural(n, "lançamento bancário", "lançamentos bancários"),
          },
        ], "Não é possível excluir este banco. Ele está em uso em:");
        await DB.prepare("DELETE FROM banco WHERE id = ?").bind(id).run();
      } catch (error) {
        console.error("❌ Erro ao excluir banco:", error);
        const { status, message } = erroExclusao(error, "o banco");
        return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
      }
      console.log("✅ Banco excluído:", id);
      return new Response(JSON.stringify({ message: "Banco excluído com sucesso!" }), { status: 200, headers: corsHeaders });
    }

    // 📌 Rotas para Centro de Custos
    if (pathname.startsWith("/api/centro-custos")) {
      console.log("🔍 Rota de centro de custos detectada:", pathname);
      
      try {
        const { handleRequest } = await import("./handleCentroCustos");
        return await handleRequest(req, DB);
      } catch (importError) {
        console.error("❌ Erro ao importar módulos de centro de custos:", importError);
        return new Response(JSON.stringify({ error: "Erro ao carregar módulos de centro de custos" }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 📌 Rotas para Histórico de Importações OFX
    if (pathname.startsWith("/api/historico-importacao-ofx")) {
      console.log("🔍 Rota de histórico de importações detectada:", pathname);
      
      try {
        const { HistoricoImportacaoOFXController } = await import("../controllers/HistoricoImportacaoOFXController");
        const { HistoricoImportacaoOFXRepository } = await import("../repositories/HistoricoImportacaoOFXRepository");
        
        console.log("✅ Módulos carregados com sucesso");
        
        const historicoRepository = new HistoricoImportacaoOFXRepository(DB);
        const historicoController = new HistoricoImportacaoOFXController(historicoRepository);
        
        console.log("✅ Controller criado, processando requisição...");
        return await historicoController.handleRequest(req);
      } catch (importError) {
        console.error("❌ Erro ao importar módulos:", importError);
        return new Response(JSON.stringify({ error: "Erro ao carregar módulos do histórico" }), {
          status: 500,
          headers: corsHeaders,
        });
      }
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
