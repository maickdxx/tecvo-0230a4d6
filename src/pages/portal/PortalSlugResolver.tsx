import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalSlugResolver() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) {
      setError("Link inválido.");
      return;
    }

    const resolve = async () => {
      const { data, error: dbError } = await supabase
        .from("client_portal_config")
        .select("organization_id, is_active")
        .eq("slug", slug)
        .maybeSingle();

      if (dbError || !data) {
        setError("Empresa não encontrada.");
        return;
      }

      if (!data.is_active) {
        setError("O portal desta empresa está desativado.");
        return;
      }

      // Store org context for the portal
      sessionStorage.setItem("portal_org_id", data.organization_id);
      sessionStorage.setItem("portal_slug", slug);

      // Forward to login with any existing query params (e.g. token)
      const token = searchParams.get("token");
      const loginPath = token
        ? `/portal/login?token=${token}`
        : "/portal/login";
      navigate(loginPath, { replace: true });
    };

    resolve();
  }, [slug, navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-blue-50/30 p-4">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Ops!</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      <div className="w-full max-w-sm px-4 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="w-20 h-20 rounded-2xl" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}
