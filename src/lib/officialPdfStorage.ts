import { supabase } from "@/integrations/supabase/client";
import {
  OFFICIAL_SERVICE_PDF_GENERATOR,
  OFFICIAL_SERVICE_PDF_LAYOUT,
} from "@/lib/generateServiceOrderPDF";
import {
  OFFICIAL_REPORT_PDF_GENERATOR,
  OFFICIAL_REPORT_PDF_LAYOUT,
} from "@/lib/generateReportPDF";

const MIN_PDF_BYTES = 1024;

type MarkerData = Record<string, any> | null;

export interface OfficialStoredPdfStatus {
  ready: boolean;
  path: string;
  markerPath: string;
  blockReason?: string;
  markerData?: MarkerData;
  blob?: Blob | null;
  sizeBytes?: number;
  generator?: string | null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function parseMarker(markerBlob?: Blob | null): Promise<MarkerData> {
  if (!markerBlob) return null;

  try {
    return JSON.parse(await markerBlob.text());
  } catch {
    return null;
  }
}

async function validatePdfBlob(pdfBlob?: Blob | null, pdfError?: unknown) {
  if (!pdfBlob || pdfError) {
    return { valid: false, blockReason: "pdf_missing" } as const;
  }

  const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));

  if (!header.startsWith("%PDF-") || bytes.byteLength < MIN_PDF_BYTES) {
    return {
      valid: false,
      blockReason: "pdf_invalid",
      sizeBytes: bytes.byteLength,
    } as const;
  }

  return {
    valid: true,
    sizeBytes: bytes.byteLength,
  } as const;
}

export function getOfficialServicePdfPaths(organizationId: string, serviceId: string) {
  return {
    path: `os-pdfs/${organizationId}/${serviceId}.pdf`,
    markerPath: `os-pdfs/${organizationId}/${serviceId}.official.json`,
  };
}

export function getOfficialReportPdfPaths(organizationId: string, reportId: string) {
  return {
    path: `os-pdfs/${organizationId}/report_${reportId}.pdf`,
    markerPath: `os-pdfs/${organizationId}/report_${reportId}.official.json`,
  };
}

export function isOfficialServicePdfMarker(markerData: MarkerData, serviceId: string) {
  return Boolean(
    markerData &&
      markerData.generator === OFFICIAL_SERVICE_PDF_GENERATOR &&
      markerData.layout === OFFICIAL_SERVICE_PDF_LAYOUT &&
      markerData.service_id === serviceId &&
      markerData.source !== "legacy_official" &&
      !markerData.canonicalized_at,
  );
}

export function isOfficialReportPdfMarker(markerData: MarkerData, reportId: string) {
  return Boolean(
    markerData &&
      markerData.generator === OFFICIAL_REPORT_PDF_GENERATOR &&
      markerData.layout === OFFICIAL_REPORT_PDF_LAYOUT &&
      markerData.report_id === reportId,
  );
}

export async function readOfficialServicePdfStatus(
  organizationId: string,
  serviceId: string,
): Promise<OfficialStoredPdfStatus> {
  const { path, markerPath } = getOfficialServicePdfPaths(organizationId, serviceId);
  const storage = supabase.storage.from("whatsapp-media");

  const [{ data: markerBlob }, { data: pdfBlob, error: pdfError }] = await Promise.all([
    storage.download(markerPath),
    storage.download(path),
  ]);

  const markerData = await parseMarker(markerBlob);

  if (!markerData) {
    return { ready: false, path, markerPath, blockReason: "marker_missing", markerData };
  }

  if (!isOfficialServicePdfMarker(markerData, serviceId)) {
    return {
      ready: false,
      path,
      markerPath,
      blockReason: "marker_invalid",
      markerData,
      generator: markerData.generator || null,
    };
  }

  const pdfValidation = await validatePdfBlob(pdfBlob, pdfError);
  if (!pdfValidation.valid) {
    return {
      ready: false,
      path,
      markerPath,
      blockReason: pdfValidation.blockReason,
      markerData,
      generator: markerData.generator || null,
      sizeBytes: pdfValidation.sizeBytes,
    };
  }

  return {
    ready: true,
    path,
    markerPath,
    markerData,
    blob: pdfBlob,
    sizeBytes: pdfValidation.sizeBytes,
    generator: markerData.generator || null,
  };
}

export async function readOfficialReportPdfStatus(
  organizationId: string,
  reportId: string,
): Promise<OfficialStoredPdfStatus> {
  const { path, markerPath } = getOfficialReportPdfPaths(organizationId, reportId);
  const storage = supabase.storage.from("whatsapp-media");

  const [{ data: markerBlob }, { data: pdfBlob, error: pdfError }] = await Promise.all([
    storage.download(markerPath),
    storage.download(path),
  ]);

  const markerData = await parseMarker(markerBlob);

  if (!markerData) {
    return { ready: false, path, markerPath, blockReason: "marker_missing", markerData };
  }

  if (!isOfficialReportPdfMarker(markerData, reportId)) {
    return {
      ready: false,
      path,
      markerPath,
      blockReason: "marker_invalid",
      markerData,
      generator: markerData.generator || null,
    };
  }

  const pdfValidation = await validatePdfBlob(pdfBlob, pdfError);
  if (!pdfValidation.valid) {
    return {
      ready: false,
      path,
      markerPath,
      blockReason: pdfValidation.blockReason,
      markerData,
      generator: markerData.generator || null,
      sizeBytes: pdfValidation.sizeBytes,
    };
  }

  return {
    ready: true,
    path,
    markerPath,
    markerData,
    blob: pdfBlob,
    sizeBytes: pdfValidation.sizeBytes,
    generator: markerData.generator || null,
  };
}

export async function waitForOfficialServicePdf(
  organizationId: string,
  serviceId: string,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 350;

  let lastStatus = await readOfficialServicePdfStatus(organizationId, serviceId);
  if (lastStatus.ready) return lastStatus;

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    await sleep(delayMs);
    lastStatus = await readOfficialServicePdfStatus(organizationId, serviceId);
    if (lastStatus.ready) return lastStatus;
  }

  return lastStatus;
}

export async function waitForOfficialReportPdf(
  organizationId: string,
  reportId: string,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 350;

  let lastStatus = await readOfficialReportPdfStatus(organizationId, reportId);
  if (lastStatus.ready) return lastStatus;

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    await sleep(delayMs);
    lastStatus = await readOfficialReportPdfStatus(organizationId, reportId);
    if (lastStatus.ready) return lastStatus;
  }

  return lastStatus;
}