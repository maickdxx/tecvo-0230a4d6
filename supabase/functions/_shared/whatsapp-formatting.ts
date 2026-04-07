/**
 * WhatsApp text formatting utilities.
 */

/**
 * Convert markdown formatting to WhatsApp formatting.
 */
export function markdownToWhatsApp(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, "").trim());
}
