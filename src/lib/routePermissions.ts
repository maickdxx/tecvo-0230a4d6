/**
 * Precise route matching: matches exactly or as a parent segment.
 * "/financeiro" matches "/financeiro" and "/financeiro/xxx"
 * but NOT "/financeiro-teste" or "/financeiroExtra".
 */
export function matchRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

/**
 * Check if pathname matches any route in the list (precise matching).
 */
export function matchAnyRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => matchRoute(pathname, route));
}

/**
 * Maps routes to the granular permission required to access them.
 * If a user has the listed permission, access is granted regardless of base role.
 * Routes NOT listed here follow structural (role-based) rules.
 */
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  "/financeiro": "finance.view",
  "/contas-pagar": "finance.view",
  "/contas-receber": "finance.view",
  "/financeiro/relatorios": "finance.view",
  "/financeiro/formas-pagamento": "finance.view",
  "/financeiro/categorias": "finance.view",
  "/financeiro/transferencias": "finance.view",
  "/fornecedores": "finance.view",
  "/lixeira": "service.delete",
};

/**
 * Routes that are structurally blocked by role — granular permissions
 * cannot override these. Only specific roles (owner, admin, super_admin)
 * can access them.
 */
export const STRUCTURAL_BLOCKED_ROUTES = ["/admin", "/ia"];

/**
 * Check if a route path can be unlocked by a granular permission.
 * Returns the required permission key, or null if the route is
 * structurally blocked or not in the map.
 */
export function getRoutePermission(pathname: string): string | null {
  for (const [route, permission] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (matchRoute(pathname, route)) {
      return permission;
    }
  }
  return null;
}
