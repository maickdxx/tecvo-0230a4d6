
/**
 * Formats a WhatsApp message content by:
 * 1. Escaping HTML characters for safety (XSS prevention)
 * 2. Detecting and converting URLs into clickable links
 * 3. Applying WhatsApp formatting (*bold*, _italic_, ~strikethrough~)
 */
export function formatWhatsAppMessage(content: string): string {
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

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-500 dark:text-blue-400 hover:underline break-all transition-colors">${cleanUrl}</a>${suffix}`;
  });

  // 3. WhatsApp markdown formatting
  // Note: We do this after links to avoid potential issues with links containing markdown chars
  formatted = formatted
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");

  return formatted;
}
