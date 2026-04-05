/**
 * Validates that a user belongs to the given organization.
 * Returns true if access is valid, false otherwise.
 * Logs denied attempts for security auditing.
 */
export async function validateUserOrgAccess(
  supabaseAdmin: any,
  userId: string,
  organizationId: string,
  functionName: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    // Log the denied access attempt
    try {
      await supabaseAdmin.from("data_audit_log").insert({
        organization_id: organizationId,
        user_id: userId,
        table_name: functionName,
        operation: "ACCESS_DENIED",
        metadata: {
          reason: "user_not_in_organization",
          attempted_org_id: organizationId,
          function: functionName,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.error(`[SECURITY] Failed to log access denial:`, logErr);
    }

    console.warn(
      `[SECURITY] ACCESS DENIED: user=${userId} tried to access org=${organizationId} via ${functionName}`
    );
    return false;
  }

  return true;
}

/**
 * Returns a 403 Response for denied access.
 */
export function accessDeniedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Acesso negado: você não pertence a esta organização." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
