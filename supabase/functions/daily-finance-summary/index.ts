/**
 * ── DAILY FINANCE SUMMARY ──
 * 
 * Proactive daily financial closing assistant.
 * Runs once per day (via cron, e.g., 18:00 BRT).
 * 
 * For each org with pending approval transactions:
 * - Calculates daily financial summary
 * - Sends WhatsApp message to org owner via Laura's voice
 * - Logs the send to avoid duplicates
 * 
 * RULES:
 * - Only sends to org owners with AI enabled
 * - Respects send window (08:00-20:00)
 * - Max 1 summary per org per day
 * - Uses Laura's voice (natural, professional)
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { resolveOwnerContact } from "../_shared/resolveOwnerPhone.ts";
import { checkAndEnqueue } from "../_shared/sendWindow.ts";
import { checkSendLimit } from "../_shared/sendGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildSummaryMessage(
  name: string,
  incomeCount: number,
  incomeTotal: number,
  expenseCount: number,
  expenseTotal: number,
  totalPending: number,
): string {
  const balance = incomeTotal - expenseTotal;
  const balanceSign = balance >= 0 ? "+" : "";

  return `Oi ${name}! 📊 Fechamento financeiro do dia:\n\n` +
    `*Receitas lançadas:*\n` +
    `• Total: ${formatBRL(incomeTotal)}\n` +
    `• Quantidade: ${incomeCount}\n\n` +
    `*Despesas lançadas:*\n` +
    `• Total: ${formatBRL(expenseTotal)}\n` +
    `• Quantidade: ${expenseCount}\n\n` +
    `*Saldo operacional do dia:* ${balanceSign}${formatBRL(balance)}\n\n` +
    `📋 ${totalPending} transação(ões) aguardando aprovação financeira.\n\n` +
    `Deseja que eu:\n` +
    `1️⃣ Aprove todas\n` +
    `2️⃣ Mostre item por item\n` +
    `3️⃣ Mantenha pendente por enquanto\n\n` +
    `— Laura`;
}

function buildNoPendingMessage(name: string): string {
  return `Oi ${name}! ✅ Fechamento do dia:\n\nNão há transações pendentes de aprovação financeira. Tudo em dia! 👏\n\n— Laura`;
}

async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${TECVO_PLATFORM_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[FINANCE-SUMMARY] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[FINANCE-SUMMARY] Send error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // Get active paid organizations
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, plan, messaging_paused, timezone")
      .eq("messaging_paused", false)
      .not("plan", "eq", "free");

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ message: "No active orgs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const org of orgs) {
      try {
        // Check if already sent today
        const { data: alreadySent } = await supabase
          .from("auto_message_log")
          .select("id")
          .eq("organization_id", org.id)
          .eq("message_type", "daily_finance_summary")
          .eq("sent_date", todayStr)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          continue; // Already sent today
        }

        // Get pending approval summary for today
        const { data: summary, error: summaryErr } = await supabase.rpc(
          "get_pending_approval_summary",
          { _organization_id: org.id, _date: todayStr },
        );

        if (summaryErr) {
          console.error(`[FINANCE-SUMMARY] RPC error for org ${org.id}:`, summaryErr);
          continue;
        }

        // Also check ALL pending (not just today) for context
        const { data: allPending } = await supabase.rpc(
          "get_pending_approval_summary",
          { _organization_id: org.id },
        );

        const totalPending = allPending?.total_pending || summary?.total_pending || 0;

        // Resolve owner contact
        const owner = await resolveOwnerContact(supabase, org.id);
        if (!owner.phone || !owner.aiEnabled) {
          continue;
        }

        const firstName = owner.fullName?.split(" ")[0] || "Gestor";

        // Build message
        let messageText: string;
        if (totalPending === 0 && (!summary || summary.total_pending === 0)) {
          // No pending transactions at all - send short confirmation
          messageText = buildNoPendingMessage(firstName);
        } else {
          // Has pending - send full summary
          const incomeCount = summary?.pending_income_count || 0;
          const incomeTotal = Number(summary?.pending_income_total || 0);
          const expenseCount = summary?.pending_expense_count || 0;
          const expenseTotal = Number(summary?.pending_expense_total || 0);

          // If today has no pending but there are older ones, adjust message
          if (summary?.total_pending === 0 && totalPending > 0) {
            messageText = `Oi ${firstName}! 📊 Fechamento do dia:\n\nNenhuma transação nova pendente hoje, mas existem *${totalPending} transação(ões) acumuladas* aguardando aprovação.\n\nDeseja que eu mostre o resumo completo?\n\n— Laura`;
          } else {
            messageText = buildSummaryMessage(
              firstName,
              incomeCount,
              incomeTotal,
              expenseCount,
              expenseTotal,
              totalPending,
            );
          }
        }

        // Send guard check
        const guard = await checkSendLimit(supabase, org.id, null, "finance_summary");
        if (!guard.allowed) {
          console.log(`[FINANCE-SUMMARY] Org ${org.id} blocked by guard: ${guard.reason}`);
          continue;
        }

        const orgTz = org.timezone || "America/Sao_Paulo";

        // Check send window — queue if outside hours
        const windowCheck = await checkAndEnqueue({
          supabase,
          organizationId: org.id,
          phone: owner.phone,
          messageContent: messageText,
          messageType: "daily_finance_summary",
          sourceFunction: "daily-finance-summary",
          idempotencyKey: `finance-summary-${org.id}-${todayStr}`,
          timezone: orgTz,
        });

        if (windowCheck.action === "queued") {
          console.log(`[FINANCE-SUMMARY] ⏰ Org ${org.id} queued for ${windowCheck.scheduledFor}`);
          await supabase.from("auto_message_log").insert({
            organization_id: org.id,
            message_type: "daily_finance_summary",
            content: messageText,
            send_status: "queued",
            sent_at: new Date().toISOString(),
            sent_date: todayStr,
          });
          results.push({ org: org.id, status: "queued" });
          continue;
        }

        // Send via WhatsApp
        const sent = await sendWhatsApp(owner.phone, messageText);

        // Log the send
        await supabase.from("auto_message_log").insert({
          organization_id: org.id,
          message_type: "daily_finance_summary",
          content: messageText,
          send_status: sent ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          sent_date: todayStr,
        });

        results.push({ org: org.id, status: sent ? "sent" : "failed", pending: totalPending });

        if (sent) {
          console.log(`[FINANCE-SUMMARY] ✅ Summary sent to org ${org.id} (${firstName}) — ${totalPending} pending`);
        }

        // Small delay between orgs
        await new Promise((r) => setTimeout(r, 2000));
      } catch (orgErr) {
        console.error(`[FINANCE-SUMMARY] Error for org ${org.id}:`, orgErr);
        results.push({ org: org.id, status: "error", error: String(orgErr) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[FINANCE-SUMMARY] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
