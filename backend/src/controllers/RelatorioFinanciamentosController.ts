import { RelatorioFinanciamentosRepository, FiltrosRelatorioFinanciamentos } from '../repositories/RelatorioFinanciamentosRepository';

export class RelatorioFinanciamentosController {
  constructor(private repository: RelatorioFinanciamentosRepository) {}

  async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const { method } = req;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (method === "GET" && pathname === "/api/relatorio/financiamentos") {
        const filtros: FiltrosRelatorioFinanciamentos = {};
        
        // Parse dos filtros da query string
        const mesVencimento = url.searchParams.get("mesVencimento");
        if (mesVencimento) filtros.mesVencimento = parseInt(mesVencimento);

        const anoVencimento = url.searchParams.get("anoVencimento");
        if (anoVencimento) filtros.anoVencimento = parseInt(anoVencimento);

        const idBanco = url.searchParams.get("idBanco");
        if (idBanco) filtros.idBanco = parseInt(idBanco);

        const idPessoa = url.searchParams.get("idPessoa");
        if (idPessoa) filtros.idPessoa = parseInt(idPessoa);

        const numeroGarantia = url.searchParams.get("numeroGarantia");
        if (numeroGarantia) filtros.numeroGarantia = numeroGarantia;

        const modalidade = url.searchParams.get("modalidade");
        if (modalidade && ['INVESTIMENTO', 'CUSTEIO', 'PARTICULAR'].includes(modalidade)) {
          filtros.modalidade = modalidade as 'INVESTIMENTO' | 'CUSTEIO' | 'PARTICULAR';
        }

        const dataContratoInicio = url.searchParams.get("dataContratoInicio");
        if (dataContratoInicio) filtros.dataContratoInicio = dataContratoInicio;

        const dataContratoFim = url.searchParams.get("dataContratoFim");
        if (dataContratoFim) filtros.dataContratoFim = dataContratoFim;

        const faixaJuros = url.searchParams.get("faixaJuros");
        if (faixaJuros && ['<=8', '>8<=10', '>10<=12', '>12<=15', '>15'].includes(faixaJuros)) {
          filtros.faixaJuros = faixaJuros;
        }

        const data = await this.repository.getRelatorioFinanciamentos(filtros);
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({ error: "Rota não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Erro no controller:", error);
      return new Response(
        JSON.stringify({
          error: "Erro no servidor",
          details: error instanceof Error ? error.message : "Erro desconhecido"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
}

