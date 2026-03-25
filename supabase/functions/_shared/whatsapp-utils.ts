/**
 * Centralized WhatsApp utilities for identity normalization and lookup.
 * Handles DDI, JID formats (@s.whatsapp.net, @lid), and group IDs.
 */

export function normalizeDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Normalizes a WhatsApp JID or phone number to a clean digit string for Brazil.
 * Handles adding/removing '55' and the '9' digit if necessary.
 */
export function normalizePhone(raw: string | null | undefined): string {
  let digits = normalizeDigits(raw);
  
  // If it's a JID, strip the suffix
  if (raw?.includes("@")) {
    digits = normalizeDigits(raw.split("@")[0]);
  }

  // Handle Brazil specific normalization if it looks like a BR number
  // Standard BR: 55 + (DDD) + 9 + (8 digits) = 13 digits
  // Or 55 + (DDD) + (8 digits) = 12 digits
  if (digits.length >= 10 && (digits.startsWith("55") || digits.length <= 11)) {
    if (!digits.startsWith("55")) {
      digits = "55" + digits;
    }
    
    // Optional: could handle the '9' digit discrepancy here, 
    // but usually better to keep what we get as long as it has 55.
  }

  return digits;
}

/**
 * Normalizes a JID for storage and comparison.
 * Ensures consistent suffix and handles @lid vs @s.whatsapp.net for non-groups.
 */
export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  
  if (jid.includes("@g.us")) {
    return jid.toLowerCase().trim();
  }
  
  if (jid.includes("@lid") || jid.includes("@s.whatsapp.net")) {
    const [prefix] = jid.split("@");
    // We keep the original prefix but we could consider normalizing it too.
    // However, @lid and @s.whatsapp.net are technically different identities in WA.
    // For Tecvo, we want to treat them as the same if they have the same digits.
    // BUT the whatsapp_id field is unique, so we must decide:
    // Do we store 'digits@s.whatsapp.net' always?
    // If we do, we might break Evolution API's expectation when replying.
    // Recommendation: Keep the JID as provided for 'whatsapp_id', 
    // but ALWAYS use 'normalized_phone' for merging/lookup fallback.
    return jid.toLowerCase().trim();
  }
  
  // If it's just digits, assume @s.whatsapp.net
  if (/^\d+$/.test(jid)) {
    return `${jid}@s.whatsapp.net`;
  }
  
  return jid.toLowerCase().trim();
}

/**
 * Helper to check if two identifiers refer to the same contact.
 */
export function isSameContact(id1: string, id2: string): boolean {
  if (id1 === id2) return true;
  return normalizePhone(id1) === normalizePhone(id2);
}
