const PAYMENT_METHOD_MAP: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  debit_card: "Cartão de Débito",
  debito: "Cartão de Débito",
  bank_transfer: "Transferência Bancária",
  transferencia: "Transferência Bancária",
};

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "Não informado";

  // Check direct map
  const direct = PAYMENT_METHOD_MAP[method.toLowerCase()];
  if (direct) return direct;

  // Handle credit_card_Nx pattern
  const ccMatch = method.match(/^credit_card_(\d+)x$/i);
  if (ccMatch) return `Cartão de Crédito (${ccMatch[1]}x)`;

  // Fallback: replace underscores, capitalize first letter
  return method
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
