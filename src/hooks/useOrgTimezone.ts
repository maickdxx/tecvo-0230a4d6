import { useOrganization } from "./useOrganization";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

/**
 * Returns the IANA timezone configured for the current organization.
 * Falls back to America/Sao_Paulo if not set.
 */
export function useOrgTimezone(): string {
  const { organization } = useOrganization();
  return organization?.timezone || DEFAULT_TIMEZONE;
}
