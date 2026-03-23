import { getCorsHeaders } from "../_shared/cors.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromReceitaWS(clean: string) {
  const url = `https://www.receitaws.com.br/v1/cnpj/${clean}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);

    if (response.status === 429 && attempt < 3) {
      await sleep(500 * attempt);
      continue;
    }

    return { response, data };
  }

  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const { cnpj } = await req.json();
    const clean = (cnpj || "").replace(/\D/g, "");

    if (clean.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const result = await fetchFromReceitaWS(clean);

    if (!result) {
      return new Response(JSON.stringify({ error: "Falha ao consultar CNPJ" }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    const { response, data } = result;

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Limite temporário da consulta de CNPJ. Tente novamente em instantes." }),
        {
          status: 429,
          headers: jsonHeaders,
        },
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ status: "ERROR", message: data?.message ?? "Erro ao consultar CNPJ" }),
        {
          status: 502,
          headers: jsonHeaders,
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("Erro interno cnpj-lookup:", err);
    return new Response(JSON.stringify({ error: "Erro ao consultar CNPJ" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
