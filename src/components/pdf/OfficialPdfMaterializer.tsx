import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { materializeReportPDF, materializeServicePDF } from "@/lib/materializePDF";
import {
  readOfficialReportPdfStatus,
  readOfficialServicePdfStatus,
} from "@/lib/officialPdfStorage";

const LOOKBACK_HOURS = 72;
const POLL_INTERVAL_MS = 45000;
const MAX_RECENT_SERVICES = 12;
const MAX_RECENT_REPORTS = 8;

export function OfficialPdfMaterializer() {
  const { organizationId } = useAuth();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;

    const scanForMissingOfficialPdfs = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const updatedSince = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

        const { data: services } = await supabase
          .from("services")
          .select("id, organization_id, document_type, updated_at")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("document_type", ["service_order", "quote"])
          .gte("updated_at", updatedSince)
          .order("updated_at", { ascending: false })
          .limit(MAX_RECENT_SERVICES);

        for (const service of services ?? []) {
          if (cancelled) return;

          const status = await readOfficialServicePdfStatus(service.organization_id, service.id);
          if (status.ready) continue;

          console.log("[PDF-WORKER] Repairing missing official service PDF:", {
            serviceId: service.id,
            organizationId: service.organization_id,
            documentType: service.document_type,
            blockReason: status.blockReason,
          });

          try {
            await materializeServicePDF(service.id, service.organization_id);
          } catch (error) {
            console.warn("[PDF-WORKER] Service PDF repair failed:", service.id, error);
          }
        }

        const { data: reports } = await supabase
          .from("technical_reports")
          .select("id, organization_id, updated_at")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("updated_at", updatedSince)
          .order("updated_at", { ascending: false })
          .limit(MAX_RECENT_REPORTS);

        for (const report of reports ?? []) {
          if (cancelled) return;

          const status = await readOfficialReportPdfStatus(report.organization_id, report.id);
          if (status.ready) continue;

          console.log("[PDF-WORKER] Repairing missing official report PDF:", {
            reportId: report.id,
            organizationId: report.organization_id,
            blockReason: status.blockReason,
          });

          try {
            await materializeReportPDF(report.id, report.organization_id);
          } catch (error) {
            console.warn("[PDF-WORKER] Report PDF repair failed:", report.id, error);
          }
        }
      } catch (error) {
        console.warn("[PDF-WORKER] Scan failed:", error);
      } finally {
        runningRef.current = false;
      }
    };

    void scanForMissingOfficialPdfs();

    const intervalId = window.setInterval(() => {
      void scanForMissingOfficialPdfs();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [organizationId]);

  return null;
}