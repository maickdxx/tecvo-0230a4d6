// Shared CORS configuration for all edge functions
// Restricts access to known application domains only

const ALLOWED_ORIGINS = [
  "https://tecnico-pro.lovable.app",
  "https://id-preview--2582d402-8e1c-49ce-8869-e2e510609c62.lovable.app",
  "https://2582d402-8e1c-49ce-8869-e2e510609c62.lovableproject.com",
  "https://tecvo.com.br",
  "https://www.tecvo.com.br",
  "http://localhost:5173",
  "http://localhost:8080",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  
  // Check if origin is in allowed list
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0]; // Default to production URL
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Simple helper for static CORS headers (legacy compatibility)
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
