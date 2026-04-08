/**
 * ── MORNING FINANCE SUMMARY ──
 * 
 * Consolidation of yesterday's financial activity.
 * Runs once per day (via cron, e.g., 07:00 or 08:00 BRT).
 * 
 * Complements the daily-finance-summary (evening closing) by capturing
 * late-night movements and providing a reliable morning overview.
 * 
 * RULES:
 * - Only sends to org owners with AI enabled
 * - Respects send window (08:00-20:00)
 * - Max 1 morning summary per org per day
 * - Uses Laura's voice (natural, professional)
 * - Operates under service_role (no auth.uid())
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

function getYesterdayStr(timezone: string): string {
  const now = new Date();
  // Get "today" in org timezone, then subtract 1 day
  const todayInTz = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const yesterday = new Date(todayInTz + "T12:00:00Z"); // noon to avoid DST issues
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

function getTodayStr(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

function buildMorningSummary(
  name: string,
  yesterdayStr: string,
  incomeCount: number,
  incomeTotal: number,
  expenseCount: number,
  expenseTotal: number,
  pendingFromYesterday: number,
  totalPendingAll: number,
  servicesCount: number,
): string {
  const balance = incomeTotal - expenseTotal;
  const balanceSign = balance >= 0 ? "+" : "";

  // Format date as DD/MM
  const [y, m, d] = yesterdayStr.split("-");
  const dateFormatted = `${d}/${m}`;

  let msg = `Bom dia, ${name}! ☀️\n\nAqui está o resumo consolidado de ontem (${dateFormatted}):\n\n`;

  msg += `*Receitas lançadas:* ${formatBRL(incomeTotal)} (${incomeCount})\n`;
  msg += `*Despesas lançadas:* ${formatBRL(expenseTotal)} (${expenseCount})\n`;
  msg += `*Resultado operacional:* ${balanceSign}${formatBRL(balance)}\n`;

  if (servicesCount > 0) {
    msg += `\n📋 ${servicesCount} serviço(s) registrado(s) ontem.\n`;
  }

  if (pendingFromYesterday > 0) {
    msg += `\n⏳ ${pendingFromYesterday} transação(ões) de ontem aguardando aprovação.`;
    if (totalPendingAll > pendingFromYesterday) {
      msg += `\n📊 Total acumulado pendente: ${totalPendingAll}.`;
    }
    msg += `\n\nDeseja que eu:\n1️⃣ Aprove todas\n2️⃣ Mostre item por item\n3️⃣ Mantenha pendente por enquanto`;
  } else if (totalPendingAll > 0) {
    msg += `\n✅ Nenhuma pendência nova de ontem, mas existem *${totalPendingAll} transação(ões) acumulada(s)* aguardando aprovação.`;
  } else {
    msg += `\n✅ Nenhuma pendência financeira. Tudo em dia!`;
  }

  msg += `\n\n— Laura`;
  return msg;
}

function buildNoActivityMessage(name: string, yesterdayStr: string, totalPendingAll: number): string {
  const [, m, d] = yesterdayStr.split("-");
  const dateFormatted = `${d}/${m}`;

  let msg = `Bom dia, ${name}! ☀️\n\nOntem (${dateFormatted}) não houve movimentação financeira registrada.`;

  if (totalPendingAll > 0) {
    msg += `\n\n📊 Mas existem *${totalPendingAll} transação(ões) acumulada(s)* aguardando aprovação. Quer que eu mostre?`;
  } else {
    msg += ` Tudo tranquilo! 👏`;
  }

  msg += `\n\n— Laura`;
  return msg;
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
      console.error("[MORNING-SUMMARY] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[MORNING-SUMMARY] Send error:", err);
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
        const orgTz = org.timezone || "America/Sao_Paulo";
        const yesterdayStr = getYesterdayStr(orgTz);
        const todayStr = getTodayStr(orgTz);

        // Idempotency: check if already sent today for this message_type
        const { data: alreadySent } = await supabase
          .from("auto_message_log")
          .select("id")
          .eq("organization_id", org.id)
          .eq("message_type", "morning_finance_summary")
          .eq("sent_date", todayStr)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          continue; // Already sent today
        }

        // ── Fetch yesterday's transactions (ALL statuses, not just pending) ──
        const { data: yesterdayTxns, error: txnErr } = await supabase
          .from("transactions")
          .select("type, amount, approval_status")
          .eq("organization_id", org.id)
          .eq("date", yesterdayStr)
          .is("deleted_at", null);

        if (txnErr) {
          console.error(`[MORNING-SUMMARY] Query error for org ${org.id}:`, txnErr.message);
          results.push({ org: org.id, status: "error", error: txnErr.message });
          continue;
        }

        const allYesterday = yesterdayTxns || [];
        const incomeItems = allYesterday.filter((t: any) => t.type === "income");
        const expenseItems = allYesterday.filter((t: any) => t.type === "expense");
        const pendingFromYesterday = allYesterday.filter((t: any) => t.approval_status === "pending_approval").length;

        const incomeCount = incomeItems.length;
        const incomeTotal = incomeItems.reduce((s: number, t: any) => s + Number(t.amount), 0);
        const expenseCount = expenseItems.length;
        const expenseTotal = expenseItems.reduce((s: number, t: any) => s + Number(t.amount), 0);

        // Count services executed yesterday
        const { count: servicesCount } = await supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("scheduled_date", yesterdayStr)
          .is("deleted_at", null);

        // Total pending across all time
        const { count: totalPendingAll } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("approval_status", "pending_approval")
          .is("deleted_at", null);

        const totalPending = totalPendingAll || 0;

        // Resolve owner contact
        const owner = await resolveOwnerContact(supabase, org.id);
        if (!owner.phone || !owner.aiEnabled) {
          continue;
        }

        const firstName = owner.fullName?.split(" ")[0] || "Gestor";

        // Build message
        let messageText: string;
        const hasActivity = allYesterday.length > 0 || (servicesCount || 0) > 0;

        if (!hasActivity && totalPending === 0) {
          // No activity yesterday and no pending — skip sending
          results.push({ org: org.id, status: "skipped", reason: "no_activity" });
          continue;
        } else if (!hasActivity) {
          messageText = buildNoActivityMessage(firstName, yesterdayStr, totalPending);
        } else {
          messageText = buildMorningSummary(
            firstName,
            yesterdayStr,
            incomeCount,
            incomeTotal,
            expenseCount,
            expenseTotal,
            pendingFromYesterday,
            totalPending,
            servicesCount || 0,
          );
        }

        // Send guard check
        const guard = await checkSendLimit(supabase, org.id, null, "morning_summary");
        if (!guard.allowed) {
          console.log(`[MORNING-SUMMARY] Org ${org.id} blocked by guard: ${guard.reason}`);
          continue;
        }

        // Check send window — queue if outside hours
        const windowCheck = await checkAndEnqueue({
          supabase,
          organizationId: org.id,
          phone: owner.phone,
          messageContent: messageText,
          messageType: "morning_finance_summary",
          sourceFunction: "morning-finance-summary",
          idempotencyKey: `morning-summary-${org.id}-${todayStr}`,
          timezone: orgTz,
        });

        if (windowCheck.action === "queued") {
          console.log(`[MORNING-SUMMARY] ⏰ Org ${org.id} queued for ${windowCheck.scheduledFor}`);
          await supabase.from("auto_message_log").insert({
            organization_id: org.id,
            message_type: "morning_finance_summary",
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
          message_type: "morning_finance_summary",
          content: messageText,
          send_status: sent ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          sent_date: todayStr,
        });

        results.push({ org: org.id, status: sent ? "sent" : "failed", pending: totalPending });

        if (sent) {
          console.log(`[MORNING-SUMMARY] ✅ Morning summary sent to org ${org.id} (${firstName}) — yesterday: ${allYesterday.length} txns, pending: ${totalPending}`);
        }

        // Small delay between orgs
        await new Promise((r) => setTimeout(r, 2000));
      } catch (orgErr) {
        console.error(`[MORNING-SUMMARY] Error for org ${org.id}:`, orgErr);
        results.push({ org: org.id, status: "error", error: String(orgErr) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[MORNING-SUMMARY] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
