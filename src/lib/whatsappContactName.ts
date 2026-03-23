/**
 * Returns the display name for a WhatsApp contact following strict priority:
 * 1. Linked client name from Tecvo (highest priority)
 * 2. WhatsApp contact name
 * 3. Phone number
 */
export function getContactDisplayName(contact: {
  name?: string | null;
  phone?: string | null;
  linked_client?: { name: string } | null;
}): string {
  return contact?.linked_client?.name || contact?.name || contact?.phone || "Contato";
}
