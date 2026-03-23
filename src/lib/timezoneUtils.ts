/**
 * Maps Brazilian states to their IANA timezone identifiers.
 * Used to automatically determine timezone from the company's registered address.
 */

const STATE_TIMEZONE_MAP: Record<string, string> = {
  // UTC-5: Acre
  AC: "America/Rio_Branco",
  // UTC-4: Amazonas, Roraima, Rondônia
  AM: "America/Manaus",
  RR: "America/Manaus",
  RO: "America/Manaus",
  // UTC-4: Mato Grosso, Mato Grosso do Sul
  MT: "America/Cuiaba",
  MS: "America/Cuiaba",
  // UTC-3: Tocantins, Amapá, Pará, Maranhão (Belém)
  TO: "America/Belem",
  AP: "America/Belem",
  PA: "America/Belem",
  MA: "America/Belem",
  // UTC-2: Fernando de Noronha (PE territory)
  FN: "America/Noronha",
  // UTC-3: All other states (Brasília time)
  SP: "America/Sao_Paulo",
  RJ: "America/Sao_Paulo",
  MG: "America/Sao_Paulo",
  ES: "America/Sao_Paulo",
  PR: "America/Sao_Paulo",
  SC: "America/Sao_Paulo",
  RS: "America/Sao_Paulo",
  BA: "America/Sao_Paulo",
  SE: "America/Sao_Paulo",
  AL: "America/Sao_Paulo",
  PE: "America/Sao_Paulo",
  PB: "America/Sao_Paulo",
  RN: "America/Sao_Paulo",
  CE: "America/Sao_Paulo",
  PI: "America/Sao_Paulo",
  GO: "America/Sao_Paulo",
  DF: "America/Sao_Paulo",
};

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Returns the IANA timezone for a given Brazilian state abbreviation.
 */
export function getTimezoneByState(state: string | null | undefined): string {
  if (!state) return DEFAULT_TIMEZONE;
  return STATE_TIMEZONE_MAP[state.toUpperCase().trim()] || DEFAULT_TIMEZONE;
}

export { DEFAULT_TIMEZONE };
