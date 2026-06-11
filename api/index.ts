import express from "express";
import axios from "axios";

const app = express();
app.use(express.json({ limit: '10mb' }));

const BEMMELHOR_BASE_URL = "https://service.bemmelhor.com.br/api/integrations/v1";

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Adarco Inside Sales API is Active" });
});

/**
 * GET /api/calls
 * Busca dados da API Bem Melhor e formata para o Dashboard com paginação total.
 */
app.get("/api/calls", async (req, res) => {
  const apiKey = process.env.BEMMELHOR_API_KEY;
  const { start, end } = req.query;

  if (!apiKey) {
    return res.status(500).json({ 
      error: "BEMMELHOR_API_KEY não configurada no ambiente." 
    });
  }

  const allCalls: any[] = [];
  const limit = 100;
  let currentPage = 1;
  let hasMore = true;

  // Headers base
  const headers: any = { 
    'x-api-key': apiKey,
    'Accept': 'application/json' 
  };
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    headers['Authorization'] = apiKey;
    delete headers['x-api-key'];
  }

  try {
    console.log(`[API] Iniciando extração total: start=${start}, end=${end}`);

    while (hasMore) {
      try {
        const queryParams = {
          page: currentPage,
          limit: limit,
          // Enviamos ambos os formatos para garantir compatibilidade com variações da API
          startDate: typeof start === 'string' ? start.split('T')[0] : start,
          endDate: typeof end === 'string' ? end.split('T')[0] : end,
          start_date: typeof start === 'string' ? start.split('T')[0] : start,
          end_date: typeof end === 'string' ? end.split('T')[0] : end
        };

        console.log(`[API] Pag ${currentPage} Request:`, JSON.stringify(queryParams));

        const response = await axios.get(`${BEMMELHOR_BASE_URL}/calls`, {
          headers,
          params: queryParams,
          timeout: 20000 // 20s de timeout por página
        });

        let pageData: any[] = [];
        if (Array.isArray(response.data)) {
          pageData = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          pageData = response.data.data;
        } else if (response.data && response.data.calls && Array.isArray(response.data.calls)) {
          pageData = response.data.calls;
        }

        if (pageData.length === 0) {
          hasMore = false;
        } else {
          // Log diagnóstico do primeiro item para verificar campos reais
          if (currentPage === 1 && pageData[0]) {
            console.log(`[API] Raw Item:`, JSON.stringify(pageData[0]));
          }
          
          allCalls.push(...pageData);
          console.log(`[API] Página ${currentPage} extraída (${pageData.length} itens). Total: ${allCalls.length}`);
          
          if (pageData.length < limit) {
            hasMore = false;
          } else {
            currentPage++;
            // Limite de segurança de 150 páginas
            if (currentPage > 150) {
              console.warn("[API] Limite de segurança de 150 páginas atingido.");
              hasMore = false;
            }
          }
        }
      } catch (innerError: any) {
        console.error(`[API] Erro na extração da página ${currentPage}:`, innerError.message);
        throw {
          isPaginationError: true,
          page: currentPage,
          status: innerError.response?.status || 500,
          detail: innerError.response?.data?.message || innerError.message,
          totalFetched: allCalls.length
        };
      }
    }

    // Função auxiliar para extrair o ramal (números entre parênteses ou apenas números)
    const extractExtension = (str: any): string => {
      if (!str) return "";
      const s = String(str);
      // Busca (6007)
      const matchParens = s.match(/\((\d+)\)/);
      if (matchParens) return matchParens[1];
      // Busca apenas números se não houver parênteses
      const matchDigits = s.match(/\d+/);
      return matchDigits ? matchDigits[0] : s;
    };

    // Função auxiliar para converter duração (HH:MM:SS ou segundos) em segundos puros
    const parseDuration = (d: any): number => {
      if (!d) return 0;
      if (typeof d === 'number') return d;
      const str = String(d);
      if (str.includes(':')) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
      }
      return parseInt(str) || 0;
    };

    // Enviamos o array bruto para o frontend fazer a normalização conforme regra de negócio
    res.json(allCalls);
  } catch (error: any) {
    if (error.isPaginationError) {
      return res.status(error.status).json({
        error: "Falha na Extração de Dados (Paginação)",
        message: `Não foi possível extrair a página ${error.page} da API Bem Melhor.`,
        detail: error.detail,
        page: error.page,
        partialCount: error.totalFetched
      });
    }

    const status = error.response?.status || 500;
    const detail = error.response?.data?.message || error.response?.data?.error || error.message;
    
    console.error("[API] Erro Crítico Bem Melhor:", {
      status,
      detail,
      data: error.response?.data
    });

    res.status(status).json({ 
      error: "Erro de Conexão com a API Bem Melhor",
      detail: detail,
      code: error.code,
      message: "Verifique se a BEMMELHOR_API_KEY está correta nas configurações."
    });
  }
});

export default app;
