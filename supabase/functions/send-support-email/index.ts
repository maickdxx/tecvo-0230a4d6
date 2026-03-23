import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SupportEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: SupportEmailRequest = await req.json();

    console.log("Received support email request:", { name, email, subject });

    if (!name || !email || !subject || !message) {
      throw new Error("Todos os campos são obrigatórios");
    }

    // Send email to support team
    const emailResponse = await resend.emails.send({
      from: "Suporte Tecvo <contato@tecvo.com.br>",
      to: ["michaeldouglas7991@gmail.com"],
      replyTo: email,
      subject: `[Suporte Tecvo] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D47A1;">Nova mensagem de suporte — Tecvo</h2>
          <hr style="border: 1px solid #eee;">
          
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Assunto:</strong> ${subject}</p>
          
          <h3 style="color: #333; margin-top: 20px;">Mensagem:</h3>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          
          <hr style="border: 1px solid #eee; margin-top: 30px;">
          <p style="color: #888; font-size: 12px;">
            Esta mensagem foi enviada através do formulário de suporte da Tecvo.
          </p>
        </div>
      `,
    });

    console.log("Support email sent successfully:", emailResponse);

    // Send confirmation email to user
    await resend.emails.send({
      from: "Tecvo <contato@tecvo.com.br>",
      to: [email],
      subject: "Recebemos sua mensagem — Tecvo",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D47A1;">Olá, ${name}!</h2>
          
          <p>Recebemos sua mensagem e nossa equipe está analisando.</p>
          <p>Responderemos em até <strong>24 horas</strong> através do email: <strong>${email}</strong></p>
          
          <h3 style="color: #333; margin-top: 20px;">Sua mensagem:</h3>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p><strong>Assunto:</strong> ${subject}</p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          
          <p style="margin-top: 20px;">Obrigado por entrar em contato!</p>
          <p>Equipe Tecvo</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-support-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
