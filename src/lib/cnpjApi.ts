import { supabase } from "@/integrations/supabase/client";

export interface CnpjResponse {
  nome: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  status: string;
}

export async function fetchCnpjData(cnpj: string): Promise<CnpjResponse | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;

  try {
    const { data, error } = await supabase.functions.invoke("cnpj-lookup", {
      body: { cnpj: clean },
    });

    if (error) {
      console.error("CNPJ lookup invoke error:", error);
      throw error;
    }

    if (!data || data.status === "ERROR") {
      console.warn("ReceitaWS returned ERROR:", data?.message);
      return null;
    }

    return data as CnpjResponse;
  } catch (err) {
    console.error("Erro ao consultar CNPJ:", err);
    throw err;
  }
}

export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
