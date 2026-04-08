/**
 * Laura New Tool Executors — handlers for edit_service, cancel_service,
 * update_client, search_services, search_clients, get_service_equipment.
 * 
 * These are called from executeAdminTool in lauraPrompt.ts.
 */

import { formatBRL } from "./lauraContext.ts";
import { buildTimestampEdge, getDatePartInTz } from "./timezone.ts";
import { logToolSuccess, type ShieldContext } from "./actionShield.ts";

// ─────────────────── edit_service ───────────────────

export async function handleEditService(
  supabase: any,
  organizationId: string,
  args: any,
  ctx: any,
): Promise<string> {
  const { service_id, scheduled_date, value, service_type, description, assigned_to_name, status } = args;
  if (!service_id) return "Erro: service_id é obrigatório.";

  // Verify service exists and belongs to org
  const { data: existing, error: fetchErr } = await supabase
    .from("services")
    .select("id, status, client_id, quote_number")
    .eq("id", service_id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchErr || !existing) return "Erro: serviço não encontrado ou não pertence a esta organização.";
  if (existing.status === "cancelled") return "Erro: não é possível editar um serviço cancelado.";

  const updates: any = {};
  const changes: string[] = [];

  if (scheduled_date) {
    const tz = ctx?.timezone || "America/Sao_Paulo";
    updates.scheduled_date = buildTimestampEdge(scheduled_date, tz);
    changes.push(`📅 Data: ${new Date(scheduled_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`);
  }
  if (value !== undefined && value !== null) {
    updates.value = value;
    changes.push(`💰 Valor: ${formatBRL(value)}`);
  }
  if (service_type) {
    updates.service_type = service_type;
    changes.push(`🔧 Tipo: ${service_type}`);
  }
  if (description) {
    updates.description = description;
    changes.push(`📝 Descrição: ${description}`);
  }
  if (status) {
    updates.status = status;
    if (status === "completed") updates.completed_date = new Date().toISOString();
    changes.push(`📊 Status: ${status}`);
  }
  if (assigned_to_name) {
    const profiles = ctx?.profiles || [];
    const match = profiles.find((p: any) =>
      p.full_name && p.full_name.toLowerCase().includes(assigned_to_name.toLowerCase())
    );
    if (match) {
      updates.assigned_to = match.user_id;
      changes.push(`👤 Técnico: ${match.full_name}`);
    } else {
      return `Técnico "${assigned_to_name}" não encontrado na equipe.`;
    }
  }

  if (changes.length === 0) return "Nenhuma alteração informada. Informe o que deseja alterar.";

  const { error: updateErr } = await supabase
    .from("services")
    .update(updates)
    .eq("id", service_id)
    .eq("organization_id", organizationId);

  if (updateErr) return `Erro ao editar serviço: ${updateErr.message}`;

  const osNum = String(existing.quote_number || 0).padStart(4, "0");
  await logToolSuccess(supabase, organizationId, "edit_service", args);
  return `✅ OS #${osNum} atualizada!\n\nAlterações:\n${changes.join("\n")}`;
}

// ─────────────────── cancel_service ───────────────────

export async function handleCancelService(
  supabase: any,
  organizationId: string,
  args: any,
  ctx: any,
): Promise<string> {
  const { service_id, reason, confirmed } = args;
  if (!service_id) return "Erro: service_id é obrigatório.";

  const { data: existing } = await supabase
    .from("services")
    .select("id, status, quote_number, description, value, client_id")
    .eq("id", service_id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) return "Erro: serviço não encontrado ou não pertence a esta organização.";
  if (existing.status === "cancelled") return "Este serviço já está cancelado.";

  const osNum = String(existing.quote_number || 0).padStart(4, "0");

  if (!confirmed) {
    return `⚠️ *Confirmação obrigatória*\n\nVocê está prestes a cancelar a *OS #${osNum}*:\n• ${existing.description || "Sem descrição"}\n• Valor: ${formatBRL(existing.value || 0)}\n\nResponda exatamente *CONFIRMAR* para cancelar ou *CANCELAR* para abortar.`;
  }

  const { error: cancelErr } = await supabase
    .from("services")
    .update({ status: "cancelled", deleted_at: new Date().toISOString() })
    .eq("id", service_id)
    .eq("organization_id", organizationId);

  if (cancelErr) return `Erro ao cancelar serviço: ${cancelErr.message}`;

  await logToolSuccess(supabase, organizationId, "cancel_service", args);
  return `❌ OS #${osNum} cancelada com sucesso.${reason ? `\nMotivo: ${reason}` : ""}`;
}

// ─────────────────── update_client ───────────────────

export async function handleUpdateClient(
  supabase: any,
  organizationId: string,
  args: any,
): Promise<string> {
  let { client_id, client_name, name, phone, email, address } = args;

  // Resolve client by name if no ID
  if (!client_id && client_name) {
    const { data: matches } = await supabase
      .from("clients")
      .select("id, name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .ilike("name", `%${client_name}%`)
      .limit(5);

    if (!matches || matches.length === 0) return `Cliente "${client_name}" não encontrado.`;
    if (matches.length > 1) {
      return `Encontrei ${matches.length} clientes: ${matches.map((c: any) => c.name).join(", ")}. Qual deles?`;
    }
    client_id = matches[0].id;
  }

  if (!client_id) return "Erro: informe o ID ou nome do cliente.";

  const updates: any = {};
  const changes: string[] = [];

  if (name) { updates.name = name; changes.push(`👤 Nome: ${name}`); }
  if (phone) { updates.phone = phone.replace(/\D/g, ""); changes.push(`📱 Telefone: ${phone}`); }
  if (email) { updates.email = email; changes.push(`📧 Email: ${email}`); }
  if (address) { updates.address = address; changes.push(`📍 Endereço: ${address}`); }

  if (changes.length === 0) return "Nenhuma alteração informada.";

  const { error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", client_id)
    .eq("organization_id", organizationId);

  if (error) return `Erro ao atualizar cliente: ${error.message}`;

  await logToolSuccess(supabase, organizationId, "update_client", args);
  return `✅ Cliente atualizado!\n\n${changes.join("\n")}`;
}

// ─────────────────── search_services ───────────────────

export async function handleSearchServices(
  supabase: any,
  organizationId: string,
  args: any,
  ctx: any,
): Promise<string> {
  const { client_name, date_from, date_to, status, service_type, limit: maxItems } = args;
  const resultLimit = Math.min(maxItems || 20, 50);
  const tz = ctx?.timezone || "America/Sao_Paulo";

  let query = supabase
    .from("services")
    .select(`
      id, status, scheduled_date, completed_date, value, description, service_type, 
      quote_number, assigned_to, document_type,
      client:clients!inner(id, name, phone)
    `)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("scheduled_date", { ascending: false })
    .limit(resultLimit);

  if (client_name) {
    query = query.ilike("client.name", `%${client_name}%`);
  }
  if (date_from) query = query.gte("scheduled_date", `${date_from}T00:00:00`);
  if (date_to) query = query.lte("scheduled_date", `${date_to}T23:59:59`);
  if (status) query = query.eq("status", status);
  if (service_type) query = query.eq("service_type", service_type);

  const { data: svcs, error } = await query;
  if (error) return `Erro na busca: ${error.message}`;
  if (!svcs || svcs.length === 0) return "Nenhum serviço encontrado com os filtros informados.";

  const lines = svcs.map((s: any, i: number) => {
    const osNum = String(s.quote_number || 0).padStart(4, "0");
    const docType = s.document_type === "quote" ? "Orç" : "OS";
    const date = s.scheduled_date ? getDatePartInTz(s.scheduled_date, tz) : "—";
    return `${i + 1}. ${docType} #${osNum} | ${s.client?.name || "?"} | ${s.service_type} | ${date} | ${formatBRL(s.value || 0)} | ${s.status}\n   ID: ${s.id}`;
  });

  await logToolSuccess(supabase, organizationId, "search_services", args);
  return `📋 Encontrados ${svcs.length} serviço(s):\n\n${lines.join("\n\n")}`;
}

// ─────────────────── search_clients ───────────────────

export async function handleSearchClients(
  supabase: any,
  organizationId: string,
  args: any,
): Promise<string> {
  const { query: searchQuery, limit: maxItems } = args;
  if (!searchQuery) return "Erro: informe o termo de busca.";

  const resultLimit = Math.min(maxItems || 10, 30);
  const isPhone = /^\d{8,}$/.test(searchQuery.replace(/\D/g, ""));

  let dbQuery = supabase
    .from("clients")
    .select("id, name, phone, email, address, city, state, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(resultLimit);

  if (isPhone) {
    dbQuery = dbQuery.ilike("phone", `%${searchQuery.replace(/\D/g, "")}%`);
  } else if (searchQuery.includes("@")) {
    dbQuery = dbQuery.ilike("email", `%${searchQuery}%`);
  } else {
    dbQuery = dbQuery.ilike("name", `%${searchQuery}%`);
  }

  const { data: clients, error } = await dbQuery;
  if (error) return `Erro na busca: ${error.message}`;
  if (!clients || clients.length === 0) return `Nenhum cliente encontrado para "${searchQuery}".`;

  const lines = clients.map((c: any, i: number) => {
    const addr = [c.address, c.city, c.state].filter(Boolean).join(", ");
    return `${i + 1}. ${c.name}\n   📱 ${c.phone || "—"} | 📧 ${c.email || "—"}${addr ? `\n   📍 ${addr}` : ""}\n   ID: ${c.id}`;
  });

  await logToolSuccess(supabase, organizationId, "search_clients", args);
  return `👥 Encontrados ${clients.length} cliente(s):\n\n${lines.join("\n\n")}`;
}

// ─────────────────── get_service_equipment ───────────────────

export async function handleGetServiceEquipment(
  supabase: any,
  organizationId: string,
  args: any,
): Promise<string> {
  const { service_id } = args;
  if (!service_id) return "Erro: service_id é obrigatório.";

  // Verify service belongs to org
  const { data: svc } = await supabase
    .from("services")
    .select("id, quote_number")
    .eq("id", service_id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!svc) return "Serviço não encontrado ou não pertence a esta organização.";

  const { data: equipment, error } = await supabase
    .from("service_equipment")
    .select("id, brand, model, capacity_btu, equipment_type, location, serial_number")
    .eq("service_id", service_id)
    .eq("organization_id", organizationId);

  if (error) return `Erro ao buscar equipamentos: ${error.message}`;
  if (!equipment || equipment.length === 0) return `OS #${String(svc.quote_number || 0).padStart(4, "0")} não tem equipamentos vinculados.`;

  // Also get report data if available
  const { data: reportData } = await supabase
    .from("equipment_report_data")
    .select("equipment_id, status, problem_identified, work_performed, service_type_performed, checklist")
    .eq("service_id", service_id)
    .eq("organization_id", organizationId);

  const reportMap: Record<string, any> = {};
  for (const r of (reportData || [])) {
    reportMap[r.equipment_id] = r;
  }

  const osNum = String(svc.quote_number || 0).padStart(4, "0");
  const lines = equipment.map((eq: any, i: number) => {
    const report = reportMap[eq.id];
    let line = `${i + 1}. ${eq.brand || "?"} ${eq.model || ""} | ${eq.capacity_btu ? eq.capacity_btu + " BTUs" : "—"} | ${eq.equipment_type || "Split"}`;
    if (eq.location) line += `\n   📍 ${eq.location}`;
    if (eq.serial_number) line += `\n   🔢 SN: ${eq.serial_number}`;
    if (report) {
      line += `\n   📊 Status: ${report.status || "—"}`;
      if (report.problem_identified) line += `\n   🔍 Problema: ${report.problem_identified}`;
      if (report.work_performed) line += `\n   🔧 Trabalho: ${report.work_performed}`;
    }
    return line;
  });

  await logToolSuccess(supabase, organizationId, "get_service_equipment", args);
  return `🏗️ Equipamentos da OS #${osNum} (${equipment.length}):\n\n${lines.join("\n\n")}`;
}
