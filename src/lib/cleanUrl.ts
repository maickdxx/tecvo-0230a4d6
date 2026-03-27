/**
 * Strips technical query parameters from URLs for clean display.
 * Keeps the full URL in the database for debugging.
 */

const PARAMS_TO_STRIP = [
  '_lovable_token',
  'lovable_token',
  'token',
  'access_token',
  'refresh_token',
  'code',
  'state',
  'nonce',
  'session_id',
];

/**
 * Returns only the pathname from a URL or path string,
 * removing all query parameters and hashes with tokens.
 */
export function cleanDisplayUrl(urlOrPath: string | null | undefined): string {
  if (!urlOrPath) return '';
  
  try {
    // If it's a full URL, extract pathname
    if (urlOrPath.startsWith('http')) {
      const url = new URL(urlOrPath);
      return url.pathname || '/';
    }
    
    // If it's a path with query params, strip them
    const questionMark = urlOrPath.indexOf('?');
    const hashMark = urlOrPath.indexOf('#');
    
    let cleanPath = urlOrPath;
    if (questionMark !== -1) {
      cleanPath = urlOrPath.substring(0, questionMark);
    } else if (hashMark !== -1) {
      cleanPath = urlOrPath.substring(0, hashMark);
    }
    
    return cleanPath || '/';
  } catch {
    // Fallback: just strip everything after ? or #
    const idx = Math.min(
      urlOrPath.indexOf('?') === -1 ? Infinity : urlOrPath.indexOf('?'),
      urlOrPath.indexOf('#') === -1 ? Infinity : urlOrPath.indexOf('#')
    );
    return idx === Infinity ? urlOrPath : urlOrPath.substring(0, idx) || '/';
  }
}

/**
 * Friendly page name from a path
 */
export function getPageName(path: string | null | undefined, title?: string | null): string {
  if (title) return title;
  
  const clean = cleanDisplayUrl(path);
  if (!clean || clean === '/') return 'Página Inicial';
  
  const segment = clean.split('/').filter(Boolean).pop() || '';
  const names: Record<string, string> = {
    'precos': 'Preços',
    'cadastro': 'Cadastro',
    'login': 'Login',
    'signup': 'Cadastro',
    'register': 'Cadastro',
    'pricing': 'Preços',
    'contato': 'Contato',
    'sobre': 'Sobre',
    'termos': 'Termos de Uso',
    'privacidade': 'Política de Privacidade',
  };
  
  return names[segment.toLowerCase()] || segment.charAt(0).toUpperCase() + segment.slice(1);
}
