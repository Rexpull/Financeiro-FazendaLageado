import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { Usuario } from "../models/Usuario";

export class UsuarioController {
    private usuarioRepository: UsuarioRepository;

    constructor(usuarioRepository: UsuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const { pathname } = url;
        const { method } = req;

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            if (method === "GET" && pathname === "/api/usuario") {
                const usuarios = await this.usuarioRepository.getAll();
                return new Response(JSON.stringify(usuarios), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (method === "POST" && pathname === "/api/usuario") {
                try {
                    const body: Usuario = await req.json();
                    const id = await this.usuarioRepository.create(body);
                    return new Response(JSON.stringify({ id, message: "Usuário cadastrado com sucesso!" }), {
                        status: 201,
                        headers: corsHeaders,
                    });
                } catch (error) {
                    console.error("❌ Erro ao cadastrar usuário:", error);
            
                    if ((error as Error).message.includes("UNIQUE constraint failed: usuario.email")) {
                        return new Response(
                            JSON.stringify({ error: "Este e-mail já está cadastrado no sistema!" }),
                            { status: 400, headers: corsHeaders }
                        );
                    }
            
                    if ((error as Error).message.includes("UNIQUE constraint failed: usuario.usuario")) {
                        return new Response(JSON.stringify({ error: "Este NOME de usuario já está cadastrado no sistema!" }), {
                            status: 400,
                            headers: corsHeaders,
                        });
                    }

                    return new Response(
                        JSON.stringify({ error: "Erro ao cadastrar usuário", details: (error as Error).message }),
                        { status: 500, headers: corsHeaders }
                    );
                }
            }
            

            if (method === "PUT" && pathname.startsWith("/api/usuario/")) {
                try {
                    const id = parseInt(pathname.split("/")[3]);
                    const body: Usuario = await req.json();
                    await this.usuarioRepository.update(id, body);
                    return new Response(JSON.stringify({ message: "Usuário atualizado com sucesso!" }), {
                        status: 200,
                        headers: corsHeaders,
                    });
                } catch (error) {
                    console.error("❌ Erro ao atualizar usuário:", error);
            
                    if ((error as Error).message.includes("UNIQUE constraint failed: usuario.email")) {
                        return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado no sistema!" }), {
                            status: 400,
                            headers: corsHeaders,
                        });
                    }

                    if ((error as Error).message.includes("UNIQUE constraint failed: usuario.usuario")) {
                        return new Response(JSON.stringify({ error: "Este NOME de usuario já está cadastrado no sistema!" }), {
                            status: 400,
                            headers: corsHeaders,
                        });
                    }
            
                    return new Response(JSON.stringify({ error: "Erro ao atualizar usuário", details: (error as Error).message }), {
                        status: 500,
                        headers: corsHeaders,
                    });
                }
            }

            if (method === "DELETE" && pathname.startsWith("/api/usuario/")) {
                const id = parseInt(pathname.split("/")[3]);
                await this.usuarioRepository.deleteById(id);
                return new Response(JSON.stringify({ message: "Usuário excluído com sucesso!" }), { status: 200, headers: corsHeaders });
            }

            if (method === "PATCH" && pathname.startsWith("/api/usuario/") && pathname.endsWith("/status")) {
                const id = parseInt(pathname.split("/")[3]);
                const body: Usuario = await req.json();

                if (!id || isNaN(id)) {
                    return new Response(JSON.stringify({ error: "ID inválido!" }), { status: 400, headers: corsHeaders });
                }

                if (typeof body.ativo !== "boolean") {
                    return new Response(JSON.stringify({ error: "O campo 'ativo' deve ser um booleano (true/false)!" }), { status: 400, headers: corsHeaders });
                }

                await this.usuarioRepository.updateStatus(id, body.ativo);
                return new Response(JSON.stringify({ message: `Usuário ${body.ativo ? "ativado" : "inativado"} com sucesso!` }), { status: 200, headers: corsHeaders });
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
}
