
/**
 * Formats a WhatsApp message content by:
 * 1. Escaping HTML characters for safety (XSS prevention)
 * 2. Detecting and converting URLs into clickable links
 * 3. Applying WhatsApp formatting (*bold*, _italic_, ~strikethrough~)
 */
export function formatWhatsAppMessage(content: string, isMe: boolean = false): string {
  if (!content) return "";

  // 1. Basic HTML sanitization
  let formatted = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Detect and format links
  // This matches URLs starting with http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  formatted = formatted.replace(urlRegex, (match) => {
    // Basic cleaning of trailing punctuation that's common in sentences but not part of a URL
    let cleanUrl = match;
    let suffix = "";
    
    // Some URLs might end with characters like . , ! ? that shouldn't be part of the URL in a message
    const trailingPunctuation = /[.,!?;:]+$/;
    const punctuationMatch = match.match(trailingPunctuation);
    
    if (punctuationMatch) {
      cleanUrl = match.substring(0, match.length - punctuationMatch[0].length);
      suffix = punctuationMatch[0];
    }

    let href = cleanUrl;
    if (cleanUrl.toLowerCase().startsWith("www.")) {
      href = `https://${cleanUrl}`;
    }

    // Adjust link color based on whether it's our message or the other person's
    // On our messages (isMe), we use a lighter blue/white-ish if background is primary
    // On received messages, we use the standard blue
    const linkColorClass = isMe 
      ? "text-blue-100 dark:text-blue-200 underline" 
      : "text-blue-600 dark:text-blue-400 hover:underline";

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkColorClass} break-all transition-colors">${cleanUrl}</a>${suffix}`;
  });

  // 3. WhatsApp markdown formatting
  formatted = formatted
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");

  return formatted;
}
