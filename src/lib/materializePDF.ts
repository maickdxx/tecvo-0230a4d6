/**
 * Materializes a PDF in storage after creating/editing an OS, quote, or laudo.
 * This ensures the PDF exists for Laura to send via WhatsApp without manual intervention.
 * Runs silently in the background — never blocks the UI.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Materializes the OS/Quote PDF in storage after create/edit.
 * Fetches all data needed, generates the PDF, and uploads it.
 */
export async function materializeServicePDF(serviceId: string, organizationId: string) {
  try {
    console.log("[MATERIALIZE] Starting PDF materialization for service:", serviceId);

    // Fetch service with client
    const { data: service, error: svcErr } = await supabase
      .from("services")
      .select("*, client:clients(*)")
      .eq("id", serviceId)
      .single();

    if (svcErr || !service) {
      console.warn("[MATERIALIZE] Service not found:", serviceId, svcErr?.message);
      return;
    }

    // Fetch organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    // Fetch service items
    const { data: items } = await supabase
      .from("service_items")
      .select("*")
      .eq("service_id", serviceId);

    // Fetch equipment
    const { data: equipment } = await supabase
      .from("service_equipment")
      .select("*")
      .eq("service_id", serviceId);

    // Fetch assigned profile name
    let assignedProfileName: string | undefined;
    if (service.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", service.assigned_to)
        .single();
      assignedProfileName = profile?.full_name || undefined;
    }

    // Fetch client signature
    const { data: sigData } = await supabase
      .from("service_signatures")
      .select("signature_url")
      .eq("service_id", serviceId)
      .maybeSingle();

    // Compute total from items
    const itemsTotal = (items || []).reduce((sum: number, item: any) => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      const discount = item.discount || 0;
      const discountType = item.discount_type || "percentage";
      const lineTotal = qty * price;
      const discountAmt = discountType === "percentage" ? lineTotal * (discount / 100) : discount;
      return sum + (lineTotal - discountAmt);
    }, 0);

    const { generateServiceOrderPDF } = await import("@/lib/generateServiceOrderPDF");
    const { formatDateInTz, formatTimeInTz } = await import("@/lib/timezone");

    // Use default timezone
    const tz = org?.timezone || "America/Sao_Paulo";

    const orderData = {
      entryDate: service.entry_date ? formatDateInTz(service.entry_date, tz) : "",
      entryTime: service.entry_date ? formatTimeInTz(service.entry_date, tz) : "",
      exitDate: service.exit_date ? formatDateInTz(service.exit_date, tz) : "",
      exitTime: service.exit_date ? formatTimeInTz(service.exit_date, tz) : "",
      equipmentType: service.equipment_type || "",
      equipmentBrand: service.equipment_brand || "",
      equipmentModel: service.equipment_model || "",
      solution: service.solution || service.description || "",
      paymentMethod: service.payment_method || "",
      paymentDueDate: service.payment_due_date ? formatDateInTz(service.payment_due_date, tz) : "",
      paymentNotes: service.payment_notes || "",
    };

    // Generate PDF as blob (this also uploads to storage internally)
    await generateServiceOrderPDF({
      service: {
        ...service,
        value: itemsTotal > 0 ? itemsTotal : service.value,
        assigned_profile: assignedProfileName ? { full_name: assignedProfileName } : null,
      } as any,
      items: (items || []) as any,
      equipmentList: equipment || [],
      organizationName: org?.name || "Minha Empresa",
      organizationCnpj: org?.cnpj_cpf || undefined,
      organizationPhone: org?.phone || undefined,
      organizationEmail: org?.email || undefined,
      organizationAddress: org?.address || undefined,
      organizationLogo: org?.logo_url || undefined,
      organizationWebsite: org?.website || undefined,
      organizationZipCode: org?.zip_code || undefined,
      organizationCity: org?.city || undefined,
      organizationState: org?.state || undefined,
      organizationSignature: org?.signature_url || undefined,
      autoSignatureOS: org?.auto_signature_os ?? false,
      clientSignatureUrl: sigData?.signature_url || undefined,
      orderData,
      isFreePlan: false,
      returnBlob: true, // Don't trigger download, just generate and upload
    });

    console.log("[MATERIALIZE] Service PDF materialized successfully:", serviceId);
  } catch (err) {
    console.warn("[MATERIALIZE] Failed to materialize service PDF:", serviceId, err);
  }
}

/**
 * Materializes the Laudo Técnico PDF in storage after create/edit.
 */
export async function materializeReportPDF(reportId: string, organizationId: string) {
  try {
    console.log("[MATERIALIZE] Starting PDF materialization for report:", reportId);

    // Fetch report with client
    const { data: report, error: repErr } = await supabase
      .from("technical_reports")
      .select("*, client:clients(*), service:services(*)")
      .eq("id", reportId)
      .single();

    if (repErr || !report) {
      console.warn("[MATERIALIZE] Report not found:", reportId, repErr?.message);
      return;
    }

    // Fetch organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    // Fetch equipment
    const { data: equipment } = await supabase
      .from("report_equipment")
      .select("*")
      .eq("report_id", reportId);

    // Fetch photos
    const { data: photos } = await supabase
      .from("technical_report_photos")
      .select("*")
      .eq("report_id", reportId);

    // Fetch signature
    const { data: sigData } = await supabase
      .from("service_signatures")
      .select("signature_url, signer_name, signed_at, ip_address")
      .eq("service_id", report.service_id || report.quote_service_id || "")
      .maybeSingle();

    const { generateReportPDF } = await import("@/lib/generateReportPDF");

    await generateReportPDF({
      report: report as any,
      equipment: (equipment || []) as any,
      photos: (photos || []) as any,
      organizationName: org?.name || "Minha Empresa",
      organizationCnpj: org?.cnpj_cpf || undefined,
      organizationPhone: org?.phone || undefined,
      organizationEmail: org?.email || undefined,
      organizationAddress: org?.address || undefined,
      organizationLogo: org?.logo_url || undefined,
      organizationCity: org?.city || undefined,
      organizationState: org?.state || undefined,
      signature: sigData || null,
      returnBlob: true, // Don't trigger download, just generate and upload
    });

    console.log("[MATERIALIZE] Report PDF materialized successfully:", reportId);
  } catch (err) {
    console.warn("[MATERIALIZE] Failed to materialize report PDF:", reportId, err);
  }
}
