
/**
 * Formats a WhatsApp message content by:
 * 1. Escaping HTML characters for safety (XSS prevention)
 * 2. Detecting and converting URLs into clickable links
 * 3. Applying WhatsApp formatting (*bold*, _italic_, ~strikethrough~)
 */
export function formatWhatsAppMessage(content: string, isMe: boolean = false): string {
  if (!content) return "";

  // 1. Basic HTML sanitization to prevent XSS
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
    
    // We also exclude WhatsApp formatting characters (*, _, ~) from the end of the URL
    // so they can be processed by the markdown step later
    const trailingPunctuation = /[.,!?;:*_~]+$/;
    const punctuationMatch = match.match(trailingPunctuation);
    
    if (punctuationMatch) {
      cleanUrl = match.substring(0, match.length - punctuationMatch[0].length);
      suffix = punctuationMatch[0];
    }

    let href = cleanUrl;
    if (cleanUrl.toLowerCase().startsWith("www.")) {
      href = `https://${cleanUrl}`;
    }

    // Link styling: blue for both sent and received (both have light backgrounds now)
    const linkColorClass = "text-blue-600 dark:text-blue-400 hover:underline underline-offset-2";

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkColorClass} break-all transition-colors">${cleanUrl}</a>${suffix}`;
  });

  // 3. WhatsApp markdown formatting
  // Using \b or similar wouldn't work well with the HTML tags already present
  // but since we escaped everything and linkified URLs into <a> tags, 
  // these regexes will only match markdown outside of the <a> tags or correctly nested.
  formatted = formatted
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");

  return formatted;
}
