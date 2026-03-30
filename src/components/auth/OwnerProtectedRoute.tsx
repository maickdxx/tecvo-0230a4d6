import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface OwnerProtectedRouteProps {
  children: ReactNode;
}

export function OwnerProtectedRoute({ children }: OwnerProtectedRouteProps) {
  const { isOwner, isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Allow both owner and admin roles to access settings
  if (!isOwner && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
