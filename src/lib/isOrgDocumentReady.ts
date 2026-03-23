export const REQUIRED_ORG_FIELDS = [
  { key: "name", label: "Nome da empresa" },
  { key: "phone", label: "Telefone" },
  { key: "address", label: "Endereço" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "zip_code", label: "CEP" },
] as const;

export type OrgFieldKey = (typeof REQUIRED_ORG_FIELDS)[number]["key"];

export interface OrgDocumentCheck {
  ready: boolean;
  missingFields: { key: OrgFieldKey; label: string }[];
}

export function isOrgDocumentReady(
  org: Record<string, any> | null | undefined
): OrgDocumentCheck {
  if (!org) {
    return {
      ready: false,
      missingFields: REQUIRED_ORG_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    };
  }

  const missing = REQUIRED_ORG_FIELDS.filter(
    (f) => !org[f.key] || (typeof org[f.key] === "string" && !org[f.key].trim())
  ).map((f) => ({ key: f.key, label: f.label }));

  return { ready: missing.length === 0, missingFields: missing };
}
